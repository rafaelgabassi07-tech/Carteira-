import React, { useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from '../components/CountUp';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import PageHeader from '../components/PageHeader';
import { vibrate, fromISODate } from '../utils';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import ClockIcon from '../components/icons/ClockIcon';
import WalletIcon from '../components/icons/WalletIcon';
import BarChart from '../components/BarChart';
import type { DividendHistoryEvent, Transaction, Asset } from '../types';

// --- Types ---
interface MonthlyData {
    month: string;
    total: number;
}

interface PayerData {
    ticker: string;
    totalPaid: number;
    count: number;
    lastExDate?: string;
    nextPaymentDate?: string;
    isProvisioned?: boolean;
    yieldOnCost: number;
    averageMonthly: number;
    projectedAmount: number;
}

interface DividendStats {
    totalReceived: number;
    monthlyData: MonthlyData[];
    payersData: PayerData[];
    averageIncome: number;
    annualForecast: number;
    yieldOnCost: number;
}

// --- Logic Hook ---
const useDividendCalculations = (transactions: Transaction[], assets: Asset[]): DividendStats => {
    return useMemo(() => {
        let totalReceived = 0;
        let totalInvestedGlobal = 0;
        const annualForecast = assets.reduce((acc, a) => acc + (a.quantity * a.currentPrice * ((a.dy || 0) / 100)), 0);
        
        const monthlyAggregation: Record<string, number> = {}; 
        const payerAggregation: Record<string, Partial<PayerData>> = {};
        const assetHistories = new Map<string, DividendHistoryEvent[]>();
        
        assets.forEach(asset => {
            const assetTxs = transactions
                .filter(t => t.ticker === asset.ticker)
                .sort((a, b) => a.date.localeCompare(b.date));

            if (assetTxs.length === 0) return;
            
            // Calculate current total invested for this asset to derive YOC
            let assetTotalInvested = 0;
            let qtyAtEnd = 0;
            assetTxs.forEach(tx => {
                if (tx.type === 'Compra') {
                    assetTotalInvested += (tx.quantity * tx.price) + (tx.costs || 0);
                    qtyAtEnd += tx.quantity;
                } else {
                    const avgPrice = qtyAtEnd > 0 ? assetTotalInvested / qtyAtEnd : 0;
                    const sellQty = Math.min(tx.quantity, qtyAtEnd);
                    assetTotalInvested -= sellQty * avgPrice;
                    qtyAtEnd -= sellQty;
                }
            });
            totalInvestedGlobal += Math.max(0, assetTotalInvested);
            
            const projectedYearly = asset.dy ? (asset.quantity * asset.currentPrice * (asset.dy / 100)) : 0;
            const assetYoC = assetTotalInvested > 0 ? (projectedYearly / assetTotalInvested) * 100 : 0;
            
            payerAggregation[asset.ticker] = { ticker: asset.ticker, yieldOnCost: assetYoC, totalPaid: 0, count: 0, projectedAmount: 0 };
            assetHistories.set(asset.ticker, asset.dividendsHistory || []);

            // Process dividends for this asset
            const history = asset.dividendsHistory || [];
            history.forEach(div => {
                let qtyOwnedAtExDate = 0;
                for (const tx of assetTxs) {
                    if (tx.date >= div.exDate) break;
                    if (tx.type === 'Compra') qtyOwnedAtExDate += tx.quantity;
                    else qtyOwnedAtExDate -= tx.quantity;
                }
                
                qtyOwnedAtExDate = Math.max(0, qtyOwnedAtExDate);

                if (qtyOwnedAtExDate > 0) {
                    const amount = qtyOwnedAtExDate * div.value;
                    if (div.isProvisioned) {
                        payerAggregation[asset.ticker]!.projectedAmount! += amount;
                    } else {
                        totalReceived += amount;
                        payerAggregation[asset.ticker]!.totalPaid! += amount;
                        payerAggregation[asset.ticker]!.count!++;
                        const monthKey = div.paymentDate.substring(0, 7); 
                        monthlyAggregation[monthKey] = (monthlyAggregation[monthKey] || 0) + amount;
                    }
                }
            });

            // Add metadata
            const sortedHistory = [...history].sort((a,b) => b.exDate.localeCompare(a.exDate));
            const latestDiv = sortedHistory[0];
            const provisioned = sortedHistory.filter(d => d.isProvisioned).sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

            if (payerAggregation[asset.ticker]) {
                payerAggregation[asset.ticker]!.lastExDate = latestDiv?.exDate;
                payerAggregation[asset.ticker]!.isProvisioned = provisioned.length > 0;
                payerAggregation[asset.ticker]!.nextPaymentDate = provisioned.length > 0 ? provisioned[0].paymentDate : latestDiv?.paymentDate;
                const paymentCount = payerAggregation[asset.ticker]!.count!;
                payerAggregation[asset.ticker]!.averageMonthly = paymentCount > 0 ? payerAggregation[asset.ticker]!.totalPaid! / Math.max(1, Math.min(paymentCount, 12)) : 0;
            }
        });
        
        const now = new Date();
        const monthlyData: MonthlyData[] = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyData.push({ month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), total: monthlyAggregation[key] || 0 });
        }

        const payersData = Object.values(payerAggregation) as PayerData[];
        const totalPaidMonths = Object.keys(monthlyAggregation).length;
        const averageIncome = totalPaidMonths > 0 ? totalReceived / totalPaidMonths : 0;
        const yieldOnCost = totalInvestedGlobal > 0 ? (annualForecast / totalInvestedGlobal) * 100 : 0;

        return { totalReceived, monthlyData, payersData, averageIncome, annualForecast, yieldOnCost };
    }, [transactions, assets]);
};


// --- Sub-components ---
const SummaryCard: React.FC<Pick<DividendStats, 'averageIncome' | 'totalReceived' | 'annualForecast' | 'yieldOnCost'>> = ({ averageIncome, totalReceived, annualForecast, yieldOnCost }) => {
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
    const { transactions, assets } = usePortfolio();
    
    const { totalReceived, monthlyData, payersData, averageIncome, annualForecast, yieldOnCost } = useDividendCalculations(transactions, assets);
    
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
                            annualForecast={annualForecast}
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
                                <BarChart data={monthlyData} />
                                <div className="absolute top-0 left-[45px] right-[10px] h-full pointer-events-none">
                                    <div className="absolute w-full border-t border-dashed border-[var(--green-text)] opacity-60"
                                         style={{ bottom: `${(averageIncome / (Math.max(...monthlyData.map(m => m.total)) * 1.2)) * 100}%` }}>
                                    </div>
                                </div>
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
