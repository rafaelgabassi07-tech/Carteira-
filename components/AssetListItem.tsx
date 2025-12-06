
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

const Sparkline: React.FC<{ data: { date: string, price: number }[]; color: string }> = ({ data, color }) => {
    const points = useMemo(() => {
        if (data.length < 2) return '';
        const width = 80;
        const height = 24;
        const prices = data.map(d => d.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min === 0 ? 1 : max - min;
        
        return data.map((d, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((d.price - min) / range) * (height * 0.8) - (height * 0.1); // Add vertical padding
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(' ');
    }, [data]);

    if (!points) return <div className="w-[80px] h-[24px]"></div>;
    
    return (
        <svg viewBox={`0 0 80 24`} width={80} height={24} className="overflow-visible">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                points={points}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

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

    const barColorClass = isPositive
        ? 'bg-gradient-to-r from-emerald-500/70 to-emerald-500'
        : 'bg-gradient-to-r from-rose-500/70 to-rose-500';

    const barStyle = {
        width: `${Math.max(allocation, 0)}%`,
        boxShadow: isPositive
            ? '0 0 10px rgb(16 185 129 / 0.4)'
            : '0 0 10px rgb(244 63 94 / 0.4)',
    };

    return (
        <div 
            onClick={() => { onClick(); vibrate(); }} 
            style={style} 
            className="group relative p-4 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-tertiary-hover)] hover:border-[var(--accent-color)]/30 transition-all duration-300 animate-fade-in-up active:scale-[0.98] shadow-sm flex flex-col justify-between overflow-hidden"
        >
            <div className="flex justify-between items-center w-full gap-4">
                {/* Left side: Ticker and Quantity */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-primary)] flex items-center justify-center font-bold text-xs text-[var(--accent-color)] border border-[var(--border-color)] shadow-inner transition-all group-hover:shadow-md group-hover:shadow-[var(--accent-color)]/10">
                        {asset.ticker.substring(0, 4)}
                    </div>
                    <div>
                        <span className="font-bold text-sm block leading-tight text-[var(--text-primary)]">{asset.ticker}</span>
                        <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                            {t('shares', { count: asset.quantity })}
                        </span>
                    </div>
                </div>
    
                {/* Middle: Sparkline */}
                <div className="flex-grow hidden sm:flex items-center justify-center">
                     <Sparkline 
                        data={asset.priceHistory.slice(-30)} 
                        color={isPositive ? 'var(--green-text)' : 'var(--red-text)'} 
                     />
                </div>
                
                {/* Right side: Value and Variation */}
                <div className={`text-right flex-shrink-0 min-w-[80px] transition-all duration-300 ${privacyMode ? 'blur-md select-none' : ''}`}>
                    <p className="font-bold text-sm text-[var(--text-primary)] tracking-tight">{format(currentValue)}</p>
                    <div className={`text-xs font-semibold mt-0.5 ${isPositive ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                        {isPositive ? '▲' : '▼'} {Math.abs(variationPercent).toFixed(2)}%
                    </div>
                </div>
            </div>
    
            {/* Bottom: Allocation bar */}
            <div className="mt-4">
                <div className="flex justify-between items-center mb-1.5">
                     <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Alocação</span>
                     <span className="text-[10px] font-bold text-[var(--text-primary)]">{allocation.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-[var(--bg-primary)] rounded-full h-1.5 overflow-hidden shadow-inner">
                     <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${barColorClass}`}
                        style={barStyle}
                    />
                </div>
            </div>
        </div>
    );
};

export default AssetListItemComponent;