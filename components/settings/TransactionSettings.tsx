import React from 'react';
import PageHeader from '../PageHeader';
import ToggleSwitch from '../ToggleSwitch';
import type { SortOption } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';

const TransactionSettings: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences } = usePortfolio();

    const sortOptions: { id: SortOption, label: string }[] = [
        { id: 'valueDesc', label: t('sort_value_desc') },
        { id: 'tickerAsc', label: t('sort_ticker_asc') },
        { id: 'performanceDesc', label: t('sort_performance_desc') },
    ];

    return (
        <div>
            <PageHeader title={t('transactions_data')} onBack={onBack} />

            <div className="space-y-4">
                 <div className="bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)]">
                    <label htmlFor="brokerage" className="font-bold text-sm">{t('default_brokerage')}</label>
                    <input
                        id="brokerage"
                        type="number"
                        value={preferences.defaultBrokerage}
                        onChange={(e) => updatePreferences({ defaultBrokerage: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2 mt-2 text-sm focus:outline-none focus:border-[var(--accent-color)]"
                    />
                </div>
                
                <div className="bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)]">
                    <h4 className="font-bold mb-3 text-sm">{t('default_sort')}</h4>
                    <div className="bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)] space-y-1">
                        {sortOptions.map(opt => (
                            <button 
                                key={opt.id} 
                                onClick={() => updatePreferences({ defaultSort: opt.id })} 
                                className={`w-full text-left p-2 my-0.5 text-sm rounded-lg ${preferences.defaultSort === opt.id ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] font-bold' : 'text-[var(--text-secondary)]'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg flex justify-between items-center border border-[var(--border-color)]">
                    <p className="font-bold text-sm">{t('hide_cents')}</p>
                    <ToggleSwitch enabled={preferences.hideCents} setEnabled={(val) => updatePreferences({ hideCents: val })} />
                </div>
                
                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg flex justify-between items-center border border-[var(--border-color)]">
                    <p className="font-bold text-sm">{t('show_currency')}</p>
                    <ToggleSwitch enabled={preferences.showCurrencySymbol} setEnabled={(val) => updatePreferences({ showCurrencySymbol: val })} />
                </div>
            </div>
        </div>
    );
};

export default TransactionSettings;