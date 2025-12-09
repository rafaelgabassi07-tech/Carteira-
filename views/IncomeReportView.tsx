
import React, { useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from '../components/CountUp';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import PageHeader from '../components/PageHeader';
import { vibrate, fromISODate } from '../utils';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import WalletIcon from '../components/icons/WalletIcon';
import BarChart from '../components/charts/BarChart';
import SortIcon from '../components/icons/SortIcon';
import type { PayerData } from '../hooks/usePortfolioCalculations';

const SummaryCard: React.FC<{ averageIncome: number; totalReceived: number; annualForecast: number; yieldOnCost: number; selectedYear: string }> = ({ averageIncome, totalReceived, annualForecast, yieldOnCost, selectedYear }) => {
    const { t, formatCurrency } = useI18n();
    const isCurrentYear = selectedYear === new Date().getFullYear().toString();

    return (
        <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm animate-fade-in-up">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="col-span-1">
                    <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1">
                        {isCurrentYear ? t('average_income') : t('average')}
                    </p>
                    <p className="text-3xl font-black text-[var(--green-text)] tracking-tight">
                        <CountUp end={averageIncome} formatter={formatCurrency} />
                    </p>
                </div>
                <div className="col-span-1 text-right">
                    <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1">
                        {isCurrentYear ? t('total_received_all_time') : t('total_received_period')}
                    </p>
                    <p className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                        <CountUp end={totalReceived} formatter={formatCurrency} />
                    </p>
                </div>
                <div className="col-span-2 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent my-1 opacity-50"></div>
                <div>
                    <p className="text-[9px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-0.5">{t('annual_forecast')}</p>
                    <p className="text-base font-bold text-[var(--accent-color)]">
                        {isCurrentYear ? <CountUp end={annualForecast} formatter={formatCurrency} /> : '-'}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[9px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-0.5">{isCurrentYear ? t('overall_yoc') : 'YoC (Ano)'}</p>
                    <p className="text-base font-bold text-[var(--text-primary)]">
                        <CountUp end={yieldOnCost} decimals={2} />%
                    </p>
                </div>
            </div>
        </div>
    );
};

const TopPayersCard: React.FC<{ topPayers: PayerData[]; totalIncome: number }> = ({ topPayers, totalIncome }) => {
    const { t, formatCurrency } = useI18n();
    if (topPayers.length === 0) return null;

    return (
        <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm animate-fade-in-up mt-6">
            <h3 className="font-bold text-sm text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-amber-400" />
                {t('top_payers')}
            </h3>
            <div className="space-y-4">
                {topPayers.map((payer, idx) => {
                    const percentage = totalIncome > 0 ? (payer.totalPaid / totalIncome) * 100 : 0;
                    return (
                        <div key={payer.ticker} className="relative">
                            <div className="flex justify-between items-end mb-1 z-10 relative">
                                <span className="text-xs font-bold text-[var(--text-primary)]">{payer.ticker}</span>
                                <span className="text-xs font-bold text-[var(--green-text)]">{formatCurrency(payer.totalPaid)}</span>
                            </div>
                            <div className="h-2 w-full bg-[var(--bg-primary)] rounded-full overflow-hidden">
                                <div 
                                    className="h-full rounded-full bg-[var(--accent-color)] transition-all duration-700 ease-out" 
                                    style={{ width: `${percentage}%`, animationDelay: `${idx * 100}ms` }}
                                ></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const PayerListItem: React.FC<{ payer: PayerData; totalAllPayers: number; isHistorical: boolean }> = ({ payer, totalAllPayers, isHistorical }) => {
    const { t, formatCurrency } = useI18n();
    const contribution = totalAllPayers > 0 ? (payer.totalPaid / totalAllPayers) * 100 : 0;

    return (
        <details className="group bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] overflow-hidden transition hover:border-[var(--accent-color)]/30">
            <summary className="flex items-center justify-between p-4 cursor-pointer list-none hover:bg-[var(--bg-tertiary-hover)] transition-colors">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-[var(--text-primary)]">{payer.ticker}</span>
                        <div className="flex items-center gap-2">
                             {payer.isProvisioned && !isHistorical && <span className="text-[9px] font-bold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-full border border-amber-500/20">{t('provisioned')}</span>}
                            <span className="font-bold text-sm text-[var(--text-primary)]">{formatCurrency(payer.totalPaid)}</span>
                        </div>
                    </div>
                    {payer.totalPaid > 0 && (
                        <div className="w-full bg-[var(--bg-secondary)] h-1.5 rounded-full border border-black/10">
                            <div className="bg-[var(--accent-color)] h-full rounded-full animate-grow-x" style={{ width: `${contribution}%` }}></div>
                        </div>
                    )}
                </div>
                <ChevronRightIcon className="w-4 h-4 text-[var(--text-secondary)] ml-3 flex-shrink-0 group-open:rotate-90 transition-transform"/>
            </summary>
            <div className="bg-[var(--bg-secondary)] p-4 border-t border-[var(--border-color)] animate-fade-in text-xs">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">{isHistorical ? 'Pago em' : t('next_payment')}</span>
                        <span className="font-semibold text-sm">{!isHistorical && payer.nextPaymentDate ? fromISODate(payer.nextPaymentDate).toLocaleDateString('pt-BR') : '-'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">{t('last_ex_date')}</span>
                        <span className="font-semibold text-sm">{payer.lastExDate ? fromISODate(payer.lastExDate).toLocaleDateString('pt-BR') : '-'}</span>
                    </div>
                     <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">{t('asset_average')} ({isHistorical ? 'Ano' : '12m'})</span>
                        <span className="font-semibold text-sm text-[var(--green-text)]">{formatCurrency(payer.averageMonthly)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">{t('asset_yoc')}</span>
                        <span className="font-semibold text-sm text-[var(--accent-color)]">{payer.yieldOnCost.toFixed(2)}%</span>
                    </div>
                    {payer.isProvisioned && payer.projectedAmount > 0 && !isHistorical && (
                        <div className="col-span-2 mt-2 pt-2 border-t border-[var(--border-color)]/50">
                            <span className="text-[9px] font-bold text-amber-400 uppercase">{t('to_receive').toUpperCase()}</span>
                            <span className="font-bold text-base text-amber-400 block">{formatCurrency(payer.projectedAmount)}</span>
                        </div>
                    )}
                </div>
            </div>
        </details>
    );
}

const IncomeReportView: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t, formatCurrency } = useI18n();
    const { assets, fullIncomeHistory, projectedAnnualIncome, annualDistribution, payersData: contextPayersData } = usePortfolio();
    
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [sortOption, setSortOption] = useState<'total' | 'yoc' | 'name'>('total');
    const [isSortOpen, setIsSortOpen] = useState(false);

    const availableYears = useMemo(() => {
        const years = new Set(Object.keys(fullIncomeHistory).map(k => k.split('-')[0]));
        years.add(new Date().getFullYear().toString());
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [fullIncomeHistory]);

    const { yearlyMonthlyData, yearlyTotalReceived, yearlyPayers } = useMemo(() => {
        const monthlyData = [];
        let total = 0;
        
        for (let i = 1; i <= 12; i++) {
            const monthStr = i.toString().padStart(2, '0');
            const key = `${selectedYear}-${monthStr}`;
            const value = fullIncomeHistory[key] || 0;
            const dateObj = new Date(parseInt(selectedYear), i - 1, 1);
            monthlyData.push({
                month: dateObj.toLocaleDateString('pt-BR', { month: 'short' }),
                total: value
            });
            total += value;
        }

        const yearDist: Record<string, number> = annualDistribution[selectedYear] || {};
        const payersList: PayerData[] = [];

        Object.entries(yearDist).forEach(([ticker, totalPaid]) => {
            if (totalPaid <= 0) return;
            const asset = assets.find(a => a.ticker === ticker);
            
            const invested = asset ? asset.quantity * asset.avgPrice : 0;
            const yoc = invested > 0 ? (totalPaid / invested) * 100 : 0;

            payersList.push({
                ticker,
                totalPaid,
                count: 0,
                yieldOnCost: yoc,
                averageMonthly: totalPaid / 12,
                projectedAmount: 0,
                lastExDate: asset?.dividendsHistory?.[0]?.exDate,
                nextPaymentDate: undefined,
                isProvisioned: false
            });
        });

        return {
            yearlyMonthlyData: monthlyData,
            yearlyTotalReceived: total,
            yearlyPayers: payersList
        };
    }, [selectedYear, fullIncomeHistory, annualDistribution, assets]);

    const isCurrentYear = selectedYear === new Date().getFullYear().toString();

    const displayPayers = useMemo(() => {
        let finalPayers = [...yearlyPayers];

        if (isCurrentYear) {
            finalPayers = finalPayers.map(p => {
                const globalData = contextPayersData.find(g => g.ticker === p.ticker);
                return globalData ? {
                    ...p,
                    projectedAmount: globalData.projectedAmount,
                    nextPaymentDate: globalData.nextPaymentDate,
                    isProvisioned: globalData.isProvisioned
                } : p;
            });

            const provisionedOnly = contextPayersData.filter(g => 
                g.projectedAmount > 0 && !finalPayers.find(fp => fp.ticker === g.ticker)
            ).map(g => ({
                ...g,
                totalPaid: 0,
                averageMonthly: 0,
                yieldOnCost: 0 
            }));

            finalPayers = [...finalPayers, ...provisionedOnly];
        }

        return finalPayers.sort((a, b) => {
            if (sortOption === 'total') return b.totalPaid - a.totalPaid;
            if (sortOption === 'yoc') return b.yieldOnCost - a.yieldOnCost;
            return a.ticker.localeCompare(b.ticker);
        });
    }, [yearlyPayers, sortOption, isCurrentYear, contextPayersData]);

    const topPayers = useMemo(() => displayPayers.filter(p => p.totalPaid > 0).slice(0, 3), [displayPayers]);

    const chartAverage = useMemo(() => {
        const monthsWithIncome = yearlyMonthlyData.filter(m => m.total > 0).length;
        return monthsWithIncome > 0 ? yearlyTotalReceived / monthsWithIncome : 0;
    }, [yearlyMonthlyData, yearlyTotalReceived]);

    const yearYieldOnCost = useMemo(() => {
        const totalInvested = assets.reduce((acc, a) => acc + (a.quantity * a.avgPrice), 0);
        return totalInvested > 0 ? (yearlyTotalReceived / totalInvested) * 100 : 0;
    }, [yearlyTotalReceived, assets]);

    return (
        <div className="p-4 pb-24 md:pb-6 h-full overflow-y-auto custom-scrollbar landscape-pb-6">
            <div className="max-w-4xl mx-auto">
                <PageHeader title={t('income_report_title')} onBack={onBack} />
                
                {assets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-center text-[var(--text-secondary)] animate-fade-in">
                        <WalletIcon className="w-12 h-12 mb-4 opacity-30 stroke-1"/>
                        <p className="font-bold text-lg text-[var(--text-primary)]">Sem dados de renda</p>
                        <p className="text-sm mt-1 max-w-xs">Adicione transações e histórico de dividendos para ver este relatório.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)] overflow-x-auto no-scrollbar">
                            {availableYears.map(year => (
                                <button
                                    key={year}
                                    onClick={() => { setSelectedYear(year); vibrate(); }}
                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${selectedYear === year ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>

                        <SummaryCard 
                            totalReceived={yearlyTotalReceived}
                            averageIncome={chartAverage}
                            annualForecast={projectedAnnualIncome}
                            yieldOnCost={yearYieldOnCost}
                            selectedYear={selectedYear}
                        />

                        <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-[var(--text-primary)]">{t('monthly_evolution')} <span className="text-sm font-normal text-[var(--text-secondary)]">({selectedYear})</span></h3>
                                <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">
                                    <TrendingUpIcon className="w-3 h-3"/> {t('average')}: <span className="text-[var(--green-text)]">{formatCurrency(chartAverage)}</span>
                                </div>
                            </div>
                            <div className="h-48 w-full relative">
                                <BarChart data={yearlyMonthlyData} />
                                {chartAverage > 0 && (
                                    <div className="absolute top-0 left-[45px] right-[10px] h-full pointer-events-none">
                                        <div className="absolute w-full border-t border-dashed border-[var(--green-text)] opacity-60"
                                            style={{ bottom: `${(chartAverage / (Math.max(...yearlyMonthlyData.map(m => m.total), chartAverage) * 1.2)) * 100}%` }}>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <TopPayersCard topPayers={topPayers} totalIncome={yearlyTotalReceived} />

                        <div className="flex items-center justify-between mt-8 mb-3 px-1 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
                            <h3 className="font-bold text-lg text-[var(--text-primary)]">{t('paying_sources')}</h3>
                            <div className="relative">
                                <button 
                                    onClick={() => { setIsSortOpen(!isSortOpen); vibrate(); }}
                                    className="flex items-center gap-1 text-xs font-bold text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-3 py-1.5 rounded-lg hover:bg-[var(--accent-color)]/20 transition-colors"
                                >
                                    <SortIcon className="w-3.5 h-3.5" />
                                    {sortOption === 'total' ? t('sort_total_paid') : (sortOption === 'yoc' ? t('sort_yoc') : t('sort_ticker_asc'))}
                                </button>
                                {isSortOpen && (
                                    <>
                                        <div className="fixed inset-0 z-30" onClick={() => setIsSortOpen(false)} />
                                        <div className="absolute right-0 mt-2 w-40 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-xl z-40 overflow-hidden animate-scale-in glass-card">
                                            <button onClick={() => { setSortOption('total'); setIsSortOpen(false); vibrate(); }} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-[var(--bg-tertiary-hover)] border-b border-[var(--border-color)]">{t('sort_total_paid')}</button>
                                            <button onClick={() => { setSortOption('yoc'); setIsSortOpen(false); vibrate(); }} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-[var(--bg-tertiary-hover)] border-b border-[var(--border-color)]">{t('sort_yoc')}</button>
                                            <button onClick={() => { setSortOption('name'); setIsSortOpen(false); vibrate(); }} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-[var(--bg-tertiary-hover)]">{t('sort_ticker_asc')}</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            {displayPayers.map((payer, idx) => (
                                <div key={payer.ticker} className="animate-fade-in-up" style={{ animationDelay: `${200 + idx * 50}ms`}}>
                                    <PayerListItem payer={payer} totalAllPayers={yearlyTotalReceived} isHistorical={!isCurrentYear} />
                                </div>
                            ))}
                            {displayPayers.length === 0 && (
                                <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
                                    Nenhum provento registrado em {selectedYear}.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IncomeReportView;
