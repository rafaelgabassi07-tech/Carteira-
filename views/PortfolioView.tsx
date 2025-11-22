import React, { useState, useMemo, useRef } from 'react';
import type { Asset, ToastMessage, SortOption } from '../types';
import type { View } from '../App';
import RefreshIcon from '../components/icons/RefreshIcon';
import ShareIcon from '../components/icons/ShareIcon';
import BellIcon from '../components/icons/BellIcon';
import CountUp from '../components/CountUp';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { generateCalendarEvents } from '../services/dynamicDataService';
import CalendarIcon from '../components/icons/CalendarIcon';
import { vibrate } from '../utils';

// Icons
const EyeIcon: React.FC<{className?:string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);
const EyeOffIcon: React.FC<{className?:string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
);
const SortIcon: React.FC<{className?:string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>
);
const WalletIcon: React.FC<{className?:string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
);

// --- Components ---

const PortfolioSkeleton: React.FC = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-pulse px-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-20 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]"></div>
        ))}
    </div>
);

const Header: React.FC<{ 
    setActiveView: (view: View) => void;
    onShare: () => void;
    onRefresh: () => void;
    isRefreshing: boolean;
}> = ({ setActiveView, onShare, onRefresh, isRefreshing }) => {
    const { t } = useI18n();
    const { privacyMode, togglePrivacyMode, preferences } = usePortfolio();
    
    const isPremium = preferences.visualStyle === 'premium';

    return (
        <header className={`px-4 py-3 flex justify-between items-center sticky z-30 glass transition-all duration-300 ${
            isPremium 
                ? 'top-3 mx-4 rounded-2xl' 
                : 'top-0 border-b border-[var(--border-color)]'
        }`}>
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
                <button id="privacy-toggle" onClick={() => { togglePrivacyMode(); vibrate(); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95" aria-label="Toggle Privacy">
                     {privacyMode ? <EyeOffIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                </button>
                <button id="share-btn" onClick={() => { onShare(); vibrate(); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95">
                    <ShareIcon className="w-5 h-5" />
                </button>
                <button id="notifications-btn" onClick={() => { setActiveView('notificacoes'); vibrate(); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] relative text-[var(--text-secondary)] transition-all active:scale-95">
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
        <div id="portfolio-summary" className="bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] p-6 rounded-2xl shadow-lg border border-[var(--border-color)] animate-scale-in relative overflow-hidden group hover:shadow-[var(--accent-color)]/5 transition-all duration-500 h-full">
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

const DividendCalendar: React.FC = () => {
    const { t, formatCurrency, locale } = useI18n();
    const { assets } = usePortfolio();

    const events = useMemo(() => generateCalendarEvents(assets), [assets]);

    if (events.length === 0) {
         return (
            <div className="bg-[var(--bg-secondary)] p-6 rounded-2xl animate-scale-in flex flex-col items-center text-center justify-center h-full min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary-hover)] flex items-center justify-center mb-3 text-[var(--text-secondary)]">
                    <CalendarIcon className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('dividend_calendar')}</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-[150px] leading-relaxed">{t('no_dividends_scheduled')}</p>
            </div>
         );
    }

    return (
        <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl animate-scale-in h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-[var(--accent-color)]" />
                    <h3 className="font-bold text-sm uppercase tracking-wider text-[var(--text-primary)]">{t('dividend_calendar')}</h3>
                </div>
                <span className="text-[10px] font-bold bg-[var(--accent-color)]/10 text-[var(--accent-color)] px-2 py-0.5 rounded-full">
                    {t('next_payments')}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-[280px] lg:max-h-none">
                <div className="space-y-3">
                    {events.map((event, idx) => {
                        const dateObj = new Date(event.date);
                        const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
                        const adjustedDate = new Date(dateObj.getTime() + userTimezoneOffset);
                        
                        const day = adjustedDate.getDate();
                        const month = adjustedDate.toLocaleDateString(locale, { month: 'short' }).toUpperCase().replace('.', '');
                        const isPaid = event.eventType === 'Pago';

                        return (
                            <div key={`${event.ticker}-${idx}`} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${isPaid ? 'bg-[var(--bg-primary)] border-transparent opacity-50' : 'bg-[var(--bg-tertiary-hover)] border-[var(--border-color)]'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg ${isPaid ? 'bg-[var(--text-secondary)]/20 text-[var(--text-secondary)]' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)]'}`}>
                                        <span className="text-[9px] font-bold uppercase leading-none">{month}</span>
                                        <span className="text-sm font-bold leading-none">{day}</span>
                                    </div>
                                    <div>
                                        <span className="block font-bold text-sm">{event.ticker}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isPaid ? 'bg-gray-500/20 text-gray-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                            {event.eventType}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`block font-bold text-sm ${isPaid ? 'text-[var(--text-secondary)]' : 'text-[var(--green-text)]'}`}>
                                        {event.projectedAmount ? formatCurrency(event.projectedAmount) : '-'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// Memoized Asset Item
const AssetListItem = React.memo<{ asset: Asset, totalValue: number, onClick: () => void, style?: React.CSSProperties, privacyMode: boolean, hideCents: boolean }>(({ asset, totalValue, onClick, style, privacyMode, hideCents }) => {
    const { t, formatCurrency } = useI18n();
    const currentValue = asset.quantity * asset.currentPrice;
    const totalInvested = asset.quantity * asset.avgPrice;
    const variation = currentValue - totalInvested;
    const allocation = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
    
    const format = (val: number) => {
        let formatted = formatCurrency(val);
        if (hideCents) formatted = formatted.replace(/,\d{2}$/, '');
        return formatted;
    }

    return (
        <div onClick={() => { onClick(); vibrate(); }} style={style} className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-tertiary-hover)] hover:border-[var(--accent-color)]/30 transition-all duration-200 animate-fade-in-up group active:scale-[0.98] shadow-sm h-full flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center space-x-3">
                        <div className="w-11 h-11 rounded-xl bg-[var(--bg-primary)] flex items-center justify-center font-bold text-sm text-[var(--accent-color)] border border-[var(--border-color)] shadow-inner">
                            {asset.ticker.substring(0, 4)}
                        </div>
                        <div>
                             <span className="font-bold text-base block leading-tight text-[var(--text-primary)]">{asset.ticker}</span>
                             <span className="text-xs text-[var(--text-secondary)]">{t('shares', {count: asset.quantity})}</span>
                        </div>
                    </div>
                    <div className={`text-right transition-all duration-300 ${privacyMode ? 'blur-sm select-none opacity-60' : ''}`}>
                        <p className="font-bold text-base">{format(currentValue)}</p>
                        <div className={`text-xs font-bold flex items-center justify-end gap-1 ${variation >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                            {variation >= 0 ? '+' : ''}{format(variation)}
                        </div>
                    </div>
                </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
                 <div className="flex-1 bg-[var(--bg-primary)] rounded-full h-1.5 overflow-hidden">
                     <div className="bg-[var(--accent-color)] h-full rounded-full transition-all duration-1000" style={{ width: `${allocation}%` }}></div>
                </div>
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] w-10 text-right">{allocation.toFixed(1)}%</span>
            </div>
        </div>
    );
});

interface PortfolioViewProps {
    setActiveView: (view: View) => void;
    setTransactionFilter: (ticker: string) => void;
    onSelectAsset: (ticker: string) => void;
    addToast: (message: string, type?: ToastMessage['type']) => void;
}

const PortfolioView: React.FC<PortfolioViewProps> = ({ setActiveView, onSelectAsset, addToast }) => {
    const { t, formatCurrency } = useI18n();
    const { assets, privacyMode, preferences, isRefreshing, refreshAllData } = usePortfolio();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>(preferences.defaultSort || 'valueDesc');
    const [isSortOpen, setIsSortOpen] = useState(false);

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
            handleGlobalRefresh();
        }
        setPullDistance(0);
        touchStartY.current = 0;
    };

    const handleGlobalRefresh = async () => {
        vibrate(20);
        addToast(t('toast_updating_prices'));
        try {
            await refreshAllData();
            addToast(t('toast_update_success'), 'success');
        } catch (error: any) {
            // Error is handled by the global error handler in App.tsx
            console.error("Error refreshing all data:", error);
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
                <Header setActiveView={setActiveView} onShare={handleShare} onRefresh={handleGlobalRefresh} isRefreshing={isRefreshing} />
                
                {assets.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-7xl mx-auto px-4 mt-6">
                            <div className="lg:col-span-8">
                                 <PortfolioSummary />
                            </div>
                            <div className="lg:col-span-4">
                                 <DividendCalendar />
                            </div>
                        </div>

                        <div className="px-4 mt-8">
                            <div className="flex space-x-3 mb-5">
                                <div className="flex-1 relative">
                                    <input 
                                        type="text" 
                                        placeholder={t('search_asset_placeholder')} 
                                        value={searchQuery} 
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl py-3 pl-4 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all"
                                        autoCapitalize="characters"
                                    />
                                </div>
                                <div className="relative">
                                    <button 
                                        id="sort-btn"
                                        onClick={() => { setIsSortOpen(!isSortOpen); vibrate(); }}
                                        className={`h-full px-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-center hover:bg-[var(--bg-tertiary-hover)] transition-colors ${isSortOpen ? 'ring-2 ring-[var(--accent-color)]/50' : ''}`}
                                    >
                                        <SortIcon className="w-5 h-5 text-[var(--text-secondary)]"/>
                                    </button>
                                    {isSortOpen && (
                                        <>
                                            <div className="fixed inset-0 z-30" onClick={() => setIsSortOpen(false)} />
                                            <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl z-40 overflow-hidden animate-scale-in origin-top-right glass">
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
                                <PortfolioSkeleton />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 landscape-grid-cols-2">
                                    {processedAssets.map((asset, index) => (
                                        <AssetListItem 
                                            key={asset.ticker}
                                            asset={asset} 
                                            totalValue={totalPortfolioValue}
                                            onClick={() => onSelectAsset(asset.ticker)} 
                                            style={{ animationDelay: `${index * 50}ms` }}
                                            privacyMode={privacyMode}
                                            hideCents={preferences.hideCents}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[80vh] px-6 text-center animate-fade-in">
                        <div className="w-24 h-24 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-6 border border-[var(--border-color)] shadow-lg">
                            <WalletIcon className="w-10 h-10 text-[var(--text-secondary)] opacity-50"/>
                        </div>
                        <h2 className="text-2xl font-bold mb-2">{t('portfolio_empty_title')}</h2>
                        <p className="text-[var(--text-secondary)] mb-8 max-w-xs leading-relaxed">{t('portfolio_empty_subtitle')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PortfolioView;