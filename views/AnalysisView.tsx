import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import PatrimonyEvolutionCard from '../components/PatrimonyEvolutionCard';
import PortfolioSummary from '../components/PortfolioSummary';
import PortfolioPieChart from '../components/PortfolioPieChart';
import BarChart from '../components/BarChart';
import CountUp from '../components/CountUp';
import { vibrate } from '../utils';
import RefreshIcon from '../components/icons/RefreshIcon';
import AssetListItem from '../components/AssetListItem';
import SortIcon from '../components/icons/SortIcon';
import WalletIcon from '../components/icons/WalletIcon';
import SearchIcon from '../components/icons/SearchIcon';
import CloseIcon from '../components/icons/CloseIcon';
import SettingsIcon from '../components/icons/SettingsIcon';
import BellIcon from '../components/icons/BellIcon';
import TransactionIcon from '../components/icons/TransactionIcon';
import AnalysisIcon from '../components/icons/AnalysisIcon';
import TransactionsView from './TransactionsView';
import type { ToastMessage, SortOption } from '../types';
import type { View } from '../App';

const AnalysisCard: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode; delay?: number; className?: string }> = ({ title, children, action, delay = 0, className = '' }) => (
    <div className={`bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-color)] shadow-sm animate-fade-in-up transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${className}`} style={{ animationDelay: `${delay}ms` }}>
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-[var(--text-primary)]">{title}</h3>
            {action}
        </div>
        {children}
    </div>
);

const IncomeCard: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const { monthlyIncome, projectedAnnualIncome } = usePortfolio();
    
    const average = useMemo(() => {
         const total = monthlyIncome.reduce((acc, item) => acc + item.total, 0);
         return monthlyIncome.length > 0 ? total / monthlyIncome.length : 0;
    }, [monthlyIncome]);

    return (
        <AnalysisCard title={t('income_report_title')} delay={100}>
            <div className="grid grid-cols-2 gap-4 mb-4 pt-2 border-t border-[var(--border-color)]">
                <div className="flex flex-col">
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mb-0.5">{t('avg_monthly_income_12m')}</span>
                    <span className="font-semibold text-lg text-[var(--green-text)]">
                        <CountUp end={average} formatter={formatCurrency} />
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mb-0.5">{t('projected_annual_income')}</span>
                    <span className="font-semibold text-lg text-[var(--green-text)]">
                        <CountUp end={projectedAnnualIncome} formatter={formatCurrency} />
                    </span>
                </div>
            </div>
             <div className="h-48 w-full">
                 <BarChart data={monthlyIncome} />
             </div>
        </AnalysisCard>
    );
};

const DiversificationCard: React.FC = () => {
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
        
        return Object.entries(segments).map(([name, value]) => ({
            name,
            value,
            percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
        })).sort((a, b) => b.value - a.value);
    }, [assets, t]);

    return (
        <AnalysisCard title={t('diversification')} delay={200}>
            <PortfolioPieChart data={data} goals={preferences.segmentGoals || {}} />
        </AnalysisCard>
    );
};

