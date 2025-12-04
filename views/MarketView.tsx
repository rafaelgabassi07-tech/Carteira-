
import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { fetchBrapiQuotes } from '../services/brapiService';
import { fetchAdvancedAssetData, fetchLiveAssetQuote } from '../services/geminiService';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate, usePersistentState } from '../utils';
import RefreshIcon from '../components/icons/RefreshIcon';
import PlusIcon from '../components/icons/PlusIcon';
import GlobeIcon from '../components/icons/GlobeIcon';
import ClockIcon from '../components/icons/ClockIcon';
import TrashIcon from '../components/icons/TrashIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
import SearchIcon from '../components/icons/SearchIcon';
import TransactionModal from '../components/modals/TransactionModal';
import NewsView from './NewsView';
import PortfolioLineChart from '../components/PortfolioLineChart';
import DividendChart from '../components/DividendChart';
import type { ToastMessage, Asset } from '../types';

interface MarketViewProps {
    addToast: (message: string, type?: ToastMessage['type']) => void;
}

interface MarketResult {
    ticker: string;
    price: number;
    change: number;
    history: number[];
    min: number;
    max: number;
    quoteSources?: string[]; // Added for Grounding compliance
    fundamentals?: Partial<Asset> & { marketSentiment?: 'Bullish' | 'Bearish' | 'Neutral' }; 
}

const MARKET_CATEGORIES = [
    { title: "Gigantes da Logística", color: "bg-orange-500", tickers: ["HGLG11", "BTLG11", "XPLG11", "VILG11"] },
    { title: "Shoppings Premium", color: "bg-blue-500", tickers: ["XPML11", "VISC11", "HGBS11", "MALL11"] },
    { title: "Papel & Recebíveis", color: "bg-emerald-500", tickers: ["MXRF11", "KNCR11", "CPTS11", "IRDM11"] },
    { title: "Fiagros (Agro)", color: "bg-lime-600", tickers: ["SNAG11", "VGIA11", "KNCA11", "RZAG11"] }
];

