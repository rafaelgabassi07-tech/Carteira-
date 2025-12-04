
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
    totalPaid: number; // Total pago historicamente
    count: number;
    lastExDate?: string;
    nextPaymentDate?: string;
    dy: number;
    annualProjection: number; // Projeção baseada no DY atual
}

interface DividendStats {
    totalReceived: number;
    monthlyData: MonthlyData[];
    payersData: PayerData[];
    currentMonthValue: number;
    currentMonthName: string;
    averageIncome: number;
    annualForecast: number; // Previsão anualizada da carteira atual
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

        // 1. Calculate Historical Data & Totals
        const allTickers = Array.from(new Set(transactions.map(t => t.ticker)));

        allTickers.forEach((ticker) => {
            const assetData = assets.find(a => a.ticker === ticker);
            if (!assetData) return;

            // Calculate Annual Forecast for this asset (Current Quantity * Current Price * DY)
            const assetValue = assetData.quantity * assetData.currentPrice;
            const projectedYearly = assetData.dy ? assetValue * (assetData.dy / 100) : 0;
            annualForecast += projectedYearly;

            const assetTxs = transactions
                .filter(t => t.ticker === ticker)
                .sort((a, b) => a.date.localeCompare(b.date));

            // Calculate Invested Total
            let assetTotalInvested = 0;
            assetTxs.forEach(tx => {
                if (tx.type === 'Compra') {
                    assetTotalInvested += (tx.quantity * tx.price) + (tx.costs || 0);
                }
            });
            totalInvestedGlobal += assetTotalInvested;

            // Process History
            const history = assetData.dividendsHistory || [];
            let tickerTotalPaid = 0;
            let count = 0;
            let lastExDate: string | undefined = undefined;
            let nextPaymentDate: string | undefined = undefined;

            // Sort history to find latest dates easily
            const sortedHistory = [...history].sort((a, b) => b.exDate.localeCompare(a.exDate));
            if (sortedHistory.length > 0) {
                lastExDate = sortedHistory[0].exDate;
                // Find nearest payment date (can be future)
                const futurePayment = sortedHistory.find(d => d.isProvisioned || d.paymentDate >= now.toISOString().split('T')[0]);
                nextPaymentDate = futurePayment ? futurePayment.paymentDate : sortedHistory[0].paymentDate;
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

                if (qtyOwned > 0) {
                    const amount = qtyOwned * div.value;
                    totalReceived += amount;
                    tickerTotalPaid += amount;
                    count++;

                    const monthKey = div.paymentDate.substring(0, 7); 
                    monthlyAggregation[monthKey] = (monthlyAggregation[monthKey] || 0) + amount;
                }
            });

            payerAggregation[ticker] = {
                ticker,
                totalPaid: tickerTotalPaid,
                count,
                lastExDate,
                nextPaymentDate,
                dy: assetData.dy || 0,
                annualProjection: projectedYearly
            };
        });

        // 2. Prepare Monthly Chart Data (Last 12 Months)
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

        // 3. Global Stats
        const currentMonthValue = monthlyAggregation[currentMonthKey] || 0;
        
        // Average Income (Exclude zeros for realistic average of active months)
        const activeMonths = Object.values(monthlyAggregation).filter(v => v > 0);
        const averageIncome = activeMonths.length > 0 ? activeMonths.reduce((a,b)=>a+b,0) / activeMonths.length : 0;

        const yieldOnCost = totalInvestedGlobal > 0 ? (annualForecast / totalInvestedGlobal) * 100 : 0;

        const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' });

        return { 
            totalReceived, 
            monthlyData, 
            payersData: Object.values(payerAggregation).sort((a,b) => b.totalPaid - a.totalPaid), 
            currentMonthValue,
            currentMonthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
            averageIncome,
            annualForecast,
            yieldOnCost
        };
    }, [transactions, assets]);
};

// --- Sub-Components ---