// Sub-component for the Overview Content
const OverviewContent: React.FC<{ 
    addToast: (message: string, type?: ToastMessage['type']) => void, 
    onSelectAsset: (ticker: string) => void 
}> = ({ addToast, onSelectAsset }) => {
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

    const clearSearch = () => {
        vibrate(5);
        setSearchQuery('');
    };

    return (
        <div className="p-4 space-y-6">
            {assets.length > 0 && <PortfolioSummary />}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="lg:col-span-2">
                    <PatrimonyEvolutionCard />
                </div>
                <IncomeCard />
                <DiversificationCard />
            </div>

            {/* Assets List Section */}
            <div>
                {assets.length > 0 ? (
                    <>
                        <div className="flex space-x-3 mb-5">
                            <div className="flex-1 relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent-color)] transition-colors pointer-events-none">
                                    <SearchIcon className="w-5 h-5" />
                                </div>
                                <input 
                                    type="text" 
                                    placeholder={t('search_asset_placeholder')} 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl py-3.5 pl-12 pr-12 text-sm font-bold focus:outline-none focus:border-[var(--accent-color)] focus:ring-4 focus:ring-[var(--accent-color)]/10 transition-all shadow-sm placeholder:text-[var(--text-secondary)]/50 uppercase tracking-wide"
                                    autoCapitalize="characters"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={clearSearch}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary-hover)] hover:text-[var(--text-primary)] transition-colors active:scale-90"
                                    >
                                        <CloseIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <button 
                                    id="sort-btn"
                                    onClick={() => { setIsSortOpen(!isSortOpen); vibrate(); }}
                                    className={`h-full px-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-center hover:bg-[var(--bg-tertiary-hover)] transition-colors ${isSortOpen ? 'ring-4 ring-[var(--accent-color)]/10 border-[var(--accent-color)]' : ''}`}
                                >
                                    <SortIcon className="w-5 h-5 text-[var(--text-secondary)]"/>
                                </button>
                                {isSortOpen && (
                                    <>
                                        <div className="fixed inset-0 z-30" onClick={() => setIsSortOpen(false)} />
                                        <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl z-40 overflow-hidden animate-scale-in origin-top-right glass-card">
                                            <div className="p-3 border-b border-[var(--border-color)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('sort_by')}</div>
                                            {(['valueDesc', 'valueAsc', 'tickerAsc', 'performanceDesc'] as SortOption[]).map(option => (
                                                <button 
                                                    key={option}
                                                    onClick={() => { setSortOption(option); setIsSortOpen(false); vibrate(); }}
                                                    className={`w-full text-left px-4 py-3 text-sm transition-colors flex justify-between items-center ${sortOption === option ? 'text-[var(--accent-color)] font-bold bg-[var(--accent-color)]/10' : 'hover:bg-[var(--bg-tertiary-hover)]'}`}
                                                >
                                                    {t(`sort_${option.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`)}
                                                    {sortOption === option && <div className="w-2 h-2 rounded-full bg-[var(--accent-color)]"></div>}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <h3 className="font-bold text-lg mb-3 px-1 flex items-center gap-2">
                            {t('my_assets')} 
                            <span className="text-xs font-semibold bg-[var(--bg-secondary)] px-2 py-0.5 rounded text-[var(--text-secondary)] border border-[var(--border-color)]">{processedAssets.length}</span>
                        </h3>
                        
                        {isRefreshing && processedAssets.length === 0 ? (
                            <div className="flex flex-col gap-3 animate-pulse">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="h-24 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)]"></div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {processedAssets.map((asset, index) => (
                                    <AssetListItem 
                                        key={asset.ticker}
                                        asset={asset} 
                                        totalValue={totalPortfolioValue}
                                        onClick={() => onSelectAsset(asset.ticker)} 
                                        style={{ animationDelay: `${index * 50}ms` }}
                                        hideCents={preferences.hideCents}
                                        privacyMode={false}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                        <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-6 border border-[var(--border-color)] shadow-lg">
                            <WalletIcon className="w-8 h-8 text-[var(--text-secondary)] opacity-50"/>
                        </div>
                        <h2 className="text-xl font-bold mb-2">{t('portfolio_empty_title')}</h2>
                        <p className="text-[var(--text-secondary)] max-w-xs leading-relaxed">{t('portfolio_empty_subtitle')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

interface AnalysisViewProps {
    addToast: (message: string, type?: ToastMessage['type']) => void;
    onSelectAsset: (ticker: string) => void;
    unreadNotificationsCount?: number;
    setActiveView: (view: View) => void;
    initialTransactionFilter?: string | null;
    clearTransactionFilter?: () => void;
    initialTab?: 'general' | 'transactions';
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ addToast, onSelectAsset, unreadNotificationsCount, setActiveView, initialTransactionFilter, clearTransactionFilter, initialTab = 'general' }) => {
    const { t } = useI18n();
    const { refreshMarketData, isRefreshing: isContextRefreshing } = usePortfolio();
    
    // Tab State: 'general' (Overview) or 'transactions'
    const [activeTab, setActiveTab] = useState<'general' | 'transactions'>(initialTab);
    
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);
    const isRefreshing = isContextRefreshing || isPullRefreshing;

    // Use specific useEffect for transaction filter navigation
    useEffect(() => {
        if (initialTransactionFilter) {
            setActiveTab('transactions');
        }
    }, [initialTransactionFilter]);

    // Pull to Refresh Logic (Wraps both tabs)
    const touchStartY = useRef(0);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (containerRef.current && containerRef.current.scrollTop === 0) {
            touchStartY.current = e.targetTouches[0].clientY;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartY.current > 0 && !isRefreshing) {
            const touchY = e.targetTouches[0].clientY;
            const dist = touchY - touchStartY.current;
            if (dist > 0) {
                setPullDistance(Math.min(dist * 0.4, 80));
            }
        }
    };

    const handleTouchEnd = () => {
        if (pullDistance > 60) {
            handleRefresh();
        }
        setPullDistance(0);
        touchStartY.current = 0;
    };

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
    
    // Memoize content components to prevent unnecessary re-renders when switching tabs
    const overviewContent = useMemo(() => (
        <OverviewContent addToast={addToast} onSelectAsset={onSelectAsset} />
    ), [addToast, onSelectAsset]);

    const transactionsContent = useMemo(() => (
        <TransactionsView 
            initialFilter={initialTransactionFilter} 
            clearFilter={clearTransactionFilter || (() => {})} 
            addToast={addToast} 
            isEmbedded={true}
        />
    ), [initialTransactionFilter, clearTransactionFilter, addToast]);

    return (
        <div className="h-full flex flex-col bg-[var(--bg-primary)]">
            <header className="px-4 py-3 flex justify-between items-center sticky top-0 z-30 glass border-b border-[var(--border-color)]/50 transition-all duration-300 flex-shrink-0">
                <h1 className="text-xl font-black tracking-tight text-[var(--text-primary)]">
                    {t('nav_analysis')}
                </h1>
                <div className="flex items-center gap-2">
                    <button 
                        id="refresh-btn" 
                        onClick={handleRefresh} 
                        disabled={isRefreshing}
                        className={`p-2.5 rounded-full hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-90 border border-transparent hover:border-[var(--border-color)] ${isRefreshing ? 'animate-spin text-[var(--accent-color)]' : ''}`} 
                        aria-label={t('refresh_prices')}
                    >
                        <RefreshIcon className="w-5 h-5"/>
                    </button>
                    <button 
                        id="settings-btn" 
                        onClick={() => { setActiveView('settings'); vibrate(); }} 
                        className="p-2.5 rounded-full hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95 border border-transparent hover:border-[var(--border-color)]" 
                        aria-label={t('nav_settings')}
                    >
                        <SettingsIcon className="w-5 h-5"/>
                    </button>
                    <button id="notifications-btn" onClick={() => { setActiveView('notificacoes'); vibrate(); }} className="p-2.5 rounded-full hover:bg-[var(--bg-tertiary-hover)] relative text-[var(--text-secondary)] transition-all active:scale-95 border border-transparent hover:border-[var(--border-color)]">
                        <BellIcon className="w-5 h-5" />
                        {unreadNotificationsCount && unreadNotificationsCount > 0 ? (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[var(--bg-primary)]"></span>
                        ) : null}
                    </button>
                </div>
            </header>

            {/* Segmented Control */}
            <div className="px-4 py-2 flex-shrink-0 bg-[var(--bg-primary)]/50 backdrop-blur-sm z-20 border-b border-[var(--border-color)]">
                <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)] shadow-sm relative">
                    {/* Sliding Background */}
                    <div 
                        className="absolute top-1 bottom-1 bg-[var(--bg-primary)] rounded-lg shadow-sm border border-[var(--border-color)] transition-all duration-300 ease-spring"
                        style={{ 
                            left: activeTab === 'general' ? '4px' : '50%', 
                            width: 'calc(50% - 4px)' 
                        }}
                    ></div>

                    <button 
                        onClick={() => { setActiveTab('general'); vibrate(); }} 
                        className={`flex-1 relative z-10 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'general' ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <AnalysisIcon className="w-4 h-4"/>
                        Visão Geral
                    </button>
                    <button 
                        onClick={() => { setActiveTab('transactions'); vibrate(); }} 
                        className={`flex-1 relative z-10 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'transactions' ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <TransactionIcon className="w-4 h-4"/>
                        {t('nav_transactions')}
                    </button>
                </div>
            </div>
            
            <div 
                className="flex-1 overflow-y-auto overscroll-contain no-scrollbar landscape-pb-6 relative"
                ref={containerRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                 {/* Refresh Spinner */}
                 <div 
                    className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none z-20 transition-transform duration-200"
                    style={{ transform: `translateY(${pullDistance > 0 ? pullDistance - 40 : (isRefreshing ? 10 : -100)}px)`, opacity: Math.min(pullDistance / 40, 1) }}
                >
                    <div className="bg-[var(--bg-secondary)] p-2 rounded-full shadow-lg border border-[var(--border-color)]">
                        <RefreshIcon className={`w-5 h-5 text-[var(--accent-color)] ${isRefreshing ? 'animate-spin' : ''}`} />
                    </div>
                </div>

                <div className="max-w-7xl mx-auto pb-24 md:pb-6">
                    {activeTab === 'general' ? (
                        <div className="animate-fade-in">
                            {overviewContent}
                        </div>
                    ) : (
                        <div className="animate-slide-in-right px-4">
                            {transactionsContent}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalysisView;