
import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { fetchBrapiQuotes } from '../services/brapiService';
import { fetchAdvancedAssetData, fetchLiveAssetQuote } from '../services/geminiService';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate, usePersistentState } from '../utils';
import RefreshIcon from '../components/icons/RefreshIcon';
import PlusIcon from '../components/icons/PlusIcon';
import NewsIcon from '../components/icons/NewsIcon';
import GlobeIcon from '../components/icons/GlobeIcon';
import ClockIcon from '../components/icons/ClockIcon';
import TrashIcon from '../components/icons/TrashIcon';
import AnalysisIcon from '../components/icons/AnalysisIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
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
    fundamentals?: Partial<Asset>; 
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
        <div className={`flex flex-col p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] justify-center ${className}`}>
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1 opacity-80">{label}</span>
            <span className={`text-base font-bold truncate block tracking-tight ${textColor}`}>
                {value}
            </span>
            {sub && <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate block font-medium opacity-70">{sub}</span>}
        </div>
    );
};

const SectionHeader: React.FC<{ title: string, icon?: React.ReactNode }> = ({ title, icon }) => (
    <div className="flex items-center gap-2 mb-3 mt-4">
        <div className="p-1.5 bg-[var(--bg-tertiary-hover)] rounded-lg text-[var(--accent-color)]">
            {icon}
        </div>
        <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">{title}</h3>
    </div>
);