// --- Modern Stat Item Component ---
const StatItem: React.FC<{ label: string; value: React.ReactNode; sub?: string; highlight?: 'green' | 'red' | 'neutral'; className?: string }> = ({ label, value, sub, highlight, className }) => {
    let textColor = 'text-[var(--text-primary)]';
    if (highlight === 'green') textColor = 'text-[var(--green-text)]';
    if (highlight === 'red') textColor = 'text-[var(--red-text)]';

    return (
        <div className={`flex flex-col p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)]/50 justify-center transition-all hover:shadow-md ${className}`}>
            <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider opacity-80">{label}</span>
                {highlight === 'green' && <div className="w-1.5 h-1.5 rounded-full bg-[var(--green-text)] shadow-[0_0_5px_var(--green-text)]"></div>}
                {highlight === 'red' && <div className="w-1.5 h-1.5 rounded-full bg-[var(--red-text)] shadow-[0_0_5px_var(--red-text)]"></div>}
            </div>
            <span className={`text-base font-bold truncate block tracking-tight ${textColor}`}>
                {value}
            </span>
            {sub && <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate block font-medium opacity-70">{sub}</span>}
        </div>
    );
};

const SectionHeader: React.FC<{ title: string, icon?: React.ReactNode }> = ({ title, icon }) => (
    <div className="flex items-center gap-2 mb-3 mt-6 pb-2 border-b border-[var(--border-color)]/50">
        <div className="text-[var(--accent-color)] opacity-80">
            {icon}
        </div>
        <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">{title}</h3>
    </div>
);

const FundamentalSkeleton: React.FC = () => (
    <div className="animate-pulse space-y-4 px-1 pb-5">
        <div className="grid grid-cols-2 gap-3">
            <div className="h-24 bg-[var(--bg-primary)] rounded-2xl opacity-50"></div>
            <div className="h-24 bg-[var(--bg-primary)] rounded-2xl opacity-50"></div>
            <div className="h-24 bg-[var(--bg-primary)] rounded-2xl opacity-50"></div>
            <div className="h-24 bg-[var(--bg-primary)] rounded-2xl opacity-50"></div>
        </div>
        <div className="h-32 bg-[var(--bg-primary)] rounded-2xl opacity-50"></div>
    </div>
);

const MarketView: React.FC<MarketViewProps> = ({ addToast }) => {
    const { t, formatCurrency } = useI18n();
    const { preferences, addTransaction } = usePortfolio();
    
    const [viewMode, setViewMode] = useState<'quotes' | 'news'>('quotes');
    const [expandedDetails, setExpandedDetails] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingFundamentals, setLoadingFundamentals] = useState(false);
    const [result, setResult] = useState<MarketResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    
    const [recentSearches, setRecentSearches] = usePersistentState<string[]>('market_recent_searches', []);
    const initialLoadDone = useRef(false);

    // --- Share Target Logic ---
    useEffect(() => {
        if (initialLoadDone.current) return;
        initialLoadDone.current = true;

        const params = new URLSearchParams(window.location.search);
        const sharedText = params.get('share_q');
        
        if (sharedText) {
            const tickerMatch = sharedText.match(/[A-Za-z]{4}(11|3|4|11B)/);
            const term = tickerMatch ? tickerMatch[0].toUpperCase() : sharedText.trim().toUpperCase();
            
            if (term.length >= 4) {
                setSearchTerm(term);
                // Call search directly instead of relying on state change
                executeSearch(term);
            }
            
            // Clean URL to prevent re-execution on refresh
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }, []);

    const executeSearch = async (term: string) => {
        const cleanTerm = term.trim().toUpperCase();
        if (!cleanTerm || cleanTerm.length < 4) return;
        
        vibrate();
        setLoading(true);
        setLoadingFundamentals(true);
        setError(null);
        setResult(null);
        // Note: setSearchTerm is called by input, but if called programmatically we update it here
        if (searchTerm !== cleanTerm) setSearchTerm(cleanTerm);
        setExpandedDetails(false);

        try {
            // 1. Tentar API Principal (Brapi)
            let marketData: MarketResult | null = null;
            
            try {
                const { quotes } = await fetchBrapiQuotes(preferences, [cleanTerm], false);
                const data = quotes[cleanTerm];
                
                if (data && data.currentPrice > 0) {
                    const historyPrices = data.priceHistory?.map(p => p.price) || [];
                    let change = data.changePercent !== undefined ? data.changePercent : 0;
                    
                    if (change === 0 && historyPrices.length >= 2) {
                        const lastClose = historyPrices[historyPrices.length - 2];
                        change = ((data.currentPrice - lastClose) / lastClose) * 100;
                    }

                    const min = historyPrices.length > 0 ? Math.min(...historyPrices) : data.currentPrice;
                    const max = historyPrices.length > 0 ? Math.max(...historyPrices) : data.currentPrice;

                    marketData = {
                        ticker: cleanTerm,
                        price: data.currentPrice,
                        change: change,
                        history: historyPrices,
                        min,
                        max,
                        fundamentals: undefined
                    };
                }
            } catch (brapiError) {
                console.warn("Brapi failed, trying Gemini fallback...", brapiError);
            }

            // 2. Fallback para Gemini se Brapi falhar
            if (!marketData) {
                const geminiQuote = await fetchLiveAssetQuote(preferences, cleanTerm);
                if (geminiQuote && geminiQuote.price > 0) {
                    marketData = {
                        ticker: cleanTerm,
                        price: geminiQuote.price,
                        change: geminiQuote.change,
                        history: [], // Sem histórico no fallback
                        min: geminiQuote.price,
                        max: geminiQuote.price,
                        fundamentals: undefined,
                        quoteSources: geminiQuote.sources
                    };
                }
            }

            if (marketData) {
                setResult(marketData);
                setLoading(false); // Preço carregado

                setRecentSearches(prev => {
                    const filtered = prev.filter(item => item !== cleanTerm);
                    return [cleanTerm, ...filtered].slice(0, 5);
                });

                // 3. Buscar Fundamentos (Sempre via Gemini)
                try {
                    const advData = await fetchAdvancedAssetData(preferences, [cleanTerm]);
                    const fund = advData.data[cleanTerm];
                    
                    if (fund) {
                        setResult(prev => prev ? ({
                            ...prev,
                            fundamentals: {
                                dy: fund.dy,
                                pvp: fund.pvp,
                                segment: fund.assetType,
                                vacancyRate: fund.vacancyRate,
                                administrator: fund.administrator,
                                lastDividend: fund.lastDividend,
                                netWorth: fund.netWorth,
                                shareholders: fund.shareholders,
                                vpPerShare: fund.vpPerShare,
                                businessDescription: fund.businessDescription,
                                riskAssessment: fund.riskAssessment,
                                marketSentiment: fund.marketSentiment,
                                strengths: fund.strengths,
                                dividendCAGR: fund.dividendCAGR,
                                capRate: fund.capRate,
                                managementFee: fund.managementFee,
                                dividendsHistory: fund.dividendsHistory,
                                sources: fund.sources
                            }
                        }) : null);
                    }
                } catch (err) {
                    console.warn("Failed to fetch fundamentals", err);
                } finally {
                    setLoadingFundamentals(false);
                }

            } else {
                setError('Ativo não encontrado ou serviço indisponível.');
                setLoading(false);
                setLoadingFundamentals(false);
            }
        } catch (e) {
            setError('Erro inesperado. Tente novamente.');
            setLoading(false);
            setLoadingFundamentals(false);
        }
    };

    const handleSearchClick = () => {
        executeSearch(searchTerm);
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') executeSearch(searchTerm);
    };

    const handleAddTransaction = (tx: any) => {
        addTransaction({ ...tx, id: String(Date.now()) });
        addToast(t('toast_transaction_added'), 'success');
        setShowAddModal(false);
    };

    const clearRecent = () => {
        vibrate();
        setRecentSearches([]);
    }

    return (
        <div className="h-full flex flex-col relative overflow-hidden bg-[var(--bg-primary)]">
            {/* Sticky Header with Search */}
            <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border-color)]/50 px-4 pt-4 pb-2 transition-all">
                <div className="max-w-2xl mx-auto w-full">
                    <h1 className="text-xl font-bold mb-4 px-1 flex items-center gap-2">
                        <GlobeIcon className="w-5 h-5 text-[var(--accent-color)]"/> {t('nav_market')}
                    </h1>

                    <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl mb-4 border border-[var(--border-color)] shrink-0 shadow-sm">
                        <button 
                            onClick={() => { setViewMode('quotes'); vibrate(); }}
                            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide ${viewMode === 'quotes' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            Cotações
                        </button>
                        <button 
                            onClick={() => { setViewMode('news'); vibrate(); }}
                            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide ${viewMode === 'news' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            Notícias
                        </button>
                    </div>

                    {viewMode === 'quotes' && (
                        <div className="relative group mb-2">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent-color)] transition-colors pointer-events-none">
                                <SearchIcon className="w-5 h-5" />
                            </div>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                                onKeyDown={handleKeyDown}
                                placeholder="PESQUISAR ATIVO (EX: HGLG11)" 
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl py-3 pl-12 pr-14 text-sm font-bold focus:outline-none focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] transition-all shadow-sm placeholder:text-[var(--text-secondary)]/40 uppercase tracking-wide"
                            />
                            <button
                                onClick={handleSearchClick}
                                disabled={loading}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-primary)] p-1.5 rounded-lg transition-colors disabled:opacity-50 border border-[var(--border-color)]"
                            >
                                {loading ? <RefreshIcon className="w-5 h-5 animate-spin text-[var(--accent-color)]" /> : <ChevronRightIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-24 md:pb-6 landscape-pb-6 scroll-smooth">
                <div className="max-w-2xl mx-auto h-full">
                    {viewMode === 'quotes' ? (
                        <div className="animate-fade-in space-y-6">
                            {result && (
                                <div className="bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] shadow-2xl animate-fade-in-up overflow-hidden">
                                    
                                    {/* HERO SECTION */}
                                    <div className="p-6 bg-gradient-to-br from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-[var(--bg-primary)] border-b border-[var(--border-color)] relative">
                                        <div className="flex justify-between items-start relative z-10">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-3">
                                                    <h2 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter">{result.ticker}</h2>
                                                    {result.fundamentals?.segment && (
                                                        <span className="px-2.5 py-1 rounded-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wide shadow-sm">
                                                            {result.fundamentals.segment}
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">{formatCurrency(result.price)}</span>
                                                    <div className={`flex items-center px-2 py-1 rounded-lg ${result.change >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                        <span className="text-xs font-bold">
                                                            {result.change >= 0 ? '▲' : '▼'} {Math.abs(result.change).toFixed(2)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Sparkline Overlay */}
                                        {result.history.length >= 2 && (
                                            <div className="relative h-24 w-full mt-4 -mb-6 opacity-30">
                                                <PortfolioLineChart data={result.history} isPositive={result.change >= 0} simpleMode={true} />
                                                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)] to-transparent pointer-events-none"></div>
                                            </div>
                                        )}

                                        {/* Grounding Source Display */}
                                        {result.quoteSources && result.quoteSources.length > 0 && (
                                            <div className="mt-4 flex flex-wrap items-center gap-2 opacity-70">
                                                <div className="flex items-center gap-1">
                                                    <GlobeIcon className="w-3 h-3 text-[var(--text-secondary)]" />
                                                    <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">Fontes:</span>
                                                </div>
                                                {result.quoteSources.slice(0, 2).map((src, idx) => {
                                                    try {
                                                        const hostname = new URL(src).hostname.replace('www.', '');
                                                        return (
                                                            <a key={idx} href={src} target="_blank" rel="noopener noreferrer" className="text-[9px] text-[var(--accent-color)] hover:underline truncate max-w-[120px]">
                                                                {hostname}
                                                            </a>
                                                        );
                                                    } catch { return null; }
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* MAIN CONTENT AREA */}
                                    <div className="pt-6 animate-fade-in">
                                        {loadingFundamentals ? (
                                            <FundamentalSkeleton />
                                        ) : (
                                            <div className="px-5 pb-6 space-y-6">
                                                
                                                {/* 1. KEY STATS GRID */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <StatItem 
                                                        label="Dividend Yield (12m)" 
                                                        value={result.fundamentals?.dy ? `${result.fundamentals.dy.toFixed(2)}%` : '-'} 
                                                        highlight={result.fundamentals?.dy && result.fundamentals.dy > 10 ? 'green' : 'neutral'}
                                                    />
                                                    <StatItem 
                                                        label="P/VP" 
                                                        value={result.fundamentals?.pvp?.toFixed(2) ?? '-'} 
                                                        sub={result.fundamentals?.vpPerShare ? `VP: ${formatCurrency(result.fundamentals.vpPerShare)}` : ''} 
                                                        highlight={result.fundamentals?.pvp && result.fundamentals.pvp < 1 ? 'green' : (result.fundamentals?.pvp && result.fundamentals.pvp > 1.2 ? 'red' : 'neutral')}
                                                    />
                                                    <StatItem 
                                                        label="Último Rendimento" 
                                                        value={result.fundamentals?.lastDividend ? formatCurrency(result.fundamentals.lastDividend) : '-'} 
                                                    />
                                                    <StatItem 
                                                        label="Vacância" 
                                                        value={result.fundamentals?.vacancyRate !== undefined ? `${result.fundamentals.vacancyRate}%` : '-'} 
                                                        highlight={result.fundamentals?.vacancyRate && result.fundamentals.vacancyRate > 10 ? 'red' : 'neutral'}
                                                    />
                                                </div>

                                                {/* 2. AI INSIGHT (Clean Design) */}
                                                {(result.fundamentals?.businessDescription || result.fundamentals?.riskAssessment) && (
                                                    <div className="bg-[var(--bg-primary)] p-5 rounded-2xl border border-[var(--border-color)] relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 p-4 opacity-5">
                                                            <SparklesIcon className="w-24 h-24 text-[var(--accent-color)]" />
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-2 mb-3 relative z-10">
                                                            <SparklesIcon className="w-4 h-4 text-[var(--accent-color)]" />
                                                            <span className="text-[10px] font-bold text-[var(--accent-color)] uppercase tracking-wider">Insight IA</span>
                                                        </div>
                                                        
                                                        {result.fundamentals?.businessDescription && (
                                                            <p className="text-xs leading-relaxed text-[var(--text-primary)] font-medium mb-4 relative z-10">
                                                                {result.fundamentals.businessDescription}
                                                            </p>
                                                        )}
                                                        
                                                        {result.fundamentals?.riskAssessment && (
                                                            <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-color)] relative z-10">
                                                                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Risco:</span>
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                                    result.fundamentals.riskAssessment.includes('High') || result.fundamentals.riskAssessment.includes('Alto') 
                                                                    ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                                                                    : (result.fundamentals.riskAssessment.includes('Medium') || result.fundamentals.riskAssessment.includes('Médio') 
                                                                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                                                                        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20')
                                                                }`}>
                                                                    {result.fundamentals.riskAssessment}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* 3. EXPANDABLE DETAILS */}
                                                {expandedDetails && (
                                                    <div className="animate-fade-in-up space-y-6 pt-2 border-t border-[var(--border-color)]/50">
                                                        
                                                        {/* Dividends Chart */}
                                                        <div>
                                                            <SectionHeader title="Histórico de Proventos" icon={<ClockIcon className="w-4 h-4"/>}/>
                                                            {result.fundamentals?.dividendsHistory && result.fundamentals.dividendsHistory.length > 0 ? (
                                                                <div className="bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)]">
                                                                    <div className="h-56"><DividendChart data={result.fundamentals.dividendsHistory} /></div>
                                                                </div>
                                                            ) : <p className="text-center text-xs text-[var(--text-secondary)] py-4 opacity-70">Histórico indisponível</p>}
                                                        </div>

                                                        {/* Secondary Stats */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <StatItem label="Patrimônio Líq." value={result.fundamentals?.netWorth ?? '-'} />
                                                            <StatItem label="Nº Cotistas" value={result.fundamentals?.shareholders ? `${(result.fundamentals.shareholders/1000).toFixed(1)}k` : '-'} />
                                                            <StatItem label="CAGR Dividendos (3A)" value={result.fundamentals?.dividendCAGR ? `${result.fundamentals.dividendCAGR}%` : '-'} highlight={result.fundamentals?.dividendCAGR && result.fundamentals.dividendCAGR > 0 ? 'green' : 'neutral'} />
                                                            <StatItem label="Taxa de Adm." value={result.fundamentals?.managementFee ?? '-'} />
                                                            <StatItem label="Gestão" value={result.fundamentals?.administrator ?? '-'} className="col-span-2" />
                                                        </div>

                                                        {/* Strengths */}
                                                        {result.fundamentals?.strengths && result.fundamentals.strengths.length > 0 && (
                                                            <div>
                                                                <SectionHeader title="Pontos Fortes" icon={<TrendingUpIcon className="w-4 h-4"/>}/>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {result.fundamentals.strengths.map((s, i) => (
                                                                        <span key={i} className="text-[10px] bg-[var(--bg-primary)] border border-[var(--border-color)] px-3 py-1.5 rounded-lg font-bold text-[var(--text-primary)] shadow-sm">{s}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Toggle Button */}
                                                <button 
                                                    onClick={() => setExpandedDetails(!expandedDetails)}
                                                    className="w-full py-3 text-xs font-bold text-[var(--text-secondary)] border border-[var(--border-color)] bg-[var(--bg-primary)] rounded-xl flex items-center justify-center gap-1 hover:bg-[var(--bg-tertiary-hover)] hover:text-[var(--text-primary)] transition-colors"
                                                >
                                                    {expandedDetails ? 'Ocultar Detalhes' : 'Ver Análise Completa'}
                                                    <ChevronRightIcon className={`w-3 h-3 transition-transform duration-300 ${expandedDetails ? '-rotate-90' : 'rotate-90'}`} />
                                                </button>

                                            </div>
                                        )}
                                    </div>

                                    {/* ADD ACTION */}
                                    <div className="p-5 bg-[var(--bg-tertiary-hover)]/30 border-t border-[var(--border-color)] backdrop-blur-sm">
                                        <button 
                                            onClick={() => setShowAddModal(true)}
                                            className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--accent-color)]/20"
                                        >
                                            <PlusIcon className="w-5 h-5" />
                                            Adicionar à Carteira
                                        </button>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl text-center text-sm font-bold animate-fade-in flex flex-col items-center gap-2">
                                    <TrashIcon className="w-6 h-6 mb-1 opacity-50"/>
                                    {error}
                                </div>
                            )}

                            {!result && (
                                <div className="animate-fade-in space-y-8 mt-4">
                                    {recentSearches.length > 0 && (
                                        <div className="mb-6">
                                            <div className="flex justify-between items-center mb-4 px-1">
                                                <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                                                    <ClockIcon className="w-3.5 h-3.5"/> Recentes
                                                </h3>
                                                <button onClick={clearRecent} className="text-[var(--text-secondary)] hover:text-red-400 p-1 transition-colors">
                                                    <TrashIcon className="w-3.5 h-3.5"/>
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {recentSearches.map(term => (
                                                    <button key={term} onClick={() => { setSearchTerm(term); executeSearch(term); }} className="bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] px-4 py-2.5 rounded-xl font-bold text-sm text-[var(--text-primary)] transition-colors active:scale-95 flex items-center gap-2 group">
                                                        {term} <span className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity -mr-1">→</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1 mb-4">Descubra Oportunidades</h3>
                                        {MARKET_CATEGORIES.map((cat, i) => (
                                            <div key={i} className="mb-6">
                                                <div className="flex items-center gap-2 px-1 mb-3">
                                                    <div className={`w-2 h-2 rounded-full ${cat.color} shadow-[0_0_8px_rgba(0,0,0,0.3)]`}></div>
                                                    <span className="text-sm font-bold text-[var(--text-primary)]">{cat.title}</span>
                                                </div>
                                                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
                                                    {cat.tickers.map(t => (
                                                        <button key={t} onClick={() => { setSearchTerm(t); executeSearch(t); }} className="flex-shrink-0 w-32 bg-[var(--bg-secondary)] border border-[var(--border-color)] p-4 rounded-2xl hover:bg-[var(--bg-tertiary-hover)] hover:border-[var(--accent-color)]/30 transition-all active:scale-95 text-left group shadow-sm">
                                                            <span className="block font-black text-sm text-[var(--text-primary)] mb-1">{t}</span>
                                                            <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors font-medium flex items-center gap-1">
                                                                Ver detalhes <ChevronRightIcon className="w-2.5 h-2.5"/>
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 animate-fade-in h-full">
                            <NewsView addToast={addToast} isEmbedded={true} />
                        </div>
                    )}
                </div>
            </div>

            {showAddModal && result && (
                <TransactionModal 
                    onClose={() => setShowAddModal(false)}
                    onSave={handleAddTransaction}
                    initialTicker={result.ticker}
                    addToast={addToast}
                />
            )}
        </div>
    );
};

export default MarketView;
