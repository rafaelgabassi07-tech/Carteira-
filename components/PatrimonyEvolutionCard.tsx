
import React, { useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import EvolutionChart from './EvolutionChart';
import CountUp from './CountUp';
import TrendingUpIcon from './icons/TrendingUpIcon';

type Period = '6m' | '1y' | 'all';

const PatrimonyEvolutionCard: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const { portfolioEvolution, assets, privacyMode } = usePortfolio();
    const [period, setPeriod] = useState<Period>('1y');

    // Calculate Current Metrics from live assets
    const currentMetrics = useMemo(() => {
        const totalInvested = assets.reduce((acc, a) => acc + (a.quantity * a.avgPrice), 0);
        const currentPatrimony = assets.reduce((acc, a) => acc + (a.quantity * a.currentPrice), 0);
        const result = currentPatrimony - totalInvested;
        const profitability = totalInvested > 0 ? (result / totalInvested) * 100 : 0;
        
        return { totalInvested, currentPatrimony, result, profitability };
    }, [assets]);

    const filteredData = useMemo(() => {
        const data = portfolioEvolution.all_types || [];
        if (data.length === 0) return [];
        
        const totalMonths = data.length;
        let sliceCount = totalMonths;
        
        if (period === '6m') sliceCount = 6;
        if (period === '1y') sliceCount = 12;
        
        return data.slice(Math.max(totalMonths - sliceCount, 0));
    }, [portfolioEvolution, period]);

    return (
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 mb-4 border border-[var(--border-color)] shadow-sm animate-fade-in-up transition-all hover:shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                
                {/* Header Metrics */}
                <div className="flex-1 w-full">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUpIcon className="w-5 h-5 text-[var(--accent-color)]" />
                        <h3 className="font-bold text-lg text-[var(--text-primary)]">{t('evolution_of_patrimony')}</h3>
                    </div>
                    
                    <div className={`flex flex-wrap gap-x-8 gap-y-2 ${privacyMode ? 'blur-sm select-none opacity-50' : ''}`}>
                        <div>
                            <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">{t('net_worth')}</p>
                            <p className="text-2xl font-bold text-[var(--text-primary)]">
                                <CountUp end={currentMetrics.currentPatrimony} formatter={formatCurrency} />
                            </p>
                        </div>
                        
                        <div>
                            <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">{t('profitability')}</p>
                            <div className="flex items-baseline gap-2">
                                <p className={`text-lg font-bold ${currentMetrics.result >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                                    {currentMetrics.result >= 0 ? '+' : ''}<CountUp end={currentMetrics.result} formatter={formatCurrency} />
                                </p>
                                <span className={`text-sm font-semibold ${currentMetrics.profitability >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'} bg-[var(--bg-primary)] px-1.5 rounded border border-[var(--border-color)]`}>
                                    {currentMetrics.profitability >= 0 ? '+' : ''}{currentMetrics.profitability.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Period Filter */}
                <div className="flex bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-color)] self-end md:self-center shrink-0">
                    {(['6m', '1y', 'all'] as Period[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${period === p ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            {p === 'all' ? 'Máx' : p === '6m' ? '6M' : '1A'}
                        </button>
                    ))}
                </div>
            </div>
            
            {/* Chart Area */}
            <div className={`h-64 w-full ${privacyMode ? 'opacity-30 blur-sm' : ''}`}>
                <EvolutionChart data={filteredData} chartType="bar" />
            </div>
            
            {/* Legend */}
            <div className="flex justify-center gap-4 mt-4 text-xs font-medium text-[var(--text-secondary)]">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1 rounded-full bg-[var(--accent-color)]"></div>
                    {t('patrimony')}
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1 rounded-full border border-[var(--text-secondary)] border-dashed"></div>
                    {t('invested_amount')}
                </div>
            </div>
        </div>
    );
};

export default PatrimonyEvolutionCard;
