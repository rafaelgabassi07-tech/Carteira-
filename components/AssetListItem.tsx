import React, { useMemo } from 'react';
import type { Asset } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { vibrate } from '../utils';

interface AssetListItemProps {
    asset: Asset;
    totalValue: number;
    onClick: () => void;
    style?: React.CSSProperties;
    privacyMode: boolean;
    hideCents: boolean;
}

const AssetListItemComponent: React.FC<AssetListItemProps> = ({ asset, totalValue, onClick, style, privacyMode, hideCents }) => {
    const { t, formatCurrency } = useI18n();
    const currentValue = asset.quantity * asset.currentPrice;
    const totalInvested = asset.quantity * asset.avgPrice;
    const variation = currentValue - totalInvested;
    const variationPercent = totalInvested > 0 ? (variation / totalInvested) * 100 : 0;
    const allocation = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
    
    const format = (val: number) => {
        let formatted = formatCurrency(val);
        if (hideCents) formatted = formatted.replace(/,\d{2}$/, '');
        return formatted;
    }
    
    const isPositive = variation >= 0;
    const trendColor = isPositive ? 'var(--green-text)' : 'var(--red-text)';

    return (
        <div 
            onClick={() => { onClick(); vibrate(); }} 
            style={style} 
            className="group relative p-4 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-tertiary-hover)] hover:border-[var(--accent-color)]/30 hover:shadow-xl hover:shadow-[var(--accent-color)]/10 transition-all duration-300 animate-fade-in-up active:scale-[0.98] shadow-sm"
        >
            <div className="flex justify-between items-center">
                {/* Left Side: Ticker & Info */}
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--bg-primary)] flex items-center justify-center font-bold text-sm text-[var(--text-primary)] border border-[var(--border-color)] shadow-sm group-hover:border-[var(--accent-color)]/40 transition-colors">
                        {asset.ticker.substring(0, 4)}
                    </div>
                    <div>
                        <span className="font-bold text-base block text-[var(--text-primary)] tracking-tight">{asset.ticker}</span>
                        <span className="text-xs font-medium text-[var(--text-secondary)] opacity-80">
                            {asset.quantity} {t('shares', { count: '' }).trim()}
                        </span>
                    </div>
                </div>
                
                {/* Right Side: Value & Performance */}
                <div className="flex flex-col items-end">
                    <span className={`font-bold text-lg text-[var(--text-primary)] transition-all tracking-tight ${privacyMode ? 'blur-sm select-none opacity-50' : ''}`}>
                        {format(currentValue)}
                    </span>
                    <div className={`text-xs font-semibold ${isPositive ? 'text-emerald-500' : 'text-rose-500'} ${privacyMode ? 'blur-sm select-none opacity-50' : ''}`}>
                        {isPositive ? '+' : ''}{format(variation)} ({variationPercent.toFixed(1)}%)
                    </div>
                </div>
            </div>
            
            {/* Allocation Bar */}
            <div className="absolute bottom-2 left-4 right-4 h-1 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                 <div className="h-full bg-[var(--accent-color)] shadow-[0_0_8px_var(--accent-color)] transition-all duration-500" style={{ width: `${allocation}%` }}></div>
            </div>
        </div>
    );
};

export default AssetListItemComponent;