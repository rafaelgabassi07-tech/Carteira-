
import React, { useState, useMemo } from 'react';
import type { Transaction, TransactionType, ToastMessage } from '../../types';
import Modal from './Modal';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { vibrate, getTodayISODate } from '../../utils';

interface TransactionModalProps { 
    onClose: () => void; 
    onSave: (tx: Omit<Transaction, 'id'> & { id?: string }) => void; 
    onDelete?: (id: string) => void;
    transaction?: Transaction | null;
    initialTicker?: string;
    addToast: (message: string, type?: ToastMessage['type']) => void;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ onClose, onSave, onDelete, transaction, initialTicker, addToast }) => {
    const { t, formatCurrency } = useI18n();
    const { getAssetByTicker } = usePortfolio();
    const isEditMode = !!transaction;

    const [type, setType] = useState<TransactionType>(transaction?.type || 'Compra');
    const [ticker, setTicker] = useState(transaction?.ticker || initialTicker || '');
    
    // States as string to handle inputs with comma/dot
    const [quantity, setQuantity] = useState(transaction?.quantity?.toString() || '');
    const [price, setPrice] = useState(transaction?.price?.toString() || '');
    const [costs, setCosts] = useState(transaction?.costs?.toString() || '');
    
    const [date, setDate] = useState(transaction?.date || getTodayISODate());
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Helper to parse localized string to float safe
    const parseLocalFloat = (val: string) => {
        if (!val) return 0;
        // Replace comma with dot for parsing
        return parseFloat(val.replace(',', '.')) || 0;
    };

    // Helper to handle input change allowing only valid characters
    const handleNumberInput = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        // Allow digits, one comma or one dot.
        val = val.replace(/[^0-9,.]/g, '');
        // Prevent multiple separators
        if ((val.match(/[.,]/g) || []).length > 1) return;
        setter(val);
    };

    const totalValue = useMemo(() => {
        const q = parseLocalFloat(quantity);
        const p = parseLocalFloat(price);
        const c = parseLocalFloat(costs);
        return type === 'Compra' ? q * p + c : q * p - c;
    }, [quantity, price, costs, type]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!ticker || ticker.trim().length < 4) newErrors.ticker = t('validation_ticker_required');
        
        const qVal = parseLocalFloat(quantity);
        if (!quantity || qVal <= 0) newErrors.quantity = t('validation_quantity_positive');
        
        const pVal = parseLocalFloat(price);
        if (!price || pVal <= 0) newErrors.price = t('validation_price_positive');
        
        const cVal = parseLocalFloat(costs);
        if (costs && cVal < 0) newErrors.costs = t('validation_costs_positive');
        
        if (!date) newErrors.date = t('validation_date_required');
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    const handleTickerBlur = () => {
        if (!isEditMode && ticker.length >= 4 && !price) {
            const asset = getAssetByTicker(ticker.toUpperCase());
            if (asset && asset.currentPrice > 0) {
                setPrice(asset.currentPrice.toFixed(2).replace('.', ',')); // Format for BR input
                vibrate();
                addToast(`Preço atual (${formatCurrency(asset.currentPrice)}) preenchido!`, 'info');
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
                quantity: parseLocalFloat(quantity),
                price: parseLocalFloat(price),
                date,
                costs: parseLocalFloat(costs),
            };
            if(isEditMode && transaction) finalTx.id = transaction.id;
            
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
                        autoFocus={!isEditMode}
                        className={`w-full bg-[var(--bg-primary)] border rounded-xl p-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all ${errors.ticker ? 'border-red-500' : 'border-[var(--border-color)]'}`} 
                        autoCapitalize="characters" 
                        placeholder="MXRF11" 
                    />
                    {errors.ticker && <p className="text-xs text-red-400 mt-1">{errors.ticker}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">{t('quantity')}</label>
                        <input 
                            value={quantity} 
                            onChange={handleNumberInput(setQuantity)} 
                            type="text" 
                            inputMode="decimal"
                            placeholder="0"
                            className={`w-full bg-[var(--bg-primary)] border rounded-xl p-3 text-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all ${errors.quantity ? 'border-red-500' : 'border-[var(--border-color)]'}`} 
                        />
                        {errors.quantity && <p className="text-xs text-red-400 mt-1">{errors.quantity}</p>}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">{t('price_per_share')}</label>
                        <input 
                            value={price}
                            onChange={handleNumberInput(setPrice)}
                            type="text" 
                            inputMode="decimal"
                            placeholder="0,00"
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
                        <input 
                            value={costs} 
                            onChange={handleNumberInput(setCosts)} 
                            type="text" 
                            inputMode="decimal"
                            placeholder="0,00"
                            className={`w-full bg-[var(--bg-primary)] border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all ${errors.costs ? 'border-red-500' : 'border-[var(--border-color)]'}`} 
                        />
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

export default TransactionModal;
