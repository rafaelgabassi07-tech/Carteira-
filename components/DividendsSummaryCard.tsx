
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
    totalPaid: number; // Total recebido em R$ neste periodo/snapshot
    count: number;
    lastExDate?: string;
    nextPaymentDate?: string;
    isProvisioned?: boolean; // Se o próximo pagamento é futuro
    yieldOnCost: number; // Retorno sobre o investido neste ativo
    averageMonthly: number;
    userQuantity: number; // Quantidade de cotas considerada
    lastValuePerShare: number; // Valor unitário do último/próximo provento
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

            // Calculate Invested Total per Asset
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
            let isProvisioned = false;
            let lastValuePerShare = 0;
            let currentQuantityOwned = 0;

            // Sort history to find latest dates easily (Newest first)
            const sortedHistory = [...history].sort((a, b) => b.exDate.localeCompare(a.exDate));
            
            if (sortedHistory.length > 0) {
                // Try to find a future/provisioned dividend first
                const provisioned = sortedHistory.find(d => d.isProvisioned || d.paymentDate >= now.toISOString().split('T')[0]);
                if (provisioned) {
                    lastExDate = provisioned.exDate;
                    nextPaymentDate = provisioned.paymentDate;
                    isProvisioned = true;
                    lastValuePerShare = provisioned.value;
                } else {
                    // Fallback to the absolute last one
                    lastExDate = sortedHistory[0].exDate;
                    nextPaymentDate = sortedHistory[0].paymentDate;
                    lastValuePerShare = sortedHistory[0].value;
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

                // Update the quantity for the "latest" displayed dividend
                if ((div.exDate === lastExDate) && qtyOwned > 0) {
                    currentQuantityOwned = qtyOwned;
                }

                if (qtyOwned > 0) {
                    const amount = qtyOwned * div.value;
                    totalReceived += amount;
                    tickerTotalPaid += amount;
                    count++;

                    const monthKey = div.paymentDate.substring(0, 7); 
                    monthlyAggregation[monthKey] = (monthlyAggregation[monthKey] || 0) + amount;
                }
            });
            
            // Fallback if current qty wasn't captured in loop (e.g. no recent dividend match, but asset exists)
            if (currentQuantityOwned === 0) currentQuantityOwned = assetData.quantity;

            // Calculate Yield on Cost specific to this asset
            const assetYoC = assetTotalInvested > 0 ? (tickerTotalPaid / assetTotalInvested) * 100 : 0;

            payerAggregation[ticker] = {
                ticker,
                totalPaid: tickerTotalPaid,
                count,
                lastExDate,
                nextPaymentDate,
                isProvisioned,
                yieldOnCost: assetYoC,
                averageMonthly: count > 0 ? tickerTotalPaid / count : 0,
                userQuantity: currentQuantityOwned,
                lastValuePerShare
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
        
        const activeMonths = Object.values(monthlyAggregation).filter(v => v > 0);
        const averageIncome = activeMonths.length > 0 ? activeMonths.reduce((a,b)=>a+b,0) / activeMonths.length : 0;

        const yieldOnCost = totalInvestedGlobal > 0 ? (annualForecast / totalInvestedGlobal) * 100 : 0;

        const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' });

        return { 
            totalReceived, 
            monthlyData, 
            payersData: Object.values(payerAggregation).filter(p => p.totalPaid > 0 || p.isProvisioned || p.nextPaymentDate).sort((a,b) => b.totalPaid - a.totalPaid), 
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
            {/* Avg Line */}
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
                {data.map((d, i) => {
                    const heightPercent = (d.total / maxVal) * 100;
                    const isCurrent = i === data.length - 1;
                    
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                            {/* Tooltip on hover */}
                            <div className="absolute -top-10 bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] text-[var(--text-primary)] text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-xl -translate-y-1">
                                {formatCurrency(d.total)}
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-[var(--border-color)]"></div>
                            </div>

                            <div 
                                className={`w-full rounded-t-md transition-all duration-700 ease-out relative overflow-hidden min-h-[4px] max-w-[40px] shadow-sm ${isCurrent ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}
                                style={{ 
                                    height: `${Math.max(heightPercent, 2)}%`,
                                    background: isCurrent 
                                        ? 'linear-gradient(to top, var(--accent-color), var(--accent-color))' 
                                        : 'linear-gradient(to top, var(--text-secondary), var(--bg-tertiary-hover))',
                                }}
                            >
                            </div>
                            <span className={`text-[8px] mt-2 font-bold uppercase tracking-wider truncate w-full text-center ${isCurrent ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`}>
                                {d.month}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const DetailRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
    <div className="flex flex-col">
        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider opacity-70 mb-0.5">{label}</span>
        <span className={`text-xs font-bold ${highlight ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{value}</span>
    </div>
);

const DetailedPayerRow: React.FC<{ payer: PayerData; rank: number }> = ({ payer, rank }) => {
    const { formatCurrency, locale } = useI18n();
    const [isExpanded, setIsExpanded] = useState(false);
    
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' }).replace('.', '');
    };

    const formatFullDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        // Fix timezone issue for visual display
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
        
        return adjustedDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const today = new Date();
    today.setHours(0,0,0,0);
    
    const payDateObj = payer.nextPaymentDate ? new Date(payer.nextPaymentDate) : null;
    if(payDateObj) payDateObj.setHours(0,0,0,0);

    const isFuture = payer.isProvisioned || (payDateObj && payDateObj >= today);
    const isToday = payDateObj && payDateObj.getTime() === today.getTime();

    // Calculate days remaining if future
    let daysRemaining = null;
    if (isFuture && payDateObj) {
        const diffTime = Math.abs(payDateObj.getTime() - today.getTime());
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    }

    const projectedTotal = payer.userQuantity * payer.lastValuePerShare;

    return (
        <div className={`bg-[var(--bg-primary)] rounded-2xl border transition-all duration-300 overflow-hidden mb-2.5 ${isExpanded ? 'border-[var(--accent-color)] shadow-md' : 'border-[var(--border-color)] hover:border-[var(--accent-color)]/30'}`}>
            
            {/* Header (Clickable) */}
            <div 
                onClick={() => { vibrate(); setIsExpanded(!isExpanded); }}
                className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[var(--bg-tertiary-hover)] transition-colors relative"
            >
                {/* Rank & Ticker */}
                <div className="flex items-center gap-3 w-[28%]">
                    <div className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-[9px] font-bold ${rank <= 3 ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'}`}>
                        {rank}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-[var(--text-primary)] truncate leading-tight">{payer.ticker}</span>
                        <span className="text-[9px] text-[var(--text-secondary)] font-medium truncate opacity-80">
                            YOC: <span className={payer.yieldOnCost > 10 ? "text-[var(--green-text)] font-bold" : ""}>{payer.yieldOnCost.toFixed(1)}%</span>
                        </span>
                    </div>
                </div>

                {/* Calendar Timeline */}
                <div className="flex-1 flex flex-col items-center justify-center px-2">
                    <div className="flex items-center w-full max-w-[140px] justify-between relative mb-1.5">
                        <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[1.5px] bg-[var(--border-color)] -z-10"></div>
                        
                        {/* Ex Date Dot */}
                        <div className="flex flex-col items-center bg-[var(--bg-primary)] px-1 z-10">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] mb-1 opacity-50 ring-2 ring-[var(--bg-primary)]"></span>
                            <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{formatDate(payer.lastExDate)}</span>
                        </div>

                        {/* Pay Date Dot */}
                        <div className="flex flex-col items-center bg-[var(--bg-primary)] px-1 z-10">
                            <span className={`w-2 h-2 rounded-full mb-1 ring-2 ring-[var(--bg-primary)] ${isFuture ? 'bg-[var(--accent-color)] shadow-[0_0_6px_var(--accent-color)]' : 'bg-[var(--green-text)]'}`}></span>
                            <span className={`text-[8px] font-bold uppercase tracking-wider ${isFuture ? 'text-[var(--accent-color)]' : 'text-[var(--text-primary)]'}`}>
                                {formatDate(payer.nextPaymentDate)}
                            </span>
                        </div>
                    </div>
                    
                    {isFuture && (
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md leading-none ${isToday ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] animate-pulse' : 'bg-[var(--bg-secondary)] text-[var(--accent-color)] border border-[var(--border-color)]'}`}>
                            {isToday ? 'HOJE!' : `${daysRemaining} dias`}
                        </span>
                    )}
                    {!isFuture && payer.count > 0 && (
                        <span className="text-[8px] font-medium text-[var(--text-secondary)] opacity-50 leading-none">Pago</span>
                    )}
                </div>
                
                {/* Values & Arrow */}
                <div className="text-right w-[28%] flex flex-col justify-center items-end">
                    <div className="flex items-center gap-1">
                        <span className="font-black text-sm text-[var(--text-primary)]">{formatCurrency(payer.totalPaid > 0 ? payer.totalPaid : projectedTotal)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] text-[var(--text-secondary)] font-medium opacity-80">
                            Méd: {formatCurrency(payer.averageMonthly)}
                        </span>
                        <ChevronRightIcon className={`w-3 h-3 text-[var(--text-secondary)] transition-transform duration-300 ${isExpanded ? '-rotate-90' : 'rotate-90'}`} />
                    </div>
                </div>
            </div>

            {/* Accordion Body */}
            {isExpanded && (
                <div className="bg-[var(--bg-secondary)]/30 border-t border-[var(--border-color)] border-dashed p-4 animate-slide-down">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 mb-2">
                        <DetailRow label="Data Com" value={formatFullDate(payer.lastExDate)} highlight />
                        <DetailRow label="Data Pagamento" value={formatFullDate(payer.nextPaymentDate)} highlight />
                        
                        <div className="col-span-2 h-px bg-[var(--border-color)]/50 my-1"></div>

                        <DetailRow label="Quantidade" value={`${payer.userQuantity} cotas`} />
                        <DetailRow label="Valor Unitário" value={formatCurrency(payer.lastValuePerShare)} highlight />
                        
                        <div className="col-span-2 bg-[var(--bg-secondary)] p-2 rounded-lg border border-[var(--border-color)] flex justify-between items-center mt-1">
                            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Total Previsto</span>
                            <span className="font-bold text-[var(--accent-color)]">{formatCurrency(projectedTotal)}</span>
                        </div>
                    </div>
                </div>
            )}
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
                        subValue="Últimos 12 meses"
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
                        label="Total Acumulado" 
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
                <div className="bg-[var(--bg-secondary)] p-6 rounded-3xl border border-[var(--border-color)] shadow-sm">
                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Evolução de Pagamentos</h3>
                    <MonthlyBarChart data={stats.monthlyData} avg={stats.averageIncome} />
                </div>

                {/* 3. Detailed Agenda/List */}
                <div>
                    <div className="flex items-center justify-between px-1 mb-4">
                        <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                            <CalendarIcon className="w-3.5 h-3.5 text-[var(--accent-color)]"/>
                            Origem & Calendário
                        </h3>
                    </div>
                    
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
                className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm cursor-pointer hover:bg-[var(--bg-tertiary-hover)] transition-all active:scale-[0.99] group relative overflow-hidden w-full flex flex-col justify-between min-h-[160px]"
            >
                {/* Header */}
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

                {/* Footer Stats */}
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
