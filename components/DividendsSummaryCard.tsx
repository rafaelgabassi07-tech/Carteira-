
import React, { useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from './CountUp';
import TrendingUpIcon from './icons/TrendingUpIcon';
import CalendarIcon from './icons/CalendarIcon';
import Modal from './modals/Modal';
import { vibrate } from '../utils';
import ChevronRightIcon from './icons/ChevronRightIcon';
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
    monthlyAverage: number; // Nova métrica
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
    yoyGrowth: number | null; // Crescimento vs Ano Anterior
    currentYearTotal: number;
}

type SortMode = 'total' | 'roi';

// --- Logic Hook: Separating Math from UI ---
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

        // Formatar Dados Mensais
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

        // Formatar Dados de Pagadores
        const payersData = Object.entries(payerAggregation).map(([ticker, data]) => ({ 
            ticker, 
            ...data,
            roi: data.invested > 0 ? (data.total / data.invested) * 100 : 0,
            monthlyAverage: data.count > 0 ? data.total / data.count : 0
        }));

        // Métricas Finais
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthKey = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthValue = monthlyAggregation[currentMonthKey] || 0;
        const globalROI = totalInvestedGlobal > 0 ? (totalReceived / totalInvestedGlobal) * 100 : 0;
        
        const bestMonth = monthlyData.reduce((max, curr) => curr.total > max.total ? curr : max, { total: 0, month: '-' });
        const averageIncome = monthlyData.length > 0 ? totalReceived / monthlyData.length : 0;

        // Cálculo Year-over-Year (YoY)
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

// --- Helper: Generate consistent color ---
const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
};

// --- Sub-Components ---

