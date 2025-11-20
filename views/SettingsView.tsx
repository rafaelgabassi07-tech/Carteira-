import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ToastMessage, AppColor, AppPreferences, TransactionType, Transaction } from '../types';
import UserIcon from '../components/icons/UserIcon';
import ShieldIcon from '../components/icons/ShieldIcon';
import UpdateIcon from '../components/icons/UpdateIcon';
import BellIcon from '../components/icons/BellIcon';
import DatabaseIcon from '../components/icons/DatabaseIcon';
import InfoIcon from '../components/icons/InfoIcon';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
import DownloadIcon from '../components/icons/DownloadIcon';
import UploadIcon from '../components/icons/UploadIcon';
import ToggleSwitch from '../components/ToggleSwitch';
import PrivacyIcon from '../components/icons/PrivacyIcon';
import TermsIcon from '../components/icons/TermsIcon';
import Modal from '../components/modals/Modal';
import PageHeader from '../components/PageHeader';
import UpdateCheckModal from '../components/modals/UpdateCheckModal';
import { MOCK_USER_PROFILE } from '../constants';
import { usePersistentState, vibrate } from '../utils';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import TransactionIcon from '../components/icons/TransactionIcon';
import LogoutIcon from '../components/icons/LogoutIcon';
import { validateApiKey } from '../services/geminiService';
import { validateBrapiToken } from '../services/brapiService';

const LinkIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"/></svg>;
const PaletteIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>;
const SlidersIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/></svg>;

type MenuScreen = 'main' | 'profile' | 'security' | 'notifications' | 'backup' | 'about' | 'appearance' | 'general' | 'transactions' | 'apiConnections';

// --- Sub-screen components ---
const ApiConnectionSettings: React.FC<{ onBack: () => void, addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ onBack, addToast }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences } = usePortfolio();
    const [geminiKey, setGeminiKey] = useState(preferences.geminiApiKey || '');
    const [brapiToken, setBrapiToken] = useState(preferences.brapiToken || '');
    const [isTestingGemini, setIsTestingGemini] = useState(false);
    const [isTestingBrapi, setIsTestingBrapi] = useState(false);

    const handleSave = () => {
        updatePreferences({ geminiApiKey: geminiKey, brapiToken: brapiToken });
        addToast(t('toast_key_saved'), 'success');
        vibrate();
    };

    const handleTestGemini = async () => {
        setIsTestingGemini(true);
        vibrate();
        const isValid = await validateApiKey(geminiKey);
        setIsTestingGemini(false);
        if (isValid) {
            addToast(t('toast_connection_success'), 'success');
        } else {
            addToast(t('toast_connection_failed'), 'error');
        }
    };
    
    const handleTestBrapi = async () => {
        setIsTestingBrapi(true);
        vibrate();
        const isValid = await validateBrapiToken(brapiToken);
        setIsTestingBrapi(false);
        if (isValid) {
            addToast(t('toast_connection_success'), 'success');
        } else {
            addToast(t('toast_connection_failed'), 'error');
        }
    };

    return (
        <div>
            <PageHeader title={t('api_connections')} helpText={t('api_connections_desc')} onBack={onBack} />
            <div className="space-y-6">
                {/* Gemini API */}
                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                    <h3 className="font-bold mb-1">{t('gemini_api_key')}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mb-3">{t('gemini_api_desc')}</p>
                    <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder={t('api_key_placeholder')} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 mb-3"/>
                    <button onClick={handleTestGemini} disabled={isTestingGemini} className="w-full bg-gray-600 text-white font-bold py-2 rounded-lg text-sm disabled:opacity-50">
                        {isTestingGemini ? 'Testando...' : t('test_connection')}
                    </button>
                </div>

                {/* Brapi API */}
                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                    <h3 className="font-bold mb-1">{t('brapi_token')}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mb-3">{t('brapi_desc')}</p>
                    <input type="password" value={brapiToken} onChange={(e) => setBrapiToken(e.target.value)} placeholder={t('api_key_placeholder')} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 mb-3"/>
                    <button onClick={handleTestBrapi} disabled={isTestingBrapi} className="w-full bg-gray-600 text-white font-bold py-2 rounded-lg text-sm disabled:opacity-50">
                        {isTestingBrapi ? 'Testando...' : t('test_connection')}
                    </button>
                </div>

                <button onClick={handleSave} className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-transform">
                    {t('save_key')}
                </button>
            </div>
        </div>
    );
};
// ... (rest of the sub-components remain the same: UserProfileDetail, SecuritySettings, etc.)

