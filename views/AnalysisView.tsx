
import React, { useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import PortfolioLineChart from '../components/PortfolioLineChart';
import PortfolioPieChart from '../components/PortfolioPieChart';
import BarChart from '../components/BarChart';
import ScaleIcon from '../components/icons/ScaleIcon';
import CompoundInterestChart from '../components/CompoundInterestChart';

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
            <div className="h-64">
                <PortfolioPieChart data={data} goals={preferences.segmentGoals || {}} />
            </div>
        </AnalysisCard>
    );
};

const SmartRebalancingCard: React.FC = () => {
    const { t } = useI18n();
    const { assets, preferences, updatePreferences } = usePortfolio();
    const [contribution, setContribution] = useState(1000);

    const { segments, totalValue } = useMemo(() => {
        const segs: Record<string, { current: number, target: number, value: number }> = {};
        let totalPortfolioValue = assets.reduce((sum, a) => sum + (a.quantity * a.currentPrice), 0);
        
        assets.forEach(a => {
            const segmentName = a.segment || t('outros');
            if (!segs[segmentName]) {
                segs[segmentName] = { current: 0, target: preferences.segmentGoals?.[segmentName] || 0, value: 0 };
            }
            const assetValue = a.quantity * a.currentPrice;
            segs[segmentName].value += assetValue;
        });

        // Add segments from goals that are not in assets yet
        Object.keys(preferences.segmentGoals || {}).forEach(goalSegment => {
            if (!segs[goalSegment]) {
                 segs[goalSegment] = { current: 0, target: preferences.segmentGoals?.[goalSegment] || 0, value: 0 };
            }
        });
        
        if (totalPortfolioValue === 0) totalPortfolioValue = 1;

        Object.keys(segs).forEach(name => {
            segs[name].current = (segs[name].value / totalPortfolioValue) * 100;
        });
        
        return {
            segments: Object.entries(segs).map(([name, values]) => ({ name, ...values })),
            totalValue: totalPortfolioValue
        };
    }, [assets, preferences.segmentGoals, t]);

    const handleGoalChange = (segment: string, value: number) => {
        const newGoals = { ...preferences.segmentGoals, [segment]: value };
        updatePreferences({ segmentGoals: newGoals });
    };

    const suggestion = useMemo(() => {
        if (contribution <= 0) return null;

        let bestSegment = null;
        let maxDeficit = -Infinity;

        segments.forEach(seg => {
            const deficit = seg.target - seg.current;
            if (deficit > maxDeficit) {
                maxDeficit = deficit;
                bestSegment = seg.name;
            }
        });
        
        if (!bestSegment || maxDeficit <= 0) {
            return { text: t('rebalance_perfect') };
        }
        
        return { text: `${t('suggestion')}: ${bestSegment}`, segment: bestSegment };

    }, [contribution, segments, t]);

    const totalGoalPct = segments.reduce((sum, seg) => sum + Number(seg.target || 0), 0);

    return (
        <AnalysisCard title={t('smart_rebalancing')} delay={250} action={<ScaleIcon className="w-5 h-5 text-[var(--accent-color)]"/>}>
            <p className="text-xs text-[var(--text-secondary)] mb-4">{t('rebalance_desc')}</p>
            <div className="space-y-4">
                {segments.map(seg => (
                    <div key={seg.name}>
                        <div className="flex justify-between items-center text-xs mb-1.5">
                            <span className="font-bold">{t(seg.name.toLowerCase().replace(/ /g, '_')) || seg.name}</span>
                            <div className="flex gap-2 items-center">
                                <input 
                                    type="number" 
                                    value={seg.target}
                                    onChange={e => handleGoalChange(seg.name, Number(e.target.value))}
                                    className="w-12 bg-[var(--bg-primary)] border border-[var(--border-color)] text-center rounded text-xs p-0.5"
                                />
                                <span className="font-bold">% {t('target')}</span>
                            </div>
                        </div>
                         <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] w-8 text-[var(--text-secondary)]">{t('current_short')}</span>
                                <div className="w-full bg-[var(--bg-primary)] rounded-full h-2 border border-[var(--border-color)]">
                                     <div className="bg-gray-500 h-full rounded-full" style={{ width: `${seg.current}%` }}></div>
                                </div>
                                <span className="text-[10px] w-8 text-right font-mono">{seg.current.toFixed(1)}%</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] w-8 text-[var(--accent-color)]">{t('target_short')}</span>
                                <div className="w-full bg-[var(--bg-primary)] rounded-full h-2 border border-[var(--border-color)]">
                                    <div className="bg-[var(--accent-color)] h-full rounded-full" style={{ width: `${seg.target}%` }}></div>
                                </div>
                                 <span className="text-[10px] w-8 text-right font-mono">{seg.target.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
             <div className="text-right text-xs font-bold mt-3 pr-2" style={{ color: totalGoalPct.toFixed(0) !== '100' ? '#f97316' : '#4ade80'}}>
                 {t('total_percentage', { value: totalGoalPct.toFixed(0) })}
             </div>
             
             {/* Contribution Suggestion */}
             <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-1 block">{t('contribution_amount')}</label>
                <input type="number" value={contribution} onChange={e => setContribution(Number(e.target.value))} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2 font-bold" />
                {suggestion && (
                    <div className={`mt-3 p-3 rounded-lg border text-center text-sm font-bold ${suggestion.segment ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-sky-500/10 border-sky-500/30 text-sky-400'}`}>
                        {suggestion.text}
                    </div>
                )}
             </div>
        </AnalysisCard>
    );
};


const MagicNumberCard: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const { assets } = usePortfolio();
    const [desiredIncome, setDesiredIncome] = useState(1000);
    const [monthlyContribution, setMonthlyContribution] = useState(500);
    const [annualRate, setAnnualRate] = useState(8);

    const portfolioTotal = useMemo(() => assets.reduce((sum, a) => sum + (a.quantity * a.currentPrice), 0), [assets]);
    
    const { timeToGoal, capitalRequired, projectionData } = useMemo(() => {
        const required = (desiredIncome * 12) / (annualRate / 100);
        let total = portfolioTotal;
        let months = 0;
        const monthlyRate = annualRate / 100 / 12;

        if (monthlyRate <= 0 || (monthlyContribution <= 0 && total < required)) {
            return { timeToGoal: Infinity, capitalRequired: required, projectionData: null };
        }
        
        if (total >= required) {
             return { timeToGoal: 0, capitalRequired: required, projectionData: { years: 0 } };
        }

        while (total < required) {
            total = total * (1 + monthlyRate) + monthlyContribution;
            months++;
            if (months > 50 * 12) { // Safety break for 50 years
                return { timeToGoal: Infinity, capitalRequired: required, projectionData: null };
            }
        }
        
        return { timeToGoal: months / 12, capitalRequired: required, projectionData: { years: Math.ceil(months/12) } };
    }, [desiredIncome, annualRate, portfolioTotal, monthlyContribution]);

    return (
        <AnalysisCard title={t('magic_number_calculator')} delay={300}>
            <div className="space-y-4">
                <p className="text-xs text-[var(--text-secondary)]">{t('magic_number_desc')}</p>

                {/* Goal Definition */}
                <div className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-color)] space-y-3">
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-1 block">{t('desired_monthly_income')}</label>
                        <input type="number" value={desiredIncome} onChange={e => setDesiredIncome(Number(e.target.value))} className="w-full bg-transparent outline-none font-bold p-1" />
                    </div>
                    <div>
                         <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-1 block">{t('desired_dy')}</label>
                         <input type="range" min="6" max="16" step="0.5" value={annualRate} onChange={e => setAnnualRate(Number(e.target.value))} className="w-full accent-[var(--accent-color)]" />
                         <span className="text-xs font-bold text-[var(--accent-color)]">{annualRate}%</span>
                    </div>
                     <div className="pt-2 border-t border-[var(--border-color)]">
                         <p className="text-xs text-[var(--text-secondary)] text-center uppercase tracking-widest">{t('capital_required')}</p>
                         <p className="text-2xl font-bold text-center text-[var(--text-primary)]">{formatCurrency(capitalRequired)}</p>
                    </div>
                </div>
                
                {/* Projection */}
                <div className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-color)] space-y-3">
                     <h4 className="font-bold text-xs text-[var(--accent-color)] uppercase">{t('projection_title')}</h4>
                    <div>
                        <label className="text-xs text-[var(--text-secondary)]">{t('initial_investment')}</label>
                        <p className="font-bold">{formatCurrency(portfolioTotal)}</p>
                    </div>
                    <div>
                         <label className="text-xs text-[var(--text-secondary)]">{t('monthly_contribution')}</label>
                         <input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(Number(e.target.value))} className="w-full bg-transparent outline-none font-bold p-1 border-b border-[var(--border-color)]" />
                    </div>
                     <div className="pt-3 border-t border-[var(--border-color)] mt-2 text-center">
                         <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest">{t('time_to_goal')}</p>
                          {isFinite(timeToGoal) ? (
                              <p className="text-xl font-bold text-[var(--accent-color)]">
                                  {timeToGoal.toFixed(1)} {t('years')}
                              </p>
                          ) : (
                              <p className="text-sm font-bold text-amber-500 mt-1">{t('goal_unreachable')}</p>
                          )}
                    </div>
                </div>

                <div className="h-64">
                    {projectionData ? (
                        <CompoundInterestChart initial={portfolioTotal} monthly={monthlyContribution} rate={annualRate} years={projectionData.years} />
                    ) : (
                         <div className="flex items-center justify-center h-full text-center text-sm text-amber-500 bg-amber-500/10 rounded-lg p-4">
                            {t('goal_unreachable_long')}
                         </div>
                    )}
                </div>
            </div>
        </AnalysisCard>
    );
}

const AnalysisView: React.FC = () => {
    const { t } = useI18n();
    return (
        <div className="p-4 pb-24">
            <h1 className="text-2xl font-bold mb-6">{t('nav_analysis')}</h1>
            <div className="max-w-2xl mx-auto">
                <PerformanceCard />
                <IncomeCard />
                <DiversificationCard />
                <SmartRebalancingCard />
                <MagicNumberCard />
            </div>
        </div>
    );
};

export default AnalysisView;
