
import React, { useMemo } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import CountUp from '../CountUp';
import CalendarIcon from '../icons/CalendarIcon';
import ChevronRightIcon from '../icons/ChevronRightIcon';
import { vibrate } from '../../utils';
import type { View } from '../../App';

interface DividendsSummaryCardProps {
    setActiveView: (view: View) => void;
}

const DividendsSummaryCard: React.FC<DividendsSummaryCardProps> = ({ setActiveView }) => {
    const { t, formatCurrency } = useI18n();
    const { monthlyIncome, projectedAnnualIncome } = usePortfolio();

    const { averageIncome, chartData } = useMemo(() => {
        const relevantMonths = monthlyIncome.filter(m => m.total > 0);
        const total = relevantMonths.reduce((acc, item) => acc + item.total, 0);
        const avg = relevantMonths.length > 0 ? total / relevantMonths.length : 0;
        
        // Take last 5 months to ensure enough space, or 6 if screen is wide enough (stick to 6 for now but optimize width)
        const lastMonths = monthlyIncome.slice(-6);
        const maxVal = Math.max(...lastMonths.map(d => d.total), 1);

        const chart = lastMonths.map((d, index) => ({
            month: d.month,
            value: d.total,
            heightPercent: maxVal > 0 ? (d.total / maxVal) * 100 : 0,
            isCurrent: index === lastMonths.length - 1
        }));

        return {
            averageIncome: avg,
            chartData: chart
        };
    }, [monthlyIncome]);
    
    if (projectedAnnualIncome === 0 && monthlyIncome.every(m => m.total === 0)) return null;

    return (
        <div 
            onClick={() => { vibrate(); setActiveView('incomeReport'); }}
            className="group relative overflow-hidden rounded-[24px] bg-[var(--bg-secondary)] border border-[var(--border-color)] p-0 cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-[var(--accent-color)]/30 active:scale-[0.99] w-full flex flex-col"
        >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--bg-tertiary-hover)]/30 opacity-50 pointer-events-none"></div>
            
            <div className="relative p-5 pb-2 z-10 flex-1">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent-color)] shadow-sm group-hover:scale-110 transition-transform duration-300">
                            <CalendarIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-[var(--text-primary)] leading-none">{t('income_report_title')}</h3>
                            <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-1 group-hover:text-[var(--accent-color)] transition-colors">
                                Histórico e Previsão
                            </p>
                        </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] group-hover:bg-[var(--accent-color)] group-hover:border-[var(--accent-color)] group-hover:text-[var(--accent-color-text)] transition-all duration-300">
                        <ChevronRightIcon className="w-4 h-4" />
                    </div>
                </div>

                {/* Metrics */}
                <div className="flex items-end justify-between gap-4 relative">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('average_income')}</span>
                        <div className="text-3xl font-black text-[var(--green-text)] tracking-tight leading-none">
                            <CountUp end={averageIncome} formatter={formatCurrency} />
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-end text-right pl-4 border-l border-[var(--border-color)]/50">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">{t('annual_forecast')}</span>
                        <div className="text-lg font-bold text-[var(--accent-color)] tracking-tight">
                            <CountUp end={projectedAnnualIncome} formatter={formatCurrency} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart Area - Enhanced Layout */}
            <div className="relative mt-auto w-full px-5 pb-5">
                <div className="flex items-end justify-between gap-2 h-28 pt-4">
                    {chartData.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end items-center h-full group/bar relative">
                            {/* Bar Value Tooltip */}
                            <div className="absolute bottom-[calc(100%+4px)] mb-1 opacity-0 group-hover/bar:opacity-100 transition-all duration-200 pointer-events-none bg-[var(--text-primary)] text-[var(--bg-primary)] text-[9px] font-bold px-2 py-1 rounded-lg shadow-xl whitespace-nowrap z-20 transform translate-y-2 group-hover/bar:translate-y-0">
                                {formatCurrency(d.value)}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--text-primary)]"></div>
                            </div>

                            {/* The Bar Track */}
                            <div className="w-full flex justify-center items-end flex-1">
                                <div 
                                    className={`w-full max-w-[12px] min-h-[4px] rounded-t-full relative transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) group-hover/bar:scale-y-105 origin-bottom ${d.isCurrent ? 'shadow-[0_0_12px_rgba(var(--accent-rgb),0.3)]' : ''}`}
                                    style={{ 
                                        height: `${d.heightPercent}%`, 
                                        background: d.isCurrent 
                                            ? 'var(--accent-color)' 
                                            : 'var(--text-secondary)',
                                        opacity: d.isCurrent ? 1 : 0.2
                                    }} 
                                />
                            </div>
                            
                            {/* Month Label */}
                            <span className={`text-[9px] font-bold uppercase tracking-wider mt-2 transition-colors duration-300 ${d.isCurrent ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)] opacity-60'}`}>
                                {d.month.split('/')[0]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DividendsSummaryCard;
