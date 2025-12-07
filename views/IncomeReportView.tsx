import React, { useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from '../components/CountUp';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import CalendarIcon from '../components/icons/CalendarIcon';
import PageHeader from '../components/PageHeader';
import { vibrate, fromISODate } from '../utils';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import ClockIcon from '../components/icons/ClockIcon';
import WalletIcon from '../components/icons/WalletIcon';
import type { DividendHistoryEvent, Transaction, Asset } from '../types';

// --- Types ---
interface MonthlyData {
    month: string;
    total: number;
    year: number;
    isoDate: string; // YYYY-MM
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
    projectedAmount?: number;
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
        let annualForecast = 0;
        
        const monthlyAggregation: Record<string, number> = {}; 
        const payerAggregation: Record<string, PayerData> = {};

        const allTickers = Array.from(new Set(transactions.map(t => t.ticker)));

        allTickers.forEach((ticker) => {
            const assetData = assets.find(a => a.ticker === ticker);
            if (!assetData) return;

            const assetValue = assetData.quantity * assetData.currentPrice;
            const projectedYearly = assetData.dy ? assetValue * (assetData.dy / 100) : 0;
            annualForecast += projectedYearly;

            const assetTxs = transactions
                .filter(t => t.ticker === ticker)
                .sort((a, b) => a.date.localeCompare(b.date));
            
            if (assetTxs.length === 0) return;

            let assetTotalInvested = 0;
            let qtyAtEnd = 0;
            assetTxs.forEach(tx => {
                if (tx.type === 'Compra') {
                    assetTotalInvested += (tx.quantity * tx.price) + (tx.costs || 0);
                    qtyAtEnd += tx.quantity;
                } else {
                    const avgPrice = qtyAtEnd > 0 ? assetTotalInvested / qtyAtEnd : 0;
                    assetTotalInvested -= tx.quantity * avgPrice;
                    qtyAtEnd -= tx.quantity;
                }
            });
            totalInvestedGlobal += Math.max(0, assetTotalInvested);

            const history = assetData.dividendsHistory || [];
            let tickerTotalPaid = 0;
            let count = 0;
            
            const sortedHistory = [...history].sort((a, b) => b.exDate.localeCompare(a.exDate));
            const latestDividend = sortedHistory[0];
            
            let projectedAmount = 0;
            let hasProvisioned = false;
            let nextPaymentDate: string | undefined = undefined;

            const provisionedDividends = sortedHistory.filter(d => d.isProvisioned);
            if (provisionedDividends.length > 0) {
                hasProvisioned = true;
                nextPaymentDate = provisionedDividends.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))[0].paymentDate;

                provisionedDividends.forEach(provDiv => {
                    let qtyOwned = 0;
                    for (const tx of assetTxs) {
                        if (tx.date >= provDiv.exDate) break;
                        if (tx.type === 'Compra') qtyOwned += tx.quantity;
                        else if (tx.type === 'Venda') qtyOwned -= tx.quantity;
                    }
                    if (Math.max(0, qtyOwned) > 0) {
                        projectedAmount += Math.max(0, qtyOwned) * provDiv.value;
                    }
                });
            } else if (latestDividend) {
                nextPaymentDate = latestDividend.paymentDate;
            }

            sortedHistory.forEach((div: DividendHistoryEvent) => {
                if (div.exDate < assetTxs[0].date || div.isProvisioned) return;

                let qtyOwned = 0;
                for (const tx of assetTxs) {
                    if (tx.date >= div.exDate) break; 
                    if (tx.type === 'Compra') qtyOwned += tx.quantity;
                    else if (tx.type === 'Venda') qtyOwned -= tx.quantity;
                }
                
                if (Math.max(0, qtyOwned) > 0) {
                    const amount = Math.max(0, qtyOwned) * div.value;
                    totalReceived += amount;
                    tickerTotalPaid += amount;
                    count++;
                    const monthKey = div.paymentDate.substring(0, 7); 
                    monthlyAggregation[monthKey] = (monthlyAggregation[monthKey] || 0) + amount;
                }
            });
            
            const assetYoC = assetTotalInvested > 0 ? (projectedYearly / assetTotalInvested) * 100 : 0;

            payerAggregation[ticker] = {
                ticker, totalPaid: tickerTotalPaid, count,
                lastExDate: latestDividend?.exDate, nextPaymentDate, isProvisioned: hasProvisioned, yieldOnCost: assetYoC,
                averageMonthly: count > 0 ? tickerTotalPaid / Math.max(1, Math.min(count, 12)) : 0, projectedAmount,
            };
        });

        const now = new Date();
        const monthlyData: MonthlyData[] = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyData.push({
                isoDate: key,
                month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
                year: d.getFullYear(),
                total: monthlyAggregation[key] || 0,
            });
        }
        
        const totalLast12m = monthlyData.reduce((acc, m) => acc + m.total, 0);
        const firstIncomeIndex = monthlyData.findIndex(m => m.total > 0);
        const monthsDivisor = firstIncomeIndex === -1 ? 1 : Math.max(1, monthlyData.length - firstIncomeIndex);
        const averageIncome = totalLast12m / monthsDivisor;
        const yieldOnCost = totalInvestedGlobal > 0 ? (annualForecast / totalInvestedGlobal) * 100 : 0;

        return { 
            totalReceived, monthlyData, averageIncome, annualForecast, yieldOnCost,
            payersData: Object.values(payerAggregation)
              .filter(p => p.totalPaid > 0 || (p.projectedAmount && p.projectedAmount > 0))
              .sort((a,b) => (b.totalPaid + (b.projectedAmount || 0)) - (a.totalPaid + (a.projectedAmount || 0))), 
        };
    }, [transactions, assets]);
};

