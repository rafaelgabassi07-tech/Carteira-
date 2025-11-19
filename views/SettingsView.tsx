import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ToastMessage, AppColor, AppPreferences, SortOption, TransactionType } from '../types';
import UserIcon from '../components/icons/UserIcon';
import ShieldIcon from '../components/icons/ShieldIcon';
import UpdateIcon from '../components/icons/UpdateIcon';
import BellIcon from '../components/icons/BellIcon';
import DatabaseIcon from '../components/icons/DatabaseIcon';
import InfoIcon from '../components/icons/InfoIcon';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
import ThemeIcon from '../components/icons/ThemeIcon';
import DownloadIcon from '../components/icons/DownloadIcon';
import UploadIcon from '../components/icons/UploadIcon';
import ToggleSwitch from '../components/ToggleSwitch';
import PrivacyIcon from '../components/icons/PrivacyIcon';
import TermsIcon from '../components/icons/TermsIcon';
import Modal from '../components/modals/Modal';
import PageHeader from '../components/PageHeader';
import UpdateCheckModal from '../components/modals/UpdateCheckModal';
import { MOCK_USER_PROFILE } from '../constants';
import { usePersistentState, vibrate, copyToClipboard } from '../utils';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { Theme } from '../App';
import TransactionIcon from '../components/icons/TransactionIcon';
import LogoutIcon from '../components/icons/LogoutIcon';
import { validateApiKey } from '../services/geminiService';
import CloseIcon from '../components/icons/CloseIcon';

// Missing Icons
const PaletteIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>;
const SlidersIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/></svg>;
const CodeIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
const ZapIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const ServerIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>;
const BugIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>;

type MenuScreen = 'main' | 'profile' | 'security' | 'notifications' | 'backup' | 'about' | 'appearance' | 'general' | 'transactions' | 'advanced';

// --- Components ---
// ... [Previous components UserProfileDetail, ChangePasswordModal, TwoFactorAuthModal, SecuritySettings, NotificationSettings, BackupWrapper, AboutApp, AppearanceSettings, GeneralSettings, TransactionSettings remain unchanged]

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

const ChangePasswordModal: React.FC<{onClose: ()=>void, addToast: (message: string, type?: ToastMessage['type']) => void;}> = ({onClose, addToast}) => {
     const { t } = useI18n();
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const newPassword = formData.get('newPassword');
        const confirmPassword = formData.get('confirmPassword');
        
        if (newPassword !== confirmPassword) {
            addToast(t('toast_passwords_no_match'), 'error');
            return;
        }
        if ((newPassword as string).length < 6) {
            addToast(t('toast_password_too_short'), 'error');
            return;
        }

        addToast(t('toast_password_changed_success'), 'success');
        onClose();
    };

    return (
        <Modal title={t('change_password')} onClose={onClose} type="scale-in">
            <form className="space-y-4 text-sm text-[var(--text-secondary)]" onSubmit={handleSubmit}>
                <div>
                    <label className="text-xs">{t('current_password')}</label>
                    <input type="password" required className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 mt-1" />
                </div>
                 <div>
                    <label className="text-xs">{t('new_password')}</label>
                    <input name="newPassword" type="password" required className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 mt-1" />
                </div>
                 <div>
                    <label className="text-xs">{t('confirm_new_password')}</label>
                    <input name="confirmPassword" type="password" required className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 mt-1" />
                </div>
                <button type="submit" className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-2 rounded-lg">{t('save_changes')}</button>
            </form>
        </Modal>
    );
};

const TwoFactorAuthModal: React.FC<{onClose: ()=>void}> = ({onClose}) => {
    const { t } = useI18n();
    return (
     <Modal title={t('setup_2fa')} onClose={onClose} type="scale-in">
        <div className="text-center space-y-4 text-sm text-[var(--text-secondary)]">
            <p>{t('scan_qr_code')}</p>
            <div className="bg-white p-2 inline-block rounded-lg">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=otpauth://totp/InvestPortfolio:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=InvestPortfolio" alt="QR Code" />
            </div>
            <div>
                <p>{t('or_enter_key')}:</p>
                <p className="font-mono bg-[var(--bg-primary)] p-2 rounded-lg my-2 text-center tracking-widest">JBSW Y3DP EHPK 3PXP</p>
            </div>
             <button onClick={onClose} className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-2 rounded-lg mt-4">{t('done')}</button>
        </div>
    </Modal>
)};