const UserProfileDetail: React.FC<{ onBack: () => void, addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ onBack, addToast }) => {
    const { t } = useI18n();
    const [user, setUser] = usePersistentState('user-profile', MOCK_USER_PROFILE);
    const [isEditing, setIsEditing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        setUser({
            ...user,
            name: formData.get('name') as string,
            email: formData.get('email') as string,
        });
        setIsEditing(false);
        addToast(t('toast_profile_updated'), 'success');
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setUser({ ...user, avatarUrl: event.target?.result as string });
                addToast(t('toast_avatar_changed'), 'success');
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    return (
        <div>
            <PageHeader title={t('my_profile')} helpText={t('help_profile')} onBack={onBack}/>
            <div className="bg-[var(--bg-secondary)] p-6 rounded-lg flex flex-col items-center">
                <div className="relative">
                    <img src={user.avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full mb-4 ring-2 ring-[var(--accent-color)]" />
                    <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-4 right-0 bg-gray-800 rounded-full p-1 border-2 border-[var(--bg-secondary)]">
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9z"></path><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                </div>
                {!isEditing ? (
                    <>
                        <h3 className="text-2xl font-bold">{user.name}</h3>
                        <p className="text-[var(--text-secondary)]">{user.email}</p>
                        <button onClick={() => setIsEditing(true)} className="mt-4 text-[var(--accent-color)] text-sm font-semibold">{t('edit_profile')}</button>
                    </>
                ) : (
                    <form onSubmit={handleSave} className="w-full space-y-4 mt-4">
                        <div>
                            <label className="text-xs text-[var(--text-secondary)]">{t('name')}</label>
                            <input name="name" defaultValue={user.name} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 mt-1" />
                        </div>
                        <div>
                            <label className="text-xs text-[var(--text-secondary)]">{t('email')}</label>
                            <input name="email" type="email" defaultValue={user.email} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 mt-1" />
                        </div>
                        <div className="flex space-x-2">
                           <button type="button" onClick={() => setIsEditing(false)} className="w-full bg-gray-600 text-white font-bold py-2 rounded-lg">{t('cancel')}</button>
                           <button type="submit" className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-2 rounded-lg">{t('save')}</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

const SecuritySettings: React.FC<{ onBack: () => void, addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ onBack, addToast }) => {
    const { t } = useI18n();
    const { updatePreferences, preferences } = usePortfolio();
    const [biometrics, setBiometrics] = usePersistentState('security-biometrics', false);

    const handleBiometricToggle = async (enabled: boolean) => {
        if (enabled) {
            if (window.PublicKeyCredential) {
                 setBiometrics(true);
                 addToast(t('toast_biometric_enabled'), 'success');
            } else {
                 addToast(t('toast_biometric_not_supported'), 'error');
            }
        } else {
            setBiometrics(false);
            addToast(t('toast_biometric_disabled'), 'info');
        }
    };

    const handlePinToggle = (enabled: boolean) => {
        if (enabled) {
             const pin = prompt(t('set_pin'));
             if (pin && pin.length === 4 && !isNaN(Number(pin))) {
                 updatePreferences({ appPin: pin });
                 addToast(t('pin_setup_success'), 'success');
             } else {
                 if(pin !== null) addToast(t('wrong_pin'), 'error');
             }
        } else {
            updatePreferences({ appPin: null });
            addToast(t('pin_removed'), 'info');
        }
    };

    return(
        <div>
            <PageHeader title={t('security')} helpText={t('help_security')} onBack={onBack}/>
            <div className="bg-[var(--bg-secondary)] rounded-lg divide-y divide-[var(--border-color)]">
                <div className="p-4 flex justify-between items-center">
                    <div>
                        <span>{t('biometric_login')}</span>
                        <p className={`text-xs ${biometrics ? 'text-green-400' : 'text-gray-400'}`}>{biometrics ? t('enabled') : t('disabled')}</p>
                    </div>
                    <ToggleSwitch enabled={biometrics} setEnabled={handleBiometricToggle} />
                </div>
                <div className="p-4 flex justify-between items-center">
                    <div>
                        <span>{t('app_lock_pin')}</span>
                        <p className={`text-xs ${preferences.appPin ? 'text-green-400' : 'text-gray-400'}`}>{preferences.appPin ? t('enabled') : t('disabled')}</p>
                    </div>
                    <ToggleSwitch enabled={!!preferences.appPin} setEnabled={handlePinToggle} />
                </div>
                 <div className="p-4 flex justify-between items-center">
                    <div>
                        <span>{t('privacy_on_start')}</span>
                    </div>
                    <ToggleSwitch enabled={preferences.privacyOnStart} setEnabled={(v) => updatePreferences({ privacyOnStart: v })} />
                </div>
            </div>
        </div>
    );
};

const NotificationSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useI18n();
    const [settings, setSettings] = usePersistentState('notification-settings', { price: true, dividend: true, news: false });
    return (
        <div>
            <PageHeader title={t('notifications')} helpText={t('help_notifications')} onBack={onBack}/>
            <div className="bg-[var(--bg-secondary)] rounded-lg divide-y divide-[var(--border-color)]">
               <div className="p-4 flex justify-between items-center"><span>{t('price_alerts')}</span> <ToggleSwitch enabled={settings.price} setEnabled={(val) => setSettings(s => ({...s, price: val}))}/></div>
               <div className="p-4 flex justify-between items-center"><span>{t('dividend_announcements')}</span> <ToggleSwitch enabled={settings.dividend} setEnabled={(val) => setSettings(s => ({...s, dividend: val}))}/></div>
               <div className="p-4 flex justify-between items-center"><span>{t('market_news')}</span> <ToggleSwitch enabled={settings.news} setEnabled={(val) => setSettings(s => ({...s, news: val}))}/></div>
            </div>
        </div>
    );
};

const BackupRestore: React.FC<{ onBack: () => void; addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ onBack, addToast }) => {
    const { t } = useI18n();
    const { transactions, importTransactions } = usePortfolio();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () => {
        const dataStr = JSON.stringify({ transactions }, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'invest_portfolio_backup.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        addToast(t('toast_data_exported'), 'success');
    };
    
    const handleExportCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "ID,Ticker,Type,Quantity,Price,Date,Costs,Notes\r\n";
        transactions.forEach(tx => {
            const row = [tx.id, tx.ticker, tx.type, tx.quantity, tx.price, tx.date, tx.costs || 0, `"${tx.notes || ''}"`].join(',');
            csvContent += row + "\r\n";
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "invest_portfolio_transactions.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast(t('toast_csv_exported'), 'success');
    };

    const handleImportClick = () => { fileInputRef.current?.click(); };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result as string;
                    if (file.name.endsWith('.json')) {
                        const data = JSON.parse(text);
                        if (data.transactions && Array.isArray(data.transactions)) {
                            importTransactions(data.transactions);
                            addToast(t('toast_data_imported'), 'success');
                            onBack();
                        } else { throw new Error(t('invalid_file_format')); }
                    } else if (file.name.endsWith('.csv')) {
                        const lines = text.split('\n').slice(1); // Skip header
                        const importedTxs: Transaction[] = lines.filter(line => line.trim() !== '').map((line, index) => {
                            const [id, ticker, type, quantity, price, date, costs, notes] = line.split(',');
                            return { id: id || `csv_${Date.now()}_${index}`, ticker, type: type as TransactionType, quantity: parseFloat(quantity), price: parseFloat(price), date, costs: parseFloat(costs), notes: notes?.replace(/"/g, '') };
                        });
                        importTransactions(importedTxs);
                        addToast(t('toast_csv_imported'), 'success');
                        onBack();
                    } else {
                        throw new Error(t('unsupported_file_type'));
                    }
                } catch (error: any) {
                    addToast(`${t('toast_import_failed')}: ${error.message}`, 'error');
                }
            };
            reader.readAsText(file);
        }
        if (event.target) event.target.value = '';
    };

    return(
        <div>
            <PageHeader title={t('backup_restore')} helpText={t('help_backup')} onBack={onBack}/>
            <div className="bg-[var(--bg-secondary)] p-4 rounded-lg space-y-4">
                 <div>
                    <p className="text-sm text-[var(--text-secondary)] mb-2">{t('backup_export_desc')}</p>
                    <div className="flex space-x-2">
                        <button onClick={handleExport} className="w-full flex items-center justify-center space-x-2 bg-sky-600 text-white font-bold py-3 rounded-lg hover:bg-sky-700">
                            <DownloadIcon className="w-5 h-5"/>
                            <span>{t('export_data_json')}</span>
                        </button>
                         <button onClick={handleExportCSV} className="w-full flex items-center justify-center space-x-2 bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700">
                            <DownloadIcon className="w-5 h-5"/>
                            <span>{t('export_data_csv')}</span>
                        </button>
                    </div>
                </div>
                <div className="pt-4 mt-4 border-t border-[var(--border-color)]">
                    <p className="text-sm text-[var(--text-secondary)]">{t('backup_import_desc')}</p>
                    <button onClick={handleImportClick} className="w-full mt-4 flex items-center justify-center space-x-2 bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-700">
                       <UploadIcon className="w-5 h-5"/>
                       <span>{t('import_data')}</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json,.csv" />
                </div>
            </div>
        </div>
    )
};

const AboutApp: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useI18n();
    const [showModal, setShowModal] = useState<'privacy' | 'terms' | null>(null);

    return (
        <div>
            <PageHeader title={t('about_app')} helpText={t('help_about')} onBack={onBack}/>
            <div className="bg-[var(--bg-secondary)] p-6 rounded-lg text-center">
                <h3 className="text-xl font-bold">Invest Portfolio</h3>
                <p className="text-sm text-[var(--text-secondary)]">{t('version')} 1.5.0</p>
                <p className="mt-4 text-sm">{t('about_app_desc')}</p>
                <p className="mt-6 text-xs text-gray-500">&copy; {new Date().getFullYear()} Invest Portfolio. {t('all_rights_reserved')}</p>
            </div>
             <div className="mt-4 bg-[var(--bg-secondary)] rounded-lg divide-y divide-[var(--border-color)]">
                <div onClick={() => setShowModal('privacy')} className="p-4 flex justify-between items-center cursor-pointer hover:bg-[var(--bg-tertiary-hover)]">
                    <div className="flex items-center space-x-4"><PrivacyIcon className="w-5 h-5 text-[var(--accent-color)]"/><span>{t('privacy_policy')}</span></div> <ChevronRightIcon />
                </div>
                 <div onClick={() => setShowModal('terms')} className="p-4 flex justify-between items-center cursor-pointer hover:bg-[var(--bg-tertiary-hover)]">
                    <div className="flex items-center space-x-4"><TermsIcon className="w-5 h-5 text-[var(--accent-color)]"/><span>{t('terms_of_service')}</span></div> <ChevronRightIcon />
                </div>
            </div>
            {showModal === 'privacy' && <Modal title={t('privacy_policy')} onClose={() => setShowModal(null)} type="scale-in"><p>{t('privacy_policy_content')}</p></Modal>}
            {showModal === 'terms' && <Modal title={t('terms_of_service')} onClose={() => setShowModal(null)} type="scale-in"><p>{t('terms_of_service_content')}</p></Modal>}
        </div>
    );
};

const AppearanceSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences } = usePortfolio();
    
    const colors: AppColor[] = ['blue', 'green', 'purple', 'orange', 'rose'];
    const colorMap: Record<AppColor, string> = {
        blue: 'bg-sky-500',
        green: 'bg-emerald-500',
        purple: 'bg-purple-500',
        orange: 'bg-orange-500',
        rose: 'bg-rose-500'
    };

    return (
        <div>
            <PageHeader title={t('appearance')} onBack={onBack} />
            <div className="space-y-6">
                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                    <h3 className="font-bold mb-3 text-sm">{t('accent_color')}</h3>
                    <div className="flex gap-3">
                        {colors.map(color => (
                            <button 
                                key={color}
                                onClick={() => updatePreferences({ accentColor: color })}
                                className={`w-8 h-8 rounded-full ${colorMap[color]} transition-transform hover:scale-110 ${preferences.accentColor === color ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-secondary)] ring-[var(--text-primary)] scale-110' : ''}`}
                            />
                        ))}
                    </div>
                </div>

                <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] overflow-hidden">
                    {['system', 'light', 'dark'].map((theme) => (
                        <button 
                            key={theme}
                            onClick={() => updatePreferences({ systemTheme: theme as any })}
                            className="w-full p-4 flex justify-between items-center hover:bg-[var(--bg-tertiary-hover)] border-b last:border-b-0 border-[var(--border-color)]"
                        >
                            <span>{t(`${theme}_theme`)}</span>
                            {preferences.systemTheme === theme && <div className="w-2 h-2 rounded-full bg-[var(--accent-color)]"/>}
                        </button>
                    ))}
                </div>

                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                     <h3 className="font-bold mb-3 text-sm">{t('font_size')}</h3>
                     <div className="flex bg-[var(--bg-primary)] rounded-lg p-1">
                         {['small', 'medium', 'large'].map(size => (
                             <button 
                                key={size}
                                onClick={() => updatePreferences({ fontSize: size as any })}
                                className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${preferences.fontSize === size ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow' : 'text-[var(--text-secondary)]'}`}
                             >
                                 {t(`font_${size}`)}
                             </button>
                         ))}
                     </div>
                </div>
            </div>
        </div>
    )
}

const GeneralSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
     const { t } = useI18n();
     const { preferences, updatePreferences } = usePortfolio();
     return (
         <div>
             <PageHeader title={t('general')} onBack={onBack} />
             <div className="space-y-4">
                <div className="bg-[var(--bg-secondary)] rounded-lg divide-y divide-[var(--border-color)] border border-[var(--border-color)]">
                    <div className="p-4 flex justify-between items-center">
                        <span>{t('start_screen')}</span>
                        <select 
                            value={preferences.startScreen} 
                            onChange={(e) => updatePreferences({ startScreen: e.target.value as any })}
                            className="bg-transparent text-[var(--accent-color)] font-bold outline-none text-right"
                        >
                            <option value="carteira">{t('nav_portfolio')}</option>
                            <option value="analise">{t('nav_analysis')}</option>
                            <option value="noticias">{t('nav_news')}</option>
                        </select>
                    </div>
                     <div className="p-4 flex justify-between items-center">
                        <span>{t('haptic_feedback')}</span>
                        <ToggleSwitch enabled={preferences.hapticFeedback} setEnabled={(v) => updatePreferences({ hapticFeedback: v })} />
                    </div>
                </div>
                <button onClick={() => { updatePreferences({ restartTutorial: true }); window.location.reload(); }} className="w-full p-4 bg-[var(--bg-secondary)] text-[var(--accent-color)] font-bold rounded-lg border border-[var(--border-color)]">
                    {t('restart_tutorial')}
                </button>
             </div>
         </div>
     )
}

const TransactionSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
     const { t } = useI18n();
     const { preferences, updatePreferences } = usePortfolio();
     return (
        <div>
            <PageHeader title={t('transactions_data')} onBack={onBack} />
            <div className="bg-[var(--bg-secondary)] rounded-lg divide-y divide-[var(--border-color)] border border-[var(--border-color)]">
                 <div className="p-4">
                     <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('default_brokerage')}</label>
                     <div className="flex items-center bg-[var(--bg-primary)] rounded px-2 border border-[var(--border-color)]">
                         <span className="text-[var(--text-secondary)]">R$</span>
                         <input 
                            type="number" 
                            value={preferences.defaultBrokerage} 
                            onChange={(e) => updatePreferences({ defaultBrokerage: parseFloat(e.target.value) })}
                            className="w-full bg-transparent p-2 outline-none font-bold"
                        />
                     </div>
                 </div>
                 <div className="p-4 flex justify-between items-center">
                     <span>{t('default_sort')}</span>
                     <select 
                        value={preferences.defaultSort} 
                        onChange={(e) => updatePreferences({ defaultSort: e.target.value as any })}
                        className="bg-transparent text-[var(--text-secondary)] outline-none text-right text-sm"
                    >
                        <option value="valueDesc">{t('sort_value_desc')}</option>
                        <option value="valueAsc">{t('sort_value_asc')}</option>
                        <option value="tickerAsc">{t('sort_ticker_asc')}</option>
                        <option value="performanceDesc">{t('sort_performance_desc')}</option>
                    </select>
                 </div>
                 <div className="p-4 flex justify-between items-center">
                        <span>{t('hide_cents')}</span>
                        <ToggleSwitch enabled={preferences.hideCents} setEnabled={(v) => updatePreferences({ hideCents: v })} />
                    </div>
            </div>
        </div>
     )
}

