import React, { useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from './CountUp';
import TrendingUpIcon from './icons/TrendingUpIcon';
import CalendarIcon from './icons/CalendarIcon';
import Modal from './modals/Modal';
import { vibrate } from '../utils';
import ChevronRightIcon from './icons/ChevronRightIcon';
import SparklesIcon from './icons/SparklesIcon';
import ClockIcon from './icons/ClockIcon';
import type { DividendHistoryEvent, Transaction, Asset } from '../types';

// --- Types ---
interface MonthlyData {
    month: string;
    total: number;
    year: number;
    isoDate: string; // YYYY-MM
    isProjected?: boolean;
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
}

interface DividendStats {
    totalReceived: number;
    monthlyData: MonthlyData[];
    payersData: PayerData[];
    currentMonthValue: number;
    currentMonthName: string;
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
            assetTxs.forEach(tx => {
                if (tx.type === 'Compra') {
                    assetTotalInvested += (tx.quantity * tx.price) + (tx.costs || 0);
                }
            });
            totalInvestedGlobal += assetTotalInvested;

            const history = assetData.dividendsHistory || [];
            let tickerTotalPaid = 0;
            let count = 0;
            
            const sortedHistory = [...history].sort((a, b) => b.exDate.localeCompare(a.exDate));
            const latestDividend = sortedHistory.find(d => d.isProvisioned || d.paymentDate >= now.toISOString().split('T')[0]) || sortedHistory[0];

            sortedHistory.forEach((div: DividendHistoryEvent) => {
                if (div.exDate < assetTxs[0].date) return;
                let qtyOwned = 0;
                for (const tx of assetTxs) {
                    if (tx.date > div.exDate) break; 
                    if (tx.type === 'Compra') qtyOwned += tx.quantity;
                    else if (tx.type === 'Venda') qtyOwned -= tx.quantity;
                }
                qtyOwned = Math.max(0, qtyOwned);

                if (qtyOwned > 0) {
                    const amount = qtyOwned * div.value;
                    totalReceived += amount;
                    tickerTotalPaid += amount;
                    count++;
                    const monthKey = div.paymentDate.substring(0, 7); 
                    monthlyAggregation[monthKey] = (monthlyAggregation[monthKey] || 0) + amount;
                }
            });
            
            const assetYoC = assetTotalInvested > 0 ? (tickerTotalPaid / assetTotalInvested) * 100 : 0;

            payerAggregation[ticker] = {
                ticker,
                totalPaid: tickerTotalPaid,
                count,
                lastExDate: latestDividend?.exDate,
                nextPaymentDate: latestDividend?.paymentDate,
                isProvisioned: latestDividend?.isProvisioned,
                yieldOnCost: assetYoC,
                averageMonthly: count > 0 ? tickerTotalPaid / count : 0,
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
                isProjected: key > currentMonthKey
            });
        }

        const currentMonthValue = monthlyAggregation[currentMonthKey] || 0;
        const activeMonths = Object.values(monthlyAggregation).filter(v => v > 0);
        const averageIncome = activeMonths.length > 0 ? activeMonths.reduce((a,b)=>a+b,0) / activeMonths.length : 0;
        const yieldOnCost = totalInvestedGlobal > 0 ? (annualForecast / totalInvestedGlobal) * 100 : 0;
        const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' });

        return { 
            totalReceived, 
            monthlyData, 
            payersData: Object.values(payerAggregation).filter(p => p.totalPaid > 0).sort((a,b) => b.totalPaid - a.totalPaid), 
            currentMonthValue,
            currentMonthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
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
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <DetailItem label="Retorno s/ Custo" value={`${payer.yieldOnCost.toFixed(1)}%`} />
                        <DetailItem label="Média Mensal" value={formatCurrency(payer.averageMonthly)} />
                        <DetailItem label="Próximo Pagamento" value={formatDate(payer.nextPaymentDate)} status={payer.isProvisioned ? 'Futuro' : 'Pago'}/>
                        <DetailItem label="Data Com" value={formatDate(payer.lastExDate)} />
                    </div>
                </div>
            )}
        </div>
    );
};

const IncomeReportModal: React.FC<{ onClose: () => void; stats: DividendStats }> = ({ onClose, stats }) => {
    // FIX: `formatCurrency` was not defined. It's now available via the `useI18n` hook.
    const { formatCurrency } = useI18n();
    return (
        <Modal title="Relatório de Renda" onClose={onClose} type="slide-up" fullScreen={true}>
            <div className="flex flex-col pb-safe space-y-6 w-full max-w-full">
                <div className="grid grid-cols-2 gap-3">
                    <MetricCard label="Média Mensal" value={<CountUp end={stats.averageIncome} formatter={formatCurrency} />} subValue="Últimos 12 meses" icon={<CalendarIcon className="w-5 h-5"/>} highlight />
                    <MetricCard label="Previsão Anual" value={<CountUp end={stats.annualForecast} formatter={formatCurrency} />} subValue={`Yield Proj: ${stats.yieldOnCost.toFixed(2)}%`} icon={<SparklesIcon className="w-5 h-5"/>} highlight />
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
                    <div className="space-y-1">
                        {stats.payersData.map((payer, idx) => (
                            <PayerRow key={payer.ticker} payer={payer} rank={idx + 1} />
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const DividendsSummaryCard: React.FC = () => {
    const { formatCurrency } = useI18n();
    const { assets, transactions, privacyMode } = usePortfolio();
    const [showModal, setShowModal] = useState(false);
    const stats = useDividendCalculations(transactions, assets);
    if (stats.totalReceived === 0) return null;

    return (
        <>
            <div 
                onClick={() => { vibrate(); setShowModal(true); }}
                className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm cursor-pointer hover:bg-[var(--bg-tertiary-hover)] transition-all active:scale-[0.99] group relative overflow-hidden w-full flex flex-col justify-between min-h-[160px]"
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                            <CalendarIcon className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                            {stats.currentMonthName}
                        </span>
                        <div className={`text-3xl font-black text-[var(--text-primary)] tracking-tight ${privacyMode ? 'blur-md' : ''}`}>
                            <CountUp end={stats.currentMonthValue} formatter={formatCurrency} />
                        </div>
                    </div>
                    <div className="p-2 bg-[var(--bg-primary)] rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors">
                        <ChevronRightIcon className="w-4 h-4" />
                    </div>
                </div>
                <div className="mt-auto pt-4 border-t border-[var(--border-color)]/50 grid grid-cols-2 gap-4">
                    <div>
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase block mb-0.5">Média Mensal</span>
                        <span className={`text-sm font-bold text-[var(--text-primary)] ${privacyMode ? 'blur-sm' : ''}`}>
                            {formatCurrency(stats.averageIncome)}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase block flex items-center justify-end gap-1 mb-0.5">
                            Previsão Anual <SparklesIcon className="w-2.5 h-2.5 text-[var(--accent-color)]"/>
                        </span>
                        <span className={`text-sm font-bold text-[var(--accent-color)] ${privacyMode ? 'blur-sm' : ''}`}>
                            {formatCurrency(stats.annualForecast)}
                        </span>
                    </div>
                </div>
            </div>
            {showModal && <IncomeReportModal onClose={() => setShowModal(false)} stats={stats} />}
        </>
    );
};

export default DividendsSummaryCard;
