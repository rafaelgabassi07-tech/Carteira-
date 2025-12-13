
import React, { useState, useMemo, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate } from '../utils';
import type { ToastMessage, SortOption } from '../types';
import type { View } from '../App';

// Importação de Componentes Padronizados
import PortfolioSummary from '../components/cards/PortfolioSummary';
import PortfolioPieChart from '../components/charts/PortfolioPieChart';
import BarChart from '../components/charts/BarChart';
import AssetListItem from '../components/AssetListItem';
import TransactionsView from './TransactionsView';
import CountUp from '../components/CountUp';

// Ícones
import RefreshIcon from '../components/icons/RefreshIcon';
import SortIcon from '../components/icons/SortIcon';
import WalletIcon from '../components/icons/WalletIcon';
import SearchIcon from '../components/icons/SearchIcon';
import CloseIcon from '../components/icons/CloseIcon';
import SettingsIcon from '../components/icons/SettingsIcon';
import BellIcon from '../components/icons/BellIcon';
import TransactionIcon from '../components/icons/TransactionIcon';
import AnalysisIcon from '../components/icons/AnalysisIcon';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';

// Componente Local para Seção de Renda (Simplificado)
const IncomeSection: React.FC<{ setActiveView: (view: View) => void }> = ({ setActiveView }) => {
    const { t, formatCurrency } = useI18n();
    const { monthlyIncome, projectedAnnualIncome } = usePortfolio();
    
    const average = useMemo(() => {
         const total = monthlyIncome.reduce((acc, item) => acc + item.total, 0);
         return monthlyIncome.length > 0 ? total / monthlyIncome.length : 0;
    }, [monthlyIncome]);

    // GARANTE QUE APENAS OS ÚLTIMOS 6 MESES SEJAM EXIBIDOS NO CARD DE RESUMO
    const chartData = useMemo(() => monthlyIncome.slice(-6), [monthlyIncome]);

    return (
        <div onClick={() => { vibrate(); setActiveView('incomeReport'); }} className="bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-color)] shadow-sm cursor-pointer hover:bg-[var(--bg-tertiary-hover)] transition-all group">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-base text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors flex items-center gap-2">
                    {t('income_report_title')}
                    <ChevronRightIcon className="w-4 h-4 opacity-50" />
                </h3>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide block mb-1">{t('average_income')}</span>
                    <span className="font-bold text-lg text-[var(--green-text)]"><CountUp end={average} formatter={formatCurrency} /></span>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide block mb-1">{t('projected_annual_income')}</span>
                    <span className="font-bold text-lg text-[var(--accent-color)]"><CountUp end={projectedAnnualIncome} formatter={formatCurrency} /></span>
                </div>
            </div>
             <div className="h-40 w-full pointer-events-none opacity-80">
                 <BarChart data={chartData} />
             </div>
        </div>
    );
};

const DiversificationSection: React.FC = () => {
    const { t } = useI18n();
    const { assets, preferences } = usePortfolio();
    
    const data = useMemo(() => {
        const segments: Record<string, number> = {};
        let totalValue = 0;
        assets.forEach(a => {
            const val = a.quantity * a.currentPrice;
            const seg = a.segment || t('outros');
            segments[seg] = (segments[seg] || 0) + val;
            totalValue += val;
        });
        return Object.entries(segments).map(([name, value]) => ({ name, value, percentage: totalValue > 0 ? (value / totalValue) * 100 : 0 })).sort((a, b) => b.value - a.value);
    }, [assets, t]);

    return (
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-color)] shadow-sm">
            <h3 className="font-bold text-base text-[var(--text-primary)] mb-4">{t('diversification')}</h3>
            <PortfolioPieChart data={data} goals={preferences.segmentGoals || {}} />
        </div>
    );
};

