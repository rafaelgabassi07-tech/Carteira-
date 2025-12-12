
import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { fetchBrapiQuotes } from '../services/brapiService';
import { fetchAdvancedAssetData, fetchLiveAssetQuote } from '../services/geminiService';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate, usePersistentState } from '../utils';
import type { ToastMessage, Asset } from '../types';
import { KNOWN_TICKERS } from '../constants';

// Ícones
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

// Componentes
import TransactionModal from '../components/modals/TransactionModal';
import NewsView from './NewsView';
import PortfolioLineChart from '../components/charts/PortfolioLineChart';
import DividendChart from '../components/charts/DividendChart';
import AIAnalystCard from '../components/cards/AIAnalystCard';

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
    { title: "Logística", color: "bg-orange-500", tickers: ["HGLG11", "BTLG11", "XPLG11", "VILG11"] },
    { title: "Shoppings", color: "bg-blue-500", tickers: ["XPML11", "VISC11", "HGBS11", "MALL11"] },
    { title: "Papel", color: "bg-emerald-500", tickers: ["MXRF11", "KNCR11", "CPTS11", "IRDM11"] },
    { title: "Fiagros", color: "bg-lime-600", tickers: ["SNAG11", "VGIA11", "KNCA11", "RZAG11"] }
];

