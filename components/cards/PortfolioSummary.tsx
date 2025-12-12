
import React, { useMemo } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import CountUp from '../CountUp';

const Metric: React.FC<{ label: string; value: number; format: (v: number) => string; color?: string }> = ({ label, value, format, color }) => (
    <div className="flex flex-col">
        <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1 opacity-80">{label}</h3>
        <p className={`text-base font-bold tracking-tight ${color || 'text-[var(--text-primary)]'}`}>
            <CountUp end={value} formatter={format} />
        </p>
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
    const today = new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long' });

    const format = (val: number) => {
        let formatted = formatCurrency(val);
        if (preferences.hideCents) formatted = formatted.replace(/,\d{2}$/, '');
        return formatted;
    }

    return (
        <div className="relative bg-[var(--bg-secondary)] rounded-3xl p-6 border border-[var(--border-color)] shadow-sm overflow-hidden animate-fade-in">
            {/* Minimalist Background Decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-color)]/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                     <span className="px-3 py-1 bg-[var(--bg-primary)] rounded-full text-[10px] font-bold text-[var(--text-secondary)] border border-[var(--border-color)] shadow-sm uppercase tracking-wide">
                        {t('my_portfolio')} • {today}
                     </span>
                </div>
                
                <div className={`mb-8 transition-all duration-300 ${privacyMode ? 'blur-md select-none grayscale opacity-50' : ''}`}>
                    <p className="text-4xl font-black tracking-tighter text-[var(--text-primary)] mb-2">
                        <CountUp end={summary.currentValue} formatter={format} />
                    </p>
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${unrealizedGain >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {unrealizedGain >= 0 ? '▲' : '▼'} {Math.abs(unrealizedGainPercent).toFixed(2)}%
                        </div>
                        <span className={`text-sm font-semibold ${unrealizedGain >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                            {unrealizedGain >= 0 ? '+' : ''} <CountUp end={unrealizedGain} formatter={format} /> 
                        </span>
                    </div>
                </div>

                <div className={`grid grid-cols-2 gap-y-6 gap-x-4 pt-6 border-t border-[var(--border-color)] ${privacyMode ? 'blur-md opacity-50' : ''}`}>
                    <Metric label={t('total_invested')} value={summary.totalInvested} format={format} />
                    <Metric label={t('yield_on_cost')} value={yieldOnCost} format={(v) => `${v.toFixed(2)}%`} color="text-[var(--accent-color)]" />
                    <Metric label={t('projected_annual_income')} value={projectedAnnualIncome} format={format} />
                    <Metric label={t('capital_gain')} value={unrealizedGain} format={format} color={unrealizedGain >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'} />
                </div>
            </div>
        </div>
    );
};

export default PortfolioSummary;
