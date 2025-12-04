
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
    total: number;
    count: number;
    invested: number;
    roi: number; 
    monthlyAverage: number; 
    nextPayment?: string;
}

interface DividendStats {
    totalReceived: number;
    monthlyData: MonthlyData[];
    payersData: PayerData[];
    currentMonthValue: number;
    currentMonthName: string;
    currentMonthPaid: number; // Já caiu na conta
    currentMonthProvisioned: number; // Vai cair
    averageIncome: number;
    bestMonth: { total: number; month: string };
    globalROI: number;
    magicNumberCount: number; // Quantas "cotas base 10" dá pra comprar com a média
}

type SortMode = 'total' | 'roi' | 'date';

// --- Logic Hook ---
const useDividendCalculations = (transactions: Transaction[], assets: Asset[]): DividendStats => {
    return useMemo(() => {
        let totalReceived = 0;
        let totalInvestedGlobal = 0;
        const monthlyAggregation: Record<string, number> = {}; 
        const payerAggregation: Record<string, { total: number, count: number, invested: number, nextPayment?: string }> = {};

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthIdx = now.getMonth();
        const currentMonthKey = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;
        
        let currentMonthPaid = 0;
        let currentMonthProvisioned = 0;

        const allTickers = Array.from(new Set(transactions.map(t => t.ticker)));

        allTickers.forEach((ticker) => {
            const assetData = assets.find(a => a.ticker === ticker);
            const history = assetData?.dividendsHistory || [];
            
            const assetTxs = transactions
                .filter(t => t.ticker === ticker)
                .sort((a, b) => a.date.localeCompare(b.date));

            let assetTotalInvested = 0;
            assetTxs.forEach(tx => {
                if (tx.type === 'Compra') {
                    assetTotalInvested += (tx.quantity * tx.price) + (tx.costs || 0);
                }
            });
            totalInvestedGlobal += assetTotalInvested;

            if (history.length === 0 || assetTxs.length === 0) return;

            history.forEach((div: DividendHistoryEvent) => {
                // Check eligibility based on ex-date
                if (div.exDate < assetTxs[0].date) return;

                let qtyOwnedAtExDate = 0;
                for (const tx of assetTxs) {
                    if (tx.date > div.exDate) break; 
                    if (tx.type === 'Compra') qtyOwnedAtExDate += tx.quantity;
                    else if (tx.type === 'Venda') qtyOwnedAtExDate -= tx.quantity;
                }
                
                qtyOwnedAtExDate = Math.max(0, qtyOwnedAtExDate);

                if (qtyOwnedAtExDate > 0) {
                    const amount = qtyOwnedAtExDate * div.value;
                    totalReceived += amount;

                    // Normalizar Mês de Pagamento
                    const payDate = new Date(div.paymentDate);
                    // Ajuste de fuso horário simples para garantir mês correto
                    payDate.setMinutes(payDate.getMinutes() + payDate.getTimezoneOffset());
                    
                    const monthKey = div.paymentDate.substring(0, 7); 
                    monthlyAggregation[monthKey] = (monthlyAggregation[monthKey] || 0) + amount;

                    // Dados do Mês Atual
                    if (monthKey === currentMonthKey) {
                        if (div.isProvisioned || payDate > now) {
                            currentMonthProvisioned += amount;
                        } else {
                            currentMonthPaid += amount;
                        }
                    }

                    if (!payerAggregation[ticker]) {
                        payerAggregation[ticker] = { total: 0, count: 0, invested: assetTotalInvested, nextPayment: undefined };
                    }
                    payerAggregation[ticker].total += amount;
                    payerAggregation[ticker].count += 1;
                    
                    // Track next payment date for sorting
                    if (div.isProvisioned || payDate >= now) {
                        const existingNext = payerAggregation[ticker].nextPayment;
                        if (!existingNext || div.paymentDate < existingNext) {
                            payerAggregation[ticker].nextPayment = div.paymentDate;
                        }
                    }
                }
            });
        });

        // Fill gaps for last 12 months chart
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

        const payersData = Object.entries(payerAggregation).map(([ticker, data]) => ({ 
            ticker, 
            ...data,
            roi: data.invested > 0 ? (data.total / data.invested) * 100 : 0,
            monthlyAverage: data.count > 0 ? data.total / data.count : 0
        }));

        const currentMonthValue = monthlyAggregation[currentMonthKey] || 0;
        const globalROI = totalInvestedGlobal > 0 ? (totalReceived / totalInvestedGlobal) * 100 : 0;
        const bestMonth = monthlyData.reduce((max, curr) => curr.total > max.total ? curr : max, { total: 0, month: '-' });
        
        // Average excluding zeros for better realism
        const activeMonths = Object.values(monthlyAggregation).filter(v => v > 0);
        const averageIncome = activeMonths.length > 0 ? activeMonths.reduce((a,b)=>a+b,0) / activeMonths.length : 0;

        // "Magic Number" Insight: How many ~10 BRL shares can I buy?
        const magicNumberCount = Math.floor(averageIncome / 10);

        const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' });

        return { 
            totalReceived, 
            monthlyData, 
            payersData, 
            currentMonthValue,
            currentMonthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
            currentMonthPaid,
            currentMonthProvisioned,
            averageIncome,
            bestMonth,
            globalROI,
            magicNumberCount
        };
    }, [transactions, assets]);
};