// Componente de Conteúdo Principal
const OverviewContent: React.FC<{ 
    addToast: (message: string, type?: ToastMessage['type']) => void, 
    onSelectAsset: (ticker: string) => void,
    setActiveView: (view: View) => void
}> = ({ addToast, onSelectAsset, setActiveView }) => {
    const { t } = useI18n();
    const { assets, preferences, isRefreshing } = usePortfolio();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>(preferences.defaultSort || 'valueDesc');
    const [isSortOpen, setIsSortOpen] = useState(false);

    const totalPortfolioValue = useMemo(() => assets.reduce((acc, asset) => acc + asset.currentPrice * asset.quantity, 0), [assets]);
    
    const processedAssets = useMemo(() => {
        let filtered = assets.filter(asset => asset.ticker.toLowerCase().includes(searchQuery.toLowerCase()));
        return filtered.sort((a, b) => {
            switch (sortOption) {
                case 'valueDesc': return (b.currentPrice * b.quantity) - (a.currentPrice * a.quantity);
                case 'valueAsc': return (a.currentPrice * a.quantity) - (b.currentPrice * a.quantity);
                case 'tickerAsc': return a.ticker.localeCompare(b.ticker);
                case 'performanceDesc':
                    const perfA = a.avgPrice > 0 ? (a.currentPrice - a.avgPrice) / a.avgPrice : 0;
                    const perfB = b.avgPrice > 0 ? (b.currentPrice - b.avgPrice) / b.avgPrice : 0;
                    return perfB - perfA;
                default: return 0;
            }
        });
    }, [assets, searchQuery, sortOption]);

    return (
        <div className="space-y-6">
            {assets.length > 0 && <PortfolioSummary />}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <IncomeSection setActiveView={setActiveView} />
                <DiversificationSection />
            </div>

            <div className="space-y-4">
                {assets.length > 0 ? (
                    <>
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-lg px-1 flex items-center gap-2">
                                {t('my_assets')} 
                                <span className="text-xs font-semibold bg-[var(--bg-secondary)] px-2 py-0.5 rounded text-[var(--text-secondary)] border border-[var(--border-color)]">{processedAssets.length}</span>
                            </h3>
                            
                            <div className="flex gap-2">
                                <div className="relative">
                                    <button 
                                        onClick={() => { setIsSortOpen(!isSortOpen); vibrate(); }}
                                        className={`p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] transition-colors ${isSortOpen ? 'border-[var(--accent-color)] text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`}
                                    >
                                        <SortIcon className="w-5 h-5"/>
                                    </button>
                                    {isSortOpen && (
                                        <>
                                            <div className="fixed inset-0 z-30" onClick={() => setIsSortOpen(false)} />
                                            <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-xl z-40 overflow-hidden animate-scale-in origin-top-right">
                                                <div className="p-3 border-b border-[var(--border-color)] text-[10px] font-bold text-[var(--text-secondary)] uppercase">{t('sort_by')}</div>
                                                {(['valueDesc', 'valueAsc', 'tickerAsc', 'performanceDesc'] as SortOption[]).map(option => (
                                                    <button 
                                                        key={option}
                                                        onClick={() => { setSortOption(option); setIsSortOpen(false); vibrate(); }}
                                                        className={`w-full text-left px-4 py-3 text-sm transition-colors flex justify-between items-center ${sortOption === option ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/5 font-bold' : 'hover:bg-[var(--bg-tertiary-hover)]'}`}
                                                    >
                                                        {t(`sort_${option.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`)}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none">
                                <SearchIcon className="w-5 h-5" />
                            </div>
                            <input 
                                type="text" 
                                placeholder={t('search_asset_placeholder')} 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl py-3 pl-12 pr-12 text-sm font-medium focus:outline-none focus:border-[var(--accent-color)] transition-all uppercase placeholder:normal-case"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                >
                                    <CloseIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            {processedAssets.map((asset, index) => (
                                <AssetListItem 
                                    key={asset.ticker}
                                    asset={asset} 
                                    totalValue={totalPortfolioValue}
                                    onClick={() => onSelectAsset(asset.ticker)} 
                                    style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
                                    hideCents={preferences.hideCents}
                                    privacyMode={false}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-60">
                        <WalletIcon className="w-12 h-12 mb-3 text-[var(--text-secondary)]"/>
                        <p className="text-sm font-medium">{t('portfolio_empty_subtitle')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const AnalysisView: React.FC<any> = ({ addToast, onSelectAsset, unreadNotificationsCount, setActiveView, initialTransactionFilter, clearTransactionFilter, initialTab = 'general' }) => {
    const { t } = useI18n();
    const { refreshMarketData, isRefreshing: isContextRefreshing } = usePortfolio();
    
    const [activeTab, setActiveTab] = useState<'general' | 'transactions'>(initialTab);
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);
    const isRefreshing = isContextRefreshing || isPullRefreshing;

    useEffect(() => {
        if (initialTransactionFilter) setActiveTab('transactions');
    }, [initialTransactionFilter]);

    const handleRefresh = async () => {
        setIsPullRefreshing(true);
        vibrate();
        addToast(t('toast_updating_prices'));
        try {
            await refreshMarketData(true);
            addToast(t('toast_update_success'), 'success');
        } catch (error: any) {
            addToast(error.message || t('toast_update_failed'), 'error');
        } finally {
            setIsPullRefreshing(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[var(--bg-primary)]">
            <header className="px-4 py-3 flex justify-between items-center sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border-color)]/50 transition-all duration-300">
                <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('nav_analysis')}</h1>
                <div className="flex items-center gap-1">
                    <button onClick={handleRefresh} disabled={isRefreshing} className={`p-2.5 rounded-full hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all ${isRefreshing ? 'animate-spin text-[var(--accent-color)]' : ''}`}>
                        <RefreshIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => setActiveView('settings')} className="p-2.5 rounded-full hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all">
                        <SettingsIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => setActiveView('notificacoes')} className="p-2.5 rounded-full hover:bg-[var(--bg-tertiary-hover)] relative text-[var(--text-secondary)] transition-all">
                        <BellIcon className="w-5 h-5" />
                        {unreadNotificationsCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[var(--bg-primary)]"></span>}
                    </button>
                </div>
            </header>

            <div className="px-4 py-2 bg-[var(--bg-primary)] z-20 sticky top-[60px]">
                <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)] shadow-sm">
                    <button 
                        onClick={() => { setActiveTab('general'); vibrate(); }} 
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'general' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                    >
                        <AnalysisIcon className="w-4 h-4"/> Visão Geral
                    </button>
                    <button 
                        onClick={() => { setActiveTab('transactions'); vibrate(); }} 
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'transactions' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                    >
                        <TransactionIcon className="w-4 h-4"/> {t('nav_transactions')}
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-24 md:pb-6 landscape-pb-6">
                <div className="max-w-5xl mx-auto">
                    {activeTab === 'general' ? (
                        <div className="animate-fade-in"><OverviewContent addToast={addToast} onSelectAsset={onSelectAsset} setActiveView={setActiveView} /></div>
                    ) : (
                        <div className="animate-slide-in-right"><TransactionsView initialFilter={initialTransactionFilter} clearFilter={clearTransactionFilter || (() => {})} addToast={addToast} isEmbedded={true} /></div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalysisView;