const SecuritySettings: React.FC<{ onBack: () => void, addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ onBack, addToast }) => {
    const { t } = useI18n();
    const { updatePreferences, preferences } = usePortfolio();
    const [twoFa, setTwoFa] = usePersistentState('security-2fa', false);
    const [biometrics, setBiometrics] = usePersistentState('security-biometrics', false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [show2FAModal, setShow2FAModal] = useState(false);

    const handle2FAToggle = (enabled: boolean) => {
        if (enabled) {
            setShow2FAModal(true); 
        } else {
            setTwoFa(false);
            addToast(t('toast_2fa_disabled'), 'info');
        }
    };
    
    const handle2FAModalClose = () => {
        setShow2FAModal(false);
        setTwoFa(true); 
        addToast(t('toast_2fa_enabled'), 'success');
    };

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
                <div onClick={() => setShowPasswordModal(true)} className="p-4 flex justify-between items-center cursor-pointer hover:bg-[var(--bg-tertiary-hover)]"><span>{t('change_password')}</span> <ChevronRightIcon /></div>
                <div className="p-4 flex justify-between items-center">
                    <div>
                        <span>{t('2fa')}</span>
                        <p className={`text-xs ${twoFa ? 'text-green-400' : 'text-gray-400'}`}>{twoFa ? t('enabled') : t('disabled')}</p>
                    </div>
                    <ToggleSwitch enabled={twoFa} setEnabled={handle2FAToggle} />
                </div>
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
            </div>
            {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} addToast={addToast} />}
            {show2FAModal && <TwoFactorAuthModal onClose={handle2FAModalClose} />}
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

const BackupWrapper: React.FC<{ onBack: () => void; addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ onBack, addToast }) => {
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
                        const importedTxs: any[] = lines.filter(line => line.trim() !== '').map((line, index) => {
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
                {/* Accent Color */}
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

                {/* Theme */}
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

                {/* Font Size */}
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
                
                {/* Toggles */}
                <div className="bg-[var(--bg-secondary)] rounded-lg divide-y divide-[var(--border-color)] border border-[var(--border-color)]">
                    <div className="p-4 flex justify-between items-center">
                        <span>{t('compact_mode')}</span>
                        <ToggleSwitch enabled={preferences.compactMode} setEnabled={(v) => updatePreferences({ compactMode: v })} />
                    </div>
                    <div className="p-4 flex justify-between items-center">
                        <span>{t('show_currency')}</span>
                        <ToggleSwitch enabled={preferences.showCurrencySymbol} setEnabled={(v) => updatePreferences({ showCurrencySymbol: v })} />
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
                        <span>{t('hide_cents')}</span>
                        <ToggleSwitch enabled={preferences.hideCents} setEnabled={(v) => updatePreferences({ hideCents: v })} />
                    </div>
                     <div className="p-4 flex justify-between items-center">
                        <span>{t('haptic_feedback')}</span>
                        <ToggleSwitch enabled={preferences.hapticFeedback} setEnabled={(v) => updatePreferences({ hapticFeedback: v })} />
                    </div>
                     {preferences.hapticFeedback && (
                        <div className="p-4 flex justify-between items-center">
                            <span>{t('vibration_intensity')}</span>
                             <select 
                                value={preferences.vibrationIntensity} 
                                onChange={(e) => updatePreferences({ vibrationIntensity: e.target.value as any })}
                                className="bg-transparent text-[var(--text-secondary)] outline-none text-right text-sm"
                            >
                                <option value="light">{t('vibration_light')}</option>
                                <option value="medium">{t('vibration_medium')}</option>
                                <option value="heavy">{t('vibration_heavy')}</option>
                            </select>
                        </div>
                     )}
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
            </div>
        </div>
     )
}

const AdvancedSettings: React.FC<{ onBack: () => void, addToast: (message: string, type?: ToastMessage['type']) => void }> = ({ onBack, addToast }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences, resetApp, clearCache, lastSync, getRawData } = usePortfolio();
    const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline' | 'idle'>('idle');
    const [showRawData, setShowRawData] = useState(false);

    const checkStatus = useCallback(async (key?: string) => {
        setApiStatus('checking');
        const isWorking = await validateApiKey(key);
        setApiStatus(isWorking ? 'online' : 'offline');
    }, []);

    useEffect(() => {
        checkStatus(preferences.customApiKey);
    }, [checkStatus, preferences.customApiKey]);


    const handleReset = () => {
        if(window.confirm(t('reset_app_confirm'))) {
            resetApp();
        }
    };

    const handleClearSpecificCache = (key: string) => {
        clearCache(key);
        addToast(t('cache_cleared'), 'success');
    };
    
    const handleCopyDebug = async () => {
        const debugInfo = {
            version: '1.5.0',
            platform: navigator.userAgent,
            storage: usePortfolio().getStorageUsage(),
            prefs: { ...preferences, customApiKey: '***HIDDEN***', appPin: '***HIDDEN***' },
            lastSync
        };
        const success = await copyToClipboard(JSON.stringify(debugInfo, null, 2));
        if(success) addToast(t('debug_copied'), 'success');
    };

    return (
        <div>
            <PageHeader title={t('advanced')} onBack={onBack}/>
            <div className="space-y-6 pb-10">
                 {/* API Key */}
                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                             <CodeIcon className="w-5 h-5 text-[var(--accent-color)]"/>
                             <h3 className="font-bold">{t('api_key')}</h3>
                        </div>
                        <div className="flex gap-2 items-center">
                            {apiStatus !== 'idle' && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                    apiStatus === 'online' ? 'bg-green-500/20 text-green-400' : 
                                    apiStatus === 'offline' ? 'bg-red-500/20 text-red-400' : 
                                    'bg-yellow-500/20 text-yellow-400 animate-pulse'
                                }`}>
                                    {apiStatus === 'checking' ? t('adv_api_status_checking') : t(`adv_api_status_${apiStatus}`)}
                                </span>
                            )}
                        </div>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">{t('api_key_help')}</p>
                    <div className="mt-3 relative">
                        <input
                            type="password"
                            value={preferences.customApiKey}
                            onChange={(e) => updatePreferences({ customApiKey: e.target.value })}
                            placeholder={t('api_key_placeholder')}
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2 text-sm focus:outline-none focus:border-[var(--accent-color)] transition-colors pr-10"
                        />
                        {preferences.customApiKey && (
                             <button 
                                onClick={() => {
                                    updatePreferences({ customApiKey: '' });
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-white"
                             >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <button onClick={() => checkStatus(preferences.customApiKey)} className="mt-3 w-full text-center text-xs font-bold bg-[var(--bg-primary)] py-2 rounded hover:bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)]">
                        {t('adv_test_conn')}
                     </button>
                </div>
                
                {/* Performance & Animation */}
                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                    <div className="flex items-center space-x-2 mb-3">
                         <ZapIcon className="w-5 h-5 text-yellow-400"/>
                         <h3 className="font-bold">{t('perf_animation_speed')}</h3>
                    </div>
                    <div className="flex flex-col space-y-3">
                        <div className="flex justify-between text-xs text-[var(--text-secondary)] px-1">
                            <span>{t('anim_slow')}</span>
                            <span>{t('anim_normal')}</span>
                            <span>{t('anim_fast')}</span>
                            <span>{t('anim_instant')}</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="3" 
                            step="1"
                            value={preferences.animationSpeed === 'slow' ? 0 : preferences.animationSpeed === 'normal' ? 1 : preferences.animationSpeed === 'fast' ? 2 : 3}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                const speed = val === 0 ? 'slow' : val === 1 ? 'normal' : val === 2 ? 'fast' : 'instant';
                                updatePreferences({ animationSpeed: speed });
                            }}
                            className="w-full accent-[var(--accent-color)]"
                        />
                         <div className="flex justify-between items-center mt-2">
                            <span className="font-medium">{t('reduce_motion')}</span>
                            <ToggleSwitch enabled={preferences.reduceMotion} setEnabled={(v) => updatePreferences({ reduceMotion: v })}/>
                        </div>
                    </div>
                </div>

                {/* System Diagnostics */}
                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                     <div className="flex items-center space-x-2 mb-3">
                         <ServerIcon className="w-5 h-5 text-emerald-400"/>
                         <h3 className="font-bold">{t('system_diagnostics')}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-[var(--bg-primary)] p-2 rounded">
                            <p className="text-[var(--text-secondary)] text-xs">{t('diag_memory')}</p>
                            <p className="font-mono font-bold">{(usePortfolio().getStorageUsage() / 1024).toFixed(1)} KB</p>
                        </div>
                         <div className="bg-[var(--bg-primary)] p-2 rounded">
                            <p className="text-[var(--text-secondary)] text-xs">{t('adv_requests')}</p>
                            <p className="font-mono font-bold">{Math.floor(Math.random() * 50) + 5} (Sim)</p>
                        </div>
                        <div className="bg-[var(--bg-primary)] p-2 rounded col-span-2 flex justify-between items-center">
                             <div>
                                <p className="text-[var(--text-secondary)] text-xs">{t('diag_last_sync')}</p>
                                <p className="font-mono font-bold text-xs">
                                    {lastSync ? new Date(lastSync).toLocaleString() : 'Nunca'}
                                </p>
                             </div>
                             <button onClick={() => handleCopyDebug()} className="text-[var(--accent-color)] p-1 hover:bg-[var(--bg-secondary)] rounded" title="Copiar Log">
                                 <BugIcon className="w-4 h-4"/>
                             </button>
                        </div>
                    </div>
                    
                     <div className="mt-4 space-y-2">
                        <p className="text-xs font-bold uppercase text-[var(--text-secondary)] mb-2">{t('granular_cache')}</p>
                        
                        <div className="flex justify-between items-center bg-[var(--bg-primary)] p-2 rounded border border-[var(--border-color)]">
                            <span className="text-xs font-semibold">{t('adv_cache_prices')}</span>
                            <button onClick={() => handleClearSpecificCache('asset_prices')} className="bg-[var(--bg-tertiary-hover)] hover:bg-slate-600 px-3 py-1 rounded text-xs font-bold">{t('adv_cache_prices_btn')}</button>
                        </div>

                        <div className="flex justify-between items-center bg-[var(--bg-primary)] p-2 rounded border border-[var(--border-color)]">
                            <span className="text-xs font-semibold">{t('adv_cache_news')}</span>
                            <button onClick={() => handleClearSpecificCache('news_feed')} className="bg-[var(--bg-tertiary-hover)] hover:bg-slate-600 px-3 py-1 rounded text-xs font-bold">{t('adv_cache_news_btn')}</button>
                        </div>

                        <div className="flex justify-between items-center bg-[var(--bg-primary)] p-2 rounded border border-[var(--border-color)]">
                             <span className="text-xs font-semibold">{t('adv_cache_all')}</span>
                            <button onClick={() => handleClearSpecificCache('all')} className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-1 rounded text-xs font-bold border border-red-500/30">{t('adv_cache_all_btn')}</button>
                        </div>
                     </div>
                </div>
                
                {/* Experimental & Dev */}
                 <div className="flex justify-between items-center p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]">
                     <div className="flex items-center gap-2">
                        <div>
                            <p className="font-bold text-sm">{t('beta_features')}</p>
                            <p className="text-[10px] text-[var(--text-secondary)]">{t('beta_features_desc')}</p>
                        </div>
                     </div>
                     <ToggleSwitch enabled={preferences.betaFeatures} setEnabled={(v) => updatePreferences({ betaFeatures: v })}/>
                </div>

                 <div className="flex flex-col p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]">
                     <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-xs">{t('dev_mode_active')}</span>
                        </div>
                        <ToggleSwitch enabled={preferences.devMode} setEnabled={(v) => updatePreferences({ devMode: v })}/>
                     </div>
                     {preferences.devMode && (
                         <div className="mt-2 pt-2 border-t border-[var(--border-color)]">
                             <p className="text-[10px] text-[var(--text-secondary)] mb-2">{t('dev_mode_desc')}</p>
                             <button onClick={() => setShowRawData(true)} className="w-full py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded font-mono text-xs hover:bg-indigo-500/20">
                                 {t('adv_view_raw')}
                             </button>
                         </div>
                     )}
                </div>

                {/* Danger Zone */}
                <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/30">
                     <h3 className="font-bold text-red-400 mb-2 uppercase text-xs tracking-widest">{t('danger_zone')}</h3>
                     <div className="flex justify-between items-center">
                         <div>
                            <p className="font-bold text-sm">{t('reset_app')}</p>
                            <p className="text-xs text-red-300/70">{t('reset_warning')}</p>
                         </div>
                         <button onClick={handleReset} className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-2 rounded-lg text-xs">{t('reset_app')}</button>
                     </div>
                </div>
            </div>

            {/* Raw Data Modal */}
            {showRawData && (
                <Modal title="Data Inspector" onClose={() => setShowRawData(false)} type="scale-in">
                    <div className="p-1">
                        <p className="text-xs text-[var(--text-secondary)] mb-2">{t('adv_view_raw_desc')}</p>
                        <div className="bg-black text-green-400 font-mono text-[10px] p-2 rounded overflow-auto max-h-[60vh] border border-gray-800">
                            <pre>{JSON.stringify(getRawData(), null, 2)}</pre>
                        </div>
                        <button 
                            onClick={() => { copyToClipboard(JSON.stringify(getRawData(), null, 2)); addToast(t('debug_copied'), 'success'); }}
                            className="mt-4 w-full bg-[var(--bg-tertiary-hover)] py-2 rounded font-bold text-xs"
                        >
                            Copy JSON
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const MainMenu: React.FC<{ 
    setScreen: (screen: MenuScreen) => void; 
    onShowUpdateModal: () => void; 
    addToast: (message: string, type?: ToastMessage['type']) => void; 
    theme: Theme;
    setTheme: (theme: Theme) => void;
}> = ({ setScreen, onShowUpdateModal, addToast, theme, setTheme }) => {
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
             { label: t('advanced'), icon: <ServerIcon className="w-5 h-5" />, action: () => setScreen('advanced') },
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
            
            <div className="space-y-4 pb-20">
                 {/* General Section */}
                 <p className="text-xs font-bold text-[var(--text-secondary)] uppercase ml-2">Geral</p>
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
                
                {/* Data Section */}
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase ml-2 mt-2">Dados</p>
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
                
                {/* App Section */}
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase ml-2 mt-2">Aplicativo</p>
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

interface SettingsViewProps {
    addToast: (message: string, type?: ToastMessage['type']) => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ addToast, theme, setTheme }) => {
    const [screen, setScreen] = useState<MenuScreen>('main');
    const [showUpdateModal, setShowUpdateModal] = useState(false);

    const renderScreen = () => {
        const onBack = () => setScreen('main');
        switch (screen) {
            case 'main': return <MainMenu setScreen={setScreen} onShowUpdateModal={() => setShowUpdateModal(true)} addToast={addToast} theme={theme} setTheme={setTheme} />;
            case 'profile': return <UserProfileDetail onBack={onBack} addToast={addToast} />;
            case 'security': return <SecuritySettings onBack={onBack} addToast={addToast} />;
            case 'notifications': return <NotificationSettings onBack={onBack} />;
            case 'backup': return <BackupWrapper onBack={onBack} addToast={addToast} />;
            case 'appearance': return <AppearanceSettings onBack={onBack} />;
            case 'general': return <GeneralSettings onBack={onBack} />;
            case 'transactions': return <TransactionSettings onBack={onBack} />;
            case 'advanced': return <AdvancedSettings onBack={onBack} addToast={addToast} />;
            case 'about': return <AboutApp onBack={onBack} />;
            default: return <MainMenu setScreen={setScreen} onShowUpdateModal={() => setShowUpdateModal(true)} addToast={addToast} theme={theme} setTheme={setTheme} />;
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