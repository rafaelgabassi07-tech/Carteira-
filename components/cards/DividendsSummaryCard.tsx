
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
        
        const last6Months = monthlyIncome.slice(-6);
        const maxVal = Math.max(...last6Months.map(d => d.total), 1);

        const chart = last6Months.map((d, index) => ({
            month: d.month,
            value: d.total,
            heightPercent: maxVal > 0 ? (d.total / maxVal) * 100 : 0,
            isCurrent: index === last6Months.length - 1
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
            className="group relative overflow-hidden rounded-[24px] bg-[var(--bg-secondary)] border border-[var(--border-color)] p-0 cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-[var(--accent-color)]/30 active:scale-[0.99] w-full"
        >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--bg-tertiary-hover)]/30 opacity-50 pointer-events-none"></div>
            
            <div className="relative p-5 z-10">
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

                <div className="flex items-end justify-between gap-4 relative">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('average_income')}</span>
                        <div className="text-2xl font-black text-[var(--green-text)] tracking-tight leading-none">
                            <CountUp end={averageIncome} formatter={formatCurrency} />
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-end text-right pl-4 border-l border-[var(--border-color)]/50">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">{t('annual_forecast')}</span>
                        <div className="text-base font-bold text-[var(--accent-color)] tracking-tight">
                            <CountUp end={projectedAnnualIncome} formatter={formatCurrency} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative h-20 w-full mt-2 px-2 pb-0">
                <div className="flex items-end justify-between h-full gap-2 px-4 pb-0">
                    {chartData.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end items-center h-full group/bar relative pb-3">
                            <div 
                                className="w-full max-w-[16px] rounded-t-sm relative transition-all duration-500 ease-out group-hover/bar:brightness-110"
                                style={{ 
                                    height: `${Math.max(d.heightPercent, 10)}%`, 
                                    background: d.isCurrent 
                                        ? 'linear-gradient(to top, var(--accent-color), var(--accent-color))' 
                                        : 'linear-gradient(to top, var(--bg-tertiary-hover), var(--text-secondary))',
                                    opacity: d.isCurrent ? 1 : 0.3
                                }} 
                            />
                            <span className={`absolute bottom-0 text-[8px] font-bold uppercase tracking-wider transition-colors ${d.isCurrent ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)] opacity-50'}`}>
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
