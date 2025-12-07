
import React, { useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import EvolutionChart from './EvolutionChart';
import CountUp from './CountUp';
import TrendingUpIcon from './icons/TrendingUpIcon';
import WalletIcon from './icons/WalletIcon';
import { vibrate } from '../utils';

type Period = '7d' | '30d' | '6m' | '1y' | 'all';

// --- Hook de Lógica de Negócios ---
const usePatrimonyLogic = (portfolioEvolution: any, assets: any[]) => {
    const [period, setPeriod] = useState<Period>('7d');

    // 1. Métricas Atuais (Snapshot do momento)
    const currentMetrics = useMemo(() => {
        const totalInvested = assets.reduce((acc: number, a: any) => acc + (a.quantity * a.avgPrice), 0);
        const currentPatrimony = assets.reduce((acc: number, a: any) => acc + (a.quantity * a.currentPrice), 0);
        const absoluteReturn = currentPatrimony - totalInvested;
        const percentageReturn = totalInvested > 0 ? (absoluteReturn / totalInvested) * 100 : 0;

        return { totalInvested, currentPatrimony, absoluteReturn, percentageReturn };
    }, [assets]);

    // 2. Dados Históricos Filtrados
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
            case 'all': cutoffDate = new Date(0); break; // Epoch
        }

        const cutoffStr = cutoffDate.toISOString().split('T')[0];
        // Filtra e garante ordenação cronológica
        return data
            .filter((d: any) => d.dateISO >= cutoffStr)
            .sort((a: any, b: any) => a.dateISO.localeCompare(b.dateISO));
    }, [portfolioEvolution, period]);

    // 3. Variação no Período Selecionado (Delta)
    const periodDelta = useMemo(() => {
        if (chartData.length < 2) return null;
        const start = chartData[0].marketValue;
        const end = chartData[chartData.length - 1].marketValue;
        const deltaValue = end - start;
        const deltaPercent = start > 0 ? (deltaValue / start) * 100 : 0;
        return { value: deltaValue, percent: deltaPercent };
    }, [chartData]);

    return { 
        period, 
        setPeriod, 
        currentMetrics, 
        chartData,
        periodDelta 
    };
};

const PatrimonyEvolutionCard: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const { portfolioEvolution, assets } = usePortfolio();
    
    // Utilizando o Hook refatorado
    const { period, setPeriod, currentMetrics, chartData, periodDelta } = usePatrimonyLogic(portfolioEvolution, assets);

    const handlePeriodChange = (p: Period) => {
        vibrate();
        setPeriod(p);
    };

    const periods: { id: Period; label: string }[] = [
        { id: '7d', label: '7D' },
        { id: '30d', label: '30D' },
        { id: '6m', label: t('analysis_period_6m') },
        { id: '1y', label: t('analysis_period_12m') },
        { id: 'all', label: t('since_beginning') },
    ];

    if (assets.length === 0) return null;

    return (
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 mb-6 border border-[var(--border-color)] shadow-sm animate-fade-in-up transition-all hover:shadow-md">
            
            {/* Header: Título e Seletor */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-[var(--accent-color)]/10 rounded-lg text-[var(--accent-color)]">
                        <TrendingUpIcon className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-lg text-[var(--text-primary)]">{t('evolution_of_patrimony')}</h3>
                </div>

                <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)] overflow-x-auto no-scrollbar">
                    {periods.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => handlePeriodChange(p.id)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${period === p.id ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]/50' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Métricas Principais */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                        {t('net_worth')}
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                        <CountUp end={currentMetrics.currentPatrimony} formatter={formatCurrency} />
                    </p>
                </div>

                <div className="flex flex-col items-end justify-center">
                    <div className="text-right">
                        <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider mb-1">
                            Retorno Total
                        </p>
                        <div className={`inline-flex items-center px-2 py-1 rounded-lg border ${currentMetrics.absoluteReturn >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                            <span className="font-bold text-sm">
                                {currentMetrics.absoluteReturn >= 0 ? '+' : ''}{currentMetrics.percentageReturn.toFixed(2)}%
                            </span>
                        </div>
                        <p className={`text-xs font-semibold mt-1 ${currentMetrics.absoluteReturn >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                            {currentMetrics.absoluteReturn >= 0 ? '+' : ''}{formatCurrency(currentMetrics.absoluteReturn)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Informação Contextual do Período */}
            {periodDelta && (
                <div className="flex items-center gap-2 mb-4 text-xs px-3 py-2 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-color)]/50 max-w-fit">
                    <span className="text-[var(--text-secondary)]">No período selecionado:</span>
                    <span className={`font-bold ${periodDelta.value >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                        {periodDelta.value >= 0 ? '+' : ''}{formatCurrency(periodDelta.value)} ({periodDelta.percent.toFixed(2)}%)
                    </span>
                </div>
            )}
            
            {/* Gráfico */}
            <div className="h-64 w-full relative">
                {chartData.length > 1 ? (
                    <EvolutionChart data={chartData} chartType="line" />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-60">
                        <WalletIcon className="w-12 h-12 mb-2 stroke-1" />
                        <p className="text-xs font-medium">Dados insuficientes para este período.</p>
                    </div>
                )}
            </div>

            {/* Legenda */}
            <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-[var(--border-color)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-color)] shadow-[0_0_8px_var(--accent-color)]"></div>
                    {t('patrimony')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--text-secondary)] opacity-50 border border-[var(--text-primary)]"></div>
                    {t('invested_amount')}
                </div>
            </div>
        </div>
    );
};

export default PatrimonyEvolutionCard;
