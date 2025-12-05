

import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import type { Asset, ToastMessage, SortOption, Transaction } from '../types';
import type { View } from '../App';
import RefreshIcon from '../components/icons/RefreshIcon';
import SettingsIcon from '../components/icons/SettingsIcon';
import BellIcon from '../components/icons/BellIcon';
import CountUp from '../components/CountUp';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate } from '../utils';
import AssetListItem from '../components/AssetListItem';
import DividendsSummaryCard from '../components/DividendsSummaryCard';
import WalletIcon from '../components/icons/WalletIcon';
import FloatingActionButton from '../components/FloatingActionButton';
import PatrimonyEvolutionCard from '../components/PatrimonyEvolutionCard';
import PortfolioPieChart from '../components/PortfolioPieChart';
import BarChart from '../components/BarChart';

const TransactionModal = React.lazy(() => import('../components/modals/TransactionModal'));

// Icons
const SortIcon: React.FC<{className?:string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>
);

// --- Sub-Components ---
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
        <AnalysisCard title={t('monthly_income')} delay={100}>
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
        const activeAssets = assets.filter(a => a.quantity > 0.000001);

        activeAssets.forEach(a => {
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


const PortfolioSkeleton: React.FC = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-pulse px-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-20 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]"></div>
        ))}
    </div>
);

const Header: React.FC<{ 
    setActiveView: (view: View) => void;
    onRefresh: () => void;
    isRefreshing: boolean;
    unreadNotificationsCount: number;
}> = ({ setActiveView, onRefresh, isRefreshing, unreadNotificationsCount }) => {
    const { t } = useI18n();

    return (
        <header className="px-4 py-3 flex justify-between items-center sticky top-0 z-30 glass border-b border-[var(--border-color)] transition-all duration-300 pt-safe">
            <div className="flex flex-col">
                <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)] leading-tight">Invest</h1>
                <p className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-wider">{t('main_portfolio')}</p>
            </div>
            <div className="flex items-center space-x-2">
                <button 
                    id="refresh-btn" 
                    onClick={() => { onRefresh(); vibrate(); }} 
                    className={`p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95 ${isRefreshing ? 'animate-spin text-[var(--accent-color)]' : ''}`} 
                    aria-label={t('refresh_prices')}
                >
                     <RefreshIcon className="w-5 h-5"/>
                </button>
                <button id="notifications-btn" onClick={() => { setActiveView('notificacoes'); vibrate(); }} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] relative text-[var(--text-secondary)] transition-all active:scale-95">
                    <BellIcon className="w-5 h-5" />
                    {unreadNotificationsCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-color)] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--accent-color)] border-2 border-[var(--bg-secondary)]"></span>
                        </span>
                    )}
                </button>
                <button 
                    id="settings-btn" 
                    onClick={() => { setActiveView('settings'); vibrate(); }} 
                    className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95"
                    aria-label={t('nav_settings')}
                >
                    <SettingsIcon className="w-5 h-5" />
                </button>
            </div>
        </header>
    );
};

const Metric: React.FC<{ label: string; children: React.ReactNode; }> = ({ label, children }) => (
    <div>
        <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">{label}</h3>
        <div className="font-semibold text-lg">{children}</div>
    </div>
);

