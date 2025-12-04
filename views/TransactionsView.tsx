import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, ToastMessage } from '../types';
import TransactionModal from '../components/modals/TransactionModal';
import EditIcon from '../components/icons/EditIcon';
import TrashIcon from '../components/icons/TrashIcon';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate } from '../utils';

const TransactionItem = React.memo<{ 
    transaction: Transaction, 
    onEdit: (tx: Transaction) => void, 
    onDelete: (id: string) => void, 
    style?: React.CSSProperties 
}>(({ transaction, onEdit, onDelete, style }) => {
    const { t, locale, formatCurrency } = useI18n();
    const { getAveragePriceForTransaction } = usePortfolio();
    const isBuy = transaction.type === 'Compra';

    const realizedGain = useMemo(() => {
        if (isBuy) return null;
        const avgPriceBeforeSale = getAveragePriceForTransaction(transaction);
        if (avgPriceBeforeSale === 0) return 0;
        return (transaction.price - avgPriceBeforeSale) * transaction.quantity - (transaction.costs || 0);
    }, [transaction, isBuy, getAveragePriceForTransaction]);
    
    const totalValue = transaction.quantity * transaction.price + (isBuy ? (transaction.costs || 0) : -(transaction.costs || 0));

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        vibrate();
        onDelete(transaction.id);
    }

    return (
        <div onClick={() => { onEdit(transaction); vibrate(); }} style={style} className="bg-[var(--bg-secondary)] p-4 rounded-xl cursor-pointer hover:bg-[var(--bg-tertiary-hover)] hover:-translate-y-0.5 animate-fade-in-up relative group border border-[var(--border-color)] active:scale-[0.98] transform duration-200 shadow-sm h-full">
            <div className="flex items-center justify-between pr-10">
                <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm ${isBuy ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                        {isBuy ? t('buy_short') : t('sell_short')}
                    </div>
                    <div>
                        <p className="font-bold text-[var(--text-primary)]">{transaction.ticker}</p>
                        <p className="text-[10px] text-[var(--text-secondary)] font-medium">
                            {new Date(transaction.date).toLocaleDateString(locale, { timeZone: 'UTC' })}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className={`font-bold ${isBuy ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
                        {formatCurrency(totalValue)}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                       {transaction.quantity} x {formatCurrency(transaction.price)}
                    </p>
                </div>
            </div>
            
            {realizedGain !== null && (
                <div className={`mt-3 pt-2 border-t border-[var(--border-color)] text-xs flex justify-between items-center pr-10`}>
                    <span className="text-[var(--text-secondary)] font-medium">{t('realized_gain_loss')}:</span>
                    <span className={`font-bold ${realizedGain >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                        {formatCurrency(realizedGain)}
                    </span>
                </div>
            )}
            
             <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1">
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(transaction); vibrate(); }}
                    className="p-2 text-gray-400 hover:text-[var(--accent-color)] hover:bg-[var(--bg-primary)] rounded-lg transition-colors"
                    aria-label={t('edit_transaction')}
                >
                    <EditIcon className="w-4 h-4" />
                </button>
                <button 
                    onClick={handleDelete}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-[var(--bg-primary)] rounded-lg transition-colors"
                    aria-label={t('delete')}
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
});

interface TransactionsViewProps {
    initialFilter: string | null;
    clearFilter: () => void;
    addToast: (message: string, type?: ToastMessage['type']) => void;
}

