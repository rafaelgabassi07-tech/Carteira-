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
import AlertTriangleIcon from '../components/icons/AlertTriangleIcon';
import StarIcon from '../components/icons/StarIcon';
import CloseIcon from '../components/icons/CloseIcon';
import TransactionModal from '../components/modals/TransactionModal';
import NewsView from './NewsView';
import PortfolioLineChart from '../components/PortfolioLineChart';
import DividendChart from '../components/DividendChart';
import AIAnalystCard from '../components/AIAnalystCard';
import type { ToastMessage, Asset } from '../types';
import { KNOWN_TICKERS } from '../constants';

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
    fundamentals?: Partial<Asset> & { marketSentiment?: 'Bullish' | 'Bearish' | 'Neutral' }; 
}

const MARKET_CATEGORIES = [
    { title: "Gigantes da Logística", color: "bg-orange-500", tickers: ["HGLG11", "BTLG11", "XPLG11", "VILG11"] },
    { title: "Shoppings Premium", color: "bg-blue-500", tickers: ["XPML11", "VISC11", "HGBS11", "MALL11"] },
    { title: "Papel & Recebíveis", color: "bg-emerald-500", tickers: ["MXRF11", "KNCR11", "CPTS11", "IRDM11"] },
    { title: "Fiagros (Agro)", color: "bg-lime-600", tickers: ["SNAG11", "VGIA11", "KNCA11", "RZAG11"] }
];