const PortfolioSummary: React.FC = () => {
    const { t, formatCurrency, locale } = useI18n();
    const { assets, privacyMode, preferences, yieldOnCost, projectedAnnualIncome } = usePortfolio();

    const summary = useMemo(() => {
        return assets.reduce(
            (acc, asset) => {
                const totalInvested = asset.quantity * asset.avgPrice;
                const currentValue = asset.quantity * asset.currentPrice;
                acc.totalInvested += totalInvested;
                acc.currentValue += currentValue;
                return acc;
            },
            { totalInvested: 0, currentValue: 0 }
        );
    }, [assets]);
    
    const unrealizedGain = summary.currentValue - summary.totalInvested;
    const unrealizedGainPercent = summary.totalInvested > 0 ? (unrealizedGain / summary.totalInvested) * 100 : 0;
    const today = new Date().toLocaleDateString(locale, { day: '2-digit', month: 'short' });

    const format = (val: number) => {
        let formatted = formatCurrency(val);
        if (preferences.hideCents) formatted = formatted.replace(/,\d{2}$/, '');
        return formatted;
    }

    return (
        <div id="portfolio-summary" className="bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] p-6 rounded-2xl mx-4 mt-4 shadow-lg border border-[var(--border-color)] animate-scale-in relative overflow-hidden group hover:shadow-[var(--accent-color)]/5 transition-all duration-500">
            {/* Decorative Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-color)] opacity-5 blur-[50px] rounded-full pointer-events-none"></div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-1">
                     <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('my_portfolio')}</h2>
                     <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] border border-[var(--border-color)]">{today}</span>
                </div>
                
                <div className={`mt-2 mb-1 transition-all duration-300 ${privacyMode ? 'blur-md select-none grayscale opacity-50' : ''}`}>
                    <p className="text-4xl font-bold tracking-tight mb-1 text-[var(--text-primary)]">
                        <CountUp end={summary.currentValue} formatter={format} />
                    </p>
                    <p className={`text-sm font-semibold flex items-center gap-1 ${unrealizedGain >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                        {unrealizedGain >= 0 ? '▲' : '▼'}
                        <CountUp end={Math.abs(unrealizedGain)} formatter={format} /> 
                        <span className="opacity-80">({unrealizedGainPercent.toFixed(2)}%)</span>
                    </p>
                </div>

                <div className="border-t border-[var(--border-color)]/50 my-5"></div>

                <div className={`grid grid-cols-2 gap-y-5 gap-x-2 transition-all duration-300 ${privacyMode ? 'blur-md select-none grayscale opacity-50' : ''}`}>
                    <Metric label={t('total_invested')}>
                        <p className="text-[var(--text-primary)]"><CountUp end={summary.totalInvested} formatter={format} /></p>
                    </Metric>
                    <Metric label={t('yield_on_cost')}>
                        <p className="text-[var(--accent-color)]"><CountUp end={yieldOnCost} decimals={2} />%</p>
                    </Metric>
                    <Metric label={t('projected_annual_income')}>
                        <p className="text-[var(--text-primary)]"><CountUp end={projectedAnnualIncome} formatter={format} /></p>
                    </Metric>
                    <Metric label={t('capital_gain')}>
                        <p className={unrealizedGain >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}><CountUp end={unrealizedGain} formatter={format} /></p>
                    </Metric>
                </div>
            </div>
        </div>
    );
};

// --- Main View Component ---

interface PortfolioViewProps {
    setActiveView: (view: View) => void;
    setTransactionFilter: (ticker: string) => void;
    onSelectAsset: (ticker: string) => void;
    addToast: (message: string, type?: ToastMessage['type']) => void;
    unreadNotificationsCount: number;
}

const PortfolioView: React.FC<PortfolioViewProps> = ({ setActiveView, onSelectAsset, addToast, unreadNotificationsCount }) => {
    const { t } = useI18n();
    const { assets, refreshMarketData, privacyMode, preferences, isRefreshing: isContextRefreshing, addTransaction } = usePortfolio();
    const [activeTab, setActiveTab] = useState<'summary' | 'analysis'>('summary');
    const [searchQuery, setSearchQuery] = useState('');
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);
    const [sortOption, setSortOption] = useState<SortOption>(preferences.defaultSort || 'valueDesc');
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    
    const isRefreshing = isContextRefreshing || isPullRefreshing;

    useEffect(() => {
        setSortOption(preferences.defaultSort || 'valueDesc');
    }, [preferences.defaultSort]);

    const handleSaveTransaction = (tx: Omit<Transaction, 'id'> & { id?: string }) => {
        addTransaction({ ...tx, id: String(Date.now()) });
        addToast(t('toast_transaction_added'), 'success');
        setShowAddModal(false);
    };

    // Pull to Refresh Logic
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
                setPullDistance(Math.min(dist * 0.4, 80)); // Resistance
            }
        }
    };

    const handleTouchEnd = () => {
        if (pullDistance > 60) {
            handleRefreshPrices();
        }
        setPullDistance(0);
        touchStartY.current = 0;
    };

    const handleRefreshPrices = async () => {
        setIsPullRefreshing(true);
        vibrate(20);
        addToast(t('toast_updating_prices'));
        try {
            await refreshMarketData(true);
            addToast(t('toast_update_success'), 'success');
        } catch (error: any) {
            console.error("Error refreshing data:", error);
            addToast(error.message || t('toast_update_failed'), 'error');
        } finally {
            setIsPullRefreshing(false);
        }
    };
    
    const totalPortfolioValue = useMemo(() => assets.reduce((acc, asset) => acc + asset.currentPrice * asset.quantity, 0), [assets]);
    
    const processedAssets = useMemo(() => {
        let filtered = assets.filter(asset => 
            asset.quantity > 0.000001 &&
            asset.ticker.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return filtered.sort((a, b) => {
            switch (sortOption) {
                case 'valueDesc': return (b.currentPrice * b.quantity) - (a.currentPrice * a.quantity);
                case 'valueAsc': return (a.currentPrice * a.quantity) - (b.currentPrice * b.quantity);
                case 'tickerAsc': return a.ticker.localeCompare(b.ticker);
                case 'performanceDesc':
                    const perfA = a.avgPrice > 0 ? (a.currentPrice - a.avgPrice) / a.avgPrice : 0;
                    const perfB = b.avgPrice > 0 ? (b.currentPrice - b.avgPrice) / b.avgPrice : 0;
                    return perfB - perfA;
                default: return 0;
            }
        });
    }, [assets, searchQuery, sortOption]);

    const hasActiveAssets = assets.some(a => a.quantity > 0);

    return (
        <>
            <div 
                className="pb-32 h-full overflow-y-auto overscroll-contain no-scrollbar landscape-pb-6"
                ref={containerRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Refresh Spinner */}
                <div 
                    className="fixed top-16 left-0 right-0 flex justify-center pointer-events-none z-20 transition-transform duration-200"
                    style={{ transform: `translateY(${pullDistance > 0 ? pullDistance : (isRefreshing ? 60 : -50)}px)`, opacity: Math.min(pullDistance / 40, 1) }}
                >
                    <div className="bg-[var(--bg-secondary)] p-2 rounded-full shadow-lg border border-[var(--border-color)]">
                        <RefreshIcon className={`w-5 h-5 text-[var(--accent-color)] ${isRefreshing ? 'animate-spin' : ''}`} />
                    </div>
                </div>

                <div className="max-w-7xl mx-auto">
                    <Header setActiveView={setActiveView} onRefresh={handleRefreshPrices} isRefreshing={isRefreshing} unreadNotificationsCount={unreadNotificationsCount} />
                    
                    {hasActiveAssets ? (
                        <div className="animate-fade-in">
                            <div className="px-4 mt-4">
                                <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)]">
                                    <button onClick={() => setActiveTab('summary')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'summary' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>Resumo</button>
                                    <button onClick={() => setActiveTab('analysis')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'analysis' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>Análise</button>
                                </div>
                            </div>
                            
                            {activeTab === 'summary' && (
                                <div className="animate-fade-in">
                                    <div className="md:max-w-2xl md:mx-auto lg:max-w-3xl">
                                        <PortfolioSummary />
                                        <div className="mt-6 mx-4">
                                            <DividendsSummaryCard />
                                        </div>
                                    </div>

                                    <div className="px-4 mt-8">
                                        <div className="flex space-x-3 mb-5">
                                            <div className="flex-1 relative">
                                                <input type="text" placeholder={t('search_asset_placeholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl py-3 pl-4 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all" autoCapitalize="characters" />
                                            </div>
                                            <div className="relative">
                                                <button id="sort-btn" onClick={() => { setIsSortOpen(!isSortOpen); vibrate(); }} className={`h-full px-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-center hover:bg-[var(--bg-tertiary-hover)] transition-colors ${isSortOpen ? 'ring-2 ring-[var(--accent-color)]/50' : ''}`} >
                                                    <SortIcon className="w-5 h-5 text-[var(--text-secondary)]"/>
                                                </button>
                                                {isSortOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-30" onClick={() => setIsSortOpen(false)} />
                                                        <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl z-40 overflow-hidden animate-scale-in origin-top-right glass">
                                                            <div className="p-3 border-b border-[var(--border-color)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('sort_by')}</div>
                                                            {(['valueDesc', 'valueAsc', 'tickerAsc', 'performanceDesc'] as SortOption[]).map(option => (
                                                                <button key={option} onClick={() => { setSortOption(option); setIsSortOpen(false); vibrate(); }} className={`w-full text-left px-4 py-3 text-sm transition-colors flex justify-between items-center ${sortOption === option ? 'text-[var(--accent-color)] font-bold bg-[var(--accent-color)]/10' : 'hover:bg-[var(--bg-tertiary-hover)]'}`} >
                                                                    {t(`sort_${option.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`)}
                                                                    {sortOption === option && <div className="w-2 h-2 rounded-full bg-[var(--accent-color)]"></div>}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <h3 className="font-bold text-lg mb-3 px-1 flex items-center gap-2"> {t('my_assets')} <span className="text-xs font-semibold bg-[var(--bg-secondary)] px-2 py-0.5 rounded text-[var(--text-secondary)] border border-[var(--border-color)]">{processedAssets.length}</span></h3>
                                        {isRefreshing && processedAssets.length === 0 ? <PortfolioSkeleton /> : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-h-[200px] landscape-grid-cols-2">
                                                {processedAssets.map((asset, index) => (
                                                    <AssetListItem key={asset.ticker} asset={asset} totalValue={totalPortfolioValue} onClick={() => onSelectAsset(asset.ticker)} style={{ animationDelay: `${index * 50}ms` }} privacyMode={privacyMode} hideCents={preferences.hideCents}/>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'analysis' && (
                                <div className="animate-fade-in px-4 mt-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="lg:col-span-2">
                                            <PatrimonyEvolutionCard />
                                        </div>
                                        <IncomeCard />
                                        <DiversificationCard />
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[80vh] px-6 text-center animate-fade-in">
                            <div className="w-24 h-24 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-6 border border-[var(--border-color)] shadow-lg">
                                <WalletIcon className="w-10 h-10 text-[var(--text-secondary)] opacity-50"/>
                            </div>
                            <h2 className="text-2xl font-bold mb-2">{t('portfolio_empty_title')}</h2>
                            <p className="text-[var(--text-secondary)] mb-8 max-w-xs leading-relaxed">{t('portfolio_empty_subtitle')}</p>
                            <button
                                id="add-first-transaction-button"
                                onClick={() => { setShowAddModal(true); vibrate(); }}
                                className="bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-opacity-90 transition-all active:scale-95"
                            >
                                {t('add_transaction')}
                            </button>
                        </div>
                    )}
                </div>
                {hasActiveAssets && (
                    <FloatingActionButton id="fab-add-transaction" onClick={() => { setShowAddModal(true); vibrate(); }} />
                )}
            </div>
            {showAddModal && (
                <Suspense fallback={<div />}>
                    <TransactionModal 
                        onClose={() => setShowAddModal(false)} 
                        onSave={handleSaveTransaction}
                        addToast={addToast}
                    />
                </Suspense>
            )}
        </>
    );
};

export default PortfolioView;