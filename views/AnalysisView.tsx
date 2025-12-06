
import React, { useState, useMemo, useRef } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import PatrimonyEvolutionCard from '../components/PatrimonyEvolutionCard';
import AssetListItem from '../components/AssetListItem';
import RefreshIcon from '../components/icons/RefreshIcon';
import SortIcon from '../components/icons/SortIcon';
import WalletIcon from '../components/icons/WalletIcon';
import { vibrate } from '../utils';
import type { ToastMessage, SortOption } from '../types';

interface AnalysisViewProps {
    addToast: (message: string, type?: ToastMessage['type']) => void;
    onSelectAsset: (ticker: string) => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ addToast, onSelectAsset }) => {
    const { t } = useI18n();
    const { refreshMarketData, isRefreshing: isContextRefreshing, assets, preferences, privacyMode } = usePortfolio();
    
    // State moved from PortfolioView
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>(preferences.defaultSort || 'valueDesc');
    const [isSortOpen, setIsSortOpen] = useState(false);
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

            <div className="max-w-7xl mx-auto p-4">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">{t('nav_analysis')}</h1>
                    <button 
                        onClick={handleRefresh} 
                        disabled={isRefreshing}
                        className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95 disabled:opacity-50"
                        aria-label={t('refresh_prices')}
                    >
                        <RefreshIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-[var(--accent-color)]' : ''}`} />
                    </button>
                </div>
                
                <div className="w-full">
                    <PatrimonyEvolutionCard />
                </div>

                {/* Assets List Section (Moved from PortfolioView) */}
                <div className="mt-8">
                    {assets.length > 0 ? (
                        <>
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
                                            privacyMode={privacyMode}
                                            hideCents={preferences.hideCents}
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
        </div>
    );
};

export default AnalysisView;
