
import React, { useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from '../components/CountUp';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import CalendarIcon from '../components/icons/CalendarIcon';
import PageHeader from '../components/PageHeader';
import { vibrate, fromISODate } from '../utils';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import ClockIcon from '../components/icons/ClockIcon';
import WalletIcon from '../components/icons/WalletIcon';
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
    totalPaid: number;
    count: number;
    lastExDate?: string;
    nextPaymentDate?: string;
    isProvisioned?: boolean;
    yieldOnCost: number;
    averageMonthly: number;
    projectedAmount?: number;
}

interface DividendStats {
    totalReceived: number;
    monthlyData: MonthlyData[];
    payersData: PayerData[];
    currentMonthValue: number;
    averageIncome: number;
    annualForecast: number;
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

        const allTickers = Array.from(new Set(transactions.map(t => t.ticker)));

        allTickers.forEach((ticker) => {
            const assetData = assets.find(a => a.ticker === ticker);
            if (!assetData) return;

            // Estimativa anual baseada no DY atual (Forward looking simplificado)
            const assetValue = assetData.quantity * assetData.currentPrice;
            const projectedYearly = assetData.dy ? assetValue * (assetData.dy / 100) : 0;
            annualForecast += projectedYearly;

            const assetTxs = transactions
                .filter(t => t.ticker === ticker)
                .sort((a, b) => a.date.localeCompare(b.date));
            
            if (assetTxs.length === 0) return;

            // Cálculo do Custo Médio e Total Investido no ativo
            let assetTotalInvested = 0;
            let qtyAtEnd = 0;
            assetTxs.forEach(tx => {
                if (tx.type === 'Compra') {
                    assetTotalInvested += (tx.quantity * tx.price) + (tx.costs || 0);
                    qtyAtEnd += tx.quantity;
                } else {
                    const avgPrice = qtyAtEnd > 0 ? assetTotalInvested / qtyAtEnd : 0;
                    assetTotalInvested -= tx.quantity * avgPrice;
                    qtyAtEnd -= tx.quantity;
                }
            });
            totalInvestedGlobal += Math.max(0, assetTotalInvested);

            const history = assetData.dividendsHistory || [];
            let tickerTotalPaid = 0;
            let count = 0;
            
            // Ordenar histórico do mais recente para o mais antigo para pegar dados de "Próximo Pagamento"
            const sortedHistory = [...history].sort((a, b) => b.exDate.localeCompare(a.exDate));
            const latestDividend = sortedHistory[0];
            
            // Cálculo de Proventos Futuros (Provisionados)
            let projectedAmount = 0;
            let hasProvisioned = false;
            let nextPaymentDate: string | undefined = undefined;

            // Filtra e soma todos os provisionados
            const provisionedDividends = sortedHistory.filter(d => d.isProvisioned);
            if (provisionedDividends.length > 0) {
                hasProvisioned = true;
                // Pega a data de pagamento mais próxima entre os provisionados
                nextPaymentDate = provisionedDividends.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))[0].paymentDate;

                provisionedDividends.forEach(provDiv => {
                    let qtyOwned = 0;
                    for (const tx of assetTxs) {
                        // Data Com Strict: A transação deve ser MENOR que a Data Com
                        if (tx.date >= provDiv.exDate) break;
                        if (tx.type === 'Compra') qtyOwned += tx.quantity;
                        else if (tx.type === 'Venda') qtyOwned -= tx.quantity;
                    }
                    qtyOwned = Math.max(0, qtyOwned);
                    if (qtyOwned > 0) {
                        projectedAmount += qtyOwned * provDiv.value;
                    }
                });
            } else if (latestDividend) {
                nextPaymentDate = latestDividend.paymentDate;
            }

            // Cálculo de Proventos Passados (Pagos)
            sortedHistory.forEach((div: DividendHistoryEvent) => {
                // Ignora dividendos anteriores à primeira compra
                if (div.exDate < assetTxs[0].date) return;
                
                // Ignora provisionados aqui (já calculados acima)
                if (div.isProvisioned) return;

                let qtyOwned = 0;
                for (const tx of assetTxs) {
                    if (tx.date >= div.exDate) break; 
                    if (tx.type === 'Compra') qtyOwned += tx.quantity;
                    else if (tx.type === 'Venda') qtyOwned -= tx.quantity;
                }
                qtyOwned = Math.max(0, qtyOwned);

                if (qtyOwned > 0) {
                    const amount = qtyOwned * div.value;
                    totalReceived += amount;
                    tickerTotalPaid += amount;
                    count++;
                    const monthKey = div.paymentDate.substring(0, 7); 
                    monthlyAggregation[monthKey] = (monthlyAggregation[monthKey] || 0) + amount;
                }
            });
            