// Componente StatItem reutilizável
const StatItem: React.FC<{ label: string; value: React.ReactNode; sub?: string; highlight?: 'green' | 'red' | 'neutral' }> = ({ label, value, sub, highlight }) => {
    const textColor = highlight === 'green' ? 'text-[var(--green-text)]' : highlight === 'red' ? 'text-[var(--red-text)]' : 'text-[var(--text-primary)]';
    return (
        <div className="flex flex-col p-4 rounded-xl bg-[var(--bg-primary)] justify-center border border-[var(--border-color)] hover:border-[var(--accent-color)]/30 transition-colors">
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{label}</span>
            <span className={`text-base font-bold truncate tracking-tight ${textColor}`}>{value}</span>
            {sub && <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate opacity-70">{sub}</span>}
        </div>
    );
};

const MarketView: React.FC<{ addToast: (message: string, type?: ToastMessage['type']) => void }> = ({ addToast }) => {
    const { t, formatCurrency } = useI18n();
    const { preferences, addTransaction } = usePortfolio();
    const inputRef = useRef<HTMLInputElement>(null);
    
    const [viewMode, setViewMode] = useState<'quotes' | 'news'>('quotes');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingFundamentals, setLoadingFundamentals] = useState(false);
    const [result, setResult] = useState<MarketResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [expandedDetails, setExpandedDetails] = useState(false);
    
    const [recentSearches, setRecentSearches] = usePersistentState<string[]>('market_recent_searches', []);
    const [favorites, setFavorites] = usePersistentState<string[]>('market_favorites', []);

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
        inputRef.current?.blur();

        try {
            let marketData: MarketResult | null = null;
            // Tentativa Brapi
            try {
                const { quotes } = await fetchBrapiQuotes(preferences, [cleanTerm], false);
                const data = quotes[cleanTerm];
                if (data && data.currentPrice > 0) {
                    const history = data.priceHistory?.map(p => p.price) || [];
                    marketData = { 
                        ticker: cleanTerm, 
                        price: data.currentPrice, 
                        change: data.changePercent ?? 0, 
                        history, 
                        min: Math.min(...history), 
                        max: Math.max(...history) 
                    };
                }
            } catch (e) { console.warn("Brapi fallback", e); }

            // Fallback Gemini
            if (!marketData) {
                const geminiQuote = await fetchLiveAssetQuote(preferences, cleanTerm);
                if (geminiQuote && geminiQuote.price > 0) {
                    marketData = { 
                        ticker: cleanTerm, 
                        price: geminiQuote.price, 
                        change: geminiQuote.change, 
                        history: [], 
                        min: geminiQuote.price, 
                        max: geminiQuote.price 
                    };
                }
            }

            if (marketData) {
                setResult(marketData);
                setLoading(false); 
                setRecentSearches(prev => [cleanTerm, ...prev.filter(item => item !== cleanTerm)].slice(0, 5));

                try {
                    const advData = await fetchAdvancedAssetData(preferences, [cleanTerm]);
                    if (advData.data[cleanTerm]) {
                        setResult(prev => prev ? ({ ...prev, fundamentals: advData.data[cleanTerm] }) : null);
                    }
                } catch (e) { console.warn("Fundamentals error", e); } 
                finally { setLoadingFundamentals(false); }
            } else {
                setError('Ativo não encontrado.');
                setLoading(false);
                setLoadingFundamentals(false);
            }
        } catch (e) {
            setError('Erro ao buscar dados.');
            setLoading(false);
            setLoadingFundamentals(false);
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
            setShowSuggestions(false);
        }
    };

    const toggleFavorite = (ticker: string) => {
        vibrate();
        setFavorites(prev => prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker]);
    };

    const isFavorite = result ? favorites.includes(result.ticker) : false;

    return (
        <div className="h-full flex flex-col bg-[var(--bg-primary)]">
            {/* Header Sticky */}
            <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border-color)]/50 px-4 pt-4 pb-2">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-xl font-bold mb-4 flex items-center gap-2 text-[var(--text-primary)]">
                        <GlobeIcon className="w-5 h-5 text-[var(--accent-color)]"/> {t('nav_market')}
                    </h1>
                    
                    <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl mb-4 border border-[var(--border-color)] shadow-sm">
                        <button onClick={() => { setViewMode('quotes'); vibrate(); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'quotes' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>Cotações</button>
                        <button onClick={() => { setViewMode('news'); vibrate(); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'news' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>Notícias</button>
                    </div>

                    {viewMode === 'quotes' && (
                        <div className="relative group mb-2">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
                            <input 
                                ref={inputRef}
                                type="text" 
                                value={searchTerm} 
                                onChange={handleInputChange} 
                                onFocus={() => searchTerm.length >= 2 && setShowSuggestions(true)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch(searchTerm)}
                                placeholder="PESQUISAR ATIVO (EX: HGLG11)" 
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl py-3 pl-12 pr-12 text-sm font-bold focus:border-[var(--accent-color)] focus:outline-none transition-all uppercase placeholder:normal-case" 
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                {loading ? <RefreshIcon className="w-4 h-4 animate-spin text-[var(--accent-color)]"/> : (searchTerm && <button onClick={() => setSearchTerm('')} className="p-1"><CloseIcon className="w-4 h-4 text-[var(--text-secondary)]"/></button>)}
                            </div>
                            {showSuggestions && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 overflow-hidden">
                                    {suggestions.map(ticker => (
                                        <button key={ticker} onClick={() => { setSearchTerm(ticker); handleSearch(ticker); }} className="w-full text-left px-4 py-3 text-sm font-bold border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--bg-tertiary-hover)]">
                                            {ticker}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-24 md:pb-6">
                <div className="max-w-2xl mx-auto">
                    {viewMode === 'quotes' ? (
                        <div className="animate-fade-in space-y-6">
                            {result ? (
                                <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden animate-fade-in-up">
                                    <div className="p-6 border-b border-[var(--border-color)] relative">
                                        <div className="flex justify-between items-start z-10 relative">
                                            <div>
                                                <h2 className="text-3xl font-black text-[var(--text-primary)]">{result.ticker}</h2>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-2xl font-bold">{formatCurrency(result.price)}</span>
                                                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${result.change >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                        {result.change >= 0 ? '+' : ''}{result.change.toFixed(2)}%
                                                    </span>
                                                </div>
                                            </div>
                                            <button onClick={() => toggleFavorite(result.ticker)} className={`p-2 rounded-full border ${isFavorite ? 'border-yellow-500/50 text-yellow-500 bg-yellow-500/10' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}>
                                                <StarIcon filled={isFavorite} className="w-6 h-6" />
                                            </button>
                                        </div>
                                        {result.history.length > 2 && <div className="h-24 w-full mt-4 opacity-40"><PortfolioLineChart data={result.history} isPositive={result.change >= 0} simpleMode={true} /></div>}
                                    </div>

                                    <div className="p-6 space-y-6">
                                        {loadingFundamentals ? (
                                            <div className="animate-pulse space-y-3">
                                                <div className="h-20 bg-[var(--bg-primary)] rounded-xl"></div>
                                                <div className="h-40 bg-[var(--bg-primary)] rounded-xl"></div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <StatItem label="DY (12m)" value={result.fundamentals?.dy ? `${result.fundamentals.dy.toFixed(2)}%` : '-'} highlight={result.fundamentals?.dy && result.fundamentals.dy > 10 ? 'green' : 'neutral'} />
                                                    <StatItem label="P/VP" value={result.fundamentals?.pvp?.toFixed(2) ?? '-'} highlight={result.fundamentals?.pvp && result.fundamentals.pvp < 1 ? 'green' : 'neutral'} />
                                                    <StatItem label="Último Rend." value={result.fundamentals?.lastDividend ? formatCurrency(result.fundamentals.lastDividend) : '-'} />
                                                    <StatItem label="Vacância" value={result.fundamentals?.vacancyRate ? `${result.fundamentals.vacancyRate}%` : '-'} highlight={result.fundamentals?.vacancyRate && result.fundamentals.vacancyRate > 10 ? 'red' : 'neutral'} />
                                                </div>

                                                <AIAnalystCard ticker={result.ticker} assetData={{ ...result, ...result.fundamentals }} addToast={addToast} />

                                                {expandedDetails && result.fundamentals?.dividendsHistory && (
                                                    <div className="animate-fade-in space-y-4 pt-4 border-t border-[var(--border-color)]">
                                                        <h3 className="font-bold text-sm">Histórico de Proventos</h3>
                                                        <div className="bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)] h-48">
                                                            <DividendChart data={result.fundamentals.dividendsHistory} />
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex gap-3">
                                                    <button onClick={() => setExpandedDetails(!expandedDetails)} className="flex-1 py-3 text-xs font-bold text-[var(--text-secondary)] border border-[var(--border-color)] rounded-xl hover:bg-[var(--bg-tertiary-hover)] transition-colors">
                                                        {expandedDetails ? 'Menos Detalhes' : 'Mais Detalhes'}
                                                    </button>
                                                    <button onClick={() => setShowAddModal(true)} className="flex-1 py-3 bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold rounded-xl shadow-lg shadow-[var(--accent-color)]/20 active:scale-95 transition-all flex justify-center items-center gap-2">
                                                        <PlusIcon className="w-4 h-4"/> Adicionar
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 mt-4">
                                    {recentSearches.length > 0 && (
                                        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-5">
                                            <div className="flex justify-between mb-4"><h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase">Recentes</h3><button onClick={() => { setRecentSearches([]); vibrate(); }}><TrashIcon className="w-4 h-4 text-red-400"/></button></div>
                                            <div className="flex flex-wrap gap-2">{recentSearches.map(t => <button key={t} onClick={() => handleSearch(t)} className="bg-[var(--bg-primary)] border border-[var(--border-color)] px-4 py-2 rounded-lg font-bold text-sm text-[var(--text-primary)]">{t}</button>)}</div>
                                        </div>
                                    )}
                                    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-5">
                                        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-4">Destaques</h3>
                                        {MARKET_CATEGORIES.map((cat, i) => (
                                            <div key={i} className="mb-4 last:mb-0">
                                                <div className="flex items-center gap-2 mb-2"><div className={`w-2 h-2 rounded-full ${cat.color}`}></div><span className="text-sm font-bold text-[var(--text-primary)]">{cat.title}</span></div>
                                                <div className="flex gap-2 overflow-x-auto no-scrollbar">{cat.tickers.map(t => <button key={t} onClick={() => { setSearchTerm(t); handleSearch(t); }} className="flex-shrink-0 bg-[var(--bg-primary)] border border-[var(--border-color)] px-3 py-2 rounded-lg text-xs font-bold hover:border-[var(--accent-color)] transition-colors">{t}</button>)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {error && <div className="p-4 bg-red-500/10 text-red-500 rounded-xl text-center text-sm font-bold border border-red-500/20">{error}</div>}
                        </div>
                    ) : (
                        <div className="animate-fade-in"><NewsView addToast={addToast} /></div>
                    )}
                </div>
            </div>
            {showAddModal && result && <TransactionModal onClose={() => setShowAddModal(false)} onSave={(tx) => { addTransaction({ ...tx, id: String(Date.now()) }); addToast(t('toast_transaction_added'), 'success'); setShowAddModal(false); }} initialTicker={result.ticker} addToast={addToast} />}
        </div>
    );
};

export default MarketView;
    