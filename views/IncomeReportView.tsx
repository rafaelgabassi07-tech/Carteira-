
import React, { useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from '../components/CountUp';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import CalendarIcon from '../components/icons/CalendarIcon';
import PageHeader from '../components/PageHeader';
import { vibrate } from '../utils';
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
    currentMonthValue: number;
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

        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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
            let projectedAmount: number | undefined = undefined;

            const nextProvisioned = sortedHistory.find(d => d.isProvisioned);
            if (nextProvisioned) {
                let qtyOwned = 0;
                for (const tx of assetTxs) {
                    if (tx.date > nextProvisioned.exDate) break;
                    if (tx.type === 'Compra') qtyOwned += tx.quantity;
                    else if (tx.type === 'Venda') qtyOwned -= tx.quantity;
                }
                qtyOwned = Math.max(0, qtyOwned);
                if (qtyOwned > 0) {
                    projectedAmount = qtyOwned * nextProvisioned.value;
                }
            }

            sortedHistory.forEach((div: DividendHistoryEvent) => {
                if (div.exDate < assetTxs[0].date) return;
                let qtyOwned = 0;
                for (const tx of assetTxs) {
                    if (tx.date > div.exDate) break; 
                    if (tx.type === 'Compra') qtyOwned += tx.quantity;
                    else if (tx.type === 'Venda') qtyOwned -= tx.quantity;
                }
                qtyOwned = Math.max(0, qtyOwned);

                if (qtyOwned > 0 && !div.isProvisioned) {
                    const amount = qtyOwned * div.value;
                    totalReceived += amount;
                    tickerTotalPaid += amount;
                    count++;
                    const monthKey = div.paymentDate.substring(0, 7); 
                    monthlyAggregation[monthKey] = (monthlyAggregation[monthKey] || 0) + amount;
                }
            });
            
            const assetYoC = assetTotalInvested > 0 ? (projectedYearly / assetTotalInvested) * 100 : 0;

            payerAggregation[ticker] = {
                ticker,
                totalPaid: tickerTotalPaid,
                count,
                lastExDate: latestDividend?.exDate,
                nextPaymentDate: latestDividend?.paymentDate,
                isProvisioned: latestDividend?.isProvisioned,
                yieldOnCost: assetYoC,
                averageMonthly: count > 0 ? tickerTotalPaid / count : 0,
                projectedAmount,
            };
        });

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

        const currentMonthValue = monthlyAggregation[currentMonthKey] || 0;
        const totalLast12m = monthlyData.reduce((acc, m) => acc + m.total, 0);
        
        // Smarter Average: Average of months since first payment (up to 12)
        const firstIncomeIndex = monthlyData.findIndex(m => m.total > 0);
        const monthsDivisor = firstIncomeIndex === -1 ? 1 : Math.max(1, monthlyData.length - firstIncomeIndex);
        
        // If portfolio is older than 1 year, we assume stable 12m. 
        // We can check earliest transaction date for more precision, but this approximation is good for "12m view".
        const averageIncome = totalLast12m / monthsDivisor;

        const yieldOnCost = totalInvestedGlobal > 0 ? (annualForecast / totalInvestedGlobal) * 100 : 0;

        return { 
            totalReceived, 
            monthlyData, 
            payersData: Object.values(payerAggregation).filter(p => p.totalPaid > 0 || p.projectedAmount).sort((a,b) => b.totalPaid - a.totalPaid), 
            currentMonthValue,
            averageIncome,
            annualForecast,
            yieldOnCost
        };
    }, [transactions, assets]);
};

