
import React, { useMemo } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import CountUp from '../CountUp';

const Metric: React.FC<{ label: string; children: React.ReactNode; }> = ({ label, children }) => (
    <div className="flex flex-col">
        <h3 className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1 opacity-70">{label}</h3>
        <div className="font-bold text-lg tracking-tight">{children}</div>
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
        <div id="portfolio-summary" className="relative p-6 rounded-[28px] mb-6 overflow-hidden group shadow-2xl shadow-[var(--accent-color)]/5 transition-all duration-500 border border-[var(--border-color)]">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-[var(--bg-tertiary-hover)] opacity-90"></div>
            
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[var(--accent-color)] opacity-[0.07] blur-[80px] rounded-full pointer-events-none"></div>
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500 opacity-[0.05] blur-[80px] rounded-full pointer-events-none"></div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                     <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-80">{t('my_portfolio')}</h2>
                     <span className="text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-primary)]/50 backdrop-blur-sm px-2 py-0.5 rounded-full border border-[var(--border-color)]">{today}</span>
                </div>
                
                <div className={`mt-3 mb-2 transition-all duration-300 ${privacyMode ? 'blur-md select-none grayscale opacity-50' : ''}`}>
                    <p className="text-[2.75rem] font-black tracking-tighter mb-1 text-[var(--text-primary)] leading-none">
                        <CountUp end={summary.currentValue} formatter={format} />
                    </p>
                    <div className="flex items-center gap-2">
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border ${unrealizedGain >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                            <span className="text-xs font-bold">{unrealizedGain >= 0 ? '▲' : '▼'} {unrealizedGainPercent.toFixed(2)}%</span>
                        </div>
                        <p className={`text-sm font-semibold ${unrealizedGain >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                            {unrealizedGain >= 0 ? '+' : ''} <CountUp end={Math.abs(unrealizedGain)} formatter={format} /> 
                        </p>
                    </div>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent my-6 opacity-60"></div>

                <div className={`grid grid-cols-2 gap-y-6 gap-x-4 transition-all duration-300 ${privacyMode ? 'blur-md select-none grayscale opacity-50' : ''}`}>
                    <Metric label={t('total_invested')}>
                        <p className="text-[var(--text-primary)]"><CountUp end={summary.totalInvested} formatter={format} /></p>
                    </Metric>
                    <Metric label={t('yield_on_cost')}>
                        <p className="text-[var(--accent-color)] drop-shadow-sm"><CountUp end={yieldOnCost} decimals={2} />%</p>
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

export default PortfolioSummary;
