
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


const MenuItem: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; }> = ({ icon, title, subtitle, onClick }) => (
    <div
        onClick={() => { onClick(); vibrate(); }}
        className="flex items-center space-x-4 p-4 rounded-xl hover:bg-[var(--bg-tertiary-hover)] transition-colors duration-200 cursor-pointer active:scale-[0.98]"
    >
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--bg-secondary)] text-[var(--accent-color)] shadow-sm">
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-[var(--text-primary)] truncate">{title}</p>
            <p className="text-xs text-[var(--text-secondary)] truncate">{subtitle}</p>
        </div>
        <ChevronRightIcon className="w-5 h-5 text-[var(--text-secondary)]" />
    </div>
);

const MainMenu: React.FC<{ setScreen: (screen: MenuScreen) => void; onShowUpdateModal: () => void; addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ setScreen, onShowUpdateModal, addToast }) => {
    const { t } = useI18n();
    // FIX: Destructure userProfile from the context instead of MOCK_USER_PROFILE.
    const { userProfile: user } = usePortfolio();

    const handleLogout = () => {
        if (window.confirm(t('logout_confirm'))) {
            addToast(t('toast_logging_out'));
            // In a real app, you would clear auth tokens here.
            // For this app, it might not do much, but it's good practice.
        }
    };

    return (
        <div>
            <div className="flex items-center space-x-4 mb-8 p-2">
                <img src={user.avatarUrl} alt="User Avatar" className="w-16 h-16 rounded-full border-2 border-[var(--accent-color)] shadow-lg" />
                <div>
                    <h1 className="text-2xl font-bold">{user.name}</h1>
                    <p className="text-sm text-[var(--text-secondary)]">{user.email}</p>
                </div>
            </div>

            <div className="space-y-2">
                {/* App Section */}
                <h3 className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider px-4 pt-4 pb-2">{t('app')}</h3>
                <MenuItem icon={<ThemeIcon className="w-5 h-5" />} title={t('appearance')} subtitle={t('accent_color') + ', ' + t('system_theme') + '...'} onClick={() => setScreen('appearance')} />
                <MenuItem icon={<SettingsIcon className="w-5 h-5" />} title={t('general')} subtitle={t('start_screen') + ', ' + t('haptic_feedback') + '...'} onClick={() => setScreen('general')} />
                <MenuItem icon={<ShieldIcon className="w-5 h-5" />} title={t('security')} subtitle={t('app_lock_pin') + ', ' + t('biometric_login') + '...'} onClick={() => setScreen('security')} />
                <MenuItem icon={<BellIcon className="w-5 h-5" />} title={t('notifications')} subtitle={t('price_alerts') + ', ' + t('dividend_announcements') + '...'} onClick={() => setScreen('notifications')} />
                
                {/* Data Section */}
                <h3 className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider px-4 pt-6 pb-2">{t('data')}</h3>
                 <MenuItem icon={<SparklesIcon className="w-5 h-5" />} title={t('api_connections')} subtitle={t('api_connections_desc')} onClick={() => setScreen('apiConnections')} />
                <MenuItem icon={<TransactionIcon className="w-5 h-5" />} title={t('transactions_data')} subtitle={t('default_brokerage') + ', ' + t('default_sort') + '...'} onClick={() => setScreen('transactions')} />
                <MenuItem icon={<DatabaseIcon className="w-5 h-5" />} title={t('backup_restore')} subtitle={t('help_backup')} onClick={() => setScreen('backup')} />
                
                 {/* About Section */}
                 <h3 className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider px-4 pt-6 pb-2">{t('about_app')}</h3>
                 <MenuItem icon={<UpdateIcon className="w-5 h-5" />} title={t('check_for_update')} subtitle={t('version') + ' 1.5.0'} onClick={onShowUpdateModal} />
                 <MenuItem icon={<InfoIcon className="w-5 h-5" />} title={t('about_app')} subtitle={t('help_about')} onClick={() => setScreen('about')} />
            </div>

            <div className="mt-8">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center space-x-2 p-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                >
                    <LogoutIcon className="w-5 h-5" />
                    <span className="font-bold text-sm">{t('logout')}</span>
                </button>
            </div>
        </div>
    );
};

export default MainMenu;
