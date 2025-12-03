
import React, { useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from './CountUp';
import TrendingUpIcon from './icons/TrendingUpIcon';

const DividendsSummaryCard: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const { assets, transactions, privacyMode } = usePortfolio();

    const dividendStats = useMemo(() => {
        let totalReceived = 0;
        let countPayments = 0;

        // Itera sobre todos os ativos
        assets.forEach(asset => {
            const history = asset.dividendsHistory || [];
            if (history.length === 0) return;

            // Filtra transações deste ativo e ordena
            const assetTxs = transactions
                .filter(t => t.ticker === asset.ticker)
                .sort((a, b) => a.date.localeCompare(b.date));

            if (assetTxs.length === 0) return;

            // Para cada evento de dividendo no histórico do ativo
            history.forEach(div => {
                // Otimização: Se o dividendo é anterior à primeira compra, ignora
                if (div.exDate < assetTxs[0].date) return;

                // Calcula a quantidade de cotas que o usuário tinha na Data Com (ExDate)
                let qtyAtExDate = 0;
                
                // Replay das transações até a Data Com
                for (const tx of assetTxs) {
                    // Se transação ocorreu DEPOIS da data com, para o loop (pois estamos ordenados)
                    // Nota: Se a transação for no mesmo dia da Data Com, ela conta (geralmente data com é position EOD)
                    if (tx.date > div.exDate) break; 

                    if (tx.type === 'Compra') {
                        qtyAtExDate += tx.quantity;
                    } else if (tx.type === 'Venda') {
                        qtyAtExDate -= tx.quantity;
                    }
                }

                // Se tinha cotas, soma ao total
                if (qtyAtExDate > 0) {
                    totalReceived += qtyAtExDate * div.value;
                    countPayments++;
                }
            });
        });

        return { totalReceived, countPayments };
    }, [assets, transactions]);

    return (
        <div className="bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] p-6 rounded-2xl mx-4 mt-4 shadow-lg border border-[var(--border-color)] animate-scale-in relative overflow-hidden group hover:shadow-[var(--accent-color)]/5 transition-all duration-500">
             {/* Decorative Glow */}
             <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none"></div>

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
                    <p className="text-3xl font-bold tracking-tight text-[var(--green-text)]">
                        <CountUp end={dividendStats.totalReceived} formatter={formatCurrency} />
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">
                        Acumulado desde o início • {dividendStats.countPayments} pagamentos
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DividendsSummaryCard;
