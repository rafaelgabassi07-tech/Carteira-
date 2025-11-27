
import React, { useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import PatrimonyEvolutionCard from '../components/PatrimonyEvolutionCard';
import AssetListItem from '../components/AssetListItem';
import RefreshIcon from '../components/icons/RefreshIcon';
import SortIcon from '../components/icons/SortIcon';
import type { ToastMessage, SortOption } from '../types';
import { vibrate } from '../utils';

interface AnalysisViewProps {
    addToast: (message: string, type?: ToastMessage['type']) => void;
    onSelectAsset: (ticker: string) => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ addToast, onSelectAsset }) => {
    const { t } = useI18n();
    const { refreshMarketData, isRefreshing, assets, preferences, privacyMode } = usePortfolio();
    
    // Sorting & Filtering Logic (Moved from PortfolioView)
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>(preferences.defaultSort || 'valueDesc');
    const [isSortOpen, setIsSortOpen] = useState(false);

    const handleRefresh = async () => {
        vibrate();
        addToast(t('toast_updating_prices'));
        try {
            await refreshMarketData(true);
            addToast(t('toast_update_success'), 'success');
        } catch (error: any) {
            addToast(error.message || t('toast_update_failed'), 'error');
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

    // Skeleton for assets list
    const AssetsSkeleton: React.FC = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-20 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]"></div>
            ))}
        </div>
    );
    
    return (
        <div className="p-4 pb-24 md:pb-6 h-full overflow-y-auto custom-scrollbar landscape-pb-6">
            <div className="max-w-7xl mx-auto">
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
                
                {/* Top Section: Evolution Chart */}
                <div className="mb-8">
                    <PatrimonyEvolutionCard />
                </div>

                {/* Bottom Section: Assets List */}
                <div>
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
                        <AssetsSkeleton />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-h-[200px] landscape-grid-cols-2">
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
            </div>
        </div>
    );
};

export default AnalysisView;
