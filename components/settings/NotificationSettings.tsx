import React from 'react';
import PageHeader from '../PageHeader';
import ToggleSwitch from '../ToggleSwitch';
import { useI18n } from '../../contexts/I18nContext';
import { usePersistentState } from '../../utils';

const NotificationSettings: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const [settings, setSettings] = usePersistentState('notification-settings', {
        price: true,
        dividend: true,
        news: false,
    });
    
    const updateSetting = (key: keyof typeof settings, value: boolean) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div>
            <PageHeader title={t('notifications')} onBack={onBack} helpText={t('help_notifications')} />
            <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)] space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-bold">{t('price_alerts')}</p>
                    </div>
                    <ToggleSwitch enabled={settings.price} setEnabled={(val) => updateSetting('price', val)} />
                </div>
                
                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-bold">{t('dividend_announcements')}</p>
                    </div>
                    <ToggleSwitch enabled={settings.dividend} setEnabled={(val) => updateSetting('dividend', val)} />
                </div>
            </div>
        </div>
    );
};

export default NotificationSettings;