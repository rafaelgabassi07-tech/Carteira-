
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
    percentage: number;
}

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

const PodiumItem: React.FC<{ payer: PayerData; rank: 1 | 2 | 3; maxVal: number }> = ({ payer, rank, maxVal }) => {
    const { formatCurrency } = useI18n();
    const height = rank === 1 ? 'h-32' : rank === 2 ? 'h-24' : 'h-20';
    const color = rank === 1 ? 'bg-yellow-400' : rank === 2 ? 'bg-slate-300' : 'bg-amber-600';
    const glow = rank === 1 ? 'shadow-[0_0_20px_rgba(250,204,21,0.3)]' : '';
    
    // Fallback safe color for icon
    const iconColor = stringToColor(payer.ticker);

    return (
        <div className="flex flex-col items-center justify-end group">
            <div className="mb-2 text-center transform group-hover:-translate-y-1 transition-transform">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-md mb-1 mx-auto" style={{ backgroundColor: iconColor }}>
                    {payer.ticker.substring(0,4)}
                </div>
                <span className="font-bold text-sm text-[var(--text-primary)]">{formatCurrency(payer.total)}</span>
            </div>
            <div className={`w-16 sm:w-20 ${height} ${color} rounded-t-lg relative ${glow} flex items-end justify-center pb-2 opacity-90`}>
                <span className="text-white/50 font-black text-4xl">{rank}</span>
            </div>
        </div>
    );
};

const PayerRow: React.FC<{ payer: PayerData; index: number }> = ({ payer, index }) => {
    const { formatCurrency } = useI18n();
    const iconColor = stringToColor(payer.ticker);

    return (
        <div className="relative overflow-hidden p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-between group hover:border-[var(--accent-color)]/30 transition-all">
            {/* Progress Background */}
            <div 
                className="absolute left-0 top-0 bottom-0 bg-[var(--bg-tertiary-hover)] opacity-0 group-hover:opacity-100 transition-opacity z-0" 
                style={{ width: `${payer.percentage}%` }}
            />
            
            <div className="flex items-center gap-3 z-10 relative">
                <span className="text-xs font-bold text-[var(--text-secondary)] w-4">{index + 1}</span>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-[10px] text-white shadow-sm" style={{ backgroundColor: iconColor }}>
                    {payer.ticker.substring(0,4)}
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-sm text-[var(--text-primary)]">{payer.ticker}</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">{payer.count} pagamentos</span>
                </div>
            </div>

            <div className="text-right z-10 relative">
                <span className="font-bold text-sm text-[var(--green-text)] block">{formatCurrency(payer.total)}</span>
                <span className="text-[10px] text-[var(--text-secondary)]">{payer.percentage.toFixed(1)}%</span>
            </div>
        </div>
    );
};

