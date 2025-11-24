import React, { useState, useEffect } from 'react';
import type { ToastMessage } from '../types';
import { useI18n } from '../contexts/I18nContext';

// Import sub-components
import MainMenu from '../components/settings/MainMenu';
import UserProfileDetail from '../components/settings/UserProfileDetail';
import SecuritySettings from '../components/settings/SecuritySettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import BackupRestore from '../components/settings/BackupRestore';
import AboutApp from '../components/settings/AboutApp';
import AppearanceSettings from '../components/settings/AppearanceSettings';
import GeneralSettings from '../components/settings/GeneralSettings';
import TransactionSettings from '../components/settings/TransactionSettings';
import ApiConnectionSettings from '../components/settings/ApiConnectionSettings';
import UpdateCheckModal from '../components/modals/UpdateCheckModal';
import GlossaryView from './GlossaryView';
import CalculatorsView from './CalculatorsView';
import ThemeStoreView from './ThemeStoreView';

export type MenuScreen = 'main' | 'profile' | 'security' | 'notifications' | 'backup' | 'about' | 'appearance' | 'general' | 'transactions' | 'apiConnections' | 'glossary' | 'calculators' | 'themeGallery';

interface SettingsViewProps {
    addToast: (message: string, type?: ToastMessage['type']) => void;
    initialScreen?: MenuScreen;
}

const SettingsView: React.FC<SettingsViewProps> = ({ addToast, initialScreen = 'main' }) => {
    const [screen, setScreen] = useState<MenuScreen>(initialScreen);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const { t } = useI18n();

    const activeDesktopScreen = screen === 'main' ? 'appearance' : screen;

    const getScreenComponent = (currentScreen: MenuScreen) => {
        const onBack = () => setScreen('main');
        
        switch (currentScreen) {
            case 'main': return <MainMenu setScreen={setScreen} activeScreen={screen} onShowUpdateModal={() => setShowUpdateModal(true)} addToast={addToast} />;
            case 'profile': return <UserProfileDetail onBack={onBack} addToast={addToast} />;
            case 'security': return <SecuritySettings onBack={onBack} addToast={addToast} />;
            case 'notifications': return <NotificationSettings onBack={onBack} />;
            case 'backup': return <BackupRestore onBack={onBack} addToast={addToast} />;
            case 'appearance': return <AppearanceSettings onBack={onBack} />;
            case 'general': return <GeneralSettings onBack={onBack} />;
            case 'transactions': return <TransactionSettings onBack={onBack} />;
            case 'apiConnections': return <ApiConnectionSettings onBack={onBack} addToast={addToast} />;
            case 'about': return <AboutApp onBack={onBack} />;
            case 'glossary': return <GlossaryView onBack={onBack} />;
            case 'calculators': return <CalculatorsView onBack={onBack} />;
            case 'themeGallery': return <ThemeStoreView onBack={onBack} />;
            default: return <MainMenu setScreen={setScreen} activeScreen={screen} onShowUpdateModal={() => setShowUpdateModal(true)} addToast={addToast} />;
        }
    };
    
    const animationClass = screen === 'main' ? 'animate-fade-in' : 'animate-slide-in-right';

    return (
        <div className="p-4 pb-24 md:pb-6 h-full overflow-y-auto custom-scrollbar landscape-pb-6">
             <div className="max-w-7xl mx-auto h-full">
                <h1 className="text-2xl font-bold mb-6 px-1 animate-fade-in lg:mb-8">{t('nav_settings')}</h1>
                
                <div className="lg:grid lg:grid-cols-12 lg:gap-8 h-full">
                    
                    <div className={`lg:col-span-4 lg:block ${screen !== 'main' ? 'hidden' : 'block'}`}>
                        <div className="lg:sticky lg:top-0">
                            <MainMenu 
                                setScreen={setScreen} 
                                activeScreen={activeDesktopScreen} 
                                onShowUpdateModal={() => setShowUpdateModal(true)} 
                                addToast={addToast} 
                            />
                        </div>
                    </div>

                    <div className={`lg:col-span-8 lg:block ${screen === 'main' ? 'hidden' : 'block'}`}>
                        <div className={`bg-[var(--bg-secondary)]/50 lg:bg-[var(--bg-secondary)] lg:border border-[var(--border-color)] lg:p-8 lg:rounded-3xl lg:shadow-sm h-full ${animationClass} lg:animate-fade-in`}>
                            <div key={activeDesktopScreen}>
                                {getScreenComponent(window.innerWidth >= 1024 ? activeDesktopScreen : screen)}
                            </div>
                        </div>
                    </div>
                </div>
             </div>
            {showUpdateModal && <UpdateCheckModal onClose={() => setShowUpdateModal(false)} />}
        </div>
    );
};

export default SettingsView;