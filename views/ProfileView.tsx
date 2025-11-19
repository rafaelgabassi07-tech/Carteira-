import React, { useState, useMemo, useRef } from 'react';
// FIX: Imported `TransactionType` to resolve the 'Cannot find name' error.
import type { ToastMessage, Transaction, TransactionType } from '../types';
import UserIcon from '../components/icons/UserIcon';
import ShieldIcon from '../components/icons/ShieldIcon';
import CalculatorIcon from '../components/icons/CalculatorIcon';
import UpdateIcon from '../components/icons/UpdateIcon';
import BellIcon from '../components/icons/BellIcon';
import DatabaseIcon from '../components/icons/DatabaseIcon';
import InfoIcon from '../components/icons/InfoIcon';
import LogoutIcon from '../components/icons/LogoutIcon';
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
import { usePersistentState, vibrate } from '../utils';
import { useI18n } from '../contexts/I18nContext';
import { Theme } from '../App';
import { usePortfolio } from '../contexts/PortfolioContext';

type MenuScreen = 'main' | 'profile' | 'security' | 'notifications' | 'backup' | 'about';

// --- Sub-screen components ---
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
            try {
                const creds = navigator.credentials as any;
                if (creds && typeof creds.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
                    const isSupported = await creds.isUserVerifyingPlatformAuthenticatorAvailable();
                    if (isSupported) {
                        setBiometrics(true);
                        addToast(t('toast_biometric_enabled'), 'success');
                    } else {
                        addToast(t('toast_biometric_not_supported'), 'error');
                    }
                } else {
                    addToast(t('toast_biometric_not_supported'), 'error');
                }
            } catch (error) {
                addToast(t('toast_biometric_not_supported'), 'error');
            }
        } else {
            setBiometrics(false);
            addToast(t('toast_biometric_disabled'), 'info');
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
                <p className="text-sm text-[var(--text-secondary)]">{t('version')} 1.4.0</p>
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

// --- Main Menu ---
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
        account: [
            { label: t('my_profile'), icon: <UserIcon className="w-5 h-5" />, action: () => setScreen('profile') },
            { label: t('security'), icon: <ShieldIcon className="w-5 h-5" />, action: () => setScreen('security') },
            { label: t('notifications'), icon: <BellIcon className="w-5 h-5" />, action: () => setScreen('notifications') },
        ],
        settings: [
            { label: t('theme'), icon: <ThemeIcon className="w-5 h-5" />, isToggle: true, toggleState: theme === 'dark', onToggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
            { label: t('check_for_update'), icon: <UpdateIcon className="w-5 h-5" />, action: onShowUpdateModal },
        ],
        data: [
             { label: t('backup_restore'), icon: <DatabaseIcon className="w-5 h-5" />, action: () => setScreen('backup') },
        ],
        general: [
            { label: t('about_app'), icon: <InfoIcon className="w-5 h-5" />, action: () => setScreen('about') },
            { label: t('logout'), icon: <LogoutIcon className="w-5 h-5" />, action: handleLogout, isDestructive: true },
        ]
    };

    return (
        <>
            <h1 className="text-2xl font-bold mb-6">{t('nav_settings')}</h1>
            
            <div className="space-y-4">
                 <div className="bg-[var(--bg-secondary)] rounded-lg divide-y divide-[var(--border-color)]">
                    {menuItems.account.map((item) => (
                         <button key={item.label} onClick={() => { item.action?.(); vibrate(); }} className={`w-full flex justify-between items-center py-3 px-4 text-left hover:bg-[var(--bg-tertiary-hover)] transition-colors first:rounded-t-lg last:rounded-b-lg`}>
                             <div className="flex items-center space-x-4">
                                <div className='text-[var(--accent-color)]'>{item.icon}</div>
                                <span>{item.label}</span>
                            </div>
                            <ChevronRightIcon className="text-gray-500" />
                        </button>
                     ))}
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg divide-y divide-[var(--border-color)]">
                    {menuItems.settings.map((item) => {
                         return (
                            <div key={item.label} className="w-full flex justify-between items-center py-3 px-4 text-left">
                                <button onClick={() => { item.action?.(); vibrate(); }} className="flex-grow flex items-center space-x-4">
                                    <div className="text-[var(--accent-color)]">{item.icon}</div>
                                    <span>{item.label}</span>
                                </button>
                                <div className="flex items-center space-x-2">
                                    {item.isToggle ? <ToggleSwitch enabled={item.toggleState || false} setEnabled={item.onToggle || (() => {})} /> : (item.action ? <ChevronRightIcon className="text-gray-500" /> : null)}
                                </div>
                            </div>
                        )
                    })}
                </div>
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
                <div className="bg-[var(--bg-secondary)] rounded-lg divide-y divide-[var(--border-color)]">
                     {menuItems.general.map((item) => (
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

// --- Main View Component ---
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
            case 'backup': return <BackupRestore onBack={onBack} addToast={addToast} />;
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