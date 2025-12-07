
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
        const width = 60;
        const height = 24;
        const prices = data.map(d => d.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min === 0 ? 1 : max - min;
        
        return data.map((d, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((d.price - min) / range) * height;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
    }, [data]);

    if (!points) return <div className="w-[60px] h-[24px]"></div>;
    
    return (
        <svg viewBox={`0 0 60 24`} width={60} height={24} className="overflow-visible opacity-80">
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
    const trendColor = isPositive ? 'var(--green-text)' : 'var(--red-text)';

    return (
        <div 
            onClick={() => { onClick(); vibrate(); }} 
            style={style} 
            className="group relative p-4 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-tertiary-hover)] hover:border-[var(--accent-color)]/30 hover:shadow-lg hover:shadow-[var(--accent-color)]/5 transition-all duration-300 animate-fade-in-up active:scale-[0.98] shadow-sm flex flex-col gap-3"
        >
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[var(--bg-primary)] flex items-center justify-center font-bold text-xs text-[var(--text-primary)] border border-[var(--border-color)] shadow-sm group-hover:border-[var(--accent-color)]/40 transition-colors">
                        {asset.ticker.substring(0, 4)}
                    </div>
                    <div>
                        <span className="font-bold text-base block leading-none text-[var(--text-primary)] mb-1 tracking-tight">{asset.ticker}</span>
                        <span className="text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded border border-[var(--border-color)] opacity-80">
                            {t('shares', { count: asset.quantity })}
                        </span>
                    </div>
                </div>
                
                {/* Sparkline (Hidden on tiny screens) */}
                <div className="hidden xs:block opacity-60 group-hover:opacity-100 transition-opacity">
                     <Sparkline data={asset.priceHistory.slice(-20)} color={trendColor} />
                </div>
            </div>
    
            <div className="flex justify-between items-end border-t border-[var(--border-color)]/50 pt-3 mt-1">
                <div className="flex flex-col">
                     <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-60 mb-0.5">Posição</span>
                     <span className={`font-bold text-base text-[var(--text-primary)] transition-all tracking-tight ${privacyMode ? 'blur-sm select-none opacity-50' : ''}`}>
                        {format(currentValue)}
                     </span>
                </div>
                
                <div className="text-right">
                    <div className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border ${isPositive ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/10' : 'bg-rose-500/5 text-rose-500 border-rose-500/10'} ${privacyMode ? 'blur-sm select-none opacity-50' : ''}`}>
                        {isPositive ? '▲' : '▼'} {Math.abs(variationPercent).toFixed(1)}%
                    </div>
                </div>
            </div>
            
            {/* Minimal allocation bar */}
            <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-[var(--bg-primary)] rounded-full overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                 <div className="h-full bg-[var(--accent-color)] shadow-[0_0_8px_var(--accent-color)]" style={{ width: `${allocation}%` }}></div>
            </div>
        </div>
    );
};

export default AssetListItemComponent;
