
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
import BarChart from '../components/BarChart';
import type { PayerData } from '../hooks/usePortfolioCalculations';


// --- Sub-components ---
const SummaryCard: React.FC<{ averageIncome: number; totalReceived: number; annualForecast: number; yieldOnCost: number; }> = ({ averageIncome, totalReceived, annualForecast, yieldOnCost }) => {
    const { t, formatCurrency } = useI18n();

    return (
        <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm animate-fade-in-up">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="col-span-1">
                    <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1">{t('average_income')}</p>
                    <p className="text-3xl font-black text-[var(--green-text)] tracking-tight">
                        <CountUp end={averageIncome} formatter={formatCurrency} />
                    </p>
                </div>
                <div className="col-span-1 text-right">
                    <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1">{t('total_received_all_time')}</p>
                    <p className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                        <CountUp end={totalReceived} formatter={formatCurrency} />
                    </p>
                </div>
                <div className="col-span-2 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent my-1 opacity-50"></div>
                <div>
                    <p className="text-[9px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-0.5">{t('annual_forecast')}</p>
                    <p className="text-base font-bold text-[var(--accent-color)]">
                        <CountUp end={annualForecast} formatter={formatCurrency} />
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[9px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-0.5">{t('overall_yoc')}</p>
                    <p className="text-base font-bold text-[var(--text-primary)]">
                        <CountUp end={yieldOnCost} decimals={2} />%
                    </p>
                </div>
            </div>
        </div>
    );
};

const PayerListItem: React.FC<{ payer: PayerData; totalAllPayers: number }> = ({ payer, totalAllPayers }) => {
    const { t, formatCurrency } = useI18n();
    const contribution = totalAllPayers > 0 ? (payer.totalPaid / totalAllPayers) * 100 : 0;

    return (
        <details className="group bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] overflow-hidden transition hover:border-[var(--accent-color)]/30">
            <summary className="flex items-center justify-between p-4 cursor-pointer list-none hover:bg-[var(--bg-tertiary-hover)] transition-colors">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-[var(--text-primary)]">{payer.ticker}</span>
                        <div className="flex items-center gap-2">
                             {payer.isProvisioned && <span className="text-[9px] font-bold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-full border border-amber-500/20">Provisionado</span>}
                            <span className="font-bold text-sm text-[var(--text-primary)]">{formatCurrency(payer.totalPaid)}</span>
                        </div>
                    </div>
                    <div className="w-full bg-[var(--bg-secondary)] h-1.5 rounded-full border border-black/10">
                        <div className="bg-[var(--accent-color)] h-full rounded-full animate-grow-x" style={{ width: `${contribution}%` }}></div>
                    </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-[var(--text-secondary)] ml-3 flex-shrink-0 group-open:rotate-90 transition-transform"/>
            </summary>
            <div className="bg-[var(--bg-secondary)] p-4 border-t border-[var(--border-color)] animate-fade-in text-xs">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">{t('next_payment')}</span>
                        <span className="font-semibold text-sm">{payer.nextPaymentDate ? fromISODate(payer.nextPaymentDate).toLocaleDateString('pt-BR') : '-'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">{t('last_ex_date')}</span>
                        <span className="font-semibold text-sm">{payer.lastExDate ? fromISODate(payer.lastExDate).toLocaleDateString('pt-BR') : '-'}</span>
                    </div>
                     <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">{t('asset_average')} (12m)</span>
                        <span className="font-semibold text-sm text-[var(--green-text)]">{formatCurrency(payer.averageMonthly)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">{t('asset_yoc')}</span>
                        <span className="font-semibold text-sm text-[var(--accent-color)]">{payer.yieldOnCost.toFixed(2)}%</span>
                    </div>
                    {payer.isProvisioned && payer.projectedAmount > 0 && (
                        <div className="col-span-2 mt-2 pt-2 border-t border-[var(--border-color)]/50">
                            <span className="text-[9px] font-bold text-amber-400 uppercase">A RECEBER</span>
                            <span className="font-bold text-base text-amber-400 block">{formatCurrency(payer.projectedAmount)}</span>
                        </div>
                    )}
                </div>
            </div>
        </details>
    );
}

// --- Main View ---
const IncomeReportView: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const { assets, monthlyIncome, payersData, totalReceived, projectedAnnualIncome, yieldOnCost } = usePortfolio();
    
    const averageIncome = useMemo(() => {
        const relevantMonths = monthlyIncome.filter(m => m.total > 0);
        const total = relevantMonths.reduce((sum, item) => sum + item.total, 0);
        return relevantMonths.length > 0 ? total / relevantMonths.length : 0;
    }, [monthlyIncome]);
    
    const sortedPayers = useMemo(() => {
        return [...payersData].sort((a, b) => b.totalPaid - a.totalPaid);
    }, [payersData]);

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
                        <SummaryCard 
                            totalReceived={totalReceived}
                            averageIncome={averageIncome}
                            annualForecast={projectedAnnualIncome}
                            yieldOnCost={yieldOnCost}
                        />

                        <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-[var(--text-primary)]">{t('monthly_evolution')}</h3>
                                <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">
                                    <TrendingUpIcon className="w-3 h-3"/> Média: <span className="text-[var(--green-text)]">{averageIncome.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="h-48 w-full relative">
                                <BarChart data={monthlyIncome} />
                                {averageIncome > 0 && (
                                    <div className="absolute top-0 left-[45px] right-[10px] h-full pointer-events-none">
                                        <div className="absolute w-full border-t border-dashed border-[var(--green-text)] opacity-60"
                                            style={{ bottom: `${(averageIncome / (Math.max(...monthlyIncome.map(m => m.total), averageIncome) * 1.2)) * 100}%` }}>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-3 px-1">{t('paying_sources')}</h3>
                            <div className="space-y-2">
                                {sortedPayers.filter(p => p.totalPaid > 0 || p.projectedAmount > 0).map((payer, idx) => (
                                    <div key={payer.ticker} className="animate-fade-in-up" style={{ animationDelay: `${idx * 50}ms`}}>
                                        <PayerListItem payer={payer} totalAllPayers={totalReceived} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IncomeReportView;