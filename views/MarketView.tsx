
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import TrashIcon from '../components/icons/TrashIcon';
import SearchIcon from '../components/icons/SearchIcon';
import StarIcon from '../components/icons/StarIcon';
import CloseIcon from '../components/icons/CloseIcon';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import AlertTriangleIcon from '../components/icons/AlertTriangleIcon';

// Componentes
import TransactionModal from '../components/modals/TransactionModal';
import NewsView from './NewsView';
import PortfolioLineChart from '../components/charts/PortfolioLineChart';
import DividendChart from '../components/charts/DividendChart';
import AIAnalystCard from '../components/cards/AIAnalystCard';
import CountUp from '../components/CountUp';

interface MarketResult {
    ticker: string;
    price: number;
    change: number;
    history: number[];
    min: number;
    max: number;
    fundamentals?: Partial<Asset>; 
}

// --- Sub-components for Clean Layout ---

const PvpMeter: React.FC<{ pvp: number }> = ({ pvp }) => {
    // 0.5 to 1.5 range mapping
    const percentage = Math.min(Math.max((pvp - 0.5) / 1 * 100, 0), 100);
    
    let color = 'bg-gray-500';
    let text = 'Justo';
    
    if (pvp < 0.95) { color = 'bg-emerald-500'; text = 'Descontado'; }
    else if (pvp > 1.05) { color = 'bg-rose-500'; text = 'Ágio'; }
    else { color = 'bg-amber-400'; }

    return (
        <div className="w-full mt-2">
            <div className="flex justify-between text-[10px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wide">
                <span>Barato (0.5)</span>
                <span className={pvp < 0.95 ? 'text-emerald-500' : (pvp > 1.05 ? 'text-rose-500' : 'text-amber-400')}>{text}</span>
                <span>Caro (1.5)</span>
            </div>
            <div className="h-2 bg-[var(--bg-tertiary-hover)] rounded-full overflow-hidden relative">
                <div className="absolute top-0 bottom-0 w-0.5 bg-[var(--text-primary)] z-10" style={{ left: '50%' }}></div> {/* Mark 1.0 */}
                <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`} 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
            <div className="text-center mt-1 text-xs font-bold text-[var(--text-primary)]">
                {pvp.toFixed(2)}
            </div>
        </div>
    );
};

const DataCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <div className={`bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] shadow-sm flex flex-col justify-between ${className}`}>
        <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 border-b border-[var(--border-color)]/50 pb-1">{title}</h4>
        {children}
    </div>
);

const DetailRow: React.FC<{ label: string; value: React.ReactNode; sub?: string }> = ({ label, value, sub }) => (
    <div className="flex justify-between items-end py-1">
        <span className="text-xs text-[var(--text-secondary)] font-medium">{label}</span>
        <div className="text-right">
            <span className="text-sm font-bold text-[var(--text-primary)] block">{value}</span>
            {sub && <span className="text-[10px] text-[var(--text-secondary)]">{sub}</span>}
        </div>
    </div>
);

const MarketView: React.FC<{ addToast: (message: string, type?: ToastMessage['type']) => void }> = ({ addToast }) => {
    const { t, formatCurrency } = useI18n();
    const { preferences, addTransaction } = usePortfolio();
    const inputRef = useRef<HTMLInputElement>(null);
    
    const [viewMode, setViewMode] = useState<'quotes' | 'news'>('quotes');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<MarketResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    const [chartRange, setChartRange] = useState<'1D' | '5D' | '1M' | '6M' | '1Y'>('1M');
    
    const [recentSearches, setRecentSearches] = usePersistentState<string[]>('market_recent_searches', []);
    const [favorites, setFavorites] = usePersistentState<string[]>('market_favorites', []);

    // Effect to auto-focus search on mount if empty
    useEffect(() => {
        if (!result && viewMode === 'quotes') {
            inputRef.current?.focus();
        }
    }, [viewMode, result]);

    const handleSearch = async (term: string) => {
        const cleanTerm = term.trim().toUpperCase();
        if (!cleanTerm || cleanTerm.length < 4) return;
        
        vibrate();
        setLoading(true);
        setError(null);
        setResult(null);
        setSearchTerm(cleanTerm);
        setSuggestions([]);
        setShowSuggestions(false);
        inputRef.current?.blur();

        try {
            let marketData: MarketResult | null = null;
            
            // 1. Fetch Basic Price & History
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
                        min: Math.min(...history, data.currentPrice), 
                        max: Math.max(...history, data.currentPrice) 
                    };
                }
            } catch (e) { console.warn("Brapi fallback", e); }

            // 2. Fallback to Gemini for Price if Brapi fails
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
                // 3. Fetch Fundamentals (Parallel if possible, but sequential here for state clarity)
                setResult(marketData); // Show price immediately
                setRecentSearches(prev => [cleanTerm, ...prev.filter(item => item !== cleanTerm)].slice(0, 5));

                try {
                    const advData = await fetchAdvancedAssetData(preferences, [cleanTerm]);
                    if (advData.data[cleanTerm]) {
                        setResult(prev => prev ? ({ ...prev, fundamentals: advData.data[cleanTerm] }) : null);
                    }
                } catch (e) { console.warn("Fundamentals error", e); }
                
            } else {
                setError('Ativo não encontrado ou sem liquidez.');
            }
        } catch (e) {
            setError('Erro de conexão. Tente novamente.');
        } finally {
            setLoading(false);
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

    // Simulate chart range data (since Brapi free might strictly limit history)
    const displayHistory = useMemo(() => {
        if (!result?.history) return [];
        const len = result.history.length;
        switch (chartRange) {
            case '1D': return result.history.slice(-10); // Mock daily int
            case '5D': return result.history.slice(-5);
            case '1M': return result.history.slice(-22);
            case '6M': return result.history.slice(-130);
            default: return result.history;
        }
    }, [result?.history, chartRange]);

    return (
        <div className="h-full flex flex-col bg-[var(--bg-primary)]">
            {/* Header Sticky */}
            <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border-color)]/50 px-4 pt-4 pb-2">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
                            <GlobeIcon className="w-5 h-5 text-[var(--accent-color)]"/> {t('nav_market')}
                        </h1>
                        {result && (
                            <button onClick={() => { setResult(null); setSearchTerm(''); }} className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] px-3 py-1.5 rounded-lg border border-[var(--border-color)]">
                                Nova Busca
                            </button>
                        )}
                    </div>
                    
                    {!result && (
                        <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl mb-4 border border-[var(--border-color)] shadow-sm">
                            <button onClick={() => { setViewMode('quotes'); vibrate(); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'quotes' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>Cotações</button>
                            <button onClick={() => { setViewMode('news'); vibrate(); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'news' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>Notícias</button>
                        </div>
                    )}

                    {viewMode === 'quotes' && !result && (
                        <div className="relative group mb-2">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
                            <input 
                                ref={inputRef}
                                type="text" 
                                value={searchTerm} 
                                onChange={handleInputChange} 
                                onFocus={() => searchTerm.length >= 2 && setShowSuggestions(true)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch(searchTerm)}
                                placeholder="BUSCAR ATIVO (EX: HGLG11)" 
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
                        <div className="animate-fade-in space-y-4">
                            {result ? (
                                <>
                                    {/* Asset Header Card */}
                                    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-5 shadow-md relative overflow-hidden animate-fade-in-up">
                                        <div className="absolute top-0 right-0 p-4">
                                            <button onClick={() => toggleFavorite(result.ticker)} className={`p-2 rounded-full border transition-all ${isFavorite ? 'border-yellow-500/50 text-yellow-500 bg-yellow-500/10' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary-hover)]'}`}>
                                                <StarIcon filled={isFavorite} className="w-5 h-5" />
                                            </button>
                                        </div>
                                        
                                        <div className="mb-6">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">{result.ticker}</h2>
                                                <span className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-[10px] font-bold px-2 py-1 rounded border border-[var(--border-color)]">{result.fundamentals?.assetType || 'FII'}</span>
                                            </div>
                                            <p className="text-xs text-[var(--text-secondary)] max-w-[80%] truncate">{result.fundamentals?.administrator || 'Carregando info...'}</p>
                                        </div>

                                        <div className="flex items-end gap-3 mb-4">
                                            <span className="text-4xl font-bold text-[var(--text-primary)] tracking-tighter">
                                                <CountUp end={result.price} formatter={formatCurrency} />
                                            </span>
                                            <span className={`px-2 py-1 rounded-lg text-sm font-bold flex items-center mb-1.5 ${result.change >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                {result.change >= 0 ? <TrendingUpIcon className="w-4 h-4 mr-1"/> : <TrendingUpIcon className="w-4 h-4 mr-1 rotate-180"/>}
                                                {Math.abs(result.change).toFixed(2)}%
                                            </span>
                                        </div>

                                        {/* Chart & Controls */}
                                        <div className="h-32 w-full mb-4">
                                            <PortfolioLineChart 
                                                data={displayHistory.length > 0 ? displayHistory : [result.price * 0.99, result.price]} 
                                                isPositive={result.change >= 0} 
                                                simpleMode={true} 
                                            />
                                        </div>
                                        <div className="flex justify-between bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-color)]">
                                            {(['1D', '5D', '1M', '6M', '1Y'] as const).map(range => (
                                                <button 
                                                    key={range}
                                                    onClick={() => setChartRange(range)}
                                                    className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-colors ${chartRange === range ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                                >
                                                    {range}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <button onClick={() => setShowAddModal(true)} className="w-full py-4 bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold rounded-2xl shadow-lg shadow-[var(--accent-color)]/20 active:scale-[0.98] transition-all flex justify-center items-center gap-2 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                                        <PlusIcon className="w-5 h-5"/> Adicionar à Carteira
                                    </button>

                                    {/* Fundamentals Grid */}
                                    <div className="grid grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                                        {/* Valuation */}
                                        <DataCard title="Valuation">
                                            <DetailRow label="P/VP" value={result.fundamentals?.pvp?.toFixed(2) ?? '-'} />
                                            <PvpMeter pvp={result.fundamentals?.pvp || 1} />
                                            <div className="mt-3 pt-3 border-t border-[var(--border-color)]/50">
                                                <DetailRow label="Val. Patrimonial" value={result.fundamentals?.vpPerShare ? formatCurrency(result.fundamentals.vpPerShare) : '-'} sub="/cota" />
                                                <DetailRow label="Patrimônio Líq." value={result.fundamentals?.netWorth || '-'} />
                                            </div>
                                        </DataCard>

                                        {/* Dividendos */}
                                        <DataCard title="Dividendos">
                                            <div className="mb-2">
                                                <span className="text-xs text-[var(--text-secondary)]">Dividend Yield (12m)</span>
                                                <div className="text-2xl font-bold text-[var(--green-text)]">{result.fundamentals?.dy?.toFixed(2) ?? '-'}%</div>
                                            </div>
                                            <div className="pt-2 border-t border-[var(--border-color)]/50">
                                                <DetailRow label="Último" value={result.fundamentals?.lastDividend ? formatCurrency(result.fundamentals.lastDividend) : '-'} />
                                                <DetailRow label="CAGR Div." value={result.fundamentals?.dividendCAGR ? `${result.fundamentals.dividendCAGR}%` : '-'} />
                                                <DetailRow label="Próx. Pagamento" value={result.fundamentals?.nextPaymentDate ? new Date(result.fundamentals.nextPaymentDate).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'}) : '-'} />
                                            </div>
                                        </DataCard>

                                        {/* Qualidade */}
                                        <DataCard title="Qualidade & Risco" className="col-span-2 sm:col-span-1">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[10px] text-[var(--text-secondary)] uppercase">Vacância</span>
                                                    <div className={`text-lg font-bold ${result.fundamentals?.vacancyRate && result.fundamentals.vacancyRate > 10 ? 'text-[var(--red-text)]' : 'text-[var(--text-primary)]'}`}>
                                                        {result.fundamentals?.vacancyRate !== undefined ? `${result.fundamentals.vacancyRate}%` : '-'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-[var(--text-secondary)] uppercase">Cotistas</span>
                                                    <div className="text-lg font-bold text-[var(--text-primary)]">
                                                        {result.fundamentals?.shareholders ? (result.fundamentals.shareholders > 1000 ? `${(result.fundamentals.shareholders/1000).toFixed(0)}k` : result.fundamentals.shareholders) : '-'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-[var(--border-color)]/50">
                                                <DetailRow label="Liquidez Diária" value={result.fundamentals?.liquidity ? `R$ ${(result.fundamentals.liquidity/1000000).toFixed(1)}M` : '-'} />
                                                <DetailRow label="Taxa Adm." value={result.fundamentals?.managementFee || '-'} />
                                            </div>
                                        </DataCard>

                                        {/* Profile */}
                                        <DataCard title="Perfil" className="col-span-2 sm:col-span-1">
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-[10px] text-[var(--text-secondary)] uppercase">Segmento</span>
                                                    <div className="font-bold text-sm bg-[var(--bg-primary)] p-2 rounded-lg border border-[var(--border-color)]">
                                                        {result.fundamentals?.segment || result.fundamentals?.sector || '-'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-[var(--text-secondary)] uppercase">Gestão</span>
                                                    <div className="font-bold text-sm bg-[var(--bg-primary)] p-2 rounded-lg border border-[var(--border-color)] truncate">
                                                        {result.fundamentals?.administrator || '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        </DataCard>
                                    </div>

                                    {/* Charts Section */}
                                    {result.fundamentals?.dividendsHistory && (
                                        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-5 shadow-sm animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                                            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Histórico de Proventos</h3>
                                            <div className="h-48 w-full">
                                                <DividendChart data={result.fundamentals.dividendsHistory} />
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Analyst */}
                                    <AIAnalystCard ticker={result.ticker} assetData={{ ...result, ...result.fundamentals }} addToast={addToast} />
                                </>
                            ) : (
                                /* Search & Suggestions View */
                                <div className="space-y-6 mt-4">
                                    {recentSearches.length > 0 && (
                                        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-5 animate-fade-in">
                                            <div className="flex justify-between mb-4"><h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase">Recentes</h3><button onClick={() => { setRecentSearches([]); vibrate(); }}><TrashIcon className="w-4 h-4 text-red-400"/></button></div>
                                            <div className="flex flex-wrap gap-2">{recentSearches.map(t => <button key={t} onClick={() => handleSearch(t)} className="bg-[var(--bg-primary)] border border-[var(--border-color)] px-4 py-2 rounded-lg font-bold text-sm text-[var(--text-primary)] hover:border-[var(--accent-color)] transition-colors">{t}</button>)}</div>
                                        </div>
                                    )}
                                    
                                    {favorites.length > 0 && (
                                        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-5 animate-fade-in">
                                            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-4">Favoritos</h3>
                                            <div className="flex flex-wrap gap-2">{favorites.map(t => <button key={t} onClick={() => handleSearch(t)} className="flex items-center gap-1 bg-[var(--bg-primary)] border border-[var(--border-color)] px-4 py-2 rounded-lg font-bold text-sm text-[var(--text-primary)] hover:border-yellow-500 hover:text-yellow-500 transition-colors"><StarIcon filled className="w-3 h-3"/>{t}</button>)}</div>
                                        </div>
                                    )}

                                    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-5 animate-fade-in">
                                        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-4">Destaques do Setor</h3>
                                        <div className="space-y-4">
                                            {[
                                                { title: "Logística", color: "bg-orange-500", tickers: ["HGLG11", "BTLG11", "XPLG11"] },
                                                { title: "Shoppings", color: "bg-blue-500", tickers: ["XPML11", "VISC11", "HGBS11"] },
                                                { title: "Papel (CRI)", color: "bg-emerald-500", tickers: ["MXRF11", "KNCR11", "CPTS11"] },
                                                { title: "Fiagros", color: "bg-lime-600", tickers: ["SNAG11", "VGIA11", "RZAG11"] }
                                            ].map((cat, i) => (
                                                <div key={i}>
                                                    <div className="flex items-center gap-2 mb-2"><div className={`w-1.5 h-1.5 rounded-full ${cat.color}`}></div><span className="text-xs font-bold text-[var(--text-primary)]">{cat.title}</span></div>
                                                    <div className="flex gap-2 overflow-x-auto no-scrollbar">{cat.tickers.map(t => <button key={t} onClick={() => { setSearchTerm(t); handleSearch(t); }} className="flex-shrink-0 bg-[var(--bg-primary)] border border-[var(--border-color)] px-3 py-2 rounded-lg text-xs font-bold hover:border-[var(--accent-color)] transition-colors">{t}</button>)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {error && <div className="p-4 bg-red-500/10 text-red-500 rounded-xl text-center text-sm font-bold border border-red-500/20 flex flex-col items-center gap-2"><AlertTriangleIcon className="w-6 h-6"/>{error}</div>}
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
