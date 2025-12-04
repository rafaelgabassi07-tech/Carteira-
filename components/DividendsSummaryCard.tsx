
import React, { useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from './CountUp';
import TrendingUpIcon from './icons/TrendingUpIcon';
import CalendarIcon from './icons/CalendarIcon';
import Modal from './modals/Modal';
import { vibrate } from '../utils';
import ChevronRightIcon from './icons/ChevronRightIcon';
import type { DividendHistoryEvent, Transaction } from '../types';

// --- Types ---
interface MonthlyData {
    month: string;
    total: number;
    year: number;
    monthIndex: number;
    isoDate: string;
    isCurrentYear: boolean;
}

interface PayerData {
    ticker: string;
    total: number;
    count: number;
    roi: number; // (Total Recebido / Total Investido) * 100
}

type SortMode = 'total' | 'roi';

// --- Helper: Generate consistent color from string ---
const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
};

// --- Components ---

const StatCard: React.FC<{ label: string; value: React.ReactNode; subtext?: string; icon?: React.ReactNode; variant?: 'gold' | 'default' }> = ({ label, value, subtext, icon, variant = 'default' }) => (
    <div className={`p-4 rounded-xl border flex flex-col justify-between h-full shadow-sm ${variant === 'gold' ? 'bg-[var(--bg-primary)] border-yellow-500/20' : 'bg-[var(--bg-primary)] border-[var(--border-color)]'}`}>
        <div className="flex justify-between items-start mb-2">
            <span className={`text-[10px] uppercase font-bold tracking-wider ${variant === 'gold' ? 'text-amber-500' : 'text-[var(--text-secondary)]'}`}>{label}</span>
            {icon && <div className={variant === 'gold' ? 'text-amber-500' : 'text-[var(--text-secondary)] opacity-50'}>{icon}</div>}
        </div>
        <div>
            <div className={`text-lg font-bold tracking-tight ${variant === 'gold' ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
                {value}
            </div>
            {subtext && <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5 truncate opacity-70">{subtext}</p>}
        </div>
    </div>
);

const MonthlyHeatmap: React.FC<{ data: MonthlyData[] }> = ({ data }) => {
    const { formatCurrency } = useI18n();
    const maxVal = Math.max(...data.map(d => d.total), 1);

    return (
        <div className="flex items-end gap-1.5 h-40 w-full px-2">
            {data.slice(-12).map((d, i) => {
                const heightPercent = (d.total / maxVal) * 100;
                return (
                    <div key={i} className="flex-1 flex flex-col items-center group relative">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-tertiary-hover)] text-[var(--text-primary)] text-[10px] py-1 px-2 rounded whitespace-nowrap pointer-events-none border border-[var(--border-color)] z-10 font-bold shadow-xl">
                            {d.month}: {formatCurrency(d.total)}
                        </div>
                        {/* Bar */}
                        <div 
                            className="w-full bg-[var(--accent-color)]/20 rounded-t-sm transition-all duration-500 hover:bg-[var(--accent-color)] relative overflow-hidden" 
                            style={{ height: `${Math.max(heightPercent, 5)}%` }}
                        >
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent-color)] opacity-50"></div>
                        </div>
                        {/* Label */}
                        <span className="text-[9px] text-[var(--text-secondary)] mt-1.5 font-medium uppercase tracking-wider scale-75 origin-top">{d.month.split('/')[0]}</span>
                    </div>
                );
            })}
        </div>
    );
};

const PayerListItem: React.FC<{ 
    payer: PayerData; 
    rank: number; 
    sortBy: SortMode;
    maxVal: number;
}> = ({ payer, rank, sortBy, maxVal }) => {
    const { formatCurrency } = useI18n();
    const iconColor = stringToColor(payer.ticker);
    
    const isTop3 = rank <= 3;
    let rankBadge = <span className="text-xs font-medium text-[var(--text-secondary)] opacity-50">#{rank}</span>;

    if (rank === 1) rankBadge = <span className="text-sm">🥇</span>;
    if (rank === 2) rankBadge = <span className="text-sm">🥈</span>;
    if (rank === 3) rankBadge = <span className="text-sm">🥉</span>;

    const barWidth = sortBy === 'total' 
        ? (payer.total / maxVal) * 100 
        : (payer.roi / maxVal) * 100;

    return (
        <div className={`relative p-3 rounded-xl border mb-2 flex items-center justify-between group transition-all active:bg-[var(--bg-tertiary-hover)] bg-[var(--bg-primary)] border-[var(--border-color)]`}>
            
            {/* Background Bar */}
            <div className="absolute bottom-0 left-0 h-[2px] bg-[var(--accent-color)] transition-all duration-700 opacity-50" style={{ width: `${barWidth}%` }}></div>

            <div className="flex items-center gap-3 z-10 relative flex-1 min-w-0">
                <div className="w-6 flex justify-center shrink-0">{rankBadge}</div>
                
                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-[10px] text-white shadow-sm shrink-0" style={{ backgroundColor: iconColor }}>
                    {payer.ticker.substring(0,4)}
                </div>
                
                <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-[var(--text-primary)] leading-tight">{payer.ticker}</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">
                        {payer.count}x • ROI: {payer.roi.toFixed(1)}%
                    </span>
                </div>
            </div>

            <div className="text-right z-10 relative">
                <span className="font-bold text-sm text-[var(--text-primary)] block">
                    {formatCurrency(payer.total)}
                </span>
            </div>
        </div>
    );
}

// --- Detail Modal ---
const DividendsDetailModal: React.FC<{ 
    onClose: () => void; 
    monthlyData: MonthlyData[];
    payersData: PayerData[];
    totalReceived: number;
    totalInvestedGlobal: number;
}> = ({ onClose, monthlyData, payersData, totalReceived, totalInvestedGlobal }) => {
    const { formatCurrency } = useI18n();
    const [sortMode, setSortMode] = useState<SortMode>('total');

    const averageIncome = useMemo(() => monthlyData.length > 0 ? totalReceived / monthlyData.length : 0, [totalReceived, monthlyData]);
    const bestMonth = useMemo(() => monthlyData.reduce((max, curr) => curr.total > max.total ? curr : max, { total: 0, month: '-' }), [monthlyData]);
    const globalROI = totalInvestedGlobal > 0 ? (totalReceived / totalInvestedGlobal) * 100 : 0;

    const sortedPayers = useMemo(() => {
        return [...payersData].sort((a, b) => {
            if (sortMode === 'total') return b.total - a.total;
            return b.roi - a.roi;
        });
    }, [payersData, sortMode]);

    const maxBarValue = useMemo(() => {
        if (sortedPayers.length === 0) return 1;
        return sortMode === 'total' ? sortedPayers[0].total : sortedPayers[0].roi;
    }, [sortedPayers, sortMode]);

    return (
        <Modal title="Relatório de Renda" onClose={onClose} type="slide-up" fullScreen={true}>
            <div className="flex flex-col min-h-full pb-24">
                
                {/* --- Metrics Grid --- */}
                <div className="grid grid-cols-2 gap-3 mb-6 shrink-0">
                    <StatCard 
                        label="Total Recebido" 
                        value={<CountUp end={totalReceived} formatter={formatCurrency} />} 
                        variant="gold"
                        icon={<span className="text-lg font-serif italic">$</span>}
                    />
                    <StatCard 
                        label="Yield on Cost" 
                        value={<span>{globalROI.toFixed(1)}%</span>} 
                        subtext="Retorno sobre investimento"
                    />
                    <StatCard 
                        label="Média Mensal" 
                        value={formatCurrency(averageIncome)} 
                    />
                    <StatCard 
                        label="Melhor Mês" 
                        value={formatCurrency(bestMonth.total)} 
                        subtext={bestMonth.month}
                    />
                </div>

                <div className="mb-8">
                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 px-1">Evolução (12 Meses)</h3>
                    <div className="bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)]">
                        <MonthlyHeatmap data={monthlyData} />
                    </div>
                </div>

                <div className="flex-1">
                    <div className="flex justify-between items-center mb-4 px-1">
                        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Ranking de Ativos</h3>
                        <div className="flex bg-[var(--bg-primary)] p-0.5 rounded-lg border border-[var(--border-color)]">
                            <button onClick={() => {setSortMode('total'); vibrate();}} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${sortMode === 'total' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>Total</button>
                            <button onClick={() => {setSortMode('roi'); vibrate();}} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${sortMode === 'roi' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>Retorno</button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        {sortedPayers.length > 0 ? (
                            sortedPayers.map((payer, idx) => (
                                <PayerListItem 
                                    key={payer.ticker} 
                                    payer={payer} 
                                    rank={idx + 1} 
                                    sortBy={sortMode}
                                    maxVal={maxBarValue}
                                />
                            ))
                        ) : (
                            <div className="text-center py-12 text-[var(--text-secondary)] opacity-50">
                                <p>Sem histórico de dividendos.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const DividendsSummaryCard: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const { assets, transactions, privacyMode } = usePortfolio();
    const [showModal, setShowModal] = useState(false);

    // --- Calculation Logic (Memoized) ---
    const stats = useMemo(() => {
        let totalReceived = 0;
        let totalInvestedGlobal = 0;
        const monthlyAggregation: Record<string, number> = {}; 
        const payerAggregation: Record<string, { total: number, count: number, invested: number }> = {};

        const allTickers = Array.from(new Set(transactions.map((t: Transaction) => t.ticker)));

        allTickers.forEach((ticker: string) => {
            const asset = assets.find(a => a.ticker === ticker);
            const history = asset?.dividendsHistory || [];
            
            let assetInvested = 0;
            const assetTxs = transactions.filter(t => t.ticker === ticker).sort((a, b) => a.date.localeCompare(b.date));

            assetTxs.forEach(tx => {
                if(tx.type === 'Compra') assetInvested += (tx.quantity * tx.price) + (tx.costs || 0);
            });
            totalInvestedGlobal += assetInvested;

            if (history.length === 0 || assetTxs.length === 0) return;

            history.forEach((div: DividendHistoryEvent) => {
                if (div.exDate <= assetTxs[0].date) return;

                let qtyOwned = 0;
                for (const tx of assetTxs) {
                    if (tx.date < div.exDate) qtyOwned += tx.type === 'Compra' ? tx.quantity : -tx.quantity;
                    else break;
                }
                qtyOwned = Math.max(0, qtyOwned);

                if (qtyOwned > 0) {
                    const amount = qtyOwned * div.value;
                    totalReceived += amount;

                    const monthKey = div.paymentDate.substring(0, 7);
                    monthlyAggregation[monthKey] = (monthlyAggregation[monthKey] || 0) + amount;

                    if (!payerAggregation[ticker]) payerAggregation[ticker] = { total: 0, count: 0, invested: assetInvested };
                    payerAggregation[ticker].total += amount;
                    payerAggregation[ticker].count += 1;
                }
            });
        });

        // Format Monthly
        const monthlyData = Object.keys(monthlyAggregation).sort().map(key => {
            const [year, month] = key.split('-').map(Number);
            const date = new Date(year, month - 1, 2);
            return {
                isoDate: key,
                month: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''),
                total: monthlyAggregation[key],
                year,
                monthIndex: month - 1,
                isCurrentYear: year === new Date().getFullYear()
            };
        });

        const payersData = Object.entries(payerAggregation).map(([ticker, data]) => ({ 
            ticker, 
            ...data,
            roi: data.invested > 0 ? (data.total / data.invested) * 100 : 0
        }));

        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthValue = monthlyAggregation[currentMonthKey] || 0;
        const globalROI = totalInvestedGlobal > 0 ? (totalReceived / totalInvestedGlobal) * 100 : 0;

        return { totalReceived, monthlyData, payersData, currentMonthValue, totalInvestedGlobal, globalROI };
    }, [assets, transactions]);

    const handleClick = () => {
        vibrate();
        setShowModal(true);
    };

    if (stats.totalReceived === 0) return null;

    return (
        <>
            <div 
                onClick={handleClick}
                className="relative overflow-hidden bg-[var(--bg-secondary)] p-6 rounded-2xl mx-4 mb-4 border border-[var(--border-color)] cursor-pointer active:scale-[0.99] transition-all group shadow-md"
            >
                {/* Professional/Premium Accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500 opacity-5 blur-2xl rounded-full pointer-events-none"></div>
                <div className="absolute left-0 top-4 bottom-4 w-1 bg-gradient-to-b from-amber-500 to-yellow-600 rounded-r-full opacity-80"></div>

                <div className="relative z-10 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                                <CalendarIcon className="w-3 h-3"/> Relatório de Renda
                            </span>
                            <div className={`text-3xl font-bold tracking-tight text-[var(--text-primary)] ${privacyMode ? 'blur-md' : ''}`}>
                                <CountUp end={stats.totalReceived} formatter={formatCurrency} />
                            </div>
                        </div>
                        <div className="bg-[var(--bg-primary)] p-2 rounded-xl border border-[var(--border-color)] shadow-sm">
                            <TrendingUpIcon className="w-5 h-5 text-amber-500" />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pt-4 border-t border-[var(--border-color)] border-dashed">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-[var(--text-secondary)] uppercase font-bold">Retorno (ROI)</span>
                            <span className="text-sm font-bold text-amber-500">{stats.globalROI.toFixed(1)}%</span>
                        </div>
                        <div className="w-px h-6 bg-[var(--border-color)]"></div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-[var(--text-secondary)] uppercase font-bold">Mês Atual</span>
                            <span className={`text-sm font-bold ${privacyMode ? 'blur-sm' : 'text-[var(--text-primary)]'}`}>
                                {formatCurrency(stats.currentMonthValue)}
                            </span>
                        </div>
                        <div className="ml-auto">
                            <ChevronRightIcon className="w-5 h-5 text-[var(--text-secondary)] opacity-50 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </div>
            </div>

            {showModal && (
                <DividendsDetailModal 
                    onClose={() => setShowModal(false)}
                    monthlyData={stats.monthlyData}
                    payersData={stats.payersData}
                    totalReceived={stats.totalReceived}
                    totalInvestedGlobal={stats.totalInvestedGlobal}
                />
            )}
        </>
    );
};

export default DividendsSummaryCard;
