
import React, { useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from './CountUp';
import TrendingUpIcon from './icons/TrendingUpIcon';
import CalendarIcon from './icons/CalendarIcon';
import Modal from './modals/Modal';
import BarChart from './BarChart';
import { vibrate } from '../utils';
import ChevronRightIcon from './icons/ChevronRightIcon';
import SortIcon from './icons/SortIcon'; // Reusing sort icon if available, or just text
import type { DividendHistoryEvent, Transaction } from '../types';

// --- Types ---
interface MonthlyData {
    month: string;
    total: number;
    year: number;
    monthIndex: number;
    isoDate: string;
}

interface PayerData {
    ticker: string;
    total: number;
    count: number;
    percentageOfTotal: number; // % do total recebido
    invested: number; // Total investido no ativo
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

const StatCard: React.FC<{ label: string; value: React.ReactNode; subtext?: string; icon?: React.ReactNode; highlight?: boolean }> = ({ label, value, subtext, icon, highlight }) => (
    <div className={`p-4 rounded-2xl border flex flex-col justify-between h-full shadow-sm ${highlight ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-[var(--bg-primary)] border-[var(--border-color)]'}`}>
        <div className="flex justify-between items-start mb-2">
            <span className={`text-[10px] uppercase font-bold tracking-wider ${highlight ? 'text-emerald-600' : 'text-[var(--text-secondary)]'}`}>{label}</span>
            {icon && <div className={highlight ? 'text-emerald-500' : 'text-[var(--text-secondary)] opacity-50'}>{icon}</div>}
        </div>
        <div>
            <div className={`text-lg font-black tracking-tight ${highlight ? 'text-emerald-600' : 'text-[var(--text-primary)]'}`}>
                {value}
            </div>
            {subtext && <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5 truncate">{subtext}</p>}
        </div>
    </div>
);

const PayerListItem: React.FC<{ 
    payer: PayerData; 
    rank: number; 
    sortBy: SortMode;
    maxVal: number;
}> = ({ payer, rank, sortBy, maxVal }) => {
    const { formatCurrency } = useI18n();
    const iconColor = stringToColor(payer.ticker);
    
    // Style configuration based on rank
    const isTop3 = rank <= 3;
    let rankColor = 'text-[var(--text-secondary)]';
    let containerClass = 'bg-[var(--bg-primary)] border-[var(--border-color)]';
    let badge = null;

    if (rank === 1) {
        rankColor = 'text-yellow-500';
        containerClass = 'bg-gradient-to-r from-yellow-500/10 to-[var(--bg-primary)] border-yellow-500/30';
        badge = sortBy === 'total' ? '👑 Top Pagador' : '🚀 Maior Retorno';
    } else if (rank === 2) {
        rankColor = 'text-slate-400';
        containerClass = 'bg-gradient-to-r from-slate-400/10 to-[var(--bg-primary)] border-slate-400/30';
    } else if (rank === 3) {
        rankColor = 'text-amber-700';
        containerClass = 'bg-gradient-to-r from-amber-700/10 to-[var(--bg-primary)] border-amber-700/30';
    }

    // Bar width calculation
    // If sorting by total, bar represents % of max Total. 
    // If sorting by ROI, bar represents % of max ROI.
    const barWidth = sortBy === 'total' 
        ? (payer.total / maxVal) * 100 
        : (payer.roi / maxVal) * 100;

    return (
        <div className={`relative overflow-hidden p-3 rounded-2xl border flex items-center justify-between group transition-all mb-2 active:scale-[0.99] ${containerClass} ${isTop3 ? 'shadow-sm' : ''}`}>
            
            {/* Background Progress Bar */}
            <div 
                className="absolute left-0 bottom-0 top-0 bg-[var(--text-primary)] opacity-[0.03] transition-all duration-500 z-0 pointer-events-none" 
                style={{ width: `${barWidth}%` }}
            />

            <div className="flex items-center gap-3 z-10 relative flex-1 min-w-0">
                {/* Rank Number */}
                <div className={`w-6 text-center font-black text-sm ${rankColor} shrink-0`}>{rank}</div>
                
                {/* Asset Icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[10px] text-white shadow-sm shrink-0 ring-1 ring-white/10" style={{ backgroundColor: iconColor }}>
                    {payer.ticker.substring(0,4)}
                </div>
                
                {/* Info */}
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--text-primary)] truncate">{payer.ticker}</span>
                        {badge && <span className="text-[8px] font-bold uppercase bg-[var(--bg-secondary)] border border-[var(--border-color)] px-1.5 rounded-md truncate opacity-80">{badge}</span>}
                    </div>
                    <span className="text-[10px] text-[var(--text-secondary)] font-medium truncate">
                        {payer.count} pgts • ROI: <span className={payer.roi > 10 ? 'text-[var(--green-text)]' : 'text-[var(--text-secondary)]'}>{payer.roi.toFixed(1)}%</span>
                    </span>
                </div>
            </div>

            {/* Values */}
            <div className="text-right z-10 relative pl-2 shrink-0">
                <span className={`font-bold text-sm block ${sortBy === 'total' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] opacity-70'}`}>
                    {formatCurrency(payer.total)}
                </span>
                <span className={`text-[10px] font-bold block mt-0.5 ${sortBy === 'roi' ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-1.5 rounded' : 'text-[var(--text-secondary)] opacity-50'}`}>
                    {payer.roi.toFixed(1)}%
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
    const [activeTab, setActiveTab] = useState<'evolution' | 'ranking'>('ranking');
    const [sortMode, setSortMode] = useState<SortMode>('total');

    const chartData = useMemo(() => monthlyData.slice(-12).map(d => ({ month: d.month, total: d.total })), [monthlyData]);
    const averageIncome = useMemo(() => monthlyData.length > 0 ? totalReceived / monthlyData.length : 0, [totalReceived, monthlyData]);
    const bestMonth = useMemo(() => monthlyData.reduce((max, curr) => curr.total > max.total ? curr : max, { total: 0, month: '-' }), [monthlyData]);
    const globalROI = totalInvestedGlobal > 0 ? (totalReceived / totalInvestedGlobal) * 100 : 0;

    // Sorting Logic
    const sortedPayers = useMemo(() => {
        return [...payersData].sort((a, b) => {
            if (sortMode === 'total') return b.total - a.total;
            return b.roi - a.roi;
        });
    }, [payersData, sortMode]);

    // Calculate max value for the bars based on current sort
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
                        label="Total Acumulado" 
                        value={<CountUp end={totalReceived} formatter={formatCurrency} />} 
                        highlight 
                        icon={<div className="font-bold text-lg">$</div>}
                    />
                    <StatCard 
                        label="Yield (Retorno)" 
                        value={<span>{globalROI.toFixed(1)}<span className="text-sm">%</span></span>} 
                        subtext="Sobre o capital investido"
                        icon={<TrendingUpIcon className="w-5 h-5" />}
                    />
                    <StatCard 
                        label="Média Mensal" 
                        value={formatCurrency(averageIncome)} 
                        subtext="Baseado no histórico"
                    />
                    <StatCard 
                        label="Melhor Mês" 
                        value={formatCurrency(bestMonth.total)} 
                        subtext={bestMonth.month}
                        icon={<CalendarIcon className="w-4 h-4" />}
                    />
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] mb-6 shrink-0 sticky top-0 z-20 shadow-md">
                    <button 
                        onClick={() => { setActiveTab('ranking'); vibrate(); }}
                        className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${activeTab === 'ranking' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Ranking de Ativos
                    </button>
                    <button 
                        onClick={() => { setActiveTab('evolution'); vibrate(); }}
                        className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${activeTab === 'evolution' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Evolução Mensal
                    </button>
                </div>

                {/* Content */}
                <div className="animate-fade-in flex-1">
                    {activeTab === 'ranking' ? (
                        <div className="space-y-4">
                            {/* Sort Controls */}
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
                                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mr-1">Ordenar por:</span>
                                <button 
                                    onClick={() => { setSortMode('total'); vibrate(); }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${sortMode === 'total' ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-transparent' : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-color)]'}`}
                                >
                                    Valor Total
                                </button>
                                <button 
                                    onClick={() => { setSortMode('roi'); vibrate(); }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${sortMode === 'roi' ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-transparent' : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-color)]'}`}
                                >
                                    Retorno (%)
                                </button>
                            </div>

                            {/* List */}
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
                                    <div className="text-center py-12 text-[var(--text-secondary)]">
                                        <p>Nenhum dividendo registrado.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full space-y-4">
                            <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] flex-1 min-h-[350px] flex flex-col relative overflow-hidden">
                                <div className="flex items-center justify-between mb-6 shrink-0 z-10 relative">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-[var(--accent-color)]/10 text-[var(--accent-color)] rounded-lg">
                                            <CalendarIcon className="w-5 h-5"/>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-[var(--text-primary)]">Últimos 12 Meses</h3>
                                            <p className="text-[10px] text-[var(--text-secondary)]">Consistência e crescimento</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 w-full min-h-[250px] z-10 relative">
                                    <BarChart data={chartData} />
                                </div>
                                {/* Background decoration */}
                                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[var(--accent-color)]/5 rounded-full blur-3xl pointer-events-none"></div>
                            </div>
                            
                            <div className="p-4 rounded-xl bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)]">
                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                    <strong className="text-[var(--text-primary)]">Dica:</strong> A consistência é chave nos FIIs. Busque barras crescentes e estáveis ao longo do tempo para garantir previsibilidade na sua renda passiva.
                                </p>
                            </div>
                        </div>
                    )}
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
        let countPayments = 0;
        const monthlyAggregation: Record<string, number> = {}; 
        const payerAggregation: Record<string, { total: number, count: number, invested: number }> = {};

        // Unique set of tickers from history (owned + previously owned)
        const allTickers = Array.from(new Set(transactions.map((t: Transaction) => t.ticker)));

        allTickers.forEach((ticker: string) => {
            const asset = assets.find(a => a.ticker === ticker);
            const history = asset?.dividendsHistory || [];
            
            // Calculate total invested in this asset specifically for ROI calculation
            let assetInvested = 0;
            const assetTxs = transactions
                .filter(t => t.ticker === ticker)
                .sort((a, b) => a.date.localeCompare(b.date));

            assetTxs.forEach(tx => {
                if(tx.type === 'Compra') {
                    assetInvested += (tx.quantity * tx.price) + (tx.costs || 0);
                }
            });
            totalInvestedGlobal += assetInvested;

            if (history.length === 0) return;
            if (assetTxs.length === 0) return;

            history.forEach((div: DividendHistoryEvent) => {
                // EX-DATE RULE Logic
                if (div.exDate <= assetTxs[0].date) return;

                let qtyOwned = 0;
                for (const tx of assetTxs) {
                    if (tx.date < div.exDate) {
                        qtyOwned += tx.type === 'Compra' ? tx.quantity : -tx.quantity;
                    } else {
                        break;
                    }
                }
                qtyOwned = Math.max(0, qtyOwned);

                if (qtyOwned > 0) {
                    const amount = qtyOwned * div.value;
                    totalReceived += amount;
                    countPayments++;

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
                monthIndex: month - 1
            };
        });

        // Format Payers
        const payersData = Object.entries(payerAggregation)
            .map(([ticker, data]) => ({ 
                ticker, 
                ...data,
                percentageOfTotal: totalReceived > 0 ? (data.total / totalReceived) * 100 : 0,
                roi: data.invested > 0 ? (data.total / data.invested) * 100 : 0
            }));
            // Sort handled in modal

        // Current Month Context
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthValue = monthlyAggregation[currentMonthKey] || 0;
        
        const globalROI = totalInvestedGlobal > 0 ? (totalReceived / totalInvestedGlobal) * 100 : 0;

        return { totalReceived, countPayments, monthlyData, payersData, currentMonthValue, totalInvestedGlobal, globalROI };
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
                className="relative overflow-hidden bg-gradient-to-br from-emerald-500/[0.08] to-teal-500/[0.08] p-5 rounded-2xl mx-4 mb-4 border border-emerald-500/20 cursor-pointer active:scale-[0.98] transition-all group shadow-sm hover:shadow-emerald-500/10"
            >
                {/* Decorative Background Elements */}
                <div className="absolute right-0 top-0 p-4 opacity-10 text-emerald-500">
                    <TrendingUpIcon className="w-24 h-24 rotate-12" />
                </div>
                
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-sm border border-emerald-500/20">
                                <span className="font-bold text-lg">$</span>
                            </div>
                            <span className="text-xs font-bold text-emerald-600/90 uppercase tracking-wider">{t('dividends_received')}</span>
                        </div>
                        <div className="bg-[var(--bg-secondary)] rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-[var(--border-color)]">
                            <ChevronRightIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                        </div>
                    </div>

                    <div className={`mt-3 ${privacyMode ? 'blur-md select-none opacity-50' : ''}`}>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                                <CountUp end={stats.totalReceived} formatter={formatCurrency} />
                            </p>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                Yield: {stats.globalROI.toFixed(1)}%
                            </span>
                        </div>
                        
                        {stats.currentMonthValue > 0 ? (
                            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[10px] font-bold text-emerald-600">
                                    +{formatCurrency(stats.currentMonthValue)} em {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
                                </span>
                            </div>
                        ) : (
                            <div className="mt-2 text-[10px] text-[var(--text-secondary)] font-medium">Toque para ver o relatório completo</div>
                        )}
                    </div>
                </div>

                {/* Mini Chart visualization at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-14 flex items-end gap-1 px-4 opacity-20 pointer-events-none">
                    {stats.monthlyData.slice(-12).map((d, i) => (
                        <div 
                            key={i} 
                            className="flex-1 bg-emerald-500 rounded-t-sm transition-all duration-500" 
                            style={{ height: `${Math.max((d.total / (stats.monthlyData[stats.monthlyData.length-1]?.total || 1)) * 50, 15)}%` }}
                        ></div>
                    ))}
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