const FundamentalSkeleton: React.FC = () => (
    <div className="animate-pulse space-y-4 px-5 pb-5">
        <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-[var(--bg-primary)] rounded-2xl opacity-50"></div>
            <div className="h-20 bg-[var(--bg-primary)] rounded-2xl opacity-50"></div>
            <div className="h-20 bg-[var(--bg-primary)] rounded-2xl opacity-50"></div>
            <div className="h-20 bg-[var(--bg-primary)] rounded-2xl opacity-50"></div>
        </div>
        <div className="h-24 bg-[var(--bg-primary)] rounded-2xl opacity-50"></div>
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

    // --- Share Target Logic ---
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sharedText = params.get('share_q');
        
        if (sharedText) {
            // Smart Ticker Extraction from Shared Text
            // Looks for pattern: 4 letters + (11, 11B, 3, 4) e.g. "Olha o MXRF11 caindo" -> "MXRF11"
            const tickerMatch = sharedText.match(/[A-Za-z]{4}(11|3|4|11B)/);
            
            const term = tickerMatch ? tickerMatch[0].toUpperCase() : sharedText.trim().toUpperCase();
            
            setSearchTerm(term);
            handleSearch(term);
            
            // Clean URL to prevent re-search on reload
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }, []);

    const handleSearch = async (term: string) => {
        const cleanTerm = term.trim().toUpperCase();
        if (!cleanTerm || cleanTerm.length < 4) return;
        
        vibrate();
        setLoading(true);
        setLoadingFundamentals(true);
        setError(null);
        setResult(null);
        setSearchTerm(cleanTerm);
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
                        fundamentals: undefined
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
                                strengths: fund.strengths,
                                dividendCAGR: fund.dividendCAGR,
                                capRate: fund.capRate,
                                managementFee: fund.managementFee,
                                dividendsHistory: fund.dividendsHistory
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch(searchTerm);
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
        <div className="p-4 pb-24 md:pb-6 h-full overflow-y-auto custom-scrollbar landscape-pb-6">
            <div className="max-w-2xl mx-auto h-full flex flex-col">
                <h1 className="text-2xl font-bold mb-4 px-1">{t('nav_market')}</h1>

                <div className="flex bg-[var(--bg-secondary)] p-1 rounded-2xl mb-6 border border-[var(--border-color)] shrink-0 shadow-sm">
                    <button 
                        onClick={() => { setViewMode('quotes'); vibrate(); }}
                        className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wide ${viewMode === 'quotes' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm ring-1 ring-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <GlobeIcon className="w-4 h-4" /> Cotações
                    </button>
                    <button 
                        onClick={() => { setViewMode('news'); vibrate(); }}
                        className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wide ${viewMode === 'news' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm ring-1 ring-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <NewsIcon className="w-4 h-4" /> Notícias
                    </button>
                </div>

                {viewMode === 'quotes' ? (
                    <div className="animate-fade-in space-y-6">
                        
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                                onKeyDown={handleKeyDown}
                                placeholder="Pesquisar FII (ex: MXRF11)"
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl py-4 pl-5 pr-14 text-lg font-bold focus:outline-none focus:border-[var(--accent-color)]/50 transition-all uppercase shadow-sm placeholder:text-[var(--text-secondary)]/50"
                            />
                            <button
                                onClick={() => handleSearch(searchTerm)}
                                disabled={loading}
                                className="absolute right-2 top-2 bottom-2 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--accent-color)] p-3 rounded-xl transition-colors disabled:opacity-50"
                            >
                                <RefreshIcon className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {result && (
                            <div className="bg-[var(--bg-secondary)] rounded-[24px] border border-[var(--border-color)] shadow-xl animate-fade-in-up overflow-hidden">
                                
                                {/* HERO SECTION */}
                                <div className="p-6 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] border-b border-[var(--border-color)]">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter leading-none">{result.ticker}</h2>
                                                {result.fundamentals?.segment && (
                                                    <span className="px-2 py-1 rounded-md bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                                                        {result.fundamentals.segment}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-[var(--text-secondary)] font-medium">
                                                {result.history.length > 0 ? "Cotação em tempo real" : "Cotação via IA (Estimada)"}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end text-right">
                                            <span className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">{formatCurrency(result.price)}</span>
                                            <div className={`flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md ${result.change >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                <span className="text-xs font-bold">
                                                    {result.change >= 0 ? '▲' : '▼'} {Math.abs(result.change).toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Small Sparkline - Only show if we have history (Brapi success) */}
                                    {result.history.length >= 2 ? (
                                        <div className="h-20 w-full mt-6 -mb-2 relative opacity-80">
                                            <PortfolioLineChart data={result.history} isPositive={result.change >= 0} simpleMode={true} />
                                        </div>
                                    ) : (
                                        <div className="h-4 w-full mt-2"></div> 
                                    )}
                                </div>

                                {/* MAIN CONTENT AREA */}
                                <div className="pt-5 animate-fade-in">
                                    {loadingFundamentals ? (
                                        <FundamentalSkeleton />
                                    ) : (
                                        <div className="px-5 pb-6 space-y-6">
                                            
                                            {/* 1. KEY STATS GRID (The "At a Glance" view) */}
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

                                            {/* 2. AI INSIGHT (Unified) */}
                                            {(result.fundamentals?.businessDescription || result.fundamentals?.riskAssessment) && (
                                                <div className="bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)]">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <SparklesIcon className="w-4 h-4 text-[var(--accent-color)]" />
                                                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Análise IA</span>
                                                        
                                                        {result.fundamentals?.riskAssessment && (
                                                            <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                                                result.fundamentals.riskAssessment.includes('High') || result.fundamentals.riskAssessment.includes('Alto') 
                                                                ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                                                                : (result.fundamentals.riskAssessment.includes('Medium') || result.fundamentals.riskAssessment.includes('Médio') 
                                                                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                                                                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20')
                                                            }`}>
                                                                Risco {result.fundamentals.riskAssessment.split('-')[0]}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {result.fundamentals?.businessDescription && (
                                                        <p className="text-xs leading-relaxed text-[var(--text-primary)] font-medium opacity-90 mb-3">
                                                            {result.fundamentals.businessDescription}
                                                        </p>
                                                    )}
                                                    
                                                    {result.fundamentals?.riskAssessment && (
                                                        <p className="text-[10px] leading-relaxed text-[var(--text-secondary)] pt-2 border-t border-[var(--border-color)]">
                                                            <span className="font-bold">Risco:</span> {result.fundamentals.riskAssessment}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* 3. EXPANDABLE DETAILS */}
                                            {expandedDetails && (
                                                <div className="animate-fade-in-up space-y-6 pt-2">
                                                    
                                                    {/* Dividends Chart */}
                                                    <div>
                                                        <SectionHeader title="Histórico de Proventos" icon={<ClockIcon className="w-4 h-4"/>}/>
                                                        {result.fundamentals?.dividendsHistory && result.fundamentals.dividendsHistory.length > 0 ? (
                                                            <div className="bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)]">
                                                                <div className="h-64"><DividendChart data={result.fundamentals.dividendsHistory} /></div>
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
                                                                    <span key={i} className="text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] px-3 py-1.5 rounded-lg font-bold text-[var(--text-primary)]">{s}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Toggle Button */}
                                            <button 
                                                onClick={() => setExpandedDetails(!expandedDetails)}
                                                className="w-full py-3 text-xs font-bold text-[var(--text-secondary)] border border-[var(--border-color)] bg-[var(--bg-primary)] rounded-xl flex items-center justify-center gap-1 hover:bg-[var(--bg-tertiary-hover)] transition-colors"
                                            >
                                                {expandedDetails ? 'Ocultar Análise Completa' : 'Ver Análise Completa'}
                                                <ChevronRightIcon className={`w-3 h-3 transition-transform duration-300 ${expandedDetails ? '-rotate-90' : 'rotate-90'}`} />
                                            </button>

                                        </div>
                                    )}
                                </div>

                                {/* ADD ACTION */}
                                <div className="p-5 bg-[var(--bg-tertiary-hover)]/30 border-t border-[var(--border-color)]">
                                    <button 
                                        onClick={() => setShowAddModal(true)}
                                        className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-[var(--accent-color)]/20"
                                    >
                                        <PlusIcon className="w-5 h-5" />
                                        Adicionar à Carteira
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-center text-sm font-bold animate-fade-in">
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
                                                <button key={term} onClick={() => handleSearch(term)} className="bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] px-4 py-2.5 rounded-xl font-bold text-sm text-[var(--text-primary)] transition-colors active:scale-95 flex items-center gap-2 group">
                                                    {term} <span className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity -mr-1">→</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1 mb-4">Descubra Oportunidades</h3>
                                    {MARKET_CATEGORIES.map((cat, i) => (
                                        <div key={i} className="mb-4">
                                            <div className="flex items-center gap-2 px-1 mb-3">
                                                <div className={`w-2 h-2 rounded-full ${cat.color}`}></div>
                                                <span className="text-sm font-bold text-[var(--text-primary)]">{cat.title}</span>
                                            </div>
                                            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
                                                {cat.tickers.map(t => (
                                                    <button key={t} onClick={() => { setSearchTerm(t); handleSearch(t); }} className="flex-shrink-0 w-32 bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3.5 rounded-2xl hover:bg-[var(--bg-tertiary-hover)] hover:border-[var(--accent-color)]/30 transition-all active:scale-95 text-left group">
                                                        <span className="block font-bold text-sm text-[var(--text-primary)] mb-1">{t}</span>
                                                        <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors font-medium">Ver detalhes →</span>
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
                    <div className="flex-1 animate-fade-in">
                        <NewsView addToast={addToast} />
                    </div>
                )}
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