const MetricCard: React.FC<{ 
    label: string; 
    value: React.ReactNode; 
    subValue?: string; 
    icon: React.ReactNode; 
    highlight?: boolean 
}> = ({ label, value, subValue, icon, highlight }) => (
    <div className={`p-3 rounded-2xl border flex flex-col justify-between h-24 relative overflow-hidden ${highlight ? 'bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-tertiary-hover)] border-[var(--accent-color)]/30' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'}`}>
        {highlight && <div className="absolute top-0 right-0 p-2 opacity-10 text-[var(--accent-color)]">{icon}</div>}
        <div className="flex items-center gap-1.5 mb-1 z-10">
            <div className={`scale-75 ${highlight ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`}>{icon}</div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{label}</span>
        </div>
        <div className="z-10">
            <div className="text-lg font-black tracking-tight text-[var(--text-primary)]">{value}</div>
            {subValue && <div className="text-[10px] font-medium text-[var(--text-secondary)] opacity-80">{subValue}</div>}
        </div>
    </div>
);

const MonthlyBarChart: React.FC<{ data: MonthlyData[]; avg: number }> = ({ data, avg }) => {
    const { formatCurrency } = useI18n();
    const maxVal = Math.max(...data.map(d => d.total), avg * 1.2, 1);

    return (
        <div className="relative h-40 w-full pt-6 pb-4">
            {/* Avg Line */}
            {avg > 0 && (
                <div className="absolute left-0 right-0 z-0 flex items-end pointer-events-none" style={{ bottom: `${Math.min((avg / maxVal) * 100, 100)}%`, paddingBottom: '16px' }}> 
                    <div className="w-full border-t border-dashed border-[var(--text-secondary)] opacity-30 relative">
                        <span className="text-[8px] text-[var(--text-secondary)] absolute right-0 -top-4 bg-[var(--bg-secondary)] pl-1 font-bold">
                            Média: {formatCurrency(avg)}
                        </span>
                    </div>
                </div>
            )}

            <div className="flex items-end gap-1.5 h-full w-full relative z-10 px-1">
                {data.map((d, i) => {
                    const heightPercent = (d.total / maxVal) * 100;
                    const isCurrent = i === data.length - 1;
                    
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                            <div 
                                className={`w-full rounded-t-sm transition-all duration-500 relative overflow-hidden min-h-[4px] max-w-[32px] ${isCurrent ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}
                                style={{ 
                                    height: `${Math.max(heightPercent, 2)}%`,
                                    background: isCurrent 
                                        ? 'linear-gradient(to top, var(--accent-color), var(--accent-color))' 
                                        : 'linear-gradient(to top, var(--text-secondary), var(--text-secondary))',
                                }}
                            >
                            </div>
                            <span className={`text-[8px] mt-1.5 font-bold uppercase tracking-wider truncate w-full text-center ${isCurrent ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)] opacity-70'}`}>
                                {d.month}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const DetailedPayerRow: React.FC<{ payer: PayerData; rank: number }> = ({ payer, rank }) => {
    const { formatCurrency, locale } = useI18n();
    
    // Format dates safely
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
    };

    return (
        <div className="bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-color)] mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-50 w-3">{rank}</span>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--text-primary)]">{payer.ticker}</span>
                        {payer.annualProjection > 0 && (
                            <span className="text-[9px] bg-[var(--bg-secondary)] border border-[var(--border-color)] px-1.5 rounded text-[var(--text-secondary)]">
                                {formatCurrency(payer.annualProjection/12)}/mês
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        <div className="flex flex-col">
                            <span className="text-[8px] text-[var(--text-secondary)] uppercase font-bold">Data Com</span>
                            <span className="text-[10px] font-medium text-[var(--text-primary)]">{formatDate(payer.lastExDate)}</span>
                        </div>
                        <div className="w-px h-4 bg-[var(--border-color)]"></div>
                        <div className="flex flex-col">
                            <span className="text-[8px] text-[var(--text-secondary)] uppercase font-bold">Pagamento</span>
                            <span className="text-[10px] font-medium text-[var(--text-primary)]">{formatDate(payer.nextPaymentDate)}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="text-right">
                <span className="block font-bold text-sm text-[var(--accent-color)]">{formatCurrency(payer.totalPaid)}</span>
                <span className="text-[9px] font-medium text-[var(--text-secondary)]">Total Recebido</span>
            </div>
        </div>
    );
};

// --- Modal Content ---
const IncomeReportModal: React.FC<{ onClose: () => void; stats: DividendStats }> = ({ onClose, stats }) => {
    const { formatCurrency } = useI18n();

    return (
        <Modal title="Relatório de Renda" onClose={onClose} type="slide-up" fullScreen={true}>
            <div className="flex flex-col pb-safe space-y-6 w-full max-w-full">
                
                {/* 1. Executive Summary Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <MetricCard 
                        label="Média Mensal" 
                        value={formatCurrency(stats.averageIncome)} 
                        subValue="Base: Últimos 12 meses"
                        icon={<CalendarIcon className="w-5 h-5"/>}
                        highlight
                    />
                    <MetricCard 
                        label="Previsão Anual" 
                        value={formatCurrency(stats.annualForecast)} 
                        subValue={`Yield Proj: ${stats.yieldOnCost.toFixed(2)}%`}
                        icon={<SparklesIcon className="w-5 h-5"/>}
                        highlight
                    />
                    <MetricCard 
                        label="Total Recebido" 
                        value={formatCurrency(stats.totalReceived)} 
                        icon={<TrendingUpIcon className="w-5 h-5"/>}
                    />
                    <MetricCard 
                        label="Mês Atual" 
                        value={formatCurrency(stats.currentMonthValue)} 
                        icon={<ClockIcon className="w-5 h-5"/>}
                    />
                </div>

                {/* 2. Evolution Chart */}
                <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)]">
                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Evolução de Pagamentos</h3>
                    <MonthlyBarChart data={stats.monthlyData} avg={stats.averageIncome} />
                </div>

                {/* 3. Detailed Agenda/List */}
                <div>
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                        <CalendarIcon className="w-3.5 h-3.5 text-[var(--accent-color)]"/>
                        Detalhamento por Ativo
                    </h3>
                    <div className="space-y-1">
                        {stats.payersData.map((payer, idx) => (
                            <DetailedPayerRow key={payer.ticker} payer={payer} rank={idx + 1} />
                        ))}
                    </div>
                </div>

            </div>
        </Modal>
    );
};

// --- Main Card (Dashboard) ---
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
                className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm cursor-pointer hover:bg-[var(--bg-tertiary-hover)] transition-all active:scale-[0.99] group relative overflow-hidden w-full"
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                            {stats.currentMonthName}
                        </span>
                        <div className={`text-2xl font-black text-[var(--text-primary)] mt-1 ${privacyMode ? 'blur-md' : ''}`}>
                            <CountUp end={stats.currentMonthValue} formatter={formatCurrency} />
                        </div>
                    </div>
                    <div className="p-2 bg-[var(--bg-primary)] rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors">
                        <ChevronRightIcon className="w-4 h-4" />
                    </div>
                </div>

                <div className="pt-3 border-t border-[var(--border-color)] grid grid-cols-2 gap-4">
                    <div>
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase block">Média Mensal</span>
                        <span className={`text-xs font-bold text-[var(--text-primary)] ${privacyMode ? 'blur-sm' : ''}`}>
                            {formatCurrency(stats.averageIncome)}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase block flex items-center justify-end gap-1">
                            Previsão Anual <SparklesIcon className="w-2.5 h-2.5 text-[var(--accent-color)]"/>
                        </span>
                        <span className={`text-xs font-bold text-[var(--accent-color)] ${privacyMode ? 'blur-sm' : ''}`}>
                            {formatCurrency(stats.annualForecast)}
                        </span>
                    </div>
                </div>
            </div>

            {showModal && (
                <IncomeReportModal 
                    onClose={() => setShowModal(false)}
                    stats={stats}
                />
            )}
        </>
    );
};

export default DividendsSummaryCard;
