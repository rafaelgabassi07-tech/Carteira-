
import React, { useState, useMemo } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import EvolutionChart from '../charts/EvolutionChart';
import CountUp from '../CountUp';
import TrendingUpIcon from '../icons/TrendingUpIcon';
import WalletIcon from '../icons/WalletIcon';
import { vibrate } from '../../utils';

type Period = '7d' | '30d' | '6m' | '1y' | 'all';

const usePatrimonyLogic = (portfolioEvolution: any, assets: any[]) => {
    const [period, setPeriod] = useState<Period>('7d');

    const currentMetrics = useMemo(() => {
        const totalInvested = assets.reduce((acc: number, a: any) => acc + (a.quantity * a.avgPrice), 0);
        const currentPatrimony = assets.reduce((acc: number, a: any) => acc + (a.quantity * a.currentPrice), 0);
        const absoluteReturn = currentPatrimony - totalInvested;
        const percentageReturn = totalInvested > 0 ? (absoluteReturn / totalInvested) * 100 : 0;

        return { totalInvested, currentPatrimony, absoluteReturn, percentageReturn };
    }, [assets]);

    const chartData = useMemo(() => {
        const data = portfolioEvolution.all_types || [];
        if (data.length === 0) return [];

        const now = new Date();
        let cutoffDate = new Date();

        switch (period) {
            case '7d': cutoffDate.setDate(now.getDate() - 7); break;
            case '30d': cutoffDate.setDate(now.getDate() - 30); break;
            case '6m': cutoffDate.setMonth(now.getMonth() - 6); break;
            case '1y': cutoffDate.setFullYear(now.getFullYear() - 1); break;
            case 'all': cutoffDate = new Date(0); break;
        }

        const cutoffStr = cutoffDate.toISOString().split('T')[0];
        return data.filter((d: any) => d.dateISO >= cutoffStr).sort((a: any, b: any) => a.dateISO.localeCompare(b.dateISO));
    }, [portfolioEvolution, period]);

    return { period, setPeriod, currentMetrics, chartData };
};

const PatrimonyEvolutionCard: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const { portfolioEvolution, assets } = usePortfolio();
    const { period, setPeriod, currentMetrics, chartData } = usePatrimonyLogic(portfolioEvolution, assets);

    const periods: { id: Period; label: string }[] = [
        { id: '7d', label: '7D' },
        { id: '30d', label: '30D' },
        { id: '6m', label: '6M' },
        { id: '1y', label: '1A' },
        { id: 'all', label: 'Tudo' },
    ];

    if (assets.length === 0) return null;

    return (
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-color)] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <TrendingUpIcon className="w-5 h-5 text-[var(--accent-color)]" />
                    <h3 className="font-bold text-base text-[var(--text-primary)]">{t('evolution_of_patrimony')}</h3>
                </div>
                <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)] overflow-x-auto no-scrollbar">
                    {periods.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => { setPeriod(p.id); vibrate(); }}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap ${period === p.id ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-end gap-3 mb-6">
                <div>
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider block mb-1">{t('net_worth')}</span>
                    <span className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                        <CountUp end={currentMetrics.currentPatrimony} formatter={formatCurrency} />
                    </span>
                </div>
                <div className={`mb-1.5 px-2 py-0.5 rounded text-xs font-bold ${currentMetrics.absoluteReturn >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {currentMetrics.absoluteReturn >= 0 ? '+' : ''}{currentMetrics.percentageReturn.toFixed(2)}%
                </div>
            </div>
            
            <div className="h-64 w-full relative">
                {chartData.length > 1 ? (
                    <EvolutionChart data={chartData} chartType="line" />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-50">
                        <WalletIcon className="w-10 h-10 mb-2 stroke-1" />
                        <p className="text-xs font-medium">Dados insuficientes.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PatrimonyEvolutionCard;
