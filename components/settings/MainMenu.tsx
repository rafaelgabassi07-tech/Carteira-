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
import PaletteIcon from '../icons/PaletteIcon';
import SettingsIcon from '../icons/SettingsIcon';
import TransactionIcon from '../icons/TransactionIcon';
import UpdateIcon from '../icons/UpdateIcon';
import LogoutIcon from '../icons/LogoutIcon';
import ChevronRightIcon from '../icons/ChevronRightIcon';
import SparklesIcon from '../icons/SparklesIcon';
import BookOpenIcon from '../icons/BookOpenIcon';
import CalculatorIcon from '../icons/CalculatorIcon';


const MenuItem: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; isLast?: boolean; isActive?: boolean }> = ({ icon, title, subtitle, onClick, isLast, isActive }) => (
    <div
        onClick={() => { onClick(); vibrate(); }}
        className={`flex items-center space-x-4 p-4 hover:bg-[var(--bg-tertiary-hover)] transition-colors duration-200 cursor-pointer active:scale-[0.98] ${!isLast ? 'border-b border-[var(--border-color)]' : ''} ${isActive ? 'bg-[var(--bg-tertiary-hover)] border-l-4 border-l-[var(--accent-color)]' : 'border-l-4 border-l-transparent'}`}
    >
        <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg shadow-sm transition-colors ${isActive ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)]' : 'bg-[var(--bg-primary)] text-[var(--accent-color)]'}`}>
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm truncate ${isActive ? 'text-[var(--accent-color)]' : 'text-[var(--text-primary)]'}`}>{title}</p>
            <p className="text-xs text-[var(--text-secondary)] truncate">{subtitle}</p>
        </div>
        <ChevronRightIcon className={`w-5 h-5 ${isActive ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`} />
    </div>
);

const SectionHeader: React.FC<{title: string}> = ({title}) => (
    <h3 className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider px-4 pt-4 pb-1">{title}</h3>
);


const MainMenu: React.FC<{ setScreen: (screen: MenuScreen) => void; activeScreen?: MenuScreen; onShowUpdateModal: () => void; addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ setScreen, activeScreen, onShowUpdateModal, addToast }) => {
    const { t } = useI18n();
    const { userProfile: user, resetApp } = usePortfolio();

    const handleLogout = () => {
        vibrate();
        resetApp();
    };

    return (
        <div>
            <div onClick={() => { setScreen('profile'); vibrate(); }} className={`bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] p-4 rounded-2xl flex items-center space-x-4 mb-8 border cursor-pointer hover:border-[var(--accent-color)]/30 transition-all active:scale-[0.98] shadow-lg ${activeScreen === 'profile' ? 'border-[var(--accent-color)] ring-1 ring-[var(--accent-color)]/50' : 'border-[var(--border-color)]'}`}>
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
                        <MenuItem isActive={activeScreen === 'appearance'} icon={<PaletteIcon className="w-5 h-5" />} title={t('themes')} subtitle={t('themes_subtitle')} onClick={() => setScreen('appearance')} />
                        <MenuItem isActive={activeScreen === 'general'} icon={<SettingsIcon className="w-5 h-5" />} title={t('general')} subtitle={t('start_screen') + ', ' + t('haptic_feedback') + '...'} onClick={() => setScreen('general')} />
                        <MenuItem isActive={activeScreen === 'security'} icon={<ShieldIcon className="w-5 h-5" />} title={t('security')} subtitle={t('app_lock_pin') + ', ' + t('biometric_login') + '...'} onClick={() => setScreen('security')} />
                        <MenuItem isActive={activeScreen === 'notifications'} icon={<BellIcon className="w-5 h-5" />} title={t('notifications')} subtitle={t('price_alerts') + ', ' + t('dividend_announcements') + '...'} onClick={() => setScreen('notifications')} isLast />
                    </div>
                </div>

                <div>
                    <SectionHeader title={t('data')} />
                     <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                        <MenuItem isActive={activeScreen === 'apiConnections'} icon={<SparklesIcon className="w-5 h-5" />} title={t('api_connections')} subtitle={t('api_connections_desc')} onClick={() => setScreen('apiConnections')} />
                        <MenuItem isActive={activeScreen === 'transactions'} icon={<TransactionIcon className="w-5 h-5" />} title={t('transactions_data')} subtitle={t('default_brokerage') + ', ' + t('default_sort') + '...'} onClick={() => setScreen('transactions')} />
                        <MenuItem isActive={activeScreen === 'backup'} icon={<DatabaseIcon className="w-5 h-5" />} title={t('backup_restore')} subtitle={t('help_backup')} onClick={() => setScreen('backup')} isLast />
                    </div>
                </div>
                
                <div>
                    <SectionHeader title={t('about_app')} />
                     <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                        <MenuItem isActive={activeScreen === 'calculators'} icon={<CalculatorIcon className="w-5 h-5" />} title={t('calculators')} subtitle={t('calculators_help')} onClick={() => setScreen('calculators')} />
                        <MenuItem isActive={activeScreen === 'glossary'} icon={<BookOpenIcon className="w-5 h-5" />} title={t('financial_glossary')} subtitle={t('glossary_subtitle')} onClick={() => setScreen('glossary')} />
                        <MenuItem icon={<UpdateIcon className="w-5 h-5" />} title={t('check_for_update')} subtitle={t('version') + ' 1.6.0'} onClick={onShowUpdateModal} />
                        <MenuItem isActive={activeScreen === 'about'} icon={<InfoIcon className="w-5 h-5" />} title={t('about_app')} subtitle={t('help_about')} onClick={() => setScreen('about')} isLast />
                    </div>
                </div>
            </div>

            <div className="mt-8 lg:mb-8">
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