// --- Detail Modal ---
const DividendsDetailModal: React.FC<{ 
    onClose: () => void; 
    monthlyData: MonthlyData[];
    payersData: PayerData[];
    totalReceived: number;
}> = ({ onClose, monthlyData, payersData, totalReceived }) => {
    const { t, formatCurrency } = useI18n();
    const [activeTab, setActiveTab] = useState<'evolution' | 'ranking'>('ranking');

    const chartData = useMemo(() => monthlyData.slice(-12).map(d => ({ month: d.month, total: d.total })), [monthlyData]);
    const averageIncome = useMemo(() => monthlyData.length > 0 ? totalReceived / monthlyData.length : 0, [totalReceived, monthlyData]);
    
    // Top 3 for Podium
    const topPayers = payersData.slice(0, 3);
    const otherPayers = payersData.slice(3);

    return (
        <Modal title="Relatório de Renda" onClose={onClose} type="slide-up">
            <div className="pb-safe">
                {/* Summary Header */}
                <div className="flex flex-col items-center justify-center py-6 mb-6 bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-primary)] rounded-3xl border border-[var(--border-color)] shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1 bg-[var(--bg-tertiary-hover)] px-2 py-0.5 rounded-full border border-[var(--border-color)]">
                        Total Acumulado
                    </span>
                    <p className="text-4xl font-black text-[var(--text-primary)] tracking-tight mt-2">
                        <CountUp end={totalReceived} formatter={formatCurrency} />
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-[var(--text-secondary)]">
                        <span>Média Mensal: <b className="text-[var(--text-primary)]">{formatCurrency(averageIncome)}</b></span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] mb-6">
                    <button 
                        onClick={() => { setActiveTab('ranking'); vibrate(); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'ranking' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Ranking de Ativos
                    </button>
                    <button 
                        onClick={() => { setActiveTab('evolution'); vibrate(); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'evolution' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Evolução Mensal
                    </button>
                </div>

                {/* Content */}
                <div className="animate-fade-in min-h-[300px]">
                    {activeTab === 'ranking' ? (
                        <div className="space-y-6">
                            {/* Podium (Only if we have at least 3 payers) */}
                            {topPayers.length >= 1 && (
                                <div className="flex justify-center items-end gap-4 mb-8 pt-4 px-4">
                                    {topPayers[1] && <PodiumItem payer={topPayers[1]} rank={2} maxVal={topPayers[0].total} />}
                                    <PodiumItem payer={topPayers[0]} rank={1} maxVal={topPayers[0].total} />
                                    {topPayers[2] && <PodiumItem payer={topPayers[2]} rank={3} maxVal={topPayers[0].total} />}
                                </div>
                            )}

                            {/* List */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-1">
                                    {otherPayers.length > 0 ? 'Outros Pagadores' : 'Lista Completa'}
                                </h4>
                                {(otherPayers.length > 0 ? otherPayers : (topPayers.length < 3 ? topPayers : [])).map((payer, idx) => (
                                    <PayerRow key={payer.ticker} payer={payer} index={idx + (otherPayers.length > 0 ? 3 : 0)} />
                                ))}
                                {payersData.length === 0 && (
                                    <p className="text-center text-[var(--text-secondary)] text-sm py-8">Nenhum dividendo registrado ainda.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)]">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-[var(--accent-color)]/10 text-[var(--accent-color)] rounded-lg">
                                        <CalendarIcon className="w-4 h-4"/>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-[var(--text-primary)]">Últimos 12 Meses</h3>
                                        <p className="text-[10px] text-[var(--text-secondary)]">Tendência de renda</p>
                                    </div>
                                </div>
                            </div>
                            <div className="h-64 w-full">
                                <BarChart data={chartData} />
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
        let countPayments = 0;
        const monthlyAggregation: Record<string, number> = {}; 
        const payerAggregation: Record<string, { total: number, count: number }> = {};

        // Unique set of tickers from history (owned + previously owned)
        const allTickers = Array.from(new Set(transactions.map((t: Transaction) => t.ticker)));

        allTickers.forEach((ticker: string) => {
            // Find asset data (relies on context having fetched/cached data even for sold assets if possible)
            // Fallback: If asset is completely sold and not in `assets` array, we might miss data unless persisted.
            // Current `assets` state contains all assets with logic.
            const asset = assets.find(a => a.ticker === ticker);
            const history = asset?.dividendsHistory || [];
            
            if (history.length === 0) return;

            // Sort transactions for replay
            const assetTxs = transactions
                .filter(t => t.ticker === ticker)
                .sort((a, b) => a.date.localeCompare(b.date));

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

                    if (!payerAggregation[ticker]) payerAggregation[ticker] = { total: 0, count: 0 };
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
                percentage: totalReceived > 0 ? (data.total / totalReceived) * 100 : 0
            }))
            .sort((a, b) => b.total - a.total);

        // Current Month Context
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthValue = monthlyAggregation[currentMonthKey] || 0;

        return { totalReceived, countPayments, monthlyData, payersData, currentMonthValue };
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
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-sm">
                                <span className="font-bold text-lg">$</span>
                            </div>
                            <span className="text-xs font-bold text-emerald-600/80 uppercase tracking-wider">{t('dividends_received')}</span>
                        </div>
                        <div className="bg-[var(--bg-secondary)] rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-[var(--border-color)]">
                            <ChevronRightIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                        </div>
                    </div>

                    <div className={`mt-2 ${privacyMode ? 'blur-md select-none opacity-50' : ''}`}>
                        <p className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                            <CountUp end={stats.totalReceived} formatter={formatCurrency} />
                        </p>
                        {stats.currentMonthValue > 0 && (
                            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[10px] font-bold text-emerald-600">
                                    +{formatCurrency(stats.currentMonthValue)} em {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mini Chart visualization at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-16 flex items-end gap-1 px-4 opacity-20 pointer-events-none">
                    {stats.monthlyData.slice(-12).map((d, i) => (
                        <div 
                            key={i} 
                            className="flex-1 bg-emerald-500 rounded-t-sm transition-all duration-500" 
                            style={{ height: `${Math.max((d.total / (stats.monthlyData[stats.monthlyData.length-1]?.total || 1)) * 60, 10)}%` }}
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
                />
            )}
        </>
    );
};

export default DividendsSummaryCard;