const StatItem: React.FC<{ label: string; value: React.ReactNode; sub?: string; highlight?: 'green' | 'red' | 'neutral'; className?: string }> = ({ label, value, sub, highlight, className }) => {
    let textColor = 'text-[var(--text-primary)]';
    if (highlight === 'green') textColor = 'text-[var(--green-text)]';
    if (highlight === 'red') textColor = 'text-[var(--red-text)]';

    return (
        <div className={`flex flex-col p-4 rounded-xl bg-[var(--bg-primary)] justify-center transition-all hover:shadow-md ${className}`}>
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

const SectionHeader: React.FC<{ title: string, icon?: React.ReactNode, className?: string }> = ({ title, icon, className = '' }) => (
    <div className={`flex items-center gap-2 mb-3 pb-2 border-b border-[var(--border-color)]/50 ${className}`}>
        <div className="opacity-80">
            {icon}
        </div>
        <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">{title}</h3>
    </div>
);

const FundamentalSkeleton: React.FC = () => (
    <div className="animate-pulse space-y-4 px-1 pb-5">
        <div className="grid grid-cols-2 gap-3">
            <div className="h-24 bg-[var(--bg-primary)] rounded-xl opacity-50"></div>
            <div className="h-24 bg-[var(--bg-primary)] rounded-xl opacity-50"></div>
            <div className="h-24 bg-[var(--bg-primary)] rounded-xl opacity-50"></div>
            <div className="h-24 bg-[var(--bg-primary)] rounded-xl opacity-50"></div>
        </div>
        <div className="h-32 bg-[var(--bg-primary)] rounded-xl opacity-50"></div>
    </div>
);

const MarketView: React.FC<MarketViewProps> = ({ addToast }) => {
    const { t, formatCurrency } = useI18n();
    const { preferences, addTransaction } = usePortfolio();
    const inputRef = useRef<HTMLInputElement>(null);
    
    const [viewMode, setViewMode] = useState<'quotes' | 'news'>('quotes');
    const [expandedDetails, setExpandedDetails] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingFundamentals, setLoadingFundamentals] = useState(false);
    const [result, setResult] = useState<MarketResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    const [recentSearches, setRecentSearches] = usePersistentState<string[]>('market_recent_searches', []);
    const [favorites, setFavorites] = usePersistentState<string[]>('market_favorites', []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sharedText = params.get('share_q');
        
        if (sharedText) {
            const tickerMatch = sharedText.match(/[A-Za-z]{4}(11|3|4|11B)/);
            const term = tickerMatch ? tickerMatch[0].toUpperCase() : sharedText.trim().toUpperCase();
            
            setSearchTerm(term);
            handleSearch(term);
            
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
        setSuggestions([]);
        setShowSuggestions(false);
        
        // Esconde teclado em mobile
        if (inputRef.current) inputRef.current.blur();

        try {
            let marketData: MarketResult | null = null;
            
            try {
                const { quotes } = await fetchBrapiQuotes(preferences, [cleanTerm], false);
                const data = quotes[cleanTerm];
                if (data && data.currentPrice > 0) {
                    const historyPrices = data.priceHistory?.map(p => p.price) || [];
                    let change = data.changePercent ?? 0;
                    marketData = { ticker: cleanTerm, price: data.currentPrice, change, history: historyPrices, min: Math.min(...historyPrices), max: Math.max(...historyPrices), fundamentals: undefined };
                }
            } catch (brapiError) { console.warn("Brapi failed, trying Gemini...", brapiError); }

            if (!marketData) {
                const geminiQuote = await fetchLiveAssetQuote(preferences, cleanTerm);
                if (geminiQuote && geminiQuote.price > 0) {
                    marketData = { ticker: cleanTerm, price: geminiQuote.price, change: geminiQuote.change, history: [], min: geminiQuote.price, max: geminiQuote.price, fundamentals: undefined };
                }
            }

            if (marketData) {
                setResult(marketData);
                setLoading(false); 
                setRecentSearches(prev => [cleanTerm, ...prev.filter(item => item !== cleanTerm)].slice(0, 5));

                try {
                    const advData = await fetchAdvancedAssetData(preferences, [cleanTerm]);
                    const fund = advData.data[cleanTerm];
                    if (fund) setResult(prev => prev ? ({ ...prev, fundamentals: fund }) : null);
                } catch (err) { console.warn("Failed to fetch fundamentals", err); } finally { setLoadingFundamentals(false); }
            } else {
                setError('Ativo não encontrado ou serviço indisponível.');
                setLoading(false); setLoadingFundamentals(false);
            }
        } catch (e) {
            setError('Erro inesperado. Tente novamente.');
            setLoading(false); setLoadingFundamentals(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.toUpperCase();
        setSearchTerm(val);
        
        if (val.length >= 2) {
            const filtered = KNOWN_TICKERS.filter(t => t.startsWith(val)).slice(0, 5);
            setSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleClearSearch = () => {
        vibrate(5);
        setSearchTerm('');
        setResult(null);
        setError(null);
        setSuggestions([]);
        setShowSuggestions(false);
        if (inputRef.current) inputRef.current.focus();
    };

    const handleSuggestionClick = (ticker: string) => {
        setSearchTerm(ticker);
        handleSearch(ticker);
    };

    const toggleFavorite = (ticker: string) => {
        vibrate();
        setFavorites(prev => {
            if (prev.includes(ticker)) return prev.filter(t => t !== ticker);
            return [...prev, ticker];
        });
    };

    const isFavorite = result ? favorites.includes(result.ticker) : false;

    const handleKeyDown = (e: React.KeyboardEvent) => { 
        if (e.key === 'Enter') {
            setShowSuggestions(false);
            handleSearch(searchTerm); 
        }
    };
    const handleAddTransaction = (tx: any) => { addTransaction({ ...tx, id: String(Date.now()) }); addToast(t('toast_transaction_added'), 'success'); setShowAddModal(false); };
    const clearRecent = () => { vibrate(); setRecentSearches([]); };

    return (
        <div className="h-full flex flex-col relative overflow-hidden bg-[var(--bg-primary)]">
            <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border-color)]/50 px-4 pt-4 pb-2 transition-all">
                <div className="max-w-2xl mx-auto w-full">
                    <h1 className="text-xl font-bold mb-4 px-1 flex items-center gap-2"><GlobeIcon className="w-5 h-5 text-[var(--accent-color)]"/> {t('nav_market')}</h1>
                    <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl mb-4 border border-[var(--border-color)] shrink-0 shadow-sm">
                        <button onClick={() => { setViewMode('quotes'); vibrate(); }} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide ${viewMode === 'quotes' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Analise FII</button>
                        <button onClick={() => { setViewMode('news'); vibrate(); }} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide ${viewMode === 'news' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Notícias</button>
                    </div>
                    {viewMode === 'quotes' && (
                        <div className="relative group mb-2">
                            {/* Search Icon */}
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent-color)] transition-colors pointer-events-none z-10">
                                <SearchIcon className="w-5 h-5" />
                            </div>
                            
                            {/* Enhanced Input */}
                            <input 
                                ref={inputRef}
                                type="text" 
                                value={searchTerm} 
                                onChange={handleInputChange} 
                                onFocus={() => { if(searchTerm.length >= 2) setShowSuggestions(true); }}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                onKeyDown={handleKeyDown} 
                                placeholder="PESQUISAR ATIVO (EX: HGLG11)" 
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl py-3.5 pl-12 pr-24 text-sm font-bold focus:outline-none focus:border-[var(--accent-color)] focus:ring-4 focus:ring-[var(--accent-color)]/10 transition-all shadow-sm placeholder:text-[var(--text-secondary)]/40 uppercase tracking-wide" 
                            />
                            
                            {/* Right Actions */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                {searchTerm && !loading && (
                                    <button 
                                        onClick={handleClearSearch}
                                        className="p-1.5 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary-hover)] hover:text-[var(--text-primary)] transition-colors active:scale-90"
                                        aria-label="Limpar busca"
                                    >
                                        <CloseIcon className="w-4 h-4" />
                                    </button>
                                )}
                                
                                <button 
                                    onClick={() => handleSearch(searchTerm)} 
                                    disabled={loading || searchTerm.length < 4} 
                                    className={`p-2 rounded-xl transition-all border border-[var(--border-color)] ${loading ? 'bg-[var(--bg-tertiary-hover)] cursor-wait' : 'bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary-hover)] active:scale-95 text-[var(--text-primary)]'}`}
                                >
                                    {loading ? <RefreshIcon className="w-4 h-4 animate-spin text-[var(--accent-color)]" /> : <ChevronRightIcon className="w-4 h-4" />}
                                </button>
                            </div>
                            
                            {/* Autocomplete Dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in-up origin-top ring-1 ring-black/5">
                                    {suggestions.map((ticker, index) => (
                                        <button
                                            key={ticker}
                                            onClick={() => handleSuggestionClick(ticker)}
                                            className="w-full text-left px-4 py-3.5 hover:bg-[var(--bg-tertiary-hover)] text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border-color)] last:border-0 transition-colors flex justify-between items-center group"
                                        >
                                            {ticker}
                                            <span className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity -mr-1">
                                                <ChevronRightIcon className="w-3 h-3" />
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-24 md:pb-6 landscape-pb-6 scroll-smooth">
                <div className="max-w-2xl mx-auto">
                    {viewMode === 'quotes' ? (
                        <div className="animate-fade-in space-y-6">
                            {result && (
                                <div className="bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] shadow-2xl animate-fade-in-up overflow-hidden">
                                    <div className="p-6 bg-gradient-to-br from-[var(--bg-tertiary-hover)] via-[var(--bg-secondary)] to-[var(--bg-secondary)] border-b border-[var(--border-color)] relative">
                                        <div className="flex justify-between items-start z-10">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-3">
                                                    <h2 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter">{result.ticker}</h2>
                                                    {result.fundamentals?.segment && (<span className="px-2.5 py-1 rounded-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wide shadow-sm">{result.fundamentals.segment}</span>)}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1"><span className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">{formatCurrency(result.price)}</span><div className={`flex items-center px-2 py-1 rounded-lg ${result.change >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}><span className="text-xs font-bold">{result.change >= 0 ? '▲' : '▼'} {Math.abs(result.change).toFixed(2)}%</span></div></div>
                                            </div>
                                            <button 
                                                onClick={() => toggleFavorite(result.ticker)}
                                                className={`p-3 rounded-full transition-all active:scale-90 border ${isFavorite ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                            >
                                                <StarIcon filled={isFavorite} className="w-6 h-6" />
                                            </button>
                                        </div>
                                        {result.history.length >= 2 && (<div className="h-24 w-full mt-4 -mb-6 opacity-30 mask-image-gradient-b"><PortfolioLineChart data={result.history} isPositive={result.change >= 0} simpleMode={true} /></div>)}
                                    </div>
                                    <div className="pt-6 animate-fade-in">
                                        {loadingFundamentals ? (<FundamentalSkeleton />) : (
                                            <div className="px-5 pb-6 space-y-8">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <StatItem label="Dividend Yield (12m)" value={result.fundamentals?.dy ? `${result.fundamentals.dy.toFixed(2)}%` : '-'} highlight={result.fundamentals?.dy && result.fundamentals.dy > 10 ? 'green' : 'neutral'} />
                                                    <StatItem label="P/VP" value={result.fundamentals?.pvp?.toFixed(2) ?? '-'} sub={result.fundamentals?.vpPerShare ? `VP: ${formatCurrency(result.fundamentals.vpPerShare)}` : ''} highlight={result.fundamentals?.pvp && result.fundamentals.pvp < 1 ? 'green' : (result.fundamentals?.pvp && result.fundamentals.pvp > 1.2 ? 'red' : 'neutral')} />
                                                    <StatItem label="Último Rendimento" value={result.fundamentals?.lastDividend ? formatCurrency(result.fundamentals.lastDividend) : '-'} />
                                                    <StatItem label="Vacância" value={result.fundamentals?.vacancyRate !== undefined ? `${result.fundamentals.vacancyRate}%` : '-'} highlight={result.fundamentals?.vacancyRate && result.fundamentals.vacancyRate > 10 ? 'red' : 'neutral'} />
                                                </div>

                                                <AIAnalystCard 
                                                    ticker={result.ticker} 
                                                    assetData={{ price: result.price, change: result.change, ...result.fundamentals }} 
                                                    addToast={addToast}
                                                />

                                                {(result.fundamentals?.businessDescription || result.fundamentals?.riskAssessment) && (
                                                    <div className="bg-[var(--bg-primary)] p-5 rounded-2xl relative overflow-hidden mt-6">
                                                        <div className="flex items-center gap-2 mb-3 z-10"><SparklesIcon className="w-4 h-4 text-[var(--accent-color)]" /><span className="text-[10px] font-bold text-[var(--accent-color)] uppercase tracking-wider">Resumo IA</span></div>
                                                        {result.fundamentals?.businessDescription && (<p className="text-xs leading-relaxed text-[var(--text-primary)] font-medium mb-4 z-10">{result.fundamentals.businessDescription}</p>)}
                                                        {result.fundamentals?.riskAssessment && (<div className="flex items-center gap-2 pt-3 border-t border-[var(--border-color)] z-10"><span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Risco:</span><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${result.fundamentals.riskAssessment.includes('Alto') ? 'bg-red-500/10 text-red-500 border-red-500/20' : (result.fundamentals.riskAssessment.includes('Médio') ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20')}`}>{result.fundamentals.riskAssessment}</span></div>)}
                                                    </div>
                                                )}
                                                {expandedDetails && (
                                                    <div className="animate-fade-in-up space-y-6 pt-2 border-t border-[var(--border-color)]/50">
                                                        {result.fundamentals?.dividendsHistory && result.fundamentals.dividendsHistory.length > 0 && (<div><SectionHeader title="Histórico de Proventos" className="mt-6" icon={<ClockIcon className="w-4 h-4 text-[var(--accent-color)]"/>}/><div className="bg-[var(--bg-primary)] p-4 rounded-2xl"><div className="h-56"><DividendChart data={result.fundamentals.dividendsHistory} /></div></div></div>)}
                                                        {((result.fundamentals?.strengths && result.fundamentals.strengths.length > 0) || (result.fundamentals?.weaknesses && result.fundamentals.weaknesses.length > 0)) && (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {result.fundamentals?.strengths && result.fundamentals.strengths.length > 0 && (
                                                                    <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
                                                                        <SectionHeader title="Pontos Fortes" className="!mt-0 !mb-2 !border-emerald-500/20" icon={<TrendingUpIcon className="w-4 h-4 text-emerald-500"/>} />
                                                                        <ul className="space-y-2">{result.fundamentals.strengths.map((s, i) => (<li key={i} className="text-[11px] text-[var(--text-primary)] font-medium flex items-start gap-2"><span className="text-emerald-500 font-bold mt-0.5">✓</span><span className="leading-snug opacity-90">{s}</span></li>))}</ul>
                                                                    </div>
                                                                )}
                                                                {result.fundamentals?.weaknesses && result.fundamentals.weaknesses.length > 0 && (
                                                                    <div className="bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10">
                                                                        <SectionHeader title="Pontos de Atenção" className="!mt-0 !mb-2 !border-rose-500/20" icon={<AlertTriangleIcon className="w-4 h-4 text-rose-500"/>} />
                                                                        <ul className="space-y-2">{result.fundamentals.weaknesses.map((w, i) => (<li key={i} className="text-[11px] text-[var(--text-primary)] font-medium flex items-start gap-2"><span className="text-rose-500 font-bold mt-0.5">!</span><span className="leading-snug opacity-90">{w}</span></li>))}</ul>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <StatItem label="Patrimônio Líq." value={result.fundamentals?.netWorth ?? '-'} />
                                                            <StatItem label="Nº Cotistas" value={result.fundamentals?.shareholders ? `${(result.fundamentals.shareholders/1000).toFixed(1)}k` : '-'} />
                                                            <StatItem label="CAGR Dividendos (3A)" value={result.fundamentals?.dividendCAGR ? `${result.fundamentals.dividendCAGR}%` : '-'} highlight={result.fundamentals?.dividendCAGR && result.fundamentals.dividendCAGR > 0 ? 'green' : 'neutral'} />
                                                            <StatItem label="Taxa de Adm." value={result.fundamentals?.managementFee ?? '-'} />
                                                            <StatItem label="Gestão" value={result.fundamentals?.administrator ?? '-'} className="col-span-2" />
                                                        </div>
                                                    </div>
                                                )}
                                                <button onClick={() => setExpandedDetails(!expandedDetails)} className="w-full py-3 text-xs font-bold text-[var(--text-secondary)] border border-[var(--border-color)] bg-[var(--bg-primary)] rounded-xl flex items-center justify-center gap-1 hover:bg-[var(--bg-tertiary-hover)] hover:text-[var(--text-primary)] transition-colors">{expandedDetails ? 'Ocultar Detalhes' : 'Ver Análise Completa'}<ChevronRightIcon className={`w-3 h-3 transition-transform duration-300 ${expandedDetails ? '-rotate-90' : 'rotate-90'}`} /></button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-5 bg-[var(--bg-tertiary-hover)]/30 border-t border-[var(--border-color)] backdrop-blur-sm"><button onClick={() => setShowAddModal(true)} className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--accent-color)]/20"><PlusIcon className="w-5 h-5" />Adicionar à Carteira</button></div>
                                </div>
                            )}
                            {error && (<div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl text-center text-sm font-bold animate-fade-in flex flex-col items-center gap-2"><TrashIcon className="w-6 h-6 mb-1 opacity-50"/>{error}</div>)}
                            {!result && (
                                <div className="animate-fade-in space-y-8 mt-4">
                                    {recentSearches.length > 0 && (
                                        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-4">
                                            <div className="flex justify-between items-center mb-4 px-1"><h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2"><ClockIcon className="w-3.5 h-3.5"/> Recentes</h3><button onClick={clearRecent} className="text-[var(--text-secondary)] hover:text-red-400 p-1 transition-colors"><TrashIcon className="w-3.5 h-3.5"/></button></div>
                                            <div className="flex flex-wrap gap-2">{recentSearches.map(term => (<button key={term} onClick={() => handleSearch(term)} className="bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] px-4 py-2.5 rounded-xl font-bold text-sm text-[var(--text-primary)] transition-colors active:scale-95 flex items-center gap-2 group">{term} <span className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity -mr-1">→</span></button>))}</div>
                                        </div>
                                    )}
                                    {favorites.length > 0 && (
                                        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-4">
                                            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1 mb-4 flex items-center gap-2"><StarIcon filled className="w-3.5 h-3.5 text-yellow-500"/> Meus Favoritos</h3>
                                            <div className="flex flex-wrap gap-2">{favorites.map(term => (<button key={term} onClick={() => handleSearch(term)} className="bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] px-4 py-2.5 rounded-xl font-bold text-sm text-[var(--text-primary)] transition-colors active:scale-95 flex items-center gap-2 group border-yellow-500/20">{term} <span className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity -mr-1">→</span></button>))}</div>
                                        </div>
                                    )}
                                    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-4">
                                        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1 mb-4">Descubra Oportunidades</h3>
                                        {MARKET_CATEGORIES.map((cat, i) => (
                                            <div key={i} className="mb-6">
                                                <div className="flex items-center gap-2 px-1 mb-3"><div className={`w-2 h-2 rounded-full ${cat.color} shadow-[0_0_8px_rgba(0,0,0,0.3)]`}></div><span className="text-sm font-bold text-[var(--text-primary)]">{cat.title}</span></div>
                                                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-1">{cat.tickers.map(t => (<button key={t} onClick={() => { setSearchTerm(t); handleSearch(t); }} className="flex-shrink-0 w-32 bg-[var(--bg-primary)] border border-[var(--border-color)] p-4 rounded-2xl hover:bg-[var(--bg-tertiary-hover)] hover:border-[var(--accent-color)]/30 transition-all active:scale-95 text-left group shadow-sm"><span className="block font-black text-sm text-[var(--text-primary)] mb-1">{t}</span><span className="text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors font-medium flex items-center gap-1">Ver detalhes <ChevronRightIcon className="w-2.5 h-2.5"/></span></button>))}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (<div className="flex-1 animate-fade-in h-full"><NewsView addToast={addToast} isEmbedded={true} /></div>)}
                </div>
            </div>
            {showAddModal && result && (<TransactionModal onClose={() => setShowAddModal(false)} onSave={handleAddTransaction} initialTicker={result.ticker} addToast={addToast} />)}
        </div>
    );
};

export default MarketView;