// --- Main Component ---
const MainMenu: React.FC<{ 
    setScreen: (screen: MenuScreen) => void; 
    onShowUpdateModal: () => void; 
    addToast: (message: string, type?: ToastMessage['type']) => void; 
}> = ({ setScreen, onShowUpdateModal, addToast }) => {
    const { t } = useI18n();
    
    const handleLogout = () => {
        if (window.confirm(t('logout_confirm'))) {
            addToast(t('toast_logging_out'), 'info');
            setTimeout(() => {
                localStorage.clear();
                window.location.reload();
            }, 1000);
        }
    };

    const menuItems = {
        general: [
            { label: t('my_profile'), icon: <UserIcon className="w-5 h-5" />, action: () => setScreen('profile') },
            { label: t('general'), icon: <SlidersIcon className="w-5 h-5" />, action: () => setScreen('general') },
            { label: t('appearance'), icon: <PaletteIcon className="w-5 h-5" />, action: () => setScreen('appearance') },
            { label: t('notifications'), icon: <BellIcon className="w-5 h-5" />, action: () => setScreen('notifications') },
            { label: t('security'), icon: <ShieldIcon className="w-5 h-5" />, action: () => setScreen('security') },
        ],
        data: [
             { label: t('transactions_data'), icon: <TransactionIcon className="w-5 h-5" />, action: () => setScreen('transactions') },
             { label: t('backup_restore'), icon: <DatabaseIcon className="w-5 h-5" />, action: () => setScreen('backup') },
             { label: t('api_connections'), icon: <LinkIcon className="w-5 h-5" />, action: () => setScreen('apiConnections') },
        ],
        app: [
             { label: t('check_for_update'), icon: <UpdateIcon className="w-5 h-5" />, action: onShowUpdateModal },
             { label: t('about_app'), icon: <InfoIcon className="w-5 h-5" />, action: () => setScreen('about') },
             { label: t('logout'), icon: <LogoutIcon className="w-5 h-5" />, action: handleLogout, isDestructive: true },
        ]
    };

    return (
        <>
            <h1 className="text-2xl font-bold mb-6">{t('nav_settings')}</h1>
            
            <div className="space-y-6 pb-20">
                 <p className="text-xs font-bold text-[var(--text-secondary)] uppercase ml-2">{t('general')}</p>
                 <div className="bg-[var(--bg-secondary)] rounded-lg divide-y divide-[var(--border-color)]">
                    {menuItems.general.map((item) => (
                         <button key={item.label} onClick={() => { item.action?.(); vibrate(); }} className={`w-full flex justify-between items-center py-3 px-4 text-left hover:bg-[var(--bg-tertiary-hover)] transition-colors first:rounded-t-lg last:rounded-b-lg`}>
                             <div className="flex items-center space-x-4">
                                <div className='text-[var(--accent-color)]'>{item.icon}</div>
                                <span>{item.label}</span>
                            </div>
                            <ChevronRightIcon className="text-gray-500" />
                        </button>
                     ))}
                </div>
                
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase ml-2 mt-2">{t('data')}</p>
                <div className="bg-[var(--bg-secondary)] rounded-lg divide-y divide-[var(--border-color)]">
                    {menuItems.data.map((item) => (
                         <button key={item.label} onClick={() => { item.action?.(); vibrate(); }} className={`w-full flex justify-between items-center py-3 px-4 text-left hover:bg-[var(--bg-tertiary-hover)] transition-colors first:rounded-t-lg last:rounded-b-lg`}>
                             <div className="flex items-center space-x-4">
                                <div className='text-[var(--accent-color)]'>{item.icon}</div>
                                <span>{item.label}</span>
                            </div>
                            <ChevronRightIcon className="text-gray-500" />
                        </button>
                     ))}
                </div>
                
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase ml-2 mt-2">{t('app')}</p>
                <div className="bg-[var(--bg-secondary)] rounded-lg divide-y divide-[var(--border-color)]">
                     {menuItems.app.map((item) => (
                         <button key={item.label} onClick={() => { item.action?.(); vibrate(); }} className={`w-full flex justify-between items-center py-3 px-4 text-left hover:bg-[var(--bg-tertiary-hover)] transition-colors first:rounded-t-lg last:rounded-b-lg ${item.isDestructive ? 'text-red-400' : ''}`}>
                             <div className="flex items-center space-x-4">
                                <div className={item.isDestructive ? '' : 'text-[var(--accent-color)]'}>{item.icon}</div>
                                <span>{item.label}</span>
                            </div>
                            <ChevronRightIcon className="text-gray-500" />
                        </button>
                     ))}
                </div>
            </div>
        </>
    );
};

