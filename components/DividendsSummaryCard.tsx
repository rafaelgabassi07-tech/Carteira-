
import React, { useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from './CountUp';
import TrendingUpIcon from './icons/TrendingUpIcon';
import CalendarIcon from './icons/CalendarIcon';
import Modal from './modals/Modal';
import { vibrate } from '../utils';
import ChevronRightIcon from './icons/ChevronRightIcon';
import FilterIcon from './icons/FilterIcon';
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
    total: number;
    count: number;
    invested: number;
    roi: number; // (Total Recebido / Total Investido) * 100
    monthlyAverage: number; 
}

interface DividendStats {
    totalReceived: number;
    monthlyData: MonthlyData[];
    payersData: PayerData[];
    currentMonthValue: number;
    totalInvestedGlobal: number;
    globalROI: number;
    bestMonth: { total: number; month: string };
    averageIncome: number;
    yoyGrowth: number | null; 
    currentYearTotal: number;
}

type SortMode = 'total' | 'roi';

// --- Logic Hook ---
const useDividendCalculations = (transactions: Transaction[], assets: Asset[]): DividendStats => {
    return useMemo(() => {
        let totalReceived = 0;
        let totalInvestedGlobal = 0;
        const monthlyAggregation: Record<string, number> = {}; 
        const payerAggregation: Record<string, { total: number, count: number, invested: number }> = {};

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

                    const monthKey = div.paymentDate.substring(0, 7); 
                    monthlyAggregation[monthKey] = (monthlyAggregation[monthKey] || 0) + amount;

                    if (!payerAggregation[ticker]) {
                        payerAggregation[ticker] = { total: 0, count: 0, invested: assetTotalInvested };
                    }
                    payerAggregation[ticker].total += amount;
                    payerAggregation[ticker].count += 1;
                }
            });
        });

        const monthlyData = Object.keys(monthlyAggregation).sort().map(key => {
            const [year, month] = key.split('-').map(Number);
            const date = new Date(year, month - 1, 15);
            return {
                isoDate: key,
                month: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''),
                total: monthlyAggregation[key],
                year
            };
        });

        const payersData = Object.entries(payerAggregation).map(([ticker, data]) => ({ 
            ticker, 
            ...data,
            roi: data.invested > 0 ? (data.total / data.invested) * 100 : 0,
            monthlyAverage: data.count > 0 ? data.total / data.count : 0
        }));

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthKey = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthValue = monthlyAggregation[currentMonthKey] || 0;
        const globalROI = totalInvestedGlobal > 0 ? (totalReceived / totalInvestedGlobal) * 100 : 0;
        
        const bestMonth = monthlyData.reduce((max, curr) => curr.total > max.total ? curr : max, { total: 0, month: '-' });
        const averageIncome = monthlyData.length > 0 ? totalReceived / monthlyData.length : 0;

        const thisYearTotal = monthlyData.filter(d => d.year === currentYear).reduce((acc, curr) => acc + curr.total, 0);
        const lastYearTotal = monthlyData.filter(d => d.year === currentYear - 1).reduce((acc, curr) => acc + curr.total, 0);
        
        let yoyGrowth: number | null = null;
        if (lastYearTotal > 0) {
            yoyGrowth = ((thisYearTotal - lastYearTotal) / lastYearTotal) * 100;
        }

        return { 
            totalReceived, 
            monthlyData, 
            payersData, 
            currentMonthValue, 
            totalInvestedGlobal, 
            globalROI,
            bestMonth,
            averageIncome,
            yoyGrowth,
            currentYearTotal: thisYearTotal
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

const MetricCard: React.FC<{ title: string; value: React.ReactNode; subtext?: string; icon?: React.ReactNode }> = ({ title, value, subtext, icon }) => (
    <div className="bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)] flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{title}</span>
            {icon && <div className="text-[var(--accent-color)] opacity-80">{icon}</div>}
        </div>
        <div>
            <div className="text-lg font-bold text-[var(--text-primary)] leading-none">{value}</div>
            {subtext && <div className="text-[10px] text-[var(--text-secondary)] mt-1 font-medium">{subtext}</div>}
        </div>
    </div>
);

const MonthlyBarChart: React.FC<{ data: MonthlyData[] }> = ({ data }) => {
    const { formatCurrency } = useI18n();
    const recentData = data.slice(-12); 
    const maxVal = Math.max(...recentData.map(d => d.total), 1);

    return (
        <div className="flex items-end gap-2 h-40 w-full pt-6 pb-2">
            {recentData.length === 0 && <div className="w-full text-center text-xs text-[var(--text-secondary)] self-center">Sem dados recentes</div>}
            
            {recentData.map((d, i) => {
                const heightPercent = (d.total / maxVal) * 100;
                const delay = i * 50; 
                
                return (
                    <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[10px] font-bold py-1 px-2 rounded-lg shadow-lg pointer-events-none whitespace-nowrap z-20">
                            {formatCurrency(d.total)}
                        </div>
                        
                        <div 
                            className="w-full rounded-t-md transition-all duration-300 bg-[var(--accent-color)] opacity-60 group-hover:opacity-100 relative overflow-hidden" 
                            style={{ 
                                height: `${Math.max(heightPercent, 2)}%`,
                                transformOrigin: 'bottom',
                                animation: `grow-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                                animationDelay: `${delay}ms`
                            }}
                        >
                             <div className="absolute bottom-0 left-0 right-0 h-full bg-gradient-to-t from-black/20 to-transparent"></div>
                        </div>
                        <span className="text-[9px] text-[var(--text-secondary)] mt-2 font-bold uppercase tracking-wider">{d.month.split('/')[0]}</span>
                    </div>
                );
            })}
        </div>
    );
};

const PayerRow: React.FC<{ 
    payer: PayerData; 
    rank: number;
}> = ({ payer, rank }) => {
    const { formatCurrency } = useI18n();
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
                    <span className="text-[10px] text-[var(--text-secondary)]">Méd: {formatCurrency(payer.monthlyAverage)}</span>
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
            return b.roi - a.roi;
        });
    }, [stats.payersData, sortMode]);

    return (
        <Modal title="Relatório de Renda" onClose={onClose} type="slide-up" fullScreen={true}>
            <div className="flex flex-col min-h-full pb- safe space-y-6 animate-fade-in">
                
                {/* 1. Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 px-2">
                    <MetricCard 
                        title="Total Acumulado" 
                        value={<CountUp end={stats.totalReceived} formatter={formatCurrency} />} 
                        icon={<TrendingUpIcon className="w-4 h-4"/>}
                    />
                    <MetricCard 
                        title="Retorno s/ Custo" 
                        value={`${stats.globalROI.toFixed(1)}%`} 
                        subtext="Yield on Cost Global"
                    />
                    <MetricCard 
                        title="Média Mensal" 
                        value={formatCurrency(stats.averageIncome)} 
                        subtext="Últimos 12 meses"
                    />
                    <MetricCard 
                        title="Melhor Mês" 
                        value={formatCurrency(stats.bestMonth.total)} 
                        subtext={stats.bestMonth.month}
                        icon={<CalendarIcon className="w-4 h-4"/>}
                    />
                </div>

                {/* 2. Evolution Chart */}
                <div className="px-2">
                    <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)]">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Evolução (12 Meses)</h3>
                            {stats.yoyGrowth !== null && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stats.yoyGrowth >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {stats.yoyGrowth > 0 ? '+' : ''}{stats.yoyGrowth.toFixed(0)}% vs Ano Anterior
                                </span>
                            )}
                        </div>
                        <MonthlyBarChart data={stats.monthlyData} />
                    </div>
                </div>

                {/* 3. Breakdown List */}
                <div className="flex-1 px-2 pb-10">
                    <div className="flex justify-between items-center mb-3 px-2">
                        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Origem dos Proventos</h3>
                        
                        <div className="flex bg-[var(--bg-primary)] p-0.5 rounded-lg border border-[var(--border-color)]">
                            <button 
                                onClick={() => {setSortMode('total'); vibrate();}} 
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${sortMode === 'total' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                            >
                                Valor
                            </button>
                            <button 
                                onClick={() => {setSortMode('roi'); vibrate();}} 
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${sortMode === 'roi' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                            >
                                Retorno
                            </button>
                        </div>
                    </div>

                    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-2">
                        <div className="flex justify-between px-4 py-2 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border-color)] mb-2">
                            <span>Ativo</span>
                            <span>Total / Retorno</span>
                        </div>
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

    return (
        <>
            <div 
                onClick={() => { vibrate(); setShowModal(true); }}
                className="bg-[var(--bg-secondary)] p-5 rounded-2xl mx-4 mt-4 border border-[var(--border-color)] shadow-sm cursor-pointer hover:bg-[var(--bg-tertiary-hover)] hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all group animate-fade-in-up"
            >
                <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                                <TrendingUpIcon className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                Proventos Acumulados
                            </span>
                        </div>
                        
                        <div className={`text-2xl font-black text-[var(--text-primary)] tracking-tight ${privacyMode ? 'blur-md' : ''}`}>
                            <CountUp end={stats.totalReceived} formatter={formatCurrency} />
                        </div>

                        {stats.yoyGrowth !== null && !privacyMode && (
                            <div className={`text-[10px] font-bold inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md w-fit mt-1 ${stats.yoyGrowth >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                {stats.yoyGrowth >= 0 ? '▲' : '▼'} {Math.abs(stats.yoyGrowth).toFixed(0)}% <span className="text-[var(--text-secondary)] font-medium opacity-70">vs ano anterior</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors">
                        <ChevronRightIcon className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>
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
