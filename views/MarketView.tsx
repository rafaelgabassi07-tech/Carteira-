
import React, { useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { fetchBrapiQuotes } from '../services/brapiService';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate } from '../utils';
import RefreshIcon from '../components/icons/RefreshIcon';
import PlusIcon from '../components/icons/PlusIcon';
import NewsIcon from '../components/icons/NewsIcon';
import GlobeIcon from '../components/icons/GlobeIcon';
import TransactionModal from '../components/modals/TransactionModal';
import NewsView from './NewsView';
import type { ToastMessage } from '../types';

interface MarketViewProps {
    addToast: (message: string, type?: ToastMessage['type']) => void;
}

const MarketView: React.FC<MarketViewProps> = ({ addToast }) => {
    const { t, formatCurrency } = useI18n();
    const { preferences, addTransaction } = usePortfolio();
    
    const [activeTab, setActiveTab] = useState<'quotes' | 'news'>('quotes');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ ticker: string, price: number, change: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);

    const popularTickers = ['MXRF11', 'HGLG11', 'XPLG11', 'VISC11', 'KNRI11', 'XPML11', 'BCFF11'];

    const handleSearch = async (term: string) => {
        if (!term || term.length < 4) return;
        
        vibrate();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const { quotes } = await fetchBrapiQuotes(preferences, [term], true); // Lite mode
            const data = quotes[term.toUpperCase()];
            
            if (data && data.currentPrice > 0) {
                // Calculate simple change if history exists, else 0
                let change = 0;
                if (data.priceHistory && data.priceHistory.length >= 2) {
                    const lastClose = data.priceHistory[data.priceHistory.length - 2].price;
                    change = ((data.currentPrice - lastClose) / lastClose) * 100;
                }

                setResult({
                    ticker: term.toUpperCase(),
                    price: data.currentPrice,
                    change: change
                });
            } else {
                setError('Ativo não encontrado ou sem dados de hoje.');
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

    return (
        <div className="p-4 pb-24 md:pb-6 h-full overflow-y-auto custom-scrollbar landscape-pb-6">
            <div className="max-w-2xl mx-auto h-full flex flex-col">
                <h1 className="text-2xl font-bold mb-4">{t('nav_market')}</h1>

                {/* Tab Switcher */}
                <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl mb-6 border border-[var(--border-color)] shrink-0">
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
                    <div className="animate-fade-in">
                        {/* Search Bar */}
                        <div className="relative mb-6">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                                onKeyDown={handleKeyDown}
                                placeholder="Pesquisar ativo (ex: MXRF11)"
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl py-4 pl-5 pr-14 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all uppercase"
                            />
                            <button
                                onClick={() => handleSearch(searchTerm)}
                                disabled={loading}
                                className="absolute right-2 top-2 bottom-2 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--accent-color)] p-3 rounded-xl transition-colors disabled:opacity-50"
                            >
                                <RefreshIcon className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {/* Result Card */}
                        {result && (
                            <div className="bg-[var(--bg-secondary)] p-6 rounded-3xl border border-[var(--border-color)] shadow-lg animate-fade-in-up mb-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className="text-3xl font-black text-[var(--text-primary)] mb-1">{result.ticker}</h2>
                                        <p className="text-sm text-[var(--text-secondary)] font-medium">Cotação em Tempo Real</p>
                                    </div>
                                    <div className={`text-right px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]`}>
                                        <span className={`font-bold ${result.change >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                                            {result.change >= 0 ? '+' : ''}{result.change.toFixed(2)}%
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-baseline gap-2 mb-8">
                                    <span className="text-4xl font-black text-[var(--text-primary)] tracking-tight">
                                        {formatCurrency(result.price)}
                                    </span>
                                </div>

                                <button 
                                    onClick={() => setShowAddModal(true)}
                                    className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--accent-color)]/20"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                    Adicionar à Carteira
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/10 text-red-500 p-4 rounded-xl text-center font-bold mb-8 animate-fade-in">
                                {error}
                            </div>
                        )}

                        {/* Popular Tags */}
                        <div>
                            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Populares</h3>
                            <div className="flex flex-wrap gap-2">
                                {popularTickers.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => { setSearchTerm(t); handleSearch(t); }}
                                        className="bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] px-4 py-2 rounded-lg font-bold text-sm text-[var(--text-primary)] transition-colors active:scale-95"
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
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