            const assetYoC = assetTotalInvested > 0 ? (projectedYearly / assetTotalInvested) * 100 : 0;

            payerAggregation[ticker] = {
                ticker,
                totalPaid: tickerTotalPaid,
                count,
                lastExDate: latestDividend?.exDate,
                nextPaymentDate: nextPaymentDate,
                isProvisioned: hasProvisioned,
                yieldOnCost: assetYoC,
                // Média Mensal baseada no total pago dividido por 12 (anualizado simples) ou histórico disponível se < 1 ano
                averageMonthly: count > 0 ? tickerTotalPaid / Math.max(1, Math.min(count, 12)) : 0, 
                projectedAmount,
            };
        });

        // Construção do Gráfico (Últimos 12 meses)
        const monthlyData: MonthlyData[] = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyData.push({
                isoDate: key,
                month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
                year: d.getFullYear(),
                total: monthlyAggregation[key] || 0,
            });
        }

        const currentMonthValue = monthlyAggregation[currentMonthKey] || 0;
        const totalLast12m = monthlyData.reduce((acc, m) => acc + m.total, 0);
        
        // Média Inteligente: Considera apenas os meses desde o primeiro recebimento (para carteiras novas)
        const firstIncomeIndex = monthlyData.findIndex(m => m.total > 0);
        const monthsDivisor = firstIncomeIndex === -1 ? 1 : Math.max(1, monthlyData.length - firstIncomeIndex);
        
        const averageIncome = totalLast12m / monthsDivisor;

        const yieldOnCost = totalInvestedGlobal > 0 ? (annualForecast / totalInvestedGlobal) * 100 : 0;

        return { 
            totalReceived, 
            monthlyData, 
            payersData: Object.values(payerAggregation).filter(p => p.totalPaid > 0 || (p.projectedAmount && p.projectedAmount > 0)).sort((a,b) => b.totalPaid - a.totalPaid), 
            currentMonthValue,
            averageIncome,
            annualForecast,
            yieldOnCost
        };
    }, [transactions, assets]);
};

// --- Sub-Components ---
const MetricCard: React.FC<{ label: string; value: React.ReactNode; subValue?: string; icon: React.ReactNode; highlight?: boolean }> = ({ label, value, subValue, icon, highlight }) => (
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
                {data.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        <div className="absolute -top-10 bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] text-[var(--text-primary)] text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-xl -translate-y-1">
                            {formatCurrency(d.total)}
                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-[var(--border-color)]"></div>
                        </div>
                        <div 
                            className="w-full rounded-t-md transition-all duration-700 ease-out relative overflow-hidden min-h-[4px] max-w-[40px] shadow-sm opacity-70 group-hover:opacity-100"
                            style={{ 
                                height: `${Math.max((d.total / maxVal) * 100, 2)}%`,
                                background: 'linear-gradient(to top, var(--accent-color), var(--accent-color))',
                            }}
                        />
                        <span className="text-[8px] mt-2 font-bold uppercase tracking-wider truncate w-full text-center text-[var(--text-secondary)]">
                            {d.month}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DetailItem: React.FC<{label: string, value: string | React.ReactNode, status?: 'Futuro' | 'Pago'}> = ({label, value, status}) => (
    <div className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-color)]">
        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{label}</p>
        <div className="flex justify-between items-center">
            <span className="font-bold text-sm text-[var(--text-primary)]">{value}</span>
            {status && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${status === 'Futuro' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                    {status}
                </span>
            )}
        </div>
    </div>
);

