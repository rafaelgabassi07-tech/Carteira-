
import React, { useState, useMemo, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import PortfolioLineChart from '../components/PortfolioLineChart';
import PortfolioPieChart from '../components/PortfolioPieChart';
import BarChart from '../components/BarChart';
import ScaleIcon from '../components/icons/ScaleIcon';

const AnalysisCard: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode; delay?: number }> = ({ title, children, action, delay = 0 }) => (
    <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 mb-4 border border-[var(--border-color)] shadow-sm animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-[var(--text-primary)]">{title}</h3>
            {action}
        </div>
        {children}
    </div>
);

const PerformanceAnalysis: React.FC = () => {
    const { t } = useI18n();
    const { assets } = usePortfolio();
    const [timeRange, setTimeRange] = useState('12M');

    const portfolioData = useMemo(() => {
        if (assets.length === 0) return [];
        
        // Find the maximum history length available
        const maxHistoryLength = Math.max(...assets.map(a => a.priceHistory.length));
        if (maxHistoryLength === 0) return [];

        // Initialize array
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
        
        return aggregatedHistory;
    }, [assets]);

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
             <div className="h-64 w-full">
                {portfolioData.length > 1 ? (
                     <PortfolioLineChart data={portfolioData} isPositive={portfolioData[portfolioData.length - 1] >= portfolioData[0]} label={t('my_portfolio_performance')} color="var(--accent-color)" />
                ) : (
                    <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                        {t('no_transactions_found')}
                    </div>
                )}
             </div>
        </AnalysisCard>
    );
};