const TransactionsView: React.FC<TransactionsViewProps> = ({ initialFilter, clearFilter, addToast }) => {
    const { t, locale, formatCurrency } = useI18n();
    const { transactions, addTransaction, updateTransaction, deleteTransaction } = usePortfolio();

    const [filter, setFilter] = useState<'todos' | 'Compra' | 'Venda'>('todos');
    const [searchQuery, setSearchQuery] = useState(initialFilter || '');
    const [dateRange, setDateRange] = useState<'all' | '30' | '90' | '365'>('all');
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        if (initialFilter) {
            setTimeout(() => clearFilter(), 100);
        }
    }, [initialFilter, clearFilter]);


    const filteredTransactions = useMemo(() => {
        const now = new Date();
        let limitDate: Date | null = null;
        
        if (dateRange !== 'all') {
            limitDate = new Date();
            limitDate.setDate(now.getDate() - parseInt(dateRange));
            // Normalize to midnight to avoid time discrepancies
            limitDate.setHours(0,0,0,0);
        }

        return transactions.filter(t => {
            const matchesType = filter === 'todos' || t.type === filter;
            const matchesTicker = t.ticker.toLowerCase().includes(searchQuery.toLowerCase());
            
            let matchesDate = true;
            if (limitDate) {
                const txDate = new Date(t.date);
                txDate.setHours(0,0,0,0); // Normalize comparison
                matchesDate = txDate >= limitDate;
            }
            
            return matchesType && matchesTicker && matchesDate;
        });
    }, [filter, transactions, searchQuery, dateRange]);

    const summary = useMemo(() => {
        const result = filteredTransactions.reduce((acc, tx) => {
            const value = tx.quantity * tx.price + (tx.costs || 0);
            if (tx.type === 'Compra') {
                acc.buys += value;
            } else {
                acc.sells += value - (tx.costs || 0) * 2; 
            }
            return acc;
        }, { buys: 0, sells: 0 });
        return { ...result, net: result.buys - result.sells };
    }, [filteredTransactions]);

    const groupedTransactions = useMemo(() => {
        const sorted = [...filteredTransactions].sort((a, b) => b.date.localeCompare(a.date));
        return sorted.reduce<Record<string, Transaction[]>>((acc, tx) => {
            const date = new Date(tx.date);
            const monthYear = date.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
            if (!acc[monthYear]) acc[monthYear] = [];
            acc[monthYear].push(tx);
            return acc;
        }, {});
    }, [filteredTransactions, locale]);
    
    const handleSaveTransaction = (tx: Omit<Transaction, 'id'> & { id?: string }) => {
        if (tx.id) {
            updateTransaction(tx as Transaction);
            addToast(t('toast_transaction_updated'), 'success');
        } else {
            addTransaction({ ...tx, id: String(Date.now()) });
            addToast(t('toast_transaction_added'), 'success');
        }
        setEditingTx(null);
        setShowAddModal(false);
    };

    const handleDeleteTransaction = (txId: string) => {
        deleteTransaction(txId);
        setEditingTx(null);
        addToast(t('toast_transaction_deleted'), 'success');
    };
    
    const handleConfirmDelete = (txId: string) => {
        if (window.confirm(t('confirm_delete_transaction'))) {
             handleDeleteTransaction(txId);
        }
    };
    
    return (
        <div className="p-4 pt-safe pb-32 md:pb-6 h-full overflow-y-auto custom-scrollbar landscape-pb-6" id="transactions-view">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl font-bold mb-4 px-1">{t('nav_transactions')}</h1>
                
                <div className="mb-4 space-y-3">
                    <input 
                        type="text" 
                        placeholder={t('search_by_ticker_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all"
                        autoCapitalize="characters"
                    />
                    
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                         <select 
                            value={dateRange} 
                            onChange={(e) => { setDateRange(e.target.value as any); vibrate(); }}
                            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-bold focus:outline-none"
                        >
                            <option value="all">Todos os Periodos</option>
                            <option value="30">30 Dias</option>
                            <option value="90">90 Dias</option>
                            <option value="365">1 Ano</option>
                        </select>
                        
                        {(['todos', 'Compra', 'Venda'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => { setFilter(f); vibrate(); }}
                                className={`flex-shrink-0 py-1.5 px-4 text-xs font-bold rounded-lg transition-all duration-200 ${
                                    filter === f
                                        ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow-md'
                                        : 'bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)]'
                                }`}
                            >
                                {f === 'todos' ? t('all') : t(f === 'Compra' ? 'buy' : 'sell')}
                            </button>
                        ))}
                    </div>
                </div>

                {filteredTransactions.length > 0 && (
                     <div className="bg-gradient-to-r from-[var(--bg-secondary)] to-[var(--bg-primary)] p-4 rounded-xl mb-6 shadow-sm border border-[var(--border-color)] text-sm space-y-2 animate-scale-in">
                        <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)] font-medium">{t('total_buys')}</span>
                            <span className="font-bold text-[var(--green-text)]">{formatCurrency(summary.buys)}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)] font-medium">{t('total_sells')}</span>
                            <span className="font-bold text-[var(--red-text)]">{formatCurrency(summary.sells)}</span>
                        </div>
                         <div className="flex justify-between pt-2 border-t border-[var(--border-color)] mt-2">
                            <span className="text-[var(--text-primary)] font-bold">{t('net_investment')}</span>
                            <span className={`font-bold text-base ${summary.net >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>{formatCurrency(summary.net)}</span>
                        </div>
                    </div>
                )}

                {Object.keys(groupedTransactions).length > 0 ? (
                    Object.entries(groupedTransactions).map(([monthYear, txs]) => (
                        <div key={monthYear} className="mb-6 animate-fade-in-up">
                            <h2 className="text-xs font-bold text-[var(--text-secondary)] mb-3 uppercase tracking-widest px-1 sticky top-0 z-10 bg-[var(--bg-primary)]/90 backdrop-blur-sm py-2">{monthYear}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 landscape-grid-cols-2">
                                {(txs as Transaction[]).map((tx, index) => (
                                    <TransactionItem 
                                        key={tx.id} 
                                        transaction={tx} 
                                        onEdit={setEditingTx} 
                                        onDelete={handleConfirmDelete}
                                        style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-[var(--text-secondary)] py-20 animate-fade-in">
                        <div className="w-16 h-16 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--border-color)]">
                            <EditIcon className="w-6 h-6 opacity-50"/>
                        </div>
                      <p className="font-bold">{t('no_transactions_found')}</p>
                      <p className="text-xs mt-2 max-w-xs mx-auto">{t('no_transactions_subtitle')}</p>
                    </div>
                )}
            </div>
            
            {showAddModal && (
                <TransactionModal 
                    onClose={() => setShowAddModal(false)} 
                    onSave={handleSaveTransaction}
                    addToast={addToast}
                />
            )}

            {editingTx && (
                <TransactionModal 
                    onClose={() => setEditingTx(null)} 
                    onSave={handleSaveTransaction}
                    onDelete={handleDeleteTransaction}
                    transaction={editingTx} 
                    addToast={addToast}
                />
            )}
        </div>
    );
};

export default TransactionsView;