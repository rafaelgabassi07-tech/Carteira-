import React, { useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate } from '../utils';

interface AssetAllocationCardProps {
    onSelectAsset: (ticker: string) => void;
}

const AssetAllocationCard: React.FC<AssetAllocationCardProps> = ({ onSelectAsset }) => {
    const { t, formatCurrency } = useI18n();
    const { assets } = usePortfolio();

    const { sortedAssets, totalValue } = useMemo(() => {
        const total = assets.reduce((acc, asset) => acc + asset.currentPrice * asset.quantity, 0);
        const sorted = [...assets]
            .map(asset => ({
                ...asset,
                currentValue: asset.currentPrice * asset.quantity,
            }))
            .sort((a, b) => b.currentValue - a.currentValue);
        return { sortedAssets: sorted, totalValue: total };
    }, [assets]);

    return (
        <div className={`bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-color)] shadow-sm animate-fade-in-up`} style={{ animationDelay: `300ms` }}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">{t('asset_allocation')}</h3>
            
            <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                {sortedAssets.map(asset => {
                    const percentage = totalValue > 0 ? (asset.currentValue / totalValue) * 100 : 0;
                    return (
                        <div 
                            key={asset.ticker}
                            onClick={() => { onSelectAsset(asset.ticker); vibrate(); }}
                            className="p-3 rounded-xl hover:bg-[var(--bg-tertiary-hover)] cursor-pointer transition-colors"
                        >
                            <div className="flex justify-between items-center text-sm mb-1.5">
                                <span className="font-bold text-[var(--text-primary)]">{asset.ticker}</span>
                                <div className="font-mono text-right">
                                    <span className="font-bold">{formatCurrency(asset.currentValue)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-[var(--bg-primary)] rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-[var(--accent-color)] h-full" style={{ width: `${percentage}%` }}></div>
                                </div>
                                <span className="text-[10px] font-semibold text-[var(--text-secondary)] w-10 text-right">{percentage.toFixed(1)}%</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AssetAllocationCard;