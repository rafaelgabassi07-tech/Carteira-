
import React, { useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from './CountUp';
import TrendingUpIcon from './icons/TrendingUpIcon';
import CalendarIcon from './icons/CalendarIcon';
import Modal from './modals/Modal';
import BarChart from './BarChart'; // Reusing the robust chart component
import { vibrate } from '../utils';

// --- Types ---
interface MonthlyData {
    month: string; // "Jan/23"
    total: number;
    year: number;
    monthIndex: number;
    isoDate: string; // YYYY-MM helper for sorting
}

interface PayerData {
    ticker: string;
    total: number;
    count: number;
    lastPaid: string;
}

// --- Detail Modal ---
const DividendsDetailModal: React.FC<{ 
    onClose: () => void; 
    monthlyData: MonthlyData[];
    payersData: PayerData[];
    totalReceived: number;
}> = ({ onClose, monthlyData, payersData, totalReceived }) => {
    const { t, formatCurrency } = useI18n();
    const [activeTab, setActiveTab] = useState<'evolution' | 'ranking'>('evolution');

    // Prepare data for BarChart component
    const chartData = useMemo(() => {
        // Take last 12 months for the chart, or more if available but limited to fit nicely
        return monthlyData.slice(-12).map(d => ({
            month: d.month,
            total: d.total
        }));
    }, [monthlyData]);

    const averageIncome = useMemo(() => {
        if (monthlyData.length === 0) return 0;
        return totalReceived / monthlyData.length;
    }, [totalReceived, monthlyData]);

    return (
        <Modal title="Relatório de Renda" onClose={onClose} type="slide-up">
            <div className="space-y-6 pb-6">
                
                {/* Big Header */}
                <div className="flex flex-col items-center justify-center py-6 bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-color)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--green-text)] to-[var(--accent-color)]"></div>
                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">{t('total_dividends_received')}</p>
                    <p className="text-4xl font-black text-[var(--text-primary)] tracking-tight">
                        <CountUp end={totalReceived} formatter={formatCurrency} />
                    </p>
                    <p className="text-xs font-medium text-[var(--text-secondary)] mt-2 bg-[var(--bg-secondary)] px-3 py-1 rounded-full border border-[var(--border-color)]">
                        Média mensal: <span className="text-[var(--green-text)] font-bold">{formatCurrency(averageIncome)}</span>
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)]">
                    <button 
                        onClick={() => { setActiveTab('evolution'); vibrate(); }}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'evolution' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                    >
                        Evolução
                    </button>
                    <button 
                        onClick={() => { setActiveTab('ranking'); vibrate(); }}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'ranking' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                    >
                        Ranking de Ativos
                    </button>
                </div>

                {/* Content */}
                <div className="animate-fade-in min-h-[300px]">
                    {activeTab === 'evolution' ? (
                        <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)]">
                            <div className="flex items-center gap-2 mb-4">
                                <CalendarIcon className="w-4 h-4 text-[var(--accent-color)]"/>
                                <h3 className="font-bold text-sm text-[var(--text-primary)]">Histórico (Últimos 12 Meses)</h3>
                            </div>
                            <div className="h-64 w-full">
                                <BarChart data={chartData} />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] overflow-hidden">
                            <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary-hover)] flex justify-between text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                <span>Ativo</span>
                                <span>Total Pago</span>
                            </div>
                            <div className="divide-y divide-[var(--border-color)]">
                                {payersData.map((payer, idx) => {
                                    const percentage = (payer.total / totalReceived) * 100;
                                    const maxVal = payersData[0].total;
                                    const barWidth = (payer.total / maxVal) * 100;

                                    return (
                                        <div key={payer.ticker} className="p-3 hover:bg-[var(--bg-tertiary-hover)] transition-colors">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold text-[var(--text-secondary)] w-4 text-center">{idx + 1}</span>
                                                    <div>
                                                        <span className="font-bold text-sm text-[var(--text-primary)] block">{payer.ticker}</span>
                                                        <span className="text-[10px] text-[var(--text-secondary)]">{payer.count} pagamentos</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-bold text-sm text-[var(--green-text)] block">{formatCurrency(payer.total)}</span>
                                                    <span className="text-[10px] text-[var(--text-secondary)]">{percentage.toFixed(1)}% do total</span>
                                                </div>
                                            </div>
                                            {/* Progress Bar */}
                                            <div className="w-full h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-[var(--accent-color)] rounded-full opacity-80" 
                                                    style={{ width: `${barWidth}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
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

    // --- Core Calculation Logic ---
    const stats = useMemo(() => {
        let totalReceived = 0;
        let countPayments = 0;
        const monthlyAggregation: Record<string, number> = {}; // Key: "YYYY-MM"
        const payerAggregation: Record<string, { total: number, count: number, lastPaid: string }> = {};

        // 1. Identify all tickers involved in transactions (even sold ones)
        const allTickers = Array.from(new Set(transactions.map(t => t.ticker)));

        allTickers.forEach(ticker => {
            // Get asset data (current or just for history)
            // We use the `assets` array from context which might currently only hold active assets.
            // Ideally, we need access to the full `marketData` for sold assets. 
            // Since `assets` in context only returns active ones, we look at the one in context first.
            const asset = assets.find(a => a.ticker === ticker);
            
            // If asset is fully sold, we might miss its dividendsHistory if not persisted elsewhere.
            // *CRITICAL FIX*: For now, we rely on `assets` having the history. 
            // In a real app, `marketData` should be accessed directly or `assets` should return everything with qty=0.
            // Assuming `assets` contains the necessary dividend history:
            
            const history = asset?.dividendsHistory || [];
            if (history.length === 0) return;

            // Get all transactions for this specific ticker, sorted by date
            const assetTxs = transactions
                .filter(t => t.ticker === ticker)
                .sort((a, b) => a.date.localeCompare(b.date));

            if (assetTxs.length === 0) return;

            // Iterate through every dividend event in history
            history.forEach(div => {
                // EX-DATE RULE: You must own the asset at the end of the day BEFORE the ex-date.
                // Or simply: You bought it BEFORE the ex-date and haven't sold it yet.
                // We calculate the quantity owned at the close of `div.exDate` minus 1 second.
                // Effectively: Sum of all transactions where `tx.date < div.exDate`.
                
                // Optimized check: If the dividend ex-date is before the very first purchase, skip.
                if (div.exDate <= assetTxs[0].date) return;

                let qtyOwned = 0;
                for (const tx of assetTxs) {
                    // Transaction must have happened strictly BEFORE the ex-date to count
                    if (tx.date < div.exDate) {
                        if (tx.type === 'Compra') qtyOwned += tx.quantity;
                        else if (tx.type === 'Venda') qtyOwned -= tx.quantity;
                    } else {
                        // Transactions sorted by date, so we can break early
                        break;
                    }
                }

                // Ensure no negative quantity (data error safety)
                qtyOwned = Math.max(0, qtyOwned);

                if (qtyOwned > 0) {
                    const amount = qtyOwned * div.value;
                    totalReceived += amount;
                    countPayments++;

                    // Monthly Grouping
                    // Extract YYYY-MM from payment date reliably
                    const monthKey = div.paymentDate.substring(0, 7); 
                    monthlyAggregation[monthKey] = (monthlyAggregation[monthKey] || 0) + amount;

                    // Payer Grouping
                    if (!payerAggregation[ticker]) {
                        payerAggregation[ticker] = { total: 0, count: 0, lastPaid: div.paymentDate };
                    }
                    payerAggregation[ticker].total += amount;
                    payerAggregation[ticker].count += 1;
                    if (div.paymentDate > payerAggregation[ticker].lastPaid) {
                        payerAggregation[ticker].lastPaid = div.paymentDate;
                    }
                }
            });
        });

        // 2. Format Monthly Data (Sort chronological)
        const sortedMonths = Object.keys(monthlyAggregation).sort();
        const monthlyData: MonthlyData[] = sortedMonths.map(key => {
            const [year, month] = key.split('-').map(Number);
            // Create date object correctly handling timezone to get month name
            const date = new Date(year, month - 1, 2); 
            return {
                isoDate: key,
                month: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''),
                total: monthlyAggregation[key],
                year,
                monthIndex: month - 1
            };
        });

        // 3. Format Payers Data (Sort by Total Value Desc)
        const payersData: PayerData[] = Object.entries(payerAggregation)
            .map(([ticker, data]) => ({ ticker, ...data }))
            .sort((a, b) => b.total - a.total);

        // 4. Current Month Stats
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthValue = monthlyAggregation[currentMonthKey] || 0;

        return {
            totalReceived,
            countPayments,
            monthlyData,
            payersData,
            currentMonthValue
        };

    }, [assets, transactions]);

    const maxMonthlyTotal = useMemo(() => {
        if (stats.monthlyData.length === 0) return 1;
        return Math.max(...stats.monthlyData.map(d => d.total), 1);
    }, [stats.monthlyData]);

    const handleClick = () => {
        vibrate();
        setShowModal(true);
    };

    return (
        <>
            <div 
                onClick={handleClick}
                className="bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] p-6 rounded-2xl mx-4 mt-4 shadow-lg border border-[var(--border-color)] animate-scale-in relative overflow-hidden group hover:shadow-[var(--accent-color)]/5 transition-all duration-300 cursor-pointer active:scale-[0.98]"
            >
                {/* Background Chart Effect */}
                <div className={`absolute bottom-0 left-0 right-0 h-12 flex items-end gap-1 px-6 opacity-10 pointer-events-none transition-opacity duration-500 ${privacyMode ? 'opacity-0' : ''}`}>
                    {stats.monthlyData.slice(-10).map((d, i) => (
                        <div key={i} className="flex-1 bg-[var(--green-text)] rounded-t-sm" style={{ height: `${(d.total / maxMonthlyTotal) * 100}%` }}></div>
                    ))}
                </div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                            <div className="p-1.5 bg-green-500/10 rounded-lg text-[var(--green-text)] border border-green-500/20">
                                <TrendingUpIcon className="w-3.5 h-3.5" />
                            </div>
                            {t('dividends_received')}
                        </h2>
                        {stats.currentMonthValue > 0 && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-500/20 bg-green-500/10 text-green-500 transition-all ${privacyMode ? 'opacity-0' : 'opacity-100'}`}>
                                +{formatCurrency(stats.currentMonthValue)} este mês
                            </span>
                        )}
                    </div>
                    
                    <div className={`transition-all duration-300 ${privacyMode ? 'blur-md select-none grayscale opacity-50' : ''}`}>
                        <p className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                            <CountUp end={stats.totalReceived} formatter={formatCurrency} />
                        </p>
                        
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-[var(--text-secondary)] font-medium">
                                Acumulado em <span className="text-[var(--text-primary)] font-bold">{stats.countPayments}</span> pagamentos
                            </p>
                        </div>
                    </div>
                </div>
                
                {/* Visual "More" Indicator */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-secondary)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
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
