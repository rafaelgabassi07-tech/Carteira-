import React, { useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import PortfolioLineChart from '../components/PortfolioLineChart';
import PortfolioPieChart from '../components/PortfolioPieChart';
import BarChart from '../components/BarChart';
import CountUp from '../components/CountUp';
import { calculatePortfolioMetrics, fromISODate } from '../utils';

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
    const { assets, transactions } = usePortfolio();
    const [timeRange, setTimeRange] = useState('12M');

    const { portfolioData, dateLabels, endValue, gain, percentageGain } = useMemo(() => {
        if (transactions.length === 0 || assets.length === 0) {
            return { portfolioData: [], dateLabels: [], endValue: 0, gain: 0, percentageGain: 0 };
        }

        const priceMap = new Map<string, Map<string, number>>();
        assets.forEach(asset => {
            const assetPrices = new Map<string, number>();
            if (asset.priceHistory) {
                asset.priceHistory.forEach(historyPoint => {
                    assetPrices.set(historyPoint.date, historyPoint.price);
                });
            }
            priceMap.set(asset.ticker, assetPrices);
        });

        const sortedTxs = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
        const firstTxDate = fromISODate(sortedTxs[0].date);
        const today = new Date();

        const MAX_HISTORY_YEARS = 5;
        const maxHistoryDate = new Date();
        maxHistoryDate.setFullYear(today.getFullYear() - MAX_HISTORY_YEARS);
        const startDate = firstTxDate > maxHistoryDate ? firstTxDate : maxHistoryDate;

        const fullPortfolioValueHistory: { date: Date; value: number }[] = [];
        let relevantTxs: typeof transactions = [];
        let txIndex = 0;

        for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
            const currentDate = new Date(d);
            const currentDateStr = currentDate.toISOString().split('T')[0];

            while (txIndex < sortedTxs.length && sortedTxs[txIndex].date <= currentDateStr) {
                relevantTxs.push(sortedTxs[txIndex]);
                txIndex++;
            }

            if (relevantTxs.length === 0) continue;

            const dailyHoldings = calculatePortfolioMetrics(relevantTxs);
            let dailyTotalValue = 0;

            for (const ticker in dailyHoldings) {
                const holding = dailyHoldings[ticker];
                const assetPriceHistory = priceMap.get(ticker);
                let priceForDay = assetPriceHistory?.get(currentDateStr);

                if (!priceForDay && assetPriceHistory) {
                    const availableDates = Array.from(assetPriceHistory.keys()).filter(date => date <= currentDateStr).sort();
                    if (availableDates.length > 0) {
                        const lastAvailableDate = availableDates[availableDates.length - 1];
                        priceForDay = assetPriceHistory.get(lastAvailableDate);
                    }
                }
                if (!priceForDay) {
                    const asset = assets.find(a => a.ticker === ticker);
                    priceForDay = asset?.currentPrice || 0;
                }

                dailyTotalValue += holding.quantity * priceForDay;
            }
            fullPortfolioValueHistory.push({ date: currentDate, value: dailyTotalValue });
        }
        
        if (fullPortfolioValueHistory.length < 2) {
             return { portfolioData: [], dateLabels: [], endValue: 0, gain: 0, percentageGain: 0 };
        }
        
        let rangedHistory = fullPortfolioValueHistory;
        const lastDate = new Date(fullPortfolioValueHistory[fullPortfolioValueHistory.length - 1].date);

        if (timeRange === '6M') {
            const rangeStartDate = new Date(lastDate);
            rangeStartDate.setMonth(lastDate.getMonth() - 6);
            rangedHistory = fullPortfolioValueHistory.filter(p => p.date >= rangeStartDate);
        } else if (timeRange === '12M') {
            const rangeStartDate = new Date(lastDate);
            rangeStartDate.setFullYear(lastDate.getFullYear() - 1);
            rangedHistory = fullPortfolioValueHistory.filter(p => p.date >= rangeStartDate);
        } else if (timeRange === 'YTD') {
            const startOfYear = new Date(lastDate.getFullYear(), 0, 1);
            rangedHistory = fullPortfolioValueHistory.filter(p => p.date >= startOfYear);
        }

        if (rangedHistory.length < 2) rangedHistory = fullPortfolioValueHistory.slice(-2);
        
        const finalPortfolioData = rangedHistory.map(p => p.value);
        const finalDateLabels = rangedHistory.map(p => p.date.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', ''));
        const startValue = finalPortfolioData[0];
        const finalEndValue = finalPortfolioData[finalPortfolioData.length - 1];
        const absoluteGain = finalEndValue - startValue;
        const percentGain = startValue > 0 ? (absoluteGain / startValue) * 100 : 0;

        return { 
            portfolioData: finalPortfolioData, 
            dateLabels: finalDateLabels, 
            endValue: finalEndValue, 
            gain: absoluteGain, 
            percentageGain: percentGain 
        };
    }, [assets, transactions, locale, timeRange]);

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
                    <div className="h-72 w-full pt-2">
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