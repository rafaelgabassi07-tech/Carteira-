import React, { useState } from 'react';
import type { ToastMessage } from '../types';

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

export type MenuScreen = 'main' | 'profile' | 'security' | 'notifications' | 'backup' | 'about' | 'appearance' | 'general' | 'transactions' | 'apiConnections';

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
