


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
import LogoutIcon from '../icons/LogoutIcon';
import ChevronRightIcon from '../icons/ChevronRightIcon';
import SparklesIcon from '../icons/SparklesIcon';
import CalculatorIcon from '../icons/CalculatorIcon';
import BookOpenIcon from '../icons/BookOpenIcon';
import UpdateIcon from '../icons/UpdateIcon';

const MenuItem: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; isLast?: boolean; hasNotification?: boolean; }> = ({ icon, title, subtitle, onClick, isLast, hasNotification }) => (
    <div
        onClick={() => { onClick(); vibrate(); }}
        className={`menu-item flex items-center space-x-4 p-4 hover:bg-[var(--bg-tertiary-hover)] transition-colors duration-200 cursor-pointer active:scale-[0.98] ${!isLast ? 'border-b border-[var(--border-color)]' : ''}`}
    >
        <div className="menu-icon flex-shrink-0 w-12 h-12 grid place-items-center bg-[var(--bg-primary)] text-[var(--accent-color)] rounded-xl shadow-sm border border-[var(--border-color)] relative">
            {icon}
            {hasNotification && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-color)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--accent-color)]"></span>
                </span>
            )}
        </div>
        <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate text-[var(--text-primary)]">{title}</p>
            <p className="text-xs text-[var(--text-secondary)] truncate">{subtitle}</p>
        </div>
        <ChevronRightIcon className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
    </div>
);

// @google/genai-api-fix: Add onShowUpdateModal and updateAvailable to props.
interface MainMenuProps {
    setScreen: (screen: MenuScreen) => void;
    addToast: (message: string, type?: ToastMessage['type']) => void;
    onShowUpdateModal: () => void;
    updateAvailable?: boolean;
}

const MainMenu: React.FC<MainMenuProps> = ({ setScreen, addToast, onShowUpdateModal, updateAvailable }) => {
    const { t } = useI18n();
    const { userProfile, resetApp } = usePortfolio();

    const accountItems = [
        { screen: 'profile', icon: <UserIcon />, title: t('my_profile'), subtitle: userProfile.name },
        { screen: 'security', icon: <ShieldIcon />, title: t('security'), subtitle: t('app_lock_pin') + ", " + t('biometric_login') },
    ];

    const personalizationItems = [
        { screen: 'appearance', icon: <PaletteIcon />, title: t('appearance'), subtitle: t('themes_subtitle') },
        { screen: 'general', icon: <SettingsIcon />, title: t('general'), subtitle: t('start_screen') + ", " + t('haptic_feedback') },
        { screen: 'notifications', icon: <BellIcon />, title: t('notifications'), subtitle: t('price_alerts') + ", " + t('dividend_announcements') },
    ];

    const dataItems = [
        { screen: 'transactions', icon: <TransactionIcon />, title: t('transactions_data'), subtitle: t('default_brokerage') + ", " + t('default_sort') },
        { screen: 'apiConnections', icon: <SparklesIcon />, title: t('api_connections'), subtitle: t('api_connections_desc') },
        { screen: 'backup', icon: <DatabaseIcon />, title: t('backup_restore'), subtitle: t('export_data_json') + ", " + t('import_data') },
    ];
    
    // @google/genai-api-fix: Add "Check for Updates" menu item.
    const toolsItems = [
        { screen: 'calculators', icon: <CalculatorIcon />, title: t('calculators'), subtitle: t('calculators_help') },
        { screen: 'glossary', icon: <BookOpenIcon />, title: t('financial_glossary'), subtitle: t('glossary_subtitle') },
        { screen: 'update', icon: <UpdateIcon />, title: t('check_for_update'), subtitle: updateAvailable ? t('new_version_available') : t('channel_stable')},
        { screen: 'about', icon: <InfoIcon />, title: t('about_app'), subtitle: t('version') + ", " + t('terms_of_service') },
    ];

    return (
        <div className="space-y-6">
            {/* Account Category */}
            <div>
                <h3 className="px-4 pb-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('settings_category_account')}</h3>
                <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
                    {accountItems.map((item, index) => (
                        <MenuItem
                            key={item.screen}
                            icon={item.icon}
                            title={item.title}
                            subtitle={item.subtitle}
                            onClick={() => setScreen(item.screen as MenuScreen)}
                            isLast={index === accountItems.length - 1}
                        />
                    ))}
                </div>
            </div>

            {/* Personalization Category */}
            <div>
                <h3 className="px-4 pb-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('settings_category_personalization')}</h3>
                <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
                    {personalizationItems.map((item, index) => (
                        <MenuItem
                            key={item.screen}
                            icon={item.icon}
                            title={item.title}
                            subtitle={item.subtitle}
                            onClick={() => setScreen(item.screen as MenuScreen)}
                            isLast={index === personalizationItems.length - 1}
                        />
                    ))}
                </div>
            </div>
            
             {/* Data Category */}
            <div>
                <h3 className="px-4 pb-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('settings_category_data_integrations')}</h3>
                <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
                    {dataItems.map((item, index) => (
                        <MenuItem
                            key={item.screen}
                            icon={item.icon}
                            title={item.title}
                            subtitle={item.subtitle}
                            onClick={() => setScreen(item.screen as MenuScreen)}
                            isLast={index === dataItems.length - 1}
                        />
                    ))}
                </div>
            </div>
            
            {/* Tools Category */}
            <div>
                <h3 className="px-4 pb-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('settings_category_tools_info')}</h3>
                <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
                    {toolsItems.map((item, index) => (
                        <MenuItem
                            key={item.screen}
                            icon={item.icon}
                            title={item.title}
                            subtitle={item.subtitle}
                            // @google/genai-api-fix: Handle click for update item.
                            onClick={() => {
                                if (item.screen === 'update') {
                                    onShowUpdateModal();
                                } else {
                                    setScreen(item.screen as MenuScreen)
                                }
                            }}
                            isLast={index === toolsItems.length - 1}
                            hasNotification={item.screen === 'update' && updateAvailable}
                        />
                    ))}
                </div>
            </div>

             <div className="p-2 space-y-2">
                <button onClick={resetApp} className="w-full flex items-center justify-center gap-2 text-center text-xs font-bold text-red-500/80 hover:text-red-500 p-3 rounded-lg hover:bg-red-500/10 transition-colors">
                    <LogoutIcon className="w-4 h-4" />
                    {t('logout')}
                </button>
            </div>
        </div>
    );
};

export default MainMenu;