// --- Helper: Clean Color Generator ---
const stringToColor = (str: string) => {
    const colors = [
        '#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fbbf24', '#f87171', '#9ca3af', '#22d3ee'
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

// --- Sub-Components ---

const MetricCard: React.FC<{ title: string; value: React.ReactNode; subtext?: React.ReactNode; icon?: React.ReactNode; accent?: boolean }> = ({ title, value, subtext, icon, accent }) => (
    <div className={`p-4 rounded-xl border flex flex-col justify-between h-full ${accent ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] border-transparent' : 'bg-[var(--bg-primary)] border-[var(--border-color)]'}`}>
        <div className="flex justify-between items-start mb-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${accent ? 'opacity-80' : 'text-[var(--text-secondary)]'}`}>{title}</span>
            {icon && <div className={accent ? 'text-white' : 'text-[var(--accent-color)] opacity-80'}>{icon}</div>}
        </div>
        <div>
            <div className="text-lg font-bold leading-none">{value}</div>
            {subtext && <div className={`text-[10px] mt-1.5 font-medium ${accent ? 'opacity-90' : 'text-[var(--text-secondary)]'}`}>{subtext}</div>}
        </div>
    </div>
);

const MonthlyBarChart: React.FC<{ data: MonthlyData[]; avg: number }> = ({ data, avg }) => {
    const { formatCurrency } = useI18n();
    const maxVal = Math.max(...data.map(d => d.total), avg * 1.2, 1);

    return (
        <div className="relative h-40 w-full pt-6 pb-2">
            {/* Avg Line */}
            {avg > 0 && (
                <div className="absolute left-0 right-0 border-t border-dashed border-[var(--text-secondary)] opacity-30 z-0 flex items-end" style={{ bottom: `${(avg / maxVal) * 100}%` }}>
                    <span className="text-[9px] text-[var(--text-secondary)] -mt-4 bg-[var(--bg-secondary)] px-1">Média</span>
                </div>
            )}

            <div className="flex items-end gap-2 h-full w-full relative z-10">
                {data.map((d, i) => {
                    const heightPercent = (d.total / maxVal) * 100;
                    const delay = i * 50; 
                    const isCurrent = i === data.length - 1;
                    
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-primary)] border border-[var(--border-color)] text-[10px] font-bold py-1 px-2 rounded-lg shadow-lg pointer-events-none whitespace-nowrap z-20">
                                {formatCurrency(d.total)}
                            </div>
                            
                            <div 
                                className={`w-full rounded-t-sm transition-all duration-300 relative overflow-hidden ${isCurrent ? 'bg-[var(--accent-color)]' : 'bg-[var(--text-secondary)] opacity-30'}`}
                                style={{ 
                                    height: `${Math.max(heightPercent, 4)}%`,
                                    animation: `grow-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                                    animationDelay: `${delay}ms`
                                }}
                            >
                            </div>
                            <span className={`text-[9px] mt-2 font-bold uppercase tracking-wider ${isCurrent ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`}>
                                {d.month}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const PayerRow: React.FC<{ 
    payer: PayerData; 
    rank: number;
}> = ({ payer, rank }) => {
    const { formatCurrency, locale } = useI18n();
    const iconBg = stringToColor(payer.ticker);
    
    return (
        <div className="flex items-center justify-between py-3 px-3 hover:bg-[var(--bg-tertiary-hover)] rounded-xl transition-colors group cursor-pointer border border-transparent hover:border-[var(--border-color)] mb-1">
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-[var(--text-secondary)] w-3">{rank}</span>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black text-[var(--bg-primary)] shadow-sm" style={{ backgroundColor: iconBg }}>
                    {payer.ticker.substring(0,4)}
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-sm text-[var(--text-primary)]">{payer.ticker}</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">
                        {payer.nextPayment ? `Pgto: ${new Date(payer.nextPayment).toLocaleDateString(locale, {day:'2-digit', month:'2-digit'})}` : `Méd: ${formatCurrency(payer.monthlyAverage)}`}
                    </span>
                </div>
            </div>
            
            <div className="text-right">
                <div className="font-bold text-sm text-[var(--text-primary)]">{formatCurrency(payer.total)}</div>
                <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md inline-block mt-0.5 ${payer.roi >= 1 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)]'}`}>
                    {payer.roi.toFixed(1)}% Ret.
                </div>
            </div>
        </div>
    );
};

// --- Detail Modal ---
const DividendsDetailModal: React.FC<{ 
    onClose: () => void; 
    stats: DividendStats;
}> = ({ onClose, stats }) => {
    const [sortMode, setSortMode] = useState<SortMode>('total');
    const { formatCurrency, t } = useI18n();

    const sortedPayers = useMemo(() => {
        return [...stats.payersData].sort((a, b) => {
            if (sortMode === 'total') return b.total - a.total;
            if (sortMode === 'date') {
                if (!a.nextPayment) return 1;
                if (!b.nextPayment) return -1;
                return a.nextPayment.localeCompare(b.nextPayment);
            }
            return b.roi - a.roi;
        });
    }, [stats.payersData, sortMode]);

    return (
        <Modal title="Relatório de Renda" onClose={onClose} type="slide-up" fullScreen={true}>
            <div className="flex flex-col min-h-full pb- safe space-y-6 animate-fade-in">
                
                {/* 1. Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 px-2">
                    <MetricCard 
                        title="Acumulado" 
                        value={<CountUp end={stats.totalReceived} formatter={formatCurrency} />} 
                        subtext="Total Histórico"
                    />
                    <MetricCard 
                        title="Média Mensal" 
                        value={formatCurrency(stats.averageIncome)} 
                        subtext="Últimos 12 meses"
                        icon={<TrendingUpIcon className="w-4 h-4"/>}
                    />
                    <div className="col-span-2">
                        <MetricCard 
                            title="Poder de Reinvestimento" 
                            value={`${stats.magicNumberCount} cotas base`}
                            subtext="Estimativa de compra mensal (base R$ 10) apenas com rendimentos."
                            icon={<SparklesIcon className="w-4 h-4"/>}
                            accent
                        />
                    </div>
                </div>

                {/* 2. Evolution Chart */}
                <div className="px-2">
                    <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)]">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Evolução Recente</h3>
                            <span className="text-[10px] font-bold bg-[var(--bg-primary)] px-2 py-0.5 rounded-full text-[var(--text-secondary)]">12 Meses</span>
                        </div>
                        <MonthlyBarChart data={stats.monthlyData} avg={stats.averageIncome} />
                    </div>
                </div>

                {/* 3. Breakdown List */}
                <div className="flex-1 px-2 pb-10">
                    <div className="flex justify-between items-center mb-3 px-2">
                        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Detalhamento</h3>
                        
                        <div className="flex bg-[var(--bg-primary)] p-0.5 rounded-lg border border-[var(--border-color)]">
                            <button onClick={() => {setSortMode('total'); vibrate();}} className={`px-2 py-1 text-[9px] font-bold rounded transition-all ${sortMode === 'total' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>Valor</button>
                            <button onClick={() => {setSortMode('roi'); vibrate();}} className={`px-2 py-1 text-[9px] font-bold rounded transition-all ${sortMode === 'roi' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>Retorno</button>
                            <button onClick={() => {setSortMode('date'); vibrate();}} className={`px-2 py-1 text-[9px] font-bold rounded transition-all ${sortMode === 'date' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}><CalendarIcon className="w-3 h-3"/></button>
                        </div>
                    </div>

                    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-2">
                        {sortedPayers.length > 0 ? (
                            sortedPayers.map((payer, index) => (
                                <PayerRow key={payer.ticker} payer={payer} rank={index + 1} />
                            ))
                        ) : (
                            <div className="text-center py-12 text-[var(--text-secondary)] opacity-50 text-xs font-medium">
                                Nenhuma informação disponível.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

// --- Main Card Component (Dashboard) ---
const DividendsSummaryCard: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const { assets, transactions, privacyMode } = usePortfolio();
    const [showModal, setShowModal] = useState(false);

    const stats = useDividendCalculations(transactions, assets);

    if (stats.totalReceived === 0) return null;

    // Calcular progresso do mês (Pago vs Total Provisionado)
    const monthProgress = stats.currentMonthValue > 0 
        ? (stats.currentMonthPaid / stats.currentMonthValue) * 100 
        : 0;

    const isAboveAverage = stats.currentMonthValue > stats.averageIncome;

    return (
        <>
            <div 
                onClick={() => { vibrate(); setShowModal(true); }}
                className="bg-[var(--bg-secondary)] p-5 rounded-2xl mx-4 mt-4 border border-[var(--border-color)] shadow-sm cursor-pointer hover:bg-[var(--bg-tertiary-hover)] hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all group animate-fade-in-up relative overflow-hidden"
            >
                {/* Background Sparkle */}
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                    <SparklesIcon className="w-24 h-24 text-[var(--accent-color)]" />
                </div>

                <div className="flex justify-between items-start relative z-10">
                    <div className="flex flex-col gap-1 w-full">
                        <div className="flex justify-between w-full">
                            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                                <CalendarIcon className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                {stats.currentMonthName}
                            </span>
                            
                            {!privacyMode && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isAboveAverage ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]'}`}>
                                    {isAboveAverage ? 'Acima da média' : 'Abaixo da média'}
                                </span>
                            )}
                        </div>
                        
                        <div className="flex items-baseline gap-2 mt-1">
                            <div className={`text-2xl font-black text-[var(--text-primary)] tracking-tight ${privacyMode ? 'blur-md' : ''}`}>
                                <CountUp end={stats.currentMonthValue} formatter={formatCurrency} />
                            </div>
                        </div>

                        {/* Barra de Progresso do Mês */}
                        <div className="mt-3 mb-1 w-full bg-[var(--bg-primary)] h-1.5 rounded-full overflow-hidden flex">
                            <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${monthProgress}%` }}></div>
                            <div className="bg-amber-500 h-full transition-all duration-1000 opacity-50" style={{ width: `${100 - monthProgress}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[9px] text-[var(--text-secondary)] font-medium uppercase tracking-wide">
                            <span>Recebido: {privacyMode ? '---' : formatCurrency(stats.currentMonthPaid)}</span>
                            <span>A Receber: {privacyMode ? '---' : formatCurrency(stats.currentMonthProvisioned)}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex justify-between items-center text-[10px] text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1">
                        <TrendingUpIcon className="w-3 h-3" /> Total Acumulado: 
                        <strong className="text-[var(--text-primary)] ml-1">{privacyMode ? '---' : formatCurrency(stats.totalReceived)}</strong>
                    </span>
                    <ChevronRightIcon className="w-4 h-4 opacity-50" />
                </div>
            </div>

            {showModal && (
                <DividendsDetailModal 
                    onClose={() => setShowModal(false)}
                    stats={stats}
                />
            )}
        </>
    );
};

export default DividendsSummaryCard;
