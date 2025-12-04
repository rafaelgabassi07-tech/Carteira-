
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
            className="group relative p-4 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-tertiary-hover)] hover:border-[var(--accent-color)]/30 transition-all duration-300 animate-fade-in-up active:scale-[0.98] shadow-sm h-full flex flex-col justify-between overflow-hidden"
        >
            {/* Background Gradient Effect on Hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-xl bg-[var(--bg-primary)] flex items-center justify-center font-bold text-sm text-[var(--accent-color)] border border-[var(--border-color)] shadow-inner group-hover:shadow-[var(--accent-color)]/10 transition-all">
                            {asset.ticker.substring(0, 4)}
                        </div>
                        <div>
                             <span className="font-bold text-base block leading-tight text-[var(--text-primary)] tracking-tight">{asset.ticker}</span>
                             <span className="text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded-md border border-[var(--border-color)] inline-block mt-1">
                                {t('shares', {count: asset.quantity})}
                             </span>
                        </div>
                    </div>
                    <div className={`text-right transition-all duration-300 ${privacyMode ? 'blur-md select-none opacity-60' : ''}`}>
                        <p className="font-black text-lg text-[var(--text-primary)] tracking-tight">{format(currentValue)}</p>
                        <div className={`text-xs font-bold flex items-center justify-end gap-1 mt-0.5 ${variation >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                            {variation >= 0 ? '▲' : '▼'} {format(Math.abs(variation))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Allocation Bar */}
            <div className="relative z-10 mt-auto pt-2">
                <div className="flex justify-between items-end mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Alocação</span>
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">{allocation.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-[var(--bg-primary)] rounded-full h-2 overflow-hidden border border-[var(--border-color)]/50">
                     <div 
                        className="bg-[var(--accent-color)] h-full rounded-full transition-all duration-1000 ease-out relative" 
                        style={{ width: `${Math.max(allocation, 2)}%` }}
                    >
                        {/* Shimmer effect on bar */}
                        <div className="absolute top-0 right-0 bottom-0 w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 opacity-50"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Custom comparison for performance optimization
const arePropsEqual = (prevProps: AssetListItemProps, nextProps: AssetListItemProps) => {
    return (
        prevProps.totalValue === nextProps.totalValue &&
        prevProps.privacyMode === nextProps.privacyMode &&
        prevProps.hideCents === nextProps.hideCents &&
        prevProps.asset.ticker === nextProps.asset.ticker &&
        prevProps.asset.quantity === nextProps.asset.quantity &&
        Math.abs(prevProps.asset.currentPrice - nextProps.asset.currentPrice) < 0.0001 &&
        Math.abs(prevProps.asset.avgPrice - nextProps.asset.avgPrice) < 0.0001 &&
        JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style)
    );
};

export default React.memo(AssetListItemComponent, arePropsEqual);
