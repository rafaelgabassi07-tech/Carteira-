import React from 'react';
import PageHeader from '../PageHeader';
import DownloadIcon from '../icons/DownloadIcon';
import UploadIcon from '../icons/UploadIcon';
import type { ToastMessage, Transaction, TransactionType, AppPreferences } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { vibrate } from '../../utils';

const BackupRestore: React.FC<{ onBack: () => void; addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ onBack, addToast }) => {
    const { t } = useI18n();
    const { transactions, preferences, importTransactions, restoreData } = usePortfolio();

    const handleExportJson = () => {
        vibrate();
        const backupData = {
            transactions,
            preferences,
        };
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = 'invest_portfolio_backup.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        addToast(t('toast_data_exported'), 'success');
    };
    
    const handleExportCsv = () => {
        vibrate();
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "ID,Ticker,Type,Quantity,Price,Date,Costs\r\n";
        
        transactions.forEach(tx => {
            const row = [tx.id, tx.ticker, tx.type, tx.quantity, tx.price, tx.date, tx.costs || 0].join(",");
            csvContent += row + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "invest_portfolio_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast(t('toast_csv_exported'), 'success');
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        vibrate();
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                let parsedTransactions: Transaction[] = [];
                let parsedPreferences: Partial<AppPreferences> | undefined = undefined;

                if (file.type === "application/json") {
                    const data = JSON.parse(text);
                    if (data.transactions && Array.isArray(data.transactions)) {
                        parsedTransactions = data.transactions;
                        parsedPreferences = data.preferences; // This might be undefined in old backups
                    } else {
                        throw new Error(t('invalid_file_format'));
                    }
                } else if (file.type === "text/csv") {
                     const lines = text.split(/\r\n|\n/).slice(1); // Skip header, robust line breaks
                     parsedTransactions = lines.filter(line => line.trim()).map(line => {
                         const values = line.split(',');
                         if (values.length < 7) throw new Error(t('invalid_file_format'));
                         const [id, ticker, type, quantity, price, date, costs] = values;
                         return { id, ticker, type: type as TransactionType, quantity: +quantity, price: +price, date, costs: +costs };
                     });
                } else {
                    throw new Error(t('unsupported_file_type'));
                }

                if (parsedTransactions.length > 0) {
                     if (window.confirm(t('confirm_restore_prompt'))) {
                        // OK for Replace
                        restoreData({ transactions: parsedTransactions, preferences: parsedPreferences });
                        addToast(t('toast_backup_restored_replace'), 'success');
                     } else {
                        // Cancel for Merge
                        importTransactions(parsedTransactions);
                        addToast(t('toast_backup_restored_merge'), 'success');
                     }
                } else {
                    addToast('Nenhuma transação encontrada no arquivo.', 'info');
                }

            } catch (error: any) {
                addToast(`${t('toast_import_failed')}: ${error.message}`, 'error');
            } finally {
                // Reset file input to allow re-uploading the same file
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div>
            <PageHeader title={t('backup_restore')} onBack={onBack} helpText={t('help_backup')} />
            <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)] space-y-6">
                <div>
                    <p className="font-bold mb-1 text-sm">{t('backup_export_desc')}</p>
                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                         <button onClick={handleExportJson} className="flex-1 flex items-center justify-center gap-2 bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-bold py-3 rounded-lg hover:bg-[var(--accent-color)] hover:text-white transition-colors">
                            <DownloadIcon className="w-4 h-4" />
                            {t('export_data_json')}
                        </button>
                         <button onClick={handleExportCsv} className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-400 font-bold py-3 rounded-lg hover:bg-emerald-500 hover:text-white transition-colors">
                            <DownloadIcon className="w-4 h-4" />
                            {t('export_data_csv')}
                        </button>
                    </div>
                </div>

                <div>
                    <p className="font-bold mb-1 text-sm">{t('backup_import_desc')}</p>
                    <div className="mt-3">
                        <label className="w-full flex items-center justify-center gap-2 bg-[var(--bg-primary)] border border-dashed border-[var(--border-color)] text-[var(--text-secondary)] font-bold py-3 rounded-lg cursor-pointer hover:bg-[var(--bg-tertiary-hover)] hover:text-white transition-colors">
                            <UploadIcon className="w-4 h-4" />
                            {t('import_data')}
                            <input type="file" accept=".json,.csv" onChange={handleImport} className="hidden" />
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BackupRestore;