const PayerRow: React.FC<{ payer: PayerData; isExpanded: boolean; onToggle: () => void }> = ({ payer, isExpanded, onToggle }) => {
    const { formatCurrency } = useI18n();
    
    return (
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden transition-all duration-300">
            <div 
                onClick={() => { vibrate(); onToggle(); }}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-tertiary-hover)]"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-center font-bold text-xs text-[var(--text-primary)]">
                        {payer.ticker.substring(0, 4)}
                    </div>
                    <div>
                        <span className="font-bold text-sm text-[var(--text-primary)] block">{payer.ticker}</span>
                        <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                            {payer.count} {payer.count === 1 ? 'pagamento' : 'pagamentos'}
                        </span>
                    </div>
                </div>
                
                <div className="text-right">
                    <span className="block font-bold text-sm text-[var(--green-text)]">
                        +{formatCurrency(payer.totalPaid)}
                    </span>
                    {payer.projectedAmount && payer.projectedAmount > 0 ? (
                        <div className="flex items-center justify-end gap-1 text-[9px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded mt-1">
                            <ClockIcon className="w-2.5 h-2.5" />
                            +{formatCurrency(payer.projectedAmount)}
                        </div>
                    ) : (
                        <span className="text-[10px] text-[var(--text-secondary)]">Total</span>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-[var(--border-color)]/50 bg-[var(--bg-primary)]/30 animate-fade-in">
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        <DetailItem 
                            label="Próximo" 
                            value={payer.nextPaymentDate ? fromISODate(payer.nextPaymentDate).toLocaleDateString('pt-BR') : '-'}
                            status={payer.isProvisioned ? 'Futuro' : undefined}
                        />
                        <DetailItem 
                            label="Última Data Com" 
                            value={payer.lastExDate ? fromISODate(payer.lastExDate).toLocaleDateString('pt-BR') : '-'} 
                        />
                        <DetailItem label="Média Mensal" value={formatCurrency(payer.averageMonthly)} />
                        <DetailItem label="Yield on Cost (Est.)" value={`${payer.yieldOnCost.toFixed(2)}%`} />
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Main View ---
const IncomeReportView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t, formatCurrency } = useI18n();
    const { transactions, assets } = usePortfolio();
    const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

    const stats = useDividendCalculations(transactions, assets);

    const toggleTicker = (ticker: string) => {
        setExpandedTicker(expandedTicker === ticker ? null : ticker);
    };

    return (
        <div className="p-4 pb-24 md:pb-6 h-full overflow-y-auto custom-scrollbar landscape-pb-6">
            <div className="max-w-2xl mx-auto">
                <PageHeader title="Relatório de Renda" onBack={onBack} />

                {/* Top Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <MetricCard 
                        label="Renda Média Mensal" 
                        value={formatCurrency(stats.averageIncome)} 
                        subValue="Últimos 12 meses"
                        icon={<CalendarIcon className="w-5 h-5"/>}
                        highlight
                    />
                    <MetricCard 
                        label="Total Recebido" 
                        value={formatCurrency(stats.totalReceived)} 
                        subValue="Desde o início"
                        icon={<WalletIcon className="w-5 h-5"/>}
                    />
                    <MetricCard 
                        label="Previsão Anual" 
                        value={formatCurrency(stats.annualForecast)} 
                        subValue="Baseado no DY atual"
                        icon={<SparklesIcon className="w-5 h-5"/>}
                    />
                    <MetricCard 
                        label="Yield on Cost" 
                        value={`${stats.yieldOnCost.toFixed(2)}%`} 
                        subValue="Retorno sobre investido"
                        icon={<TrendingUpIcon className="w-5 h-5"/>}
                    />
                </div>

                {/* Monthly Chart */}
                <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-color)] mb-6 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-[var(--text-primary)]">Evolução Mensal</h3>
                        <span className="text-[10px] font-bold bg-[var(--bg-primary)] border border-[var(--border-color)] px-2 py-1 rounded text-[var(--text-secondary)]">12 Meses</span>
                    </div>
                    <MonthlyBarChart data={stats.monthlyData} avg={stats.averageIncome} />
                </div>

                {/* Payers List */}
                <div>
                    <h3 className="font-bold text-[var(--text-primary)] mb-4 px-1 flex items-center gap-2">
                        Fontes Pagadoras 
                        <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full border border-[var(--border-color)]">{stats.payersData.length}</span>
                    </h3>
                    <div className="space-y-3">
                        {stats.payersData.length > 0 ? (
                            stats.payersData.map(payer => (
                                <PayerRow 
                                    key={payer.ticker} 
                                    payer={payer} 
                                    isExpanded={expandedTicker === payer.ticker}
                                    onToggle={() => toggleTicker(payer.ticker)}
                                />
                            ))
                        ) : (
                            <div className="text-center py-12 text-[var(--text-secondary)] opacity-60">
                                Nenhuma renda registrada ainda.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IncomeReportView;
