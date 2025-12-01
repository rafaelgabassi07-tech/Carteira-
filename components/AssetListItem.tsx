
import React from 'react';
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
    const allocation = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
    
    const format = (val: number) => {
        let formatted = formatCurrency(val);
        if (hideCents) formatted = formatted.replace(/,\d{2}$/, '');
        return formatted;
    }

    return (
        <div 
            onClick={() => { onClick(); vibrate(); }} 
            style={style} 
            className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-tertiary-hover)] hover:border-[var(--accent-color)]/30 transition-colors duration-200 animate-fade-in-up group active:scale-[0.98] shadow-sm h-full flex flex-col justify-between will-change-transform"
        >
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
                     <div className="bg-[var(--accent-color)] h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${allocation}%` }}></div>
                </div>
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] w-10 text-right">{allocation.toFixed(1)}%</span>
            </div>
        </div>
    );
};

// Custom comparison for performance optimization
const arePropsEqual = (prevProps: AssetListItemProps, nextProps: AssetListItemProps) => {
    // Only re-render if visual data changes
    return (
        prevProps.totalValue === nextProps.totalValue &&
        prevProps.privacyMode === nextProps.privacyMode &&
        prevProps.hideCents === nextProps.hideCents &&
        prevProps.asset.ticker === nextProps.asset.ticker &&
        prevProps.asset.quantity === nextProps.asset.quantity &&
        // Use epsilon for float comparison safety
        Math.abs(prevProps.asset.currentPrice - nextProps.asset.currentPrice) < 0.0001 &&
        Math.abs(prevProps.asset.avgPrice - nextProps.asset.avgPrice) < 0.0001 &&
        // Style might change for animation delays
        JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style)
    );
};

export default React.memo(AssetListItemComponent, arePropsEqual);
