
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
}

type SortMode = 'total' | 'roi';

// --- Logic Hook: Separating Math from UI ---
const useDividendCalculations = (transactions: Transaction[], assets: Asset[]): DividendStats => {
    return useMemo(() => {
        let totalReceived = 0;
        let totalInvestedGlobal = 0; // Soma de todas as compras já feitas
        const monthlyAggregation: Record<string, number> = {}; 
        const payerAggregation: Record<string, { total: number, count: number, invested: number }> = {};

        // 1. Identificar universo de ativos (Atuais + Vendidos)
        const allTickers = Array.from(new Set(transactions.map(t => t.ticker)));

        allTickers.forEach((ticker) => {
            // Tenta pegar dados do contexto de ativos (pode ter dados da API Gemini)
            // Se não encontrar (ativo vendido), tentamos reconstruir o histórico básico se possível, 
            // mas sem o dividendHistory da API, não conseguimos calcular o passado de ativos vendidos que não estão mais no cache.
            // *Nota*: O ideal seria persistir o histórico de dividendos de ativos vendidos, mas aqui usamos o que temos no 'assets'.
            const assetData = assets.find(a => a.ticker === ticker);
            const history = assetData?.dividendsHistory || [];
            
            // Filtra transações deste ativo e ordena por data
            const assetTxs = transactions
                .filter(t => t.ticker === ticker)
                .sort((a, b) => a.date.localeCompare(b.date));

            // Calcula total investido (Soma de compras) para ROI
            let assetTotalInvested = 0;
            assetTxs.forEach(tx => {
                if (tx.type === 'Compra') {
                    assetTotalInvested += (tx.quantity * tx.price) + (tx.costs || 0);
                }
            });
            totalInvestedGlobal += assetTotalInvested;

            if (history.length === 0 || assetTxs.length === 0) return;

            // Processa cada dividendo histórico
            history.forEach((div: DividendHistoryEvent) => {
                // Otimização: Se o dividendo é anterior à primeira compra, ignora
                if (div.exDate < assetTxs[0].date) return;

                // Calcula posição (quantidade) na data EX
                let qtyOwnedAtExDate = 0;
                for (const tx of assetTxs) {
                    // Se a transação ocorreu DEPOIS da data ex, ela não conta para este dividendo
                    if (tx.date > div.exDate) break; 
                    
                    if (tx.type === 'Compra') qtyOwnedAtExDate += tx.quantity;
                    else if (tx.type === 'Venda') qtyOwnedAtExDate -= tx.quantity;
                }
                
                // Evita quantidades negativas por erro de dados
                qtyOwnedAtExDate = Math.max(0, qtyOwnedAtExDate);

                if (qtyOwnedAtExDate > 0) {
                    const amount = qtyOwnedAtExDate * div.value;
                    totalReceived += amount;

                    // Agregação Mensal (YYYY-MM)
                    // Usa paymentDate para regime de caixa
                    const monthKey = div.paymentDate.substring(0, 7); 
                    monthlyAggregation[monthKey] = (monthlyAggregation[monthKey] || 0) + amount;

                    // Agregação por Pagador
                    if (!payerAggregation[ticker]) {
                        payerAggregation[ticker] = { total: 0, count: 0, invested: assetTotalInvested };
                    }
                    payerAggregation[ticker].total += amount;
                    payerAggregation[ticker].count += 1;
                }
            });
        });

        // 2. Formatar Dados Mensais
        const monthlyData = Object.keys(monthlyAggregation).sort().map(key => {
            const [year, month] = key.split('-').map(Number);
            // Cria data UTC para evitar problemas de fuso
            const date = new Date(year, month - 1, 15);
            return {
                isoDate: key,
                month: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''),
                total: monthlyAggregation[key],
                year
            };
        });

        // 3. Formatar Dados de Pagadores + ROI
        const payersData = Object.entries(payerAggregation).map(([ticker, data]) => ({ 
            ticker, 
            ...data,
            roi: data.invested > 0 ? (data.total / data.invested) * 100 : 0
        }));

        // 4. Métricas Finais
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthValue = monthlyAggregation[currentMonthKey] || 0;
        const globalROI = totalInvestedGlobal > 0 ? (totalReceived / totalInvestedGlobal) * 100 : 0;
        
        const bestMonth = monthlyData.reduce((max, curr) => curr.total > max.total ? curr : max, { total: 0, month: '-' });
        const averageIncome = monthlyData.length > 0 ? totalReceived / monthlyData.length : 0;

        return { 
            totalReceived, 
            monthlyData, 
            payersData, 
            currentMonthValue, 
            totalInvestedGlobal, 
            globalROI,
            bestMonth,
            averageIncome
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

const StatCard: React.FC<{ label: string; value: React.ReactNode; subtext?: string; icon?: React.ReactNode; variant?: 'gold' | 'default' }> = ({ label, value, subtext, icon, variant = 'default' }) => (
    <div className={`p-4 rounded-xl border flex flex-col justify-between h-full shadow-sm transition-all ${variant === 'gold' ? 'bg-[var(--bg-primary)] border-yellow-500/20 shadow-[0_0_15px_-3px_rgba(234,179,8,0.1)]' : 'bg-[var(--bg-primary)] border-[var(--border-color)]'}`}>
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
    // Pega os últimos 12 meses, preenchendo se necessário (opcional, aqui mostramos o histórico real)
    const recentData = data.slice(-12); 
    const maxVal = Math.max(...recentData.map(d => d.total), 1);

    return (
        <div className="flex items-end gap-1.5 h-40 w-full px-2 pt-6">
            {recentData.length === 0 && <div className="w-full text-center text-xs text-[var(--text-secondary)] self-center">Sem dados recentes</div>}
            
            {recentData.map((d, i) => {
                const heightPercent = (d.total / maxVal) * 100;
                // Animação stagger baseada no índice
                const delay = i * 50; 
                
                return (
                    <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        {/* Floating Tooltip */}
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[var(--bg-tertiary-hover)] text-[var(--text-primary)] text-[10px] py-1.5 px-2.5 rounded-lg whitespace-nowrap pointer-events-none border border-[var(--border-color)] z-20 font-bold shadow-xl translate-y-2 group-hover:translate-y-0 transform">
                            {d.month}: <span className="text-[var(--accent-color)]">{formatCurrency(d.total)}</span>
                        </div>
                        
                        {/* Bar */}
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
                        
                        {/* Label */}
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
    
    let rankDisplay: React.ReactNode = <span className="text-xs font-medium text-[var(--text-secondary)] opacity-50 w-5 text-center">#{rank}</span>;
    if (rank === 1) rankDisplay = <span className="text-sm w-5 text-center">🥇</span>;
    if (rank === 2) rankDisplay = <span className="text-sm w-5 text-center">🥈</span>;
    if (rank === 3) rankDisplay = <span className="text-sm w-5 text-center">🥉</span>;

    const valueToBar = sortBy === 'total' ? payer.total : payer.roi;
    const barWidth = (valueToBar / maxVal) * 100;

    return (
        <div className={`relative p-3 rounded-xl border mb-2 flex items-center justify-between group transition-all active:bg-[var(--bg-tertiary-hover)] bg-[var(--bg-primary)] border-[var(--border-color)] overflow-hidden`}>
            
            {/* Background Bar */}
            <div className="absolute bottom-0 left-0 h-[2px] bg-[var(--accent-color)] transition-all duration-1000 ease-out opacity-60" style={{ width: `${barWidth}%` }}></div>

            <div className="flex items-center gap-3 z-10 relative flex-1 min-w-0">
                {rankDisplay}
                
                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-[10px] text-white shadow-sm shrink-0" style={{ backgroundColor: iconColor }}>
                    {payer.ticker.substring(0,4)}
                </div>
                
                <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-[var(--text-primary)] leading-tight">{payer.ticker}</span>
                    <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                        {payer.count}x 
                        <span className="w-0.5 h-0.5 bg-[var(--text-secondary)] rounded-full"></span>
                        Retorno: <span className={payer.roi >= 100 ? "text-[var(--green-text)] font-bold" : ""}>{payer.roi.toFixed(1)}%</span>
                    </span>
                </div>
            </div>

            <div className="text-right z-10 relative pl-2">
                <span className="font-bold text-sm text-[var(--text-primary)] block">
                    {formatCurrency(payer.total)}
                </span>
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

    // Call the heavy logic hook
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
