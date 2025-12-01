
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, TransactionType, ToastMessage } from '../types';
import FloatingActionButton from '../components/FloatingActionButton';
import Modal from '../components/modals/Modal';
import EditIcon from '../components/icons/EditIcon';
import TrashIcon from '../components/icons/TrashIcon';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate, getTodayISODate } from '../utils';
import MoreVerticalIcon from '../components/icons/MoreVerticalIcon';

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
                        <input value={quantity} onChange={e => setQuantity(e.target.value)} type="number" inputMode="numeric" step="1" min="1" required className={`w-full bg-[var(--bg-primary)] border rounded-xl p-3 text-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all ${errors.quantity ? 'border-red-500' : 'border-[var(--border-color)]'}`} />
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

// --- NEW Transaction Item Component ---
const TransactionItem = React.memo<{ 
    transaction: Transaction, 
    onEdit: (tx: Transaction) => void, 
    onDelete: (id: string) => void, 
    style?: React.CSSProperties 
}>(({ transaction, onEdit, onDelete, style }) => {
    const { t, locale, formatCurrency } = useI18n();
    const [menuOpen, setMenuOpen] = useState(false);
    const isBuy = transaction.type === 'Compra';
    
    const totalValue = transaction.quantity * transaction.price + (isBuy ? (transaction.costs || 0) : -(transaction.costs || 0));

    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        vibrate();
        setMenuOpen(prev => !prev);
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        onEdit(transaction);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        onDelete(transaction.id);
    };

    return (
        <div style={style} className="bg-[var(--bg-secondary)] p-4 rounded-2xl animate-fade-in-up relative border border-[var(--border-color)] shadow-sm h-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-inner ${isBuy ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                        {isBuy ? t('buy_short') : t('sell_short')}
                    </div>
                    <div>
                        <p className="font-bold text-base text-[var(--text-primary)] leading-tight">{transaction.ticker}</p>
                        <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                            {new Date(transaction.date).toLocaleDateString(locale, { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-right flex-shrink-0">
                        <p className="font-bold text-base text-[var(--text-primary)]">
                            {formatCurrency(totalValue)}
                        </p>
                         <p className="text-[10px] text-[var(--text-secondary)] font-mono">
                           {transaction.quantity} @ {formatCurrency(transaction.price)}
                        </p>
                    </div>
                     <div className="relative">
                        <button 
                            onClick={handleMenuClick}
                            className="p-2 text-gray-400 hover:text-[var(--accent-color)] hover:bg-[var(--bg-primary)] rounded-full transition-colors z-10 relative active:scale-95"
                        >
                            <MoreVerticalIcon className="w-5 h-5" />
                        </button>
                        {menuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                                <div className="absolute right-0 mt-1 w-36 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-2xl z-20 overflow-hidden animate-scale-in origin-top-right">
                                    <button onClick={handleEdit} className="w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2 hover:bg-[var(--bg-tertiary-hover)]">
                                        <EditIcon className="w-4 h-4"/> {t('edit')}
                                    </button>
                                     <button onClick={handleDelete} className="w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2 text-red-400 hover:bg-red-500/10">
                                        <TrashIcon className="w-4 h-4"/> {t('delete')}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
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
    const { t, locale } = useI18n();
    const { transactions, addTransaction, updateTransaction, deleteTransaction } = usePortfolio();

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
            const matchesTicker = t.ticker.toLowerCase().includes(searchQuery.toLowerCase());
            let matchesDate = true;
            if (limitDate) {
                const txDate = new Date(t.date);
                txDate.setHours(12,0,0,0);
                matchesDate = txDate >= limitDate;
            }
            return matchesTicker && matchesDate;
        });
    }, [transactions, searchQuery, dateRange]);

    const groupedTransactions = useMemo(() => {
        const sorted = [...filteredTransactions].sort((a, b) => b.date.localeCompare(a.date));
        return sorted.reduce<Record<string, Transaction[]>>((acc, tx) => {
            const date = new Date(tx.date);
            const monthYear = date.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
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
            addTransaction({ ...tx, id: String(Date.now()) + Math.random() });
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
        <div className="h-full flex flex-col overflow-hidden">
            <div className="p-4 flex-shrink-0">
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
                     <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)]">
                         {(['all', '30', '90', '365'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => { setDateRange(p); vibrate(); }}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${dateRange === p ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                {p === 'all' ? 'Todos' : p === '30' ? '30D' : p === '90' ? '90D' : '1A'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-24 md:pb-6">
                {Object.keys(groupedTransactions).length > 0 ? (
                    Object.entries(groupedTransactions).map(([monthYear, txs]) => (
                        <div key={monthYear} className="mb-6 animate-fade-in-up">
                            <h2 className="text-xs font-bold text-[var(--text-secondary)] mb-3 uppercase tracking-widest px-1 sticky top-0 z-10 bg-[var(--bg-primary)]/90 backdrop-blur-sm py-2 -mx-4 px-4">{monthYear}</h2>
                            <div className="grid grid-cols-1 gap-3">
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
                    <div className="text-center text-[var(--text-secondary)] pt-12 animate-fade-in">
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
