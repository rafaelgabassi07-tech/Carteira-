
import React, { useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import PortfolioLineChart from '../components/PortfolioLineChart';
import PortfolioPieChart from '../components/PortfolioPieChart';
import BarChart from '../components/BarChart';

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
    const { t, locale } = useI18n();
    const { assets } = usePortfolio();
    const [timeRange, setTimeRange] = useState('12M');

    const { portfolioData, dateLabels } = useMemo(() => {
        if (assets.length === 0) return { portfolioData: [], dateLabels: [] };
        
        const maxHistoryLength = Math.max(...assets.map(a => a.priceHistory.length), 0);
        if (maxHistoryLength === 0) return { portfolioData: [], dateLabels: [] };
        
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

        const labels: string[] = [];
        const today = new Date();
        for (let i = 0; i < maxHistoryLength; i++) {
            const d = new Date();
            d.setDate(today.getDate() - (maxHistoryLength - 1 - i));
            labels.push(d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).replace('.', ''));
        }
        
        return { portfolioData: aggregatedHistory, dateLabels: labels };
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
             <div className="h-64 w-full pt-2">
                {portfolioData.length > 1 ? (
                     <PortfolioLineChart 
                        data={portfolioData} 
                        labels={dateLabels}
                        isPositive={portfolioData[portfolioData.length - 1] >= portfolioData[0]} 
                        label={t('my_portfolio_performance')} 
                        color="var(--accent-color)" 
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                        {t('no_transactions_found')}
                    </div>
                )}
             </div>
        </AnalysisCard>
    );
};

const IncomeCard: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const { monthlyIncome } = usePortfolio();
    
    const average = useMemo(() => {
         const total = monthlyIncome.reduce((acc, item) => acc + item.total, 0);
         return monthlyIncome.length > 0 ? total / monthlyIncome.length : 0;
    }, [monthlyIncome]);

    return (
        <AnalysisCard title={t('monthly_income')} delay={100}>
             <div className="mb-4 flex items-baseline gap-2">
                 <span className="text-2xl font-bold text-[var(--green-text)]">{formatCurrency(average)}</span>
                 <span className="text-xs text-[var(--text-secondary)]">{t('avg_monthly_income_12m')}</span>
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