// --- Sub-Components ---
const SummaryPanel: React.FC<Pick<DividendStats, 'averageIncome' | 'totalReceived' | 'annualForecast' | 'yieldOnCost'>> = 
({ averageIncome, totalReceived, annualForecast, yieldOnCost }) => {
    const { t, formatCurrency } = useI18n();

    return (
        <div className="bg-gradient-to-br from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-[var(--bg-tertiary-hover)] p-5 rounded-3xl border border-[var(--border-color)] shadow-xl shadow-black/20 relative overflow-hidden mb-6">
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-[var(--accent-color)] opacity-5 blur-3xl rounded-full"></div>
            <div className="relative z-10 grid grid-cols-2 gap-x-5 gap-y-6">
                {/* Main Metrics */}
                <div className="flex flex-col justify-center">
                    <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1">{t('average_income')}</p>
                    <p className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                        <CountUp end={averageIncome} formatter={formatCurrency} />
                    </p>
                </div>
                 <div className="flex flex-col justify-center border-l border-[var(--border-color)]/50 pl-5">
                    <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1">{t('total_received_all_time')}</p>
                    <p className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                        <CountUp end={totalReceived} formatter={formatCurrency} />
                    </p>
                </div>
                {/* Secondary Metrics */}
                <div className="pt-4 border-t border-[var(--border-color)]/50">
                    <p className="text-[9px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1 flex items-center gap-1.5"><SparklesIcon className="w-3 h-3 text-[var(--accent-color)]" /> {t('annual_forecast')}</p>
                    <p className="text-base font-bold text-[var(--accent-color)] tracking-tight">
                        <CountUp end={annualForecast} formatter={formatCurrency} />
                    </p>
                </div>
                 <div className="pt-4 border-t border-[var(--border-color)]/50 border-l border-[var(--border-color)]/50 pl-5">
                    <p className="text-[9px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1 flex items-center gap-1.5"><TrendingUpIcon className="w-3 h-3 text-[var(--text-secondary)]" /> {t('overall_yoc')}</p>
                    <p className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                        <CountUp end={yieldOnCost} decimals={2} />%
                    </p>
                </div>
            </div>
        </div>
    );
};

const MonthlyEvolutionCard: React.FC<{ data: MonthlyData[]; avg: number }> = ({ data, avg }) => {
    const { t, formatCurrency } = useI18n();
    const maxVal = Math.max(...data.map(d => d.total), avg * 1.2, 1);

    return (
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-color)] mb-6 shadow-sm">
            <h3 className="font-bold text-[var(--text-primary)] mb-4">{t('monthly_evolution')}</h3>
            <div className="relative h-48 w-full pt-8 pb-4">
                {avg > 0 && (
                    <div className="absolute left-0 right-0 z-0 flex items-end pointer-events-none" style={{ bottom: `${Math.min((avg / maxVal) * 100, 100)}%`, paddingBottom: '16px' }}> 
                        <div className="w-full border-t border-dashed border-[var(--accent-color)] opacity-40 relative">
                            <span className="text-[8px] text-[var(--accent-color)] absolute right-0 -top-5 bg-[var(--bg-primary)] px-2 py-0.5 rounded-full border border-[var(--border-color)] font-bold shadow-sm backdrop-blur-sm">
                                {t('average')}: {formatCurrency(avg)}
                            </span>
                        </div>
                    </div>
                )}
                <div className="flex items-end gap-1.5 h-full w-full relative z-10 px-1">
                    {data.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                            <div className="absolute -top-10 bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] text-[var(--text-primary)] text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-xl -translate-y-1">
                                {formatCurrency(d.total)}
                            </div>
                            <div 
                                className="w-full rounded-t-md transition-all duration-700 ease-out relative overflow-hidden min-h-[4px] max-w-[40px] shadow-sm opacity-70 group-hover:opacity-100"
                                style={{ 
                                    height: `${Math.max((d.total / maxVal) * 100, 2)}%`,
                                    background: 'linear-gradient(to top, var(--accent-color), rgba(var(--accent-rgb), 0.5))',
                                }}
                            />
                            <span className="text-[8px] mt-2 font-bold uppercase tracking-wider truncate w-full text-center text-[var(--text-secondary)]">
                                {d.month}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const DetailItem: React.FC<{label: string, value: string | React.ReactNode, status?: 'Futuro' | 'Pago'}> = ({label, value, status}) => (
    <div className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-color)]">
        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{label}</p>
        <div className="flex justify-between items-center">
            <span className="font-bold text-sm text-[var(--text-primary)]">{value}</span>
            {status && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${status === 'Futuro' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                    {status}
                </span>
            )}
        </div>
    </div>
);

