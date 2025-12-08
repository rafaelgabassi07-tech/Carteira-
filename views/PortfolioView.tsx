
import React, { useMemo, useRef, useState } from 'react';
import type { ToastMessage } from '../types';
import type { View } from '../App';
import RefreshIcon from '../components/icons/RefreshIcon';
import ShareIcon from '../components/icons/ShareIcon';
import BellIcon from '../components/icons/BellIcon';
import SettingsIcon from '../components/icons/SettingsIcon';
import CountUp from '../components/CountUp';
import FloatingActionButton from '../components/FloatingActionButton';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate } from '../utils';
import PortfolioPieChart from '../components/PortfolioPieChart';
import DividendsSummaryCard from '../components/DividendsSummaryCard';

// Icons
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
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-color)] shadow-sm animate-fade-in-up hover:bg-[var(--bg-tertiary-hover)] transition-colors duration-300" style={{ animationDelay: `200ms` }}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">{t('diversification')}</h3>
            <PortfolioPieChart data={data} goals={preferences.segmentGoals || {}} />
        </div>
    );
};

interface PortfolioViewProps {
    setActiveView: (view: View) => void;
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
                        {/* Summary Moved to Analysis View */}
                        
                        <div className="px-4 mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 pb-6">
                            <div className="animate-fade-in-up" style={{ animationDelay: `100ms` }}>
                                <DividendsSummaryCard setActiveView={setActiveView} />
                            </div>
                            <DiversificationCard />
                        </div>
                    </>
                ) : (
                    <div className="relative h-[80vh]">
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center animate-fade-in">
                            <div className="w-24 h-24 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-6 border border-[var(--border-color)] shadow-xl shadow-[var(--accent-color)]/5">
                                <WalletIcon className="w-10 h-10 text-[var(--text-secondary)] opacity-50"/>
                            </div>
                            <h2 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">{t('portfolio_empty_title')}</h2>
                            <p className="text-[var(--text-secondary)] mb-8 max-w-xs leading-relaxed">{t('portfolio_empty_subtitle')}</p>
                        </div>
                        <FloatingActionButton id="add-first-transaction-button" onClick={() => { setActiveView('transacoes'); vibrate(); }} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default PortfolioView;
