
import React, { useMemo, useRef, useState } from 'react';
import type { ToastMessage } from '../types';
import type { View } from '../App';
import RefreshIcon from '../components/icons/RefreshIcon';
import ShareIcon from '../components/icons/ShareIcon';
import BellIcon from '../components/icons/BellIcon';
import CountUp from '../components/CountUp';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate } from '../utils';
import PortfolioPieChart from '../components/PortfolioPieChart';
import BarChart from '../components/BarChart';

// Icons
const EyeIcon: React.FC<{className?:string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);
const EyeOffIcon: React.FC<{className?:string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
);
const WalletIcon: React.FC<{className?:string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
);

// --- Components ---

const Header: React.FC<{ 
    setActiveView: (view: View) => void;
    onShare: () => void;
    onRefresh: () => void;
    isRefreshing: boolean;
    unreadNotificationsCount?: number;
}> = ({ setActiveView, onShare, onRefresh, isRefreshing, unreadNotificationsCount }) => {
    const { t } = useI18n();
    const { privacyMode, togglePrivacyMode } = usePortfolio();

    return (
        <header className="px-4 py-3 flex justify-between items-center sticky top-0 z-30 glass border-b border-[var(--border-color)]/50 transition-all duration-300">
            <div className="flex flex-col">
                <h1 className="text-xl font-black tracking-tight text-[var(--text-primary)] leading-tight flex items-center gap-1">
                    Invest
                    <span className="w-1.5 h-1.5 bg-[var(--accent-color)] rounded-full animate-pulse mt-1"></span>
                </h1>
                <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-80">{t('main_portfolio')}</p>
            </div>
            <div className="flex items-center gap-2">
                <button 
                    id="refresh-btn" 
                    onClick={() => { onRefresh(); vibrate(); }} 
                    className={`p-2.5 rounded-full hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-90 border border-transparent hover:border-[var(--border-color)] ${isRefreshing ? 'animate-spin text-[var(--accent-color)]' : ''}`} 
                    aria-label={t('refresh_prices')}
                >
                     <RefreshIcon className="w-5 h-5"/>
                </button>
                <button id="privacy-toggle" onClick={() => { togglePrivacyMode(); vibrate(); }} className="p-2.5 rounded-full hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95 border border-transparent hover:border-[var(--border-color)]" aria-label="Toggle Privacy">
                     {privacyMode ? <EyeOffIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                </button>
                <button id="notifications-btn" onClick={() => { setActiveView('notificacoes'); vibrate(); }} className="p-2.5 rounded-full hover:bg-[var(--bg-tertiary-hover)] relative text-[var(--text-secondary)] transition-all active:scale-95 border border-transparent hover:border-[var(--border-color)]">
                    <BellIcon className="w-5 h-5" />
                    {unreadNotificationsCount && unreadNotificationsCount > 0 ? (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[var(--bg-primary)]"></span>
                    ) : null}
                </button>
            </div>
        </header>
    );
};

const Metric: React.FC<{ label: string; children: React.ReactNode; }> = ({ label, children }) => (
    <div className="flex flex-col">
        <h3 className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1 opacity-70">{label}</h3>
        <div className="font-bold text-lg tracking-tight">{children}</div>
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
    const today = new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long' });

    const format = (val: number) => {
        let formatted = formatCurrency(val);
        if (preferences.hideCents) formatted = formatted.replace(/,\d{2}$/, '');
        return formatted;
    }

    return (
        <div id="portfolio-summary" className="relative p-6 rounded-[28px] mx-4 mt-6 overflow-hidden group shadow-2xl shadow-[var(--accent-color)]/5 transition-all duration-500 border border-[var(--border-color)]">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-[var(--bg-tertiary-hover)] opacity-90"></div>
            
            {/* Subtle Noise/Glow Effect */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[var(--accent-color)] opacity-[0.07] blur-[80px] rounded-full pointer-events-none"></div>
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500 opacity-[0.05] blur-[80px] rounded-full pointer-events-none"></div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                     <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-80">{t('my_portfolio')}</h2>
                     <span className="text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-primary)]/50 backdrop-blur-sm px-2 py-0.5 rounded-full border border-[var(--border-color)]">{today}</span>
                </div>
                
                <div className={`mt-3 mb-2 transition-all duration-300 ${privacyMode ? 'blur-md select-none grayscale opacity-50' : ''}`}>
                    <p className="text-[2.75rem] font-black tracking-tighter mb-1 text-[var(--text-primary)] leading-none">
                        <CountUp end={summary.currentValue} formatter={format} />
                    </p>
                    <div className="flex items-center gap-2">
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border ${unrealizedGain >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                            <span className="text-xs font-bold">{unrealizedGain >= 0 ? '▲' : '▼'} {unrealizedGainPercent.toFixed(2)}%</span>
                        </div>
                        <p className={`text-sm font-semibold ${unrealizedGain >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                            {unrealizedGain >= 0 ? '+' : ''} <CountUp end={Math.abs(unrealizedGain)} formatter={format} /> 
                        </p>
                    </div>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent my-6 opacity-60"></div>

                <div className={`grid grid-cols-2 gap-y-6 gap-x-4 transition-all duration-300 ${privacyMode ? 'blur-md select-none grayscale opacity-50' : ''}`}>
                    <Metric label={t('total_invested')}>
                        <p className="text-[var(--text-primary)]"><CountUp end={summary.totalInvested} formatter={format} /></p>
                    </Metric>
                    <Metric label={t('yield_on_cost')}>
                        <p className="text-[var(--accent-color)] drop-shadow-sm"><CountUp end={yieldOnCost} decimals={2} />%</p>
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

const DashboardCard: React.FC<{ title: string; children: React.ReactNode; delay?: number }> = ({ title, children, delay = 0 }) => (
    <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-color)] shadow-sm animate-fade-in-up hover:bg-[var(--bg-tertiary-hover)] transition-colors duration-300" style={{ animationDelay: `${delay}ms` }}>
        <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">{title}</h3>
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
        <DashboardCard title={t('monthly_income')} delay={100}>
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
        </DashboardCard>
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
        <DashboardCard title={t('diversification')} delay={200}>
            <PortfolioPieChart data={data} goals={preferences.segmentGoals || {}} />
        </DashboardCard>
    );
};

interface PortfolioViewProps {
    setActiveView: (view: View) => void;
    setTransactionFilter: (ticker: string) => void;
    onSelectAsset: (ticker: string) => void;
    addToast: (message: string, type?: ToastMessage['type']) => void;
    unreadNotificationsCount?: number;
}

const PortfolioView: React.FC<PortfolioViewProps> = ({ setActiveView, onSelectAsset, addToast, unreadNotificationsCount }) => {
    const { t, formatCurrency } = useI18n();
    const { assets, refreshMarketData, isRefreshing: isContextRefreshing } = usePortfolio();
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);
    
    const isRefreshing = isContextRefreshing || isPullRefreshing;

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

    const handleShare = async () => {
        const totalValue = assets.reduce((acc, asset) => acc + asset.currentPrice * asset.quantity, 0);
        const shareData = {
            title: t('share_portfolio_title'),
            text: t('share_portfolio_text', { value: formatCurrency(totalValue) }),
            url: window.location.origin,
        };
        try {
            if (navigator.share) await navigator.share(shareData);
            else {
                await navigator.clipboard.writeText(shareData.text);
                addToast('Copiado para área de transferência!', 'success');
            }
        } catch (err) {
            // User cancelled
        }
    };

    return (
        <div 
            className="pb-24 md:pb-6 h-full overflow-y-auto overscroll-contain no-scrollbar landscape-pb-6 scroll-smooth"
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
                <Header setActiveView={setActiveView} onShare={handleShare} onRefresh={handleRefreshPrices} isRefreshing={isRefreshing} unreadNotificationsCount={unreadNotificationsCount} />
                
                {assets.length > 0 ? (
                    <>
                        <div className="md:max-w-2xl md:mx-auto lg:max-w-3xl">
                            <PortfolioSummary />
                        </div>

                        <div className="px-4 mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 pb-6">
                            <IncomeCard />
                            <DiversificationCard />
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[80vh] px-6 text-center animate-fade-in">
                        <div className="w-24 h-24 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-6 border border-[var(--border-color)] shadow-xl shadow-[var(--accent-color)]/5">
                            <WalletIcon className="w-10 h-10 text-[var(--text-secondary)] opacity-50"/>
                        </div>
                        <h2 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">{t('portfolio_empty_title')}</h2>
                        <p className="text-[var(--text-secondary)] mb-8 max-w-xs leading-relaxed">{t('portfolio_empty_subtitle')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PortfolioView;