const PayerRow: React.FC<{ payer: PayerData; totalIncome: number; isExpanded: boolean; onToggle: () => void }> = ({ payer, totalIncome, isExpanded, onToggle }) => {
    const { t, formatCurrency } = useI18n();
    const contribution = totalIncome > 0 ? ((payer.totalPaid + (payer.projectedAmount || 0)) / totalIncome) * 100 : 0;
    
    return (
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden transition-all duration-300">
            <div 
                onClick={() => { vibrate(); onToggle(); }}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-tertiary-hover)] relative"
            >
                {/* Contribution Bar */}
                <div className="absolute left-0 top-0 bottom-0 bg-[var(--accent-color)]/10" style={{ width: `${contribution}%`, transition: 'width 0.5s ease-out' }}></div>

                <div className="flex items-center gap-3 z-10">
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-center font-bold text-xs text-[var(--text-primary)]">
                        {payer.ticker.substring(0, 4)}
                    </div>
                    <div>
                        <span className="font-bold text-sm text-[var(--text-primary)] block">{payer.ticker}</span>
                        <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                           {payer.count} {payer.count === 1 ? 'pagamento' : 'pagamentos'}
                        </span>
                    </div>
                </div>
                
                <div className="text-right z-10 flex items-center gap-3">
                    <div>
                        <span className="block font-bold text-sm text-[var(--green-text)]">
                            +{formatCurrency(payer.totalPaid)}
                        </span>
                        {payer.projectedAmount && payer.projectedAmount > 0 ? (
                            <div className="flex items-center justify-end gap-1 text-[9px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded mt-1">
                                <ClockIcon className="w-2.5 h-2.5" />
                                +{formatCurrency(payer.projectedAmount)}
                            </div>
                        ) : (
                            <span className="text-[10px] text-[var(--text-secondary)]">Total</span>
                        )}
                    </div>
                    <ChevronRightIcon className={`w-4 h-4 text-[var(--text-secondary)] transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
            </div>

            {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-[var(--border-color)]/50 bg-[var(--bg-primary)]/30 animate-fade-in">
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        <DetailItem 
                            label={t('next_payment')}
                            value={payer.nextPaymentDate ? fromISODate(payer.nextPaymentDate).toLocaleDateString('pt-BR') : '-'}
                            status={payer.isProvisioned ? 'Futuro' : undefined}
                        />
                        <DetailItem 
                            label={t('last_ex_date')}
                            value={payer.lastExDate ? fromISODate(payer.lastExDate).toLocaleDateString('pt-BR') : '-'} 
                        />
                        <DetailItem label={t('asset_average')} value={formatCurrency(payer.averageMonthly)} />
                        <DetailItem label={t('asset_yoc')} value={`${payer.yieldOnCost.toFixed(2)}%`} />
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Main View ---
const IncomeReportView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useI18n();
    const { transactions, assets } = usePortfolio();
    const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

    const stats = useDividendCalculations(transactions, assets);
    const totalIncomeForPercentage = stats.totalReceived + stats.payersData.reduce((acc, p) => acc + (p.projectedAmount || 0), 0);

    const toggleTicker = (ticker: string) => {
        setExpandedTicker(expandedTicker === ticker ? null : ticker);
    };

    return (
        <div className="p-4 pb-24 md:pb-6 h-full overflow-y-auto custom-scrollbar landscape-pb-6 animate-fade-in">
            <div className="max-w-2xl mx-auto">
                <PageHeader title={t('income_report_title')} onBack={onBack} />
                
                <SummaryPanel {...stats} />
                
                <MonthlyEvolutionCard data={stats.monthlyData} avg={stats.averageIncome} />

                <div>
                    <h3 className="font-bold text-[var(--text-primary)] mb-4 px-1 flex items-center gap-2">
                        {t('paying_sources')}
                        <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full border border-[var(--border-color)]">{stats.payersData.length}</span>
                    </h3>
                    <div className="space-y-3">
                        {stats.payersData.length > 0 ? (
                            stats.payersData.map(payer => (
                                <PayerRow 
                                    key={payer.ticker} 
                                    payer={payer} 
                                    totalIncome={totalIncomeForPercentage}
                                    isExpanded={expandedTicker === payer.ticker}
                                    onToggle={() => toggleTicker(payer.ticker)}
                                />
                            ))
                        ) : (
                            <div className="text-center py-12 text-[var(--text-secondary)] opacity-60 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)]">
                                Nenhuma renda registrada ainda.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IncomeReportView;
