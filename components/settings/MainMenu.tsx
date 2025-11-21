import React from 'react';
import type { MenuScreen } from '../../views/SettingsView';
import type { ToastMessage } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { vibrate } from '../../utils';

// Icons
import UserIcon from '../icons/UserIcon';
import ShieldIcon from '../icons/ShieldIcon';
import BellIcon from '../icons/BellIcon';
import DatabaseIcon from '../icons/DatabaseIcon';
import InfoIcon from '../icons/InfoIcon';
import ThemeIcon from '../icons/ThemeIcon';
import SettingsIcon from '../icons/SettingsIcon';
import TransactionIcon from '../icons/TransactionIcon';
import UpdateIcon from '../icons/UpdateIcon';
import LogoutIcon from '../icons/LogoutIcon';
import ChevronRightIcon from '../icons/ChevronRightIcon';
import SparklesIcon from '../icons/SparklesIcon';


const MenuItem: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; isLast?: boolean; }> = ({ icon, title, subtitle, onClick, isLast }) => (
    <div
        onClick={() => { onClick(); vibrate(); }}
        className={`flex items-center space-x-4 p-4 hover:bg-[var(--bg-tertiary-hover)] transition-colors duration-200 cursor-pointer active:scale-[0.98] ${!isLast ? 'border-b border-[var(--border-color)]' : ''}`}
    >
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm">
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-[var(--text-primary)] truncate">{title}</p>
            <p className="text-xs text-[var(--text-secondary)] truncate">{subtitle}</p>
        </div>
        <ChevronRightIcon className="w-5 h-5 text-[var(--text-secondary)]" />
    </div>
);

const SectionHeader: React.FC<{title: string}> = ({title}) => (
    <h3 className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider px-4 pt-4 pb-1">{title}</h3>
);


const MainMenu: React.FC<{ setScreen: (screen: MenuScreen) => void; onShowUpdateModal: () => void; addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ setScreen, onShowUpdateModal, addToast }) => {
    const { t } = useI18n();
    const { userProfile: user } = usePortfolio();

    const handleLogout = () => {
        if (window.confirm(t('logout_confirm'))) {
            addToast(t('toast_logging_out'));
        }
    };

    return (
        <div>
            <div onClick={() => { setScreen('profile'); vibrate(); }} className="bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] p-4 rounded-2xl flex items-center space-x-4 mb-8 border border-[var(--border-color)] cursor-pointer hover:border-[var(--accent-color)]/30 transition-all active:scale-[0.98] shadow-lg">
                <img src={user.avatarUrl} alt="User Avatar" className="w-14 h-14 rounded-full border-2 border-[var(--accent-color)]" />
                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold truncate">{user.name}</h2>
                    <p className="text-sm text-[var(--text-secondary)]">{t('my_profile')}</p>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors" />
            </div>

            <div className="space-y-6">
                <div>
                    <SectionHeader title={t('app')} />
                    <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                        <MenuItem icon={<ThemeIcon className="w-5 h-5" />} title={t('appearance')} subtitle={t('accent_color') + ', ' + t('system_theme') + '...'} onClick={() => setScreen('appearance')} />
                        <MenuItem icon={<SettingsIcon className="w-5 h-5" />} title={t('general')} subtitle={t('start_screen') + ', ' + t('haptic_feedback') + '...'} onClick={() => setScreen('general')} />
                        <MenuItem icon={<ShieldIcon className="w-5 h-5" />} title={t('security')} subtitle={t('app_lock_pin') + ', ' + t('biometric_login') + '...'} onClick={() => setScreen('security')} />
                        <MenuItem icon={<BellIcon className="w-5 h-5" />} title={t('notifications')} subtitle={t('price_alerts') + ', ' + t('dividend_announcements') + '...'} onClick={() => setScreen('notifications')} isLast />
                    </div>
                </div>

                <div>
                    <SectionHeader title={t('data')} />
                     <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                        <MenuItem icon={<SparklesIcon className="w-5 h-5" />} title={t('api_connections')} subtitle={t('api_connections_desc')} onClick={() => setScreen('apiConnections')} />
                        <MenuItem icon={<TransactionIcon className="w-5 h-5" />} title={t('transactions_data')} subtitle={t('default_brokerage') + ', ' + t('default_sort') + '...'} onClick={() => setScreen('transactions')} />
                        <MenuItem icon={<DatabaseIcon className="w-5 h-5" />} title={t('backup_restore')} subtitle={t('help_backup')} onClick={() => setScreen('backup')} isLast />
                    </div>
                </div>
                
                <div>
                    <SectionHeader title={t('about_app')} />
                     <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                        <MenuItem icon={<UpdateIcon className="w-5 h-5" />} title={t('check_for_update')} subtitle={t('version') + ' 1.5.0'} onClick={onShowUpdateModal} />
                        <MenuItem icon={<InfoIcon className="w-5 h-5" />} title={t('about_app')} subtitle={t('help_about')} onClick={() => setScreen('about')} isLast />
                    </div>
                </div>
            </div>

            <div className="mt-8">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center space-x-2 p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
                >
                    <LogoutIcon className="w-5 h-5" />
                    <span className="font-bold text-sm">{t('logout')}</span>
                </button>
            </div>
        </div>
    );
};

export default MainMenu;