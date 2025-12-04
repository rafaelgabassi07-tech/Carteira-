
import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { fetchBrapiQuotes } from '../services/brapiService';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate, usePersistentState } from '../utils';
import RefreshIcon from '../components/icons/RefreshIcon';
import PlusIcon from '../components/icons/PlusIcon';
import NewsIcon from '../components/icons/NewsIcon';
import GlobeIcon from '../components/icons/GlobeIcon';
import ClockIcon from '../components/icons/ClockIcon';
import TrashIcon from '../components/icons/TrashIcon';
import TransactionModal from '../components/modals/TransactionModal';
import NewsView from './NewsView';
import PortfolioLineChart from '../components/PortfolioLineChart';
import type { ToastMessage } from '../types';

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
}

const MarketView: React.FC<MarketViewProps> = ({ addToast }) => {
    const { t, formatCurrency } = useI18n();
    const { preferences, addTransaction } = usePortfolio();
    
    const [activeTab, setActiveTab] = useState<'quotes' | 'news'>('quotes');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<MarketResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    
    // Persist Recent Searches
    const [recentSearches, setRecentSearches] = usePersistentState<string[]>('market_recent_searches', []);

    const popularTickers = ['MXRF11', 'HGLG11', 'XPLG11', 'VISC11', 'KNRI11', 'XPML11', 'BCFF11', 'BTLG11', 'CPTS11'];

    const handleSearch = async (term: string) => {
        const cleanTerm = term.trim().toUpperCase();
        if (!cleanTerm || cleanTerm.length < 4) return;
        
        vibrate();
        setLoading(true);
        setError(null);
        setResult(null);
        setSearchTerm(cleanTerm); // Normalize input

        try {
            const { quotes } = await fetchBrapiQuotes(preferences, [cleanTerm], false); // Request full range for chart
            const data = quotes[cleanTerm];
            
            if (data && data.currentPrice > 0) {
                const historyPrices = data.priceHistory?.map(p => p.price) || [];
                
                // Calculate simple change based on history or fallback
                let change = 0;
                if (historyPrices.length >= 2) {
                    const lastClose = historyPrices[historyPrices.length - 2];
                    change = ((data.currentPrice - lastClose) / lastClose) * 100;
                }

                // Stats
                const min = historyPrices.length > 0 ? Math.min(...historyPrices) : data.currentPrice;
                const max = historyPrices.length > 0 ? Math.max(...historyPrices) : data.currentPrice;

                setResult({
                    ticker: cleanTerm,
                    price: data.currentPrice,
                    change: change,
                    history: historyPrices,
                    min,
                    max
                });

                // Update Recent Searches (Max 5, Unique)
                setRecentSearches(prev => {
                    const filtered = prev.filter(item => item !== cleanTerm);
                    return [cleanTerm, ...filtered].slice(0, 5);
                });

            } else {
                setError('Ativo não encontrado ou sem dados de negociação recentes.');
            }
        } catch (e) {
            setError('Erro ao buscar dados. Verifique sua conexão.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch(searchTerm);
        }
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
                <h1 className="text-2xl font-bold mb-4">{t('nav_market')}</h1>

                {/* Tab Switcher */}
                <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl mb-6 border border-[var(--border-color)] shrink-0 shadow-sm">
                    <button 
                        onClick={() => { setActiveTab('quotes'); vibrate(); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide ${activeTab === 'quotes' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <GlobeIcon className="w-4 h-4" /> Cotações
                    </button>
                    <button 
                        onClick={() => { setActiveTab('news'); vibrate(); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide ${activeTab === 'news' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <NewsIcon className="w-4 h-4" /> Notícias
                    </button>
                </div>

                {/* Content Area */}
                {activeTab === 'quotes' ? (
                    <div className="animate-fade-in space-y-6">
                        
                        {/* Search Bar */}
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                                onKeyDown={handleKeyDown}
                                placeholder="Pesquisar ativo (ex: MXRF11)"
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl py-4 pl-5 pr-14 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all uppercase shadow-sm placeholder:text-[var(--text-secondary)]/50"
                            />
                            <button
                                onClick={() => handleSearch(searchTerm)}
                                disabled={loading}
                                className="absolute right-2 top-2 bottom-2 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--accent-color)] p-3 rounded-xl transition-colors disabled:opacity-50"
                            >
                                <RefreshIcon className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {/* Result Card (Interactive) */}
                        {result && (
                            <div className="bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] shadow-lg animate-fade-in-up overflow-hidden">
                                <div className="p-6 pb-2">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h2 className="text-3xl font-black text-[var(--text-primary)] mb-1 tracking-tight">{result.ticker}</h2>
                                            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Cotação em Tempo Real</p>
                                        </div>
                                        <div className={`flex flex-col items-end`}>
                                            <span className="text-2xl font-bold text-[var(--text-primary)]">{formatCurrency(result.price)}</span>
                                            <span className={`text-sm font-bold ${result.change >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                                                {result.change >= 0 ? '▲' : '▼'} {Math.abs(result.change).toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Chart Area */}
                                <div className="h-32 w-full px-2 mb-2">
                                    {result.history.length > 2 ? (
                                        <PortfolioLineChart 
                                            data={result.history} 
                                            isPositive={result.change >= 0}
                                            simpleMode={true}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] text-xs">Gráfico indisponível</div>
                                    )}
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-px bg-[var(--border-color)] border-t border-[var(--border-color)]">
                                    <div className="bg-[var(--bg-secondary)] p-3 flex flex-col items-center">
                                        <span className="text-[9px] text-[var(--text-secondary)] uppercase font-bold">Mínima (1A)</span>
                                        <span className="font-bold text-[var(--text-primary)]">{formatCurrency(result.min)}</span>
                                    </div>
                                    <div className="bg-[var(--bg-secondary)] p-3 flex flex-col items-center">
                                        <span className="text-[9px] text-[var(--text-secondary)] uppercase font-bold">Máxima (1A)</span>
                                        <span className="font-bold text-[var(--text-primary)]">{formatCurrency(result.max)}</span>
                                    </div>
                                </div>

                                <div className="p-4 bg-[var(--bg-primary)]/50">
                                    <button 
                                        onClick={() => setShowAddModal(true)}
                                        className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--accent-color)]/20"
                                    >
                                        <PlusIcon className="w-5 h-5" />
                                        Adicionar à Carteira
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center text-sm font-bold animate-fade-in">
                                {error}
                            </div>
                        )}

                        {/* Recent Searches */}
                        {!result && recentSearches.length > 0 && (
                            <div className="animate-fade-in">
                                <div className="flex justify-between items-center mb-3 px-1">
                                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                                        <ClockIcon className="w-3.5 h-3.5"/> Recentes
                                    </h3>
                                    <button onClick={clearRecent} className="text-[var(--text-secondary)] hover:text-red-400 p-1">
                                        <TrashIcon className="w-3.5 h-3.5"/>
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {recentSearches.map(term => (
                                        <button
                                            key={term}
                                            onClick={() => handleSearch(term)}
                                            className="bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] px-4 py-2 rounded-xl font-bold text-sm text-[var(--text-primary)] transition-colors active:scale-95 flex items-center gap-2 group"
                                        >
                                            {term}
                                            <span className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Popular Tags */}
                        {!result && (
                            <div className="animate-fade-in delay-100">
                                <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-1">Em Alta no Mercado</h3>
                                <div className="flex flex-wrap gap-2">
                                    {popularTickers.map(t => (
                                        <button
                                            key={t}
                                            onClick={() => { setSearchTerm(t); handleSearch(t); }}
                                            className="bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] px-4 py-2 rounded-xl font-bold text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors active:scale-95"
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 animate-fade-in">
                        <NewsView addToast={addToast} isEmbedded={true} />
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
