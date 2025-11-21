
import React, { useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import PortfolioLineChart from '../components/PortfolioLineChart';
import PortfolioPieChart from '../components/PortfolioPieChart';
import BarChart from '../components/BarChart';
import CountUp from '../components/CountUp';

const AnalysisCard: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode; delay?: number }> = ({ title, children, action, delay = 0 }) => (
    <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 mb-4 border border-[var(--border-color)] shadow-sm animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-[var(--text-primary)]">{title}</h3>
            {action}
        </div>
        {children}
    </div>
);

const PerformanceCard: React.FC = () => {
    const { t, locale, formatCurrency } = useI18n();
    const { assets } = usePortfolio();
    const [timeRange, setTimeRange] = useState('12M');

    const { portfolioData, dateLabels, endValue, gain, percentageGain } = useMemo(() => {
        if (assets.length === 0) return { portfolioData: [], dateLabels: [], endValue: 0, gain: 0, percentageGain: 0 };
        
        const maxHistoryLength = Math.max(...assets.map(a => a.priceHistory.length), 0);
        if (maxHistoryLength === 0) return { portfolioData: [], dateLabels: [], endValue: 0, gain: 0, percentageGain: 0 };
        
        const aggregatedHistory = Array(maxHistoryLength).fill(0);

        assets.forEach(asset => {
            const history = asset.priceHistory;
            const offset = maxHistoryLength - history.length;
            const oldestPrice = history[0] || 0;
            
            for (let i = 0; i < maxHistoryLength; i++) {
                let price = oldestPrice;
                if (i >= offset) {
                    price = history[i - offset];
                }
                aggregatedHistory[i] += price * asset.quantity;
            }
        });

        if (aggregatedHistory.length < 2) {
             return { portfolioData: [], dateLabels: [], endValue: 0, gain: 0, percentageGain: 0 };
        }

        const labels: string[] = [];
        const today = new Date();
        for (let i = 0; i < maxHistoryLength; i++) {
            const d = new Date();
            d.setDate(today.getDate() - (maxHistoryLength - 1 - i));
            labels.push(d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).replace('.', ''));
        }
        
        const start = aggregatedHistory[0];
        const end = aggregatedHistory[aggregatedHistory.length - 1];
        const absoluteGain = end - start;
        const percentGain = start > 0 ? (absoluteGain / start) * 100 : 0;

        return { 
            portfolioData: aggregatedHistory, 
            dateLabels: labels, 
            endValue: end, 
            gain: absoluteGain, 
            percentageGain: percentGain 
        };
    }, [assets, locale]);

    const Selector = (
        <div className="flex bg-[var(--bg-primary)] rounded-lg p-1 border border-[var(--border-color)]">
            {['6M', '12M', 'YTD'].map(range => (
                <button 
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all duration-200 ${timeRange === range ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                    {t(`analysis_period_${range.toLowerCase()}`) || range}
                </button>
            ))}
        </div>
    );

    return (
        <AnalysisCard title={t('performance')} action={Selector} delay={0}>
             {portfolioData.length > 1 ? (
                <>
                    <div className="mb-4">
                        <p className="text-3xl font-bold tracking-tight">
                            <CountUp end={endValue} formatter={formatCurrency} />
                        </p>
                        <p className={`text-sm font-semibold flex items-center gap-1 ${gain >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                            {gain >= 0 ? '▲' : '▼'}
                            <CountUp end={Math.abs(gain)} formatter={formatCurrency} /> 
                            <span className="opacity-80">({percentageGain.toFixed(2)}%)</span>
                        </p>
                    </div>
                    <div className="h-56 w-full pt-2">
                         <PortfolioLineChart 
                            data={portfolioData} 
                            labels={dateLabels}
                            isPositive={gain >= 0} 
                            label={t('my_portfolio_performance')} 
                            color="var(--accent-color)" 
                        />
                    </div>
                </>
             ) : (
                <div className="flex items-center justify-center h-64 text-[var(--text-secondary)] text-sm">
                    {t('no_transactions_found')}
                </div>
            )}
        </AnalysisCard>
    );
};

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

const AnalysisView: React.FC = () => {
    const { t } = useI18n();
    return (
        <div className="p-4 pb-24">
            <h1 className="text-2xl font-bold mb-6">{t('nav_analysis')}</h1>
            <div className="max-w-2xl mx-auto">
                <PerformanceCard />
                <IncomeCard />
                <DiversificationCard />
            </div>
        </div>
    );
};

export default AnalysisView;