const IncomeAnalysis: React.FC = () => {
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

const DiversificationAnalysis: React.FC = () => {
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

const SmartRebalancing: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const { assets, preferences, updatePreferences } = usePortfolio();
    const [contribution, setContribution] = useState(1000);
    const [isOpen, setIsOpen] = useState(false);

    const segments = useMemo(() => {
        const segs = Array.from(new Set(assets.map(a => a.segment || t('outros'))));
        return segs;
    }, [assets, t]);

    const currentAllocation = useMemo(() => {
        const alloc: Record<string, number> = {};
        let total = 0;
        assets.forEach(a => {
            const val = a.quantity * a.currentPrice;
            const seg = a.segment || t('outros');
            alloc[seg] = (alloc[seg] || 0) + val;
            total += val;
        });
        return { alloc, total };
    }, [assets, t]);

    const goals = (preferences.segmentGoals || {}) as Record<string, number>;

    const handleGoalChange = (segment: string, value: number) => {
        const newGoals = { ...goals, [segment]: value };
        updatePreferences({ segmentGoals: newGoals });
    };

    const suggestions = useMemo(() => {
        const totalWeight = Object.values(goals).reduce((a: number, b: number) => a + b, 0);
        if (totalWeight === 0) return [];

        const futureTotal = currentAllocation.total + contribution;
        const recommendations: { segment: string, amount: number }[] = [];

        segments.forEach(seg => {
            const targetPct = (goals[seg] || 0) / 100;
            const targetValue = futureTotal * targetPct;
            const currentValue = currentAllocation.alloc[seg] || 0;
            const deficit = targetValue - currentValue;
            
            if (deficit > 0) {
                recommendations.push({ segment: seg, amount: deficit });
            }
        });
        
        // Normalize recommendations to fit contribution if sum > contribution
        const totalDeficit = recommendations.reduce((acc, r) => acc + r.amount, 0);
        if (totalDeficit > contribution) {
             return recommendations.map(r => ({
                 ...r,
                 amount: (r.amount / totalDeficit) * contribution
             })).sort((a,b) => b.amount - a.amount);
        }

        return recommendations.sort((a,b) => b.amount - a.amount);

    }, [goals, contribution, currentAllocation, segments]);

    const totalGoalPct = Object.values(goals).reduce((a: number, b: number) => a + b, 0);

    return (
        <AnalysisCard title={t('smart_rebalancing')} delay={250} action={<ScaleIcon className="w-5 h-5 text-[var(--accent-color)]"/>}>
            <div className="space-y-4">
                <p className="text-xs text-[var(--text-secondary)]">{t('rebalance_desc')}</p>
                
                <div className="flex items-center bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border-color)]">
                    <span className="text-[var(--text-secondary)] mr-2 text-sm">R$</span>
                    <input 
                        type="number" 
                        value={contribution} 
                        onChange={e => setContribution(Number(e.target.value))} 
                        className="bg-transparent w-full outline-none font-bold"
                        placeholder={t('contribution_amount')}
                    />
                </div>

                <div className="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border-color)]">
                    <div className="flex justify-between items-center mb-2 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                        <h4 className="font-bold text-xs uppercase tracking-wider">{t('set_targets')}</h4>
                        <span className={`text-xs font-bold ${totalGoalPct !== 100 ? 'text-orange-400' : 'text-green-400'}`}>
                            {t('total_percentage', { value: totalGoalPct })}
                        </span>
                    </div>
                    
                    {isOpen && (
                        <div className="space-y-3 mt-3 animate-fade-in">
                            {segments.map(seg => (
                                <div key={seg} className="flex items-center justify-between text-xs">
                                    <span className="w-1/3 truncate">{t(seg.toLowerCase().replace(/ /g, '_')) || seg}</span>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={goals[seg] || 0} 
                                        onChange={e => handleGoalChange(seg, Number(e.target.value))}
                                        className="w-1/3 accent-[var(--accent-color)]"
                                    />
                                    <span className="w-10 text-right font-bold">{(goals[seg] || 0)}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-4">
                    <h4 className="font-bold text-xs uppercase tracking-wider mb-2 text-[var(--accent-color)]">{t('suggestion')}</h4>
                    {suggestions.length > 0 ? (
                        <div className="space-y-2">
                            {suggestions.map(s => (
                                <div key={s.segment} className="flex justify-between items-center bg-[var(--bg-tertiary-hover)] p-2 rounded-lg border border-[var(--border-color)]">
                                    <span className="text-sm font-medium">{t(s.segment.toLowerCase().replace(/ /g, '_')) || s.segment}</span>
                                    <span className="font-bold text-[var(--green-text)]">+{formatCurrency(s.amount)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-center text-[var(--text-secondary)] py-2">
                            {totalGoalPct !== 100 ? t('rebalance_error_total') : t('rebalance_perfect')}
                        </p>
                    )}
                </div>
            </div>
        </AnalysisCard>
    );
};

const MagicNumberCalculator: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const [desiredIncome, setDesiredIncome] = useState(1000);
    const [dy, setDy] = useState(10);
    
    const capitalRequired = (desiredIncome * 12) / (dy / 100);
    // Assuming avg quota price approx R$ 10 for base 10 funds
    const approxShares = Math.ceil(capitalRequired / 10);

    return (
        <AnalysisCard title={t('magic_number_calculator')} delay={300}>
            <div className="space-y-4">
                <p className="text-xs text-[var(--text-secondary)]">{t('magic_number_desc')}</p>
                
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {[
                        { val: 100, label: t('mn_goal_internet') },
                        { val: 1000, label: t('mn_goal_rent') },
                        { val: 5000, label: t('mn_goal_salary') }
                    ].map(preset => (
                         <button 
                            key={preset.val}
                            onClick={() => setDesiredIncome(preset.val)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${desiredIncome === preset.val ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] border-[var(--accent-color)]' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-color)]'}`}
                        >
                            {preset.label} (R$ {preset.val})
                        </button>
                    ))}
                </div>

                <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-1 block">{t('desired_monthly_income')}</label>
                    <div className="flex items-center bg-[var(--bg-primary)] rounded-lg p-2 border border-[var(--border-color)]">
                         <span className="text-[var(--text-secondary)] mr-2">R$</span>
                         <input 
                            type="number" 
                            value={desiredIncome} 
                            onChange={e => setDesiredIncome(Number(e.target.value))} 
                            className="bg-transparent w-full outline-none font-bold"
                        />
                    </div>
                </div>

                <div>
                     <div className="flex justify-between items-end mb-1">
                        <label className="text-xs font-bold text-[var(--text-secondary)] uppercase block">{t('desired_dy')}</label>
                        <span className="text-xs font-bold text-[var(--accent-color)]">{dy}%</span>
                     </div>
                     <input 
                        type="range" 
                        min="6" 
                        max="16" 
                        step="0.5" 
                        value={dy} 
                        onChange={e => setDy(Number(e.target.value))}
                        className="w-full accent-[var(--accent-color)]"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mt-1">
                        <span>{t('mn_conservative')} (6%)</span>
                        <span>{t('mn_aggressive')} (16%)</span>
                    </div>
                </div>

                <div className="pt-4 border-t border-[var(--border-color)] mt-4 bg-[var(--bg-tertiary-hover)]/30 -mx-5 -mb-5 p-5 rounded-b-2xl">
                     <p className="text-xs text-[var(--text-secondary)] text-center mb-1 uppercase tracking-widest">{t('capital_required')}</p>
                     <p className="text-3xl font-bold text-center text-[var(--text-primary)] mb-1">{formatCurrency(capitalRequired)}</p>
                     <p className="text-center text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] inline-block px-3 py-1 rounded-full mx-auto table shadow-sm border border-[var(--border-color)]">
                        {t('mn_approx_shares', { count: approxShares.toLocaleString() })}
                     </p>
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
                <PerformanceAnalysis />
                <IncomeAnalysis />
                <DiversificationAnalysis />
                <SmartRebalancing />
                <MagicNumberCalculator />
            </div>
        </div>
    );
};

export default AnalysisView;
