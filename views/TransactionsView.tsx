import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, TransactionType, ToastMessage } from '../types';
import FloatingActionButton from '../components/FloatingActionButton';
import Modal from '../components/modals/Modal';
import EditIcon from '../components/icons/EditIcon';
import TrashIcon from '../components/icons/TrashIcon';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate, getTodayISODate } from '../utils';
import VirtualList from '../components/VirtualList';

// Tipo auxiliar para a lista virtualizada
type VirtualItem = 
  | { type: 'header'; monthYear: string }
  | { type: 'transaction'; data: Transaction };

interface TransactionsViewProps {
    initialFilter: string | null;
    clearFilter: () => void;
    addToast: (message: string, type?: ToastMessage['type']) => void;
}

// ... TransactionModal Component (Mantido igual, omitido para brevidade) ...
const TransactionModal: React.FC<{ 
    onClose: () => void; 
    onSave: (tx: Omit<Transaction, 'id'> & { id?: string }) => void; 
    onDelete?: (id: string) => void;
    transaction?: Transaction | null;
    addToast: (message: string, type?: ToastMessage['type']) => void;
}> = ({ onClose, onSave, onDelete, transaction, addToast }) => {
    const { t, formatCurrency } = useI18n();
    const { getAssetByTicker } = usePortfolio();
    const isEditMode = !!transaction;

    const [type, setType] = useState<TransactionType>(transaction?.type || 'Compra');
    const [ticker, setTicker] = useState(transaction?.ticker || '');
    const [quantity, setQuantity] = useState(transaction?.quantity?.toString() || '');
    const [price, setPrice] = useState(transaction?.price?.toString() || '');
    const [costs, setCosts] = useState(transaction?.costs?.toString() || '');
    const [date, setDate] = useState(transaction?.date || getTodayISODate());
    const [errors, setErrors] = useState<Record<string, string>>({});

    const totalValue = useMemo(() => {
        const q = parseFloat(quantity) || 0;
        const p = parseFloat(price) || 0;
        const c = parseFloat(costs) || 0;
        return type === 'Compra' ? q * p + c : q * p - c;
    }, [quantity, price, costs, type]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!ticker || ticker.trim().length < 4) newErrors.ticker = t('validation_ticker_required');
        if (!quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) newErrors.quantity = t('validation_quantity_positive');
        if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) newErrors.price = t('validation_price_positive');
        if (costs && parseFloat(costs) < 0) newErrors.costs = t('validation_costs_positive');
        if (!date) newErrors.date = t('validation_date_required');
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    const handleTickerBlur = () => {
        if (!isEditMode && ticker.length >= 4 && !price) {
            const asset = getAssetByTicker(ticker.toUpperCase());
            if (asset && asset.currentPrice > 0) {
                setPrice(asset.currentPrice.toFixed(2));
                vibrate();
                addToast(`Preço atual (${asset.currentPrice.toFixed(2)}) preenchido!`, 'info');
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        vibrate();
        
        if(validate()) {
            const finalTx: Omit<Transaction, 'id'> & { id?: string } = {
                ticker: ticker.toUpperCase().trim(),
                type,
                quantity: parseFloat(quantity),
                price: parseFloat(price),
                date,
                costs: parseFloat(costs) || 0,
            };
            if(isEditMode) finalTx.id = transaction!.id;
            
            onSave(finalTx);
            onClose();
        } else {
            addToast(t('toast_check_form_errors'), 'error');
        }
    };

    return (
        <Modal title={isEditMode ? t('edit_transaction') : t('add_transaction')} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-5 pb-4">
                 <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">{t('type')}</label>
                    <div className="flex space-x-3">
                        <div className="relative flex-1">
                            <input type="radio" id="type-buy" checked={type === 'Compra'} onChange={() => setType('Compra')} className="peer hidden" />
                            <label htmlFor="type-buy" onClick={() => vibrate(5)} className="block text-center py-3 rounded-xl border-2 border-[var(--border-color)] cursor-pointer peer-checked:bg-green-500/10 peer-checked:text-green-500 peer-checked:border-green-500 transition-all font-bold hover:bg-[var(--bg-tertiary-hover)]">{t('buy')}</label>
                        </div>
                        <div className="relative flex-1">
                            <input type="radio" id="type-sell" checked={type === 'Venda'} onChange={() => setType('Venda')} className="peer hidden" />
                            <label htmlFor="type-sell" onClick={() => vibrate(5)} className="block text-center py-3 rounded-xl border-2 border-[var(--border-color)] cursor-pointer peer-checked:bg-red-500/10 peer-checked:text-red-500 peer-checked:border-red-500 transition-all font-bold hover:bg-[var(--bg-tertiary-hover)]">{t('sell')}</label>
                        </div>
                    </div>
                </div>
                <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">{t('ticker')}</label>
                    <input 
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value)}
                        onBlur={handleTickerBlur}
                        autoFocus 
                        className={`w-full bg-[var(--bg-primary)] border rounded-xl p-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all ${errors.ticker ? 'border-red-500' : 'border-[var(--border-color)]'}`} 
                        autoCapitalize="characters" 
                        placeholder="MXRF11" 
                    />
                    {errors.ticker && <p className="text-xs text-red-400 mt-1">{errors.ticker}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">{t('quantity')}</label>
                        <input value={quantity} onChange={e => setQuantity(e.target.value)} type="number" inputMode="decimal" step="1" min="0.0001" required className={`w-full bg-[var(--bg-primary)] border rounded-xl p-3 text-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all ${errors.quantity ? 'border-red-500' : 'border-[var(--border-color)]'}`} />
                        {errors.quantity && <p className="text-xs text-red-400 mt-1">{errors.quantity}</p>}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">{t('price_per_share')}</label>
                        <input 
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            type="number" 
                            inputMode="decimal" 
                            step="0.01" 
                            min="0.01" 
                            required 
                            className={`w-full bg-[var(--bg-primary)] border rounded-xl p-3 text-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all ${errors.price ? 'border-red-500' : 'border-[var(--border-color)]'}`} 
                        />
                        {errors.price && <p className="text-xs text-red-400 mt-1">{errors.price}</p>}
                    </div>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">{t('date')}</label>
                        <input value={date} onChange={e => setDate(e.target.value)} type="date" required className={`w-full bg-[var(--bg-primary)] border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all ${errors.date ? 'border-red-500' : 'border-[var(--border-color)]'}`} />
                        {errors.date && <p className="text-xs text-red-400 mt-1">{errors.date}</p>}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">{t('costs_fees')}</label>
                        <input value={costs} onChange={e => setCosts(e.target.value)} type="number" inputMode="decimal" step="0.01" min="0" className={`w-full bg-[var(--bg-primary)] border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all ${errors.costs ? 'border-red-500' : 'border-[var(--border-color)]'}`} />
                        {errors.costs && <p className="text-xs text-red-400 mt-1">{errors.costs}</p>}
                    </div>
                 </div>

                <div className="border-t border-[var(--border-color)] my-4 pt-4">
                    <div className="flex justify-between items-center bg-[var(--bg-primary)] p-3 rounded-lg">
                        <span className="text-sm font-bold text-[var(--text-secondary)]">Total da Operação:</span>
                        <span className="text-xl font-bold text-[var(--accent-color)] tracking-tight">{formatCurrency(totalValue)}</span>
                    </div>
                </div>

                <div className="flex space-x-3">
                  {isEditMode && onDelete && (
                      <button type="button" onClick={() => { vibrate(); onDelete(transaction!.id); }} className="w-1/3 bg-red-500/10 text-red-500 border border-red-500/30 font-bold py-3.5 rounded-xl hover:bg-red-500 hover:text-white transition-colors active:scale-95">{t('delete')}</button>
                  )}
                  <button type="submit" className="flex-1 bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3.5 rounded-xl shadow-lg shadow-[var(--accent-color)]/20 hover:shadow-[var(--accent-color)]/40 transition-all active:scale-95">{isEditMode ? t('save') : t('add')}</button>
                </div>
            </form>
        </Modal>
    );
};

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
        <div onClick={() => { onEdit(transaction); vibrate(); }} style={style} className="transaction-item bg-[var(--bg-secondary)] p-4 rounded-xl cursor-pointer hover:bg-[var(--bg-tertiary-hover)] hover:-translate-y-0.5 group border border-[var(--border-color)] active:scale-[0.98] transform duration-200 shadow-sm h-full flex flex-col justify-center">
            <div className="flex items-center justify-between pr-8">
                <div className="flex items-center space-x-3">
                    <div className={`transaction-icon w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm flex-shrink-0 ${isBuy ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
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
            
             <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(transaction); vibrate(); }}
                    className="p-1.5 text-gray-400 hover:text-[var(--accent-color)] hover:bg-[var(--bg-primary)] rounded-lg transition-colors"
                    aria-label={t('edit_transaction')}
                >
                    <EditIcon className="w-5 h-5" />
                </button>
                <button 
                    onClick={handleDelete}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-[var(--bg-primary)] rounded-lg transition-colors"
                    aria-label={t('delete')}
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
});

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
            limitDate.setHours(0,0,0,0);
        }

        return transactions.filter(t => {
            const matchesType = filter === 'todos' || t.type === filter;
            const matchesTicker = t.ticker.toLowerCase().includes(searchQuery.toLowerCase());
            
            let matchesDate = true;
            if (limitDate) {
                const txDate = new Date(t.date);
                txDate.setHours(0,0,0,0);
                matchesDate = txDate >= limitDate;
            }
            
            return matchesType && matchesTicker && matchesDate;
        });
    }, [filter, transactions, searchQuery, dateRange]);

    // Flattened list for virtualization
    const virtualItems = useMemo<VirtualItem[]>(() => {
        const sorted = [...filteredTransactions].sort((a, b) => b.date.localeCompare(a.date));
        const items: VirtualItem[] = [];
        let currentMonthYear = '';

        sorted.forEach(tx => {
            const date = new Date(tx.date);
            const monthYear = date.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
            
            if (monthYear !== currentMonthYear) {
                currentMonthYear = monthYear;
                items.push({ type: 'header', monthYear });
            }
            items.push({ type: 'transaction', data: tx });
        });
        return items;
    }, [filteredTransactions, locale]);

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

    // Function to determine item height based on index/type
    const getItemHeight = (index: number) => {
        const item = virtualItems[index];
        return item.type === 'header' ? 40 : 104; // 40px for header, 104px for transaction card
    };

    const renderVirtualItem = (item: VirtualItem) => {
        if (item.type === 'header') {
            return (
                <div className="h-10 flex items-end pb-2 px-1">
                    <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                        {item.monthYear}
                    </h2>
                </div>
            );
        }
        return (
            <div className="h-[104px] pb-3">
                <TransactionItem 
                    transaction={item.data} 
                    onEdit={setEditingTx} 
                    onDelete={handleConfirmDelete}
                />
            </div>
        );
    };
    
    return (
        <div className="p-4 pb-24 md:pb-6 h-full flex flex-col landscape-pb-6" id="transactions-view">
            <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
                <h1 className="text-2xl font-bold mb-4 px-1">{t('nav_transactions')}</h1>
                
                <div className="mb-4 space-y-3 flex-shrink-0">
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
                     <div className="bg-gradient-to-r from-[var(--bg-secondary)] to-[var(--bg-primary)] p-4 rounded-xl mb-6 shadow-sm border border-[var(--border-color)] text-sm space-y-2 animate-scale-in flex-shrink-0">
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

                {virtualItems.length > 0 ? (
                    <div className="flex-1 min-h-0">
                        <VirtualList 
                            items={virtualItems} 
                            renderItem={renderVirtualItem} 
                            getItemHeight={getItemHeight}
                            containerHeight="100%"
                        />
                    </div>
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
            
            <FloatingActionButton id="fab-add-transaction" onClick={() => { setShowAddModal(true); vibrate(); }} />
            
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