// --- Sub-Components ---
const MetricCard: React.FC<{ label: string; value: React.ReactNode; subValue?: string; icon: React.ReactNode; highlight?: boolean }> = ({ label, value, subValue, icon, highlight }) => (
    <div className={`p-4 rounded-2xl border flex flex-col justify-between h-28 relative overflow-hidden transition-all ${highlight ? 'bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-tertiary-hover)] border-[var(--accent-color)]/30 shadow-lg shadow-[var(--accent-color)]/5' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'}`}>
        <div className="flex items-center gap-2 mb-1 z-10">
            <div className={`scale-90 ${highlight ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`}>{icon}</div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{label}</span>
        </div>
        <div className="z-10">
            <div className="text-xl font-black tracking-tight text-[var(--text-primary)]">{value}</div>
            {subValue && <div className="text-[10px] font-medium text-[var(--text-secondary)] opacity-80 mt-1">{subValue}</div>}
        </div>
        {highlight && <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-[var(--accent-color)] opacity-5 rounded-full blur-xl pointer-events-none"></div>}
    </div>
);

const MonthlyBarChart: React.FC<{ data: MonthlyData[]; avg: number }> = ({ data, avg }) => {
    const { formatCurrency } = useI18n();
    const maxVal = Math.max(...data.map(d => d.total), avg * 1.2, 1);

    return (
        <div className="relative h-48 w-full pt-8 pb-4">
            {avg > 0 && (
                <div className="absolute left-0 right-0 z-0 flex items-end pointer-events-none" style={{ bottom: `${Math.min((avg / maxVal) * 100, 100)}%`, paddingBottom: '16px' }}> 
                    <div className="w-full border-t border-dashed border-[var(--accent-color)] opacity-40 relative">
                        <span className="text-[8px] text-[var(--accent-color)] absolute right-0 -top-5 bg-[var(--bg-primary)] px-2 py-0.5 rounded-full border border-[var(--border-color)] font-bold shadow-sm backdrop-blur-sm">
                            Média: {formatCurrency(avg)}
                        </span>
                    </div>
                </div>
            )}
            <div className="flex items-end gap-1.5 h-full w-full relative z-10 px-1">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        <div className="absolute -top-10 bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] text-[var(--text-primary)] text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-xl -translate-y-1">
                            {formatCurrency(d.total)}
                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-[var(--border-color)]"></div>
                        </div>
                        <div 
                            className="w-full rounded-t-md transition-all duration-700 ease-out relative overflow-hidden min-h-[4px] max-w-[40px] shadow-sm opacity-70 group-hover:opacity-100"
                            style={{ 
                                height: `${Math.max((d.total / maxVal) * 100, 2)}%`,
                                background: 'linear-gradient(to top, var(--accent-color), var(--accent-color))',
                            }}
                        />
                        <span className="text-[8px] mt-2 font-bold uppercase tracking-wider truncate w-full text-center text-[var(--text-secondary)]">
                            {d.month}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DetailItem: React.FC<{label: string, value: string | React.ReactNode, status?: 'Futuro' | 'Pago'}> = ({label, value, status}) => (
    <div className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-color)]">
        <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">{label}</p>
        <div className="flex items-center gap-2 mt-1">
            <p className="text-xs font-bold text-[var(--text-primary)]">{value}</p>
            {status && <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${status === 'Futuro' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{status}</span>}
        </div>
    </div>
);

const PayerRow: React.FC<{ payer: PayerData; rank: number }> = ({ payer, rank }) => {
    const { formatCurrency, locale } = useI18n();
    const [isExpanded, setIsExpanded] = useState(false);
    
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString(locale, { day: '2-digit', month: 'short' }).replace('.', '');
    };

    return (
        <div className={`rounded-xl transition-all duration-300 overflow-hidden mb-2 ${isExpanded ? 'bg-[var(--bg-tertiary-hover)] shadow-md' : 'bg-[var(--bg-secondary)]'}`}>
            <div onClick={() => { vibrate(); setIsExpanded(!isExpanded); }} className="p-4 flex items-center gap-4 cursor-pointer">
                <div className="flex items-center gap-3">
                     <span className="text-xs font-mono text-[var(--text-secondary)] w-5 text-center">{rank}.</span>
                     <div className="w-10 h-10 rounded-lg bg-[var(--bg-primary)] flex items-center justify-center font-bold text-xs text-[var(--accent-color)] border border-[var(--border-color)]">
                        {payer.ticker.substring(0,4)}
                     </div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[var(--text-primary)]">{payer.ticker}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] font-medium">Total Recebido</p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-sm text-[var(--text-primary)]">{formatCurrency(payer.totalPaid)}</p>
                </div>
                <ChevronRightIcon className={`w-4 h-4 text-[var(--text-secondary)] transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
            </div>
            {isExpanded && (
                <div className="px-4 pb-4 animate-fade-in border-t border-[var(--border-color)]">
                    {payer.isProvisioned && payer.projectedAmount && payer.projectedAmount > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-3 rounded-lg my-3 flex justify-between items-center shadow-sm">
                            <span className="text-xs font-bold uppercase tracking-wide">Valor a Receber</span>
                            <span className="text-sm font-black">{formatCurrency(payer.projectedAmount)}</span>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        <DetailItem label="Yield on Cost" value={`${payer.yieldOnCost.toFixed(1)}%`} />
                        <DetailItem label="Média Mensal" value={formatCurrency(payer.averageMonthly)} />
                        <DetailItem label="Próximo Pagamento" value={formatDate(payer.nextPaymentDate)} status={payer.isProvisioned ? 'Futuro' : 'Pago'}/>
                        <DetailItem label="Data Com" value={formatDate(payer.lastExDate)} />
                    </div>
                </div>
            )}
        </div>
    );
};

interface IncomeReportViewProps {
    onBack: () => void;
}

const IncomeReportView: React.FC<IncomeReportViewProps> = ({ onBack }) => {
    const { formatCurrency } = useI18n();
    const { assets, transactions } = usePortfolio();
    const stats = useDividendCalculations(transactions, assets);
    
    return (
        <div className="p-4 pb-24 md:pb-6 h-full overflow-y-auto custom-scrollbar landscape-pb-6">
            <div className="max-w-2xl mx-auto">
                <PageHeader title="Relatório de Renda" onBack={onBack} />
                <div className="flex flex-col space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                        <MetricCard label="Média Mensal" value={<CountUp end={stats.averageIncome} formatter={formatCurrency} />} subValue="Últimos 12 meses" icon={<CalendarIcon className="w-5 h-5"/>} highlight />
                        <MetricCard label="Previsão Anual" value={<CountUp end={stats.annualForecast} formatter={formatCurrency} />} subValue={`YoC Proj: ${stats.yieldOnCost.toFixed(2)}%`} icon={<SparklesIcon className="w-5 h-5"/>} highlight />
                        <MetricCard label="Total Acumulado" value={<CountUp end={stats.totalReceived} formatter={formatCurrency} />} icon={<TrendingUpIcon className="w-5 h-5"/>} />
                        <MetricCard label="Mês Atual" value={<CountUp end={stats.currentMonthValue} formatter={formatCurrency} />} icon={<ClockIcon className="w-5 h-5"/>} />
                    </div>
                    
                    <div className="bg-[var(--bg-secondary)] p-6 rounded-3xl border border-[var(--border-color)] shadow-sm">
                        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Evolução de Pagamentos</h3>
                        <MonthlyBarChart data={stats.monthlyData} avg={stats.averageIncome} />
                    </div>
                    
                    <div>
                        <div className="flex items-center justify-between px-1 mb-3">
                            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Origem dos Proventos</h3>
                        </div>
                        {stats.payersData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] border-dashed opacity-70 animate-fade-in">
                                <WalletIcon className="w-12 h-12 mb-3 text-[var(--text-secondary)] opacity-50" />
                                <p className="text-sm font-bold text-[var(--text-secondary)]">Sem histórico de proventos</p>
                                <p className="text-xs text-[var(--text-secondary)] mt-1 opacity-70 text-center">Adicione ativos pagadores de dividendos à sua carteira.</p>
                            </div>
                        ) : (
                            <div className="space-y-1 animate-fade-in-up">
                                {stats.payersData.map((payer, idx) => (
                                    <PayerRow key={payer.ticker} payer={payer} rank={idx + 1} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IncomeReportView;
