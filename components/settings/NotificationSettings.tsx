
import React, { useState, useEffect } from 'react';
import PageHeader from '../PageHeader';
import ToggleSwitch from '../ToggleSwitch';
import { useI18n } from '../../contexts/I18nContext';
import { usePersistentState, vibrate } from '../../utils';

const NotificationSettings: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const [settings, setSettings] = usePersistentState('notification-settings', {
        price: true,
        dividend: true,
        news: false,
    });
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    );

    useEffect(() => {
        if (typeof Notification !== 'undefined') {
            setPermissionStatus(Notification.permission);
        }
    }, []);
    
    const requestPermission = async () => {
        if (typeof Notification === 'undefined') return;
        const permission = await Notification.requestPermission();
        setPermissionStatus(permission);
        if (permission === 'granted') {
            vibrate(20);
        }
    };

    const updateSetting = (key: keyof typeof settings, value: boolean) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        if (value && permissionStatus === 'default') {
            requestPermission();
        }
    };

    return (
        <div>
            <PageHeader title={t('notifications')} onBack={onBack} helpText={t('help_notifications')} />
            
            {permissionStatus === 'denied' && (
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-4 text-xs text-red-400">
                    <p className="font-bold mb-1">Permissão Bloqueada</p>
                    <p>As notificações estão bloqueadas no seu navegador. Para receber alertas reais, você precisa habilitá-las nas configurações do site/app do seu sistema.</p>
                </div>
            )}

            {permissionStatus === 'default' && (
                <div className="bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/30 p-3 rounded-xl mb-4 text-xs">
                    <p className="font-bold mb-1 text-[var(--accent-color)]">Habilitar Notificações</p>
                    <button 
                        onClick={requestPermission}
                        className="bg-[var(--accent-color)] text-[var(--accent-color-text)] px-3 py-1.5 rounded-lg font-bold mt-2 active:scale-95 transition-transform"
                    >
                        Permitir Alertas
                    </button>
                </div>
            )}

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
