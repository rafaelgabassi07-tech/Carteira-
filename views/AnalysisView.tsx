import React, { useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import PatrimonyEvolutionCard from '../components/PatrimonyEvolutionCard';
import PortfolioPieChart from '../components/PortfolioPieChart';
import BarChart from '../components/BarChart';
import CountUp from '../components/CountUp';
import { vibrate } from '../utils';
import RefreshIcon from '../components/icons/RefreshIcon';
import type { ToastMessage } from '../types';

const AnalysisCard: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode; delay?: number; className?: string }> = ({ title, children, action, delay = 0, className = '' }) => (
    <div className={`bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-color)] shadow-sm animate-fade-in-up transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${className}`} style={{ animationDelay: `${delay}ms` }}>
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-[var(--text-primary)]">{title}</h3>
            {action}
        </div>
        {children}
    </div>
);

const IncomeCard: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const { monthlyIncome, projectedAnnualIncome } = usePortfolio();
    
    const average = useMemo(() => {
         const total = monthlyIncome.reduce((acc, item) => acc + item.total, 0);
         return monthlyIncome.length > 0 ? total / monthlyIncome.length : 0;
    }, [monthlyIncome]);

    return (
        <AnalysisCard title={t('monthly_income')} delay={100}>
            <div className="grid grid-cols-2 gap-4 mb-4 pt-2 border-t border-[var(--border-color)]">
                <div className="flex flex-col">
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mb-0.5">{t('avg_monthly_income_12m')}</span>
                    <span className="font-semibold text-lg text-[var(--green-text)]">
                        <CountUp end={average} formatter={formatCurrency} />
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mb-0.5">{t('projected_annual_income')}</span>
                    <span className="font-semibold text-lg text-[var(--green-text)]">
                        <CountUp end={projectedAnnualIncome} formatter={formatCurrency} />
                    </span>
                </div>
            </div>
             <div className="h-48 w-full">
                 <BarChart data={monthlyIncome} />
             </div>
        </AnalysisCard>
    );
};

const DiversificationCard: React.FC = () => {
    const { t } = useI18n();
    const { assets, preferences } = usePortfolio();
    
    const data = useMemo(() => {
        const segments: Record<string, number> = {};
        let totalValue = 0;
        assets.forEach(a => {
            const val = a.quantity * a.currentPrice;
            const seg = a.segment || t('outros');
            segments[seg] = (segments[seg] || 0) + val;
            totalValue += val;
        });
        
        return Object.entries(segments).map(([name, value]) => ({
            name,
            value,
            percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
        })).sort((a, b) => b.value - a.value);
    }, [assets, t]);

    return (
        <AnalysisCard title={t('diversification')} delay={200}>
            <PortfolioPieChart data={data} goals={preferences.segmentGoals || {}} />
        </AnalysisCard>
    );
};

interface AnalysisViewProps {
    addToast: (message: string, type?: ToastMessage['type']) => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ addToast }) => {
    const { t } = useI18n();
    
    return (
        <div className="p-4 pb-24 md:pb-6 h-full overflow-y-auto custom-scrollbar">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">{t('nav_analysis')}</h1>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="lg:col-span-2">
                        <PatrimonyEvolutionCard />
                    </div>
                    <IncomeCard />
                    <DiversificationCard />
                </div>
            </div>
        </div>
    );
};

export default AnalysisView;