
import React, { useMemo, useRef, useState } from 'react';
import type { View } from '../App';
import type { ToastMessage } from '../types';
import RefreshIcon from '../components/icons/RefreshIcon';
import ShareIcon from '../components/icons/ShareIcon';
import BellIcon from '../components/icons/BellIcon';
import CountUp from '../components/CountUp';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate } from '../utils';
import DividendsSummaryCard from '../components/DividendsSummaryCard';
import PortfolioPieChart from '../components/PortfolioPieChart';

// Icons
const EyeIcon: React.FC<{className?:string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);
const EyeOffIcon: React.FC<{className?:string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
);

const Header: React.FC<{ 
    setActiveView: (view: View) => void;
    onShare: () => void;
    onRefresh: () => void;
    isRefreshing: boolean;
}> = ({ setActiveView, onShare, onRefresh, isRefreshing }) => {
    const { t } = useI18n();
    const { privacyMode, togglePrivacyMode } = usePortfolio();

    return (
        <header className="px-4 py-3 flex justify-between items-center sticky top-0 z-30 glass border-b border-[var(--border-color)] transition-all duration-300">
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
                <button id="privacy-toggle" onClick={() => { togglePrivacyMode(); vibrate(); }} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95" aria-label="Toggle Privacy">
                     {privacyMode ? <EyeOffIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                </button>
                <button id="share-btn" onClick={() => { onShare(); vibrate(); }} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95">
                    <ShareIcon className="w-5 h-5" />
                </button>
                <button id="notifications-btn" onClick={() => { setActiveView('notificacoes'); vibrate(); }} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] relative text-[var(--text-secondary)] transition-all active:scale-95">
                    <BellIcon className="w-5 h-5" />
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

    if (assets.length === 0) return null;

    return (
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-color)] shadow-sm animate-fade-in-up transition-all hover:shadow-md">
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">{t('diversification')}</h3>
            <PortfolioPieChart data={data} goals={preferences.segmentGoals || {}} />
        </div>
    );
};

interface PortfolioViewProps {
    setActiveView: (view: View) => void;
    setTransactionFilter: (ticker: string) => void;
    onSelectAsset: (ticker: string) => void;
    addToast: (message: string, type?: ToastMessage['type']) => void;
    unreadNotificationsCount?: number;
}

const PortfolioView: React.FC<PortfolioViewProps> = ({ setActiveView, addToast }) => {
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
            className="pb-24 md:pb-6 h-full overflow-y-auto overscroll-contain no-scrollbar landscape-pb-6"
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
                <Header setActiveView={setActiveView} onShare={handleShare} onRefresh={handleRefreshPrices} isRefreshing={isRefreshing} />
                
                <div className="md:max-w-2xl md:mx-auto lg:max-w-3xl">
                    <PortfolioSummary />
                </div>

                <div className="px-4 mt-6 space-y-6 md:max-w-2xl md:mx-auto lg:max-w-3xl">
                    {/* Income Report Section */}
                    {assets.length > 0 && <DividendsSummaryCard />}

                    {/* Sector Allocation Section */}
                    {assets.length > 0 && <DiversificationCard />}
                </div>
            </div>
        </div>
    );
};

export default PortfolioView;