const SettingsView: React.FC<{ addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ addToast }) => {
    const [screen, setScreen] = useState<MenuScreen>('main');
    const [showUpdateModal, setShowUpdateModal] = useState(false);

    const renderScreen = () => {
        const onBack = () => setScreen('main');
        switch (screen) {
            case 'main': return <MainMenu setScreen={setScreen} onShowUpdateModal={() => setShowUpdateModal(true)} addToast={addToast} />;
            case 'profile': return <UserProfileDetail onBack={onBack} addToast={addToast} />;
            case 'security': return <SecuritySettings onBack={onBack} addToast={addToast} />;
            case 'notifications': return <NotificationSettings onBack={onBack} />;
            case 'backup': return <BackupRestore onBack={onBack} addToast={addToast} />;
            case 'appearance': return <AppearanceSettings onBack={onBack} />;
            case 'general': return <GeneralSettings onBack={onBack} />;
            case 'transactions': return <TransactionSettings onBack={onBack} />;
            case 'apiConnections': return <ApiConnectionSettings onBack={onBack} addToast={addToast} />;
            case 'about': return <AboutApp onBack={onBack} />;
            default: return <MainMenu setScreen={setScreen} onShowUpdateModal={() => setShowUpdateModal(true)} addToast={addToast} />;
        }
    };

    return (
        <div className="p-4">
            <div key={screen} className="animate-fade-in">
                {renderScreen()}
            </div>
            {showUpdateModal && <UpdateCheckModal onClose={() => setShowUpdateModal(false)} />}
        </div>
    );
};

export default SettingsView;