
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

export type MenuScreen = 'main' | 'profile' | 'security' | 'notifications' | 'backup' | 'about' | 'appearance' | 'general' | 'transactions' | 'apiConnections' | 'glossary' | 'calculators';

interface SettingsViewProps {
    addToast: (message: string, type?: ToastMessage['type']) => void;
    initialScreen?: MenuScreen;
}

const SettingsView: React.FC<SettingsViewProps> = ({ addToast, initialScreen = 'main' }) => {
    const [screen, setScreen] = useState<MenuScreen>(initialScreen);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const { t } = useI18n();
    
    useEffect(() => {
        setScreen(initialScreen);
    }, [initialScreen]);

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
            case 'calculators': return <div className="-m-4 h-full"><CalculatorsView onBack={onBack} /></div>;
            case 'glossary': return <div className="-m-4 h-full"><GlossaryView onBack={onBack} /></div>;
            default: return <MainMenu setScreen={setScreen} onShowUpdateModal={() => setShowUpdateModal(true)} addToast={addToast} />;
        }
    };
    
    const animationClass = screen === 'main' ? 'animate-fade-in' : 'animate-slide-in-right';

    return (
        <div className="p-4 pb-24 md:pb-6 h-full overflow-y-auto custom-scrollbar landscape-pb-6">
             <div className="max-w-2xl mx-auto">
                {screen === 'main' && (
                    <h1 className="text-2xl font-bold mb-4 px-1 animate-fade-in">{t('nav_settings')}</h1>
                )}
                <div key={screen} className={animationClass}>
                    {renderScreen()}
                </div>
             </div>
            {showUpdateModal && (
                <UpdateCheckModal 
                    onClose={() => setShowUpdateModal(false)} 
                />
            )}
            <style>{`
                @keyframes slide-in-right {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .animate-slide-in-right { animation: slide-in-right 0.3s ease-out forwards; }
             `}</style>
        </div>
    );
};

export default SettingsView;