const StatCard: React.FC<{ label: string; value: React.ReactNode; subtext?: React.ReactNode; icon?: React.ReactNode; variant?: 'gold' | 'default' }> = ({ label, value, subtext, icon, variant = 'default' }) => (
    <div className={`p-4 rounded-xl border flex flex-col justify-between h-full shadow-sm transition-all ${variant === 'gold' ? 'bg-[var(--bg-primary)] border-yellow-500/20 shadow-[0_0_15px_-3px_rgba(234,179,8,0.1)]' : 'bg-[var(--bg-primary)] border-[var(--border-color)]'}`}>
        <div className="flex justify-between items-start mb-2">
            <span className={`text-[10px] uppercase font-bold tracking-wider ${variant === 'gold' ? 'text-amber-500' : 'text-[var(--text-secondary)]'}`}>{label}</span>
            {icon && <div className={variant === 'gold' ? 'text-amber-500' : 'text-[var(--text-secondary)] opacity-50'}>{icon}</div>}
        </div>
        <div>
            <div className={`text-lg font-bold tracking-tight ${variant === 'gold' ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
                {value}
            </div>
            {subtext && <div className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5 truncate opacity-70">{subtext}</div>}
        </div>
    </div>
);

const MonthlyHeatmap: React.FC<{ data: MonthlyData[] }> = ({ data }) => {
    const { formatCurrency } = useI18n();
    const recentData = data.slice(-12); 
    const maxVal = Math.max(...recentData.map(d => d.total), 1);

    return (
        <div className="flex items-end gap-1.5 h-40 w-full px-2 pt-6">
            {recentData.length === 0 && <div className="w-full text-center text-xs text-[var(--text-secondary)] self-center">Sem dados recentes</div>}
            
            {recentData.map((d, i) => {
                const heightPercent = (d.total / maxVal) * 100;
                const delay = i * 50; 
                
                return (
                    <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[var(--bg-tertiary-hover)] text-[var(--text-primary)] text-[10px] py-1.5 px-2.5 rounded-lg whitespace-nowrap pointer-events-none border border-[var(--border-color)] z-20 font-bold shadow-xl translate-y-2 group-hover:translate-y-0 transform">
                            {d.month}: <span className="text-[var(--accent-color)]">{formatCurrency(d.total)}</span>
                        </div>
                        
                        <div 
                            className="w-full bg-[var(--accent-color)]/20 rounded-t-sm transition-all duration-700 hover:bg-[var(--accent-color)] relative overflow-hidden group-hover:shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)]" 
                            style={{ 
                                height: `${Math.max(heightPercent, 5)}%`,
                                animation: `grow-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                                animationDelay: `${delay}ms`
                            }}
                        >
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent-color)] opacity-50"></div>
                        </div>
                        
                        <span className="text-[9px] text-[var(--text-secondary)] mt-2 font-medium uppercase tracking-wider scale-75 origin-top">{d.month.split('/')[0]}</span>
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
    
    // Background bar calculation
    const valueToBar = sortBy === 'total' ? payer.total : payer.roi;
    const barWidth = (valueToBar / maxVal) * 100;

    return (
        <div className={`relative px-4 py-3.5 rounded-xl border mb-2 flex items-center justify-between group transition-all active:bg-[var(--bg-tertiary-hover)] bg-[var(--bg-primary)] border-[var(--border-color)] overflow-hidden`}>
            
            {/* Background Progress Bar (Subtle) */}
            <div className="absolute bottom-0 left-0 h-[2px] bg-[var(--accent-color)] transition-all duration-1000 ease-out opacity-40" style={{ width: `${barWidth}%` }}></div>

            {/* Left Side: Identity */}
            <div className="flex items-center gap-3 z-10 relative flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[10px] text-white shadow-sm shrink-0" style={{ backgroundColor: iconColor }}>
                    {payer.ticker.substring(0,4)}
                </div>
                
                <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-[var(--text-primary)] leading-tight tracking-tight">{payer.ticker}</span>
                    <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate">
                        Méd: {formatCurrency(payer.monthlyAverage)}
                    </span>
                </div>
            </div>

            {/* Right Side: Values */}
            <div className="text-right z-10 relative pl-4 flex flex-col items-end gap-1">
                <span className="font-bold text-sm text-[var(--text-primary)]">
                    {formatCurrency(payer.total)}
                </span>
                
                {/* Badge de Retorno */}
                <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${payer.roi >= 100 ? "bg-emerald-500/10 text-emerald-500" : "bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)]"}`}>
                    Retorno: {payer.roi.toFixed(1)}%
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
    const { formatCurrency } = useI18n();
    const [sortMode, setSortMode] = useState<SortMode>('total');

    const sortedPayers = useMemo(() => {
        return [...stats.payersData].sort((a, b) => {
            if (sortMode === 'total') return b.total - a.total;
            return b.roi - a.roi;
        });
    }, [stats.payersData, sortMode]);

    const maxBarValue = useMemo(() => {
        if (sortedPayers.length === 0) return 1;
        return sortMode === 'total' ? sortedPayers[0].total : sortedPayers[0].roi;
    }, [sortedPayers, sortMode]);

    return (
        <Modal title="Relatório de Renda" onClose={onClose} type="slide-up" fullScreen={true}>
            <div className="flex flex-col min-h-full pb-24 animate-fade-in">
                
                {/* --- Metrics Grid --- */}
                <div className="grid grid-cols-2 gap-3 mb-6 shrink-0">
                    <StatCard 
                        label="Total Recebido" 
                        value={<CountUp end={stats.totalReceived} formatter={formatCurrency} />} 
                        variant="gold"
                        subtext={stats.yoyGrowth !== null ? (
                            <span className={stats.yoyGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                                {stats.yoyGrowth >= 0 ? '▲' : '▼'} {Math.abs(stats.yoyGrowth).toFixed(1)}% vs Ano Anterior
                            </span>
                        ) : "Histórico iniciando"}
                        icon={<span className="text-lg font-serif italic font-bold">$</span>}
                    />
                    <StatCard 
                        label="Yield on Cost" 
                        value={<span>{stats.globalROI.toFixed(1)}%</span>} 
                        subtext="Sobre total investido"
                        icon={<TrendingUpIcon className="w-4 h-4"/>}
                    />
                    <StatCard 
                        label="Média Mensal" 
                        value={formatCurrency(stats.averageIncome)} 
                    />
                    <StatCard 
                        label="Recorde" 
                        value={formatCurrency(stats.bestMonth.total)} 
                        subtext={stats.bestMonth.month}
                    />
                </div>

                <div className="mb-8">
                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 px-1">Evolução (12 Meses)</h3>
                    <div className="bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)] shadow-inner">
                        <MonthlyHeatmap data={stats.monthlyData} />
                    </div>
                </div>

                <div className="flex-1">
                    <div className="flex justify-between items-center mb-4 px-1 sticky top-0 bg-[var(--bg-secondary)] z-20 py-2">
                        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Origem dos Proventos</h3>
                        <div className="flex bg-[var(--bg-primary)] p-0.5 rounded-lg border border-[var(--border-color)]">
                            <button onClick={() => {setSortMode('total'); vibrate();}} className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${sortMode === 'total' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>Valor</button>
                            <button onClick={() => {setSortMode('roi'); vibrate();}} className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${sortMode === 'roi' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>Retorno %</button>
                        </div>
                    </div>

                    {/* Column Headers for Clarity */}
                    <div className="flex justify-between px-4 mb-2 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider opacity-70">
                        <span>Ativo</span>
                        <span>Total / Retorno</span>
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
                            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-secondary)] opacity-50">
                                <CalendarIcon className="w-12 h-12 mb-2" />
                                <p>Sem histórico de dividendos.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

// --- Main Card Component ---
const DividendsSummaryCard: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const { assets, transactions, privacyMode } = usePortfolio();
    const [showModal, setShowModal] = useState(false);

    const stats = useDividendCalculations(transactions, assets);

    const handleClick = () => {
        vibrate();
        setShowModal(true);
    };

    if (stats.totalReceived === 0) return null;

    return (
        <>
            <div 
                onClick={handleClick}
                className="relative overflow-hidden bg-[var(--bg-secondary)] p-6 rounded-2xl mx-4 mb-4 mt-4 border border-[var(--border-color)] cursor-pointer active:scale-[0.99] transition-all group shadow-md hover:shadow-lg animate-fade-in-up"
            >
                {/* Professional/Premium Accent - Midnight Gold Theme */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 opacity-[0.03] blur-3xl rounded-full pointer-events-none"></div>
                <div className="absolute left-0 top-6 bottom-6 w-1 bg-gradient-to-b from-amber-400 to-yellow-700 rounded-r-full opacity-60"></div>

                <div className="relative z-10 flex flex-col gap-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Relatório de Renda
                            </span>
                            <div className={`text-3xl font-black tracking-tight text-[var(--text-primary)] ${privacyMode ? 'blur-md' : ''}`}>
                                <CountUp end={stats.totalReceived} formatter={formatCurrency} />
                            </div>
                            
                            {/* Growth Badge */}
                            {stats.yoyGrowth !== null && !privacyMode && (
                                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold mt-1 ${stats.yoyGrowth >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {stats.yoyGrowth >= 0 ? '▲' : '▼'} {Math.abs(stats.yoyGrowth).toFixed(0)}% vs Ano Anterior
                                </div>
                            )}
                        </div>
                        <div className="bg-[var(--bg-primary)] p-2.5 rounded-xl border border-[var(--border-color)] shadow-sm text-amber-500 group-hover:text-amber-400 transition-colors">
                            <TrendingUpIcon className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="flex items-center gap-6 pt-4 border-t border-[var(--border-color)] border-dashed">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-[var(--text-secondary)] uppercase font-bold mb-0.5">Yield on Cost</span>
                            <span className="text-sm font-bold text-amber-500">{stats.globalROI.toFixed(1)}%</span>
                        </div>
                        <div className="w-px h-8 bg-[var(--border-color)]"></div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-[var(--text-secondary)] uppercase font-bold mb-0.5">Mês Atual</span>
                            <span className={`text-sm font-bold ${privacyMode ? 'blur-sm' : 'text-[var(--text-primary)]'}`}>
                                {formatCurrency(stats.currentMonthValue)}
                            </span>
                        </div>
                        <div className="ml-auto transform transition-transform group-hover:translate-x-1">
                            <ChevronRightIcon className="w-5 h-5 text-[var(--text-secondary)] opacity-50" />
                        </div>
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
