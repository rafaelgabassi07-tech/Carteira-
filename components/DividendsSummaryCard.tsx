import React, { useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from './CountUp';
import CalendarIcon from './icons/CalendarIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import SparklesIcon from './icons/SparklesIcon';
import { vibrate } from '../utils';
import type { View } from '../App';

interface DividendsSummaryCardProps {
    setActiveView: (view: View) => void;
}

const DividendsSummaryCard: React.FC<DividendsSummaryCardProps> = ({ setActiveView }) => {
    const { t, formatCurrency } = useI18n();
    const { monthlyIncome, projectedAnnualIncome } = usePortfolio();

    const { currentMonthValue, averageIncome } = useMemo(() => {
        const now = new Date();
        const currentMonthStr = now.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
        
        const currentMonthEntry = monthlyIncome.find(m => m.month.toLowerCase() === currentMonthStr.toLowerCase());
        const currentVal = currentMonthEntry ? currentMonthEntry.total : 0;
        
        const relevantMonths = monthlyIncome.filter(m => m.total > 0);
        const total = relevantMonths.reduce((acc, item) => acc + item.total, 0);
        const avg = relevantMonths.length > 0 ? total / relevantMonths.length : 0;
        
        return {
            currentMonthValue: currentVal,
            averageIncome: avg,
        };
    }, [monthlyIncome]);
    
    if (projectedAnnualIncome === 0 && monthlyIncome.length === 0) return null;

    return (
        <div 
            onClick={() => { vibrate(); setActiveView('incomeReport'); }}
            className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm cursor-pointer hover:bg-[var(--bg-tertiary-hover)] transition-all active:scale-[0.99] group relative overflow-hidden w-full flex flex-col justify-between min-h-[160px]"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                        <CalendarIcon className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                        {t('income_report_title')}
                    </span>
                    <div className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                        <CountUp end={currentMonthValue} formatter={formatCurrency} />
                    </div>
                </div>
                <div className="p-2 bg-[var(--bg-primary)] rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors">
                    <ChevronRightIcon className="w-4 h-4" />
                </div>
            </div>
            <div className="mt-auto pt-4 border-t border-[var(--border-color)]/50 grid grid-cols-2 gap-4">
                <div>
                    <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase block mb-0.5">Média Mensal</span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                        <CountUp end={averageIncome} formatter={formatCurrency} />
                    </span>
                </div>
                <div className="text-right">
                    <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase block flex items-center justify-end gap-1 mb-0.5">
                        Previsão Anual <SparklesIcon className="w-2.5 h-2.5 text-[var(--accent-color)]"/>
                    </span>
                    <span className="text-sm font-bold text-[var(--accent-color)]">
                        <CountUp end={projectedAnnualIncome} formatter={formatCurrency} />
                    </span>
                </div>
            </div>
        </div>
    );
};

export default DividendsSummaryCard;