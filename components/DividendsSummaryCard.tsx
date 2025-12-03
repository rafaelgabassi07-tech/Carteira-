
import React, { useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from './CountUp';
import TrendingUpIcon from './icons/TrendingUpIcon';
import CalendarIcon from './icons/CalendarIcon';
import Modal from './modals/Modal';
import { vibrate } from '../utils';

// --- Mini Chart Component for the Card Background ---
const SparkBar: React.FC<{ data: number[] }> = ({ data }) => {
    const max = Math.max(...data, 1);
    return (
        <div className="flex items-end gap-1 h-8 opacity-30 mt-2">
            {data.map((val, i) => (
                <div 
                    key={i} 
                    className="flex-1 bg-[var(--green-text)] rounded-t-sm transition-all duration-500"
                    style={{ height: `${(val / max) * 100}%` }}
                />
            ))}
        </div>
    );
};

const DividendsDetailModal: React.FC<{ 
    onClose: () => void; 
    monthlyData: { month: string, value: number, year: number, monthIndex: number }[];
    topPayers: { ticker: string, value: number }[];
    totalReceived: number;
}> = ({ onClose, monthlyData, topPayers, totalReceived }) => {
    const { formatCurrency } = useI18n();
    const last12Months = monthlyData.slice(-12);
    const maxMonthValue = Math.max(...last12Months.map(d => d.value), 1);

    return (
        <Modal title="Detalhamento de Proventos" onClose={onClose} type="slide-up">
            <div className="space-y-6">
                {/* Header Big Number */}
                <div className="text-center py-4 bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-color)]">
                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Total Acumulado</p>
                    <p className="text-3xl font-black text-[var(--green-text)]">{formatCurrency(totalReceived)}</p>
                </div>

                {/* Monthly Chart */}
                <div>
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-[var(--accent-color)]"/>
                        Últimos 12 Meses
                    </h3>
                    <div className="h-48 flex items-end gap-2 justify-between px-2 border-b border-[var(--border-color)] pb-2">
                        {last12Months.map((d, i) => {
                            const heightPercent = (d.value / maxMonthValue) * 100;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                    {/* Tooltip on hover/touch */}
                                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-tertiary-hover)] text-[10px] px-1.5 py-0.5 rounded border border-[var(--border-color)] whitespace-nowrap z-10 pointer-events-none shadow-lg">
                                        {formatCurrency(d.value)}
                                    </div>
                                    
                                    <div 
                                        className={`w-full max-w-[20px] rounded-t-md transition-all duration-700 ease-out ${d.value > 0 ? 'bg-[var(--green-text)]' : 'bg-[var(--bg-tertiary-hover)]'}`}
                                        style={{ height: `${Math.max(heightPercent, 2)}%`, opacity: d.value > 0 ? 0.8 : 0.3 }}
                                    ></div>
                                    <span className="text-[9px] text-[var(--text-secondary)] mt-1.5 font-medium rotate-0 truncate w-full text-center">
                                        {d.month.split('/')[0]}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Top Payers */}
                <div>
                    <h3 className="font-bold text-sm mb-3">Top Pagadores</h3>
                    <div className="space-y-3">
                        {topPayers.slice(0, 5).map((asset, i) => (
                            <div key={asset.ticker} className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)]">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-[var(--text-secondary)] w-4">{i + 1}</span>
                                    <span className="font-bold text-sm">{asset.ticker}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-20 h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                                        <div className="h-full bg-[var(--accent-color)] rounded-full" style={{ width: `${(asset.value / (topPayers[0]?.value || 1)) * 100}%` }}></div>
                                    </div>
                                    <span className="text-sm font-bold text-[var(--text-primary)] w-24 text-right">{formatCurrency(asset.value)}</span>
                                </div>
                            </div>
                        ))}
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

    const stats = useMemo(() => {
        let totalReceived = 0;
        let countPayments = 0;
        const monthlyAggregation: Record<string, number> = {};
        const assetAggregation: Record<string, number> = {};

        // 1. Process Logic
        assets.forEach(asset => {
            const history = asset.dividendsHistory || [];
            if (history.length === 0) return;

            const assetTxs = transactions
                .filter(t => t.ticker === asset.ticker)
                .sort((a, b) => a.date.localeCompare(b.date));

            if (assetTxs.length === 0) return;

            history.forEach(div => {
                if (div.exDate < assetTxs[0].date) return;

                let qtyAtExDate = 0;
                for (const tx of assetTxs) {
                    if (tx.date > div.exDate) break; 
                    if (tx.type === 'Compra') qtyAtExDate += tx.quantity;
                    else if (tx.type === 'Venda') qtyAtExDate -= tx.quantity;
                }

                if (qtyAtExDate > 0) {
                    const amount = qtyAtExDate * div.value;
                    totalReceived += amount;
                    countPayments++;
                    
                    // Monthly Grouping (YYYY-MM)
                    // Ensure we use the date portion reliably
                    const monthKey = div.paymentDate.substring(0, 7);
                    monthlyAggregation[monthKey] = (monthlyAggregation[monthKey] || 0) + amount;

                    // Asset Grouping
                    assetAggregation[asset.ticker] = (assetAggregation[asset.ticker] || 0) + amount;
                }
            });
        });

        // 2. Prepare Monthly Data Array
        // Safe Date Generation (timezone independent for YYYY-MM keys)
        const now = new Date();
        const filledMonthlyData = [];
        
        for (let i = 11; i >= 0; i--) {
            // Calculate target date by subtracting months
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            
            // Generate key manually to avoid ISO conversion shifting timezones
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const key = `${year}-${month}`;
            
            const value = monthlyAggregation[key] || 0;
            
            filledMonthlyData.push({
                month: d.toLocaleDateString('pt-BR', { month: 'short' }),
                year: year,
                monthIndex: d.getMonth(),
                value
            });
        }

        // 3. Current Month Stats
        const currentYear = now.getFullYear();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        const currentMonthKey = `${currentYear}-${currentMonth}`;
        const currentMonthValue = monthlyAggregation[currentMonthKey] || 0;

        // 4. Top Payers
        const topPayers = Object.entries(assetAggregation)
            .map(([ticker, value]) => ({ ticker, value }))
            .sort((a, b) => b.value - a.value);

        return { 
            totalReceived, 
            countPayments, 
            monthlyData: filledMonthlyData, 
            currentMonthValue,
            topPayers 
        };
    }, [assets, transactions]);

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
                {/* Decorative Glow */}
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none transition-opacity group-hover:opacity-100 opacity-70"></div>
                
                {/* Click Hint */}
                <div className="absolute top-3 right-3 text-[var(--text-secondary)] opacity-0 group-hover:opacity-50 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                </div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-2">
                        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                            <div className="p-1 bg-green-500/20 rounded text-[var(--green-text)]">
                                <TrendingUpIcon className="w-3 h-3" />
                            </div>
                            {t('total_dividends_received')}
                        </h2>
                    </div>
                    
                    <div className={`mt-3 mb-1 transition-all duration-300 ${privacyMode ? 'blur-md select-none grayscale opacity-50' : ''}`}>
                        <p className="text-3xl font-bold tracking-tight text-[var(--green-text)] drop-shadow-sm">
                            <CountUp end={stats.totalReceived} formatter={formatCurrency} />
                        </p>
                        
                        <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-[var(--text-secondary)] font-medium">
                                <span className="text-[var(--text-primary)] font-bold">{stats.countPayments}</span> pagamentos recebidos
                            </p>
                            
                            {stats.currentMonthValue > 0 && (
                                <span className="text-[10px] font-bold bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full border border-green-500/20">
                                    +{formatCurrency(stats.currentMonthValue)} este mês
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Mini Spark Chart */}
                    <div className={privacyMode ? 'opacity-0' : ''}>
                        <SparkBar data={stats.monthlyData.map(d => d.value).slice(-6)} />
                    </div>
                </div>
            </div>

            {showModal && (
                <DividendsDetailModal 
                    onClose={() => setShowModal(false)}
                    monthlyData={stats.monthlyData}
                    topPayers={stats.topPayers}
                    totalReceived={stats.totalReceived}
                />
            )}
        </>
    );
};

export default DividendsSummaryCard;
