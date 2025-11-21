import React, { useState, useEffect } from 'react';
import PageHeader from '../PageHeader';
import ToggleSwitch from '../ToggleSwitch';
import type { ToastMessage } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { usePersistentState, vibrate } from '../../utils';
import PinLockScreen from '../PinLockScreen';

const SecuritySettings: React.FC<{ onBack: () => void; addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ onBack, addToast }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences } = usePortfolio();
    const [biometricsEnabled, setBiometricsEnabled] = usePersistentState('security-biometrics', false);
    const [showPinModal, setShowPinModal] = useState(false);

    const handleBiometricsToggle = (enabled: boolean) => {
        // In a real app, you would check for hardware support here
        if (enabled && !('credentials' in navigator)) {
            addToast(t('toast_biometric_not_supported'), 'error');
            return;
        }
        setBiometricsEnabled(enabled);
        addToast(enabled ? t('toast_biometric_enabled') : t('toast_biometric_disabled'), 'info');
    };

    const handlePinSet = (pin: string) => {
        updatePreferences({ appPin: pin });
        addToast(t('pin_setup_success'), 'success');
        setShowPinModal(false);
    };
    
    const handleRemovePin = () => {
         updatePreferences({ appPin: null });
         addToast(t('pin_removed'), 'info');
    }

    return (
        <div>
            <PageHeader title={t('security')} onBack={onBack} helpText={t('help_security')} />

            <div className="space-y-4">
                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg flex justify-between items-center border border-[var(--border-color)]">
                    <div>
                        <p className="font-bold">{t('privacy_on_start')}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{preferences.privacyOnStart ? t('enabled') : t('disabled')}</p>
                    </div>
                    <ToggleSwitch enabled={preferences.privacyOnStart} setEnabled={(val) => updatePreferences({ privacyOnStart: val })} />
                </div>
                
                 <div className="bg-[var(--bg-secondary)] p-4 rounded-lg flex justify-between items-center border border-[var(--border-color)]">
                    <div>
                        <p className="font-bold">{t('biometric_login')}</p>
                         <p className="text-xs text-[var(--text-secondary)]">{biometricsEnabled ? t('enabled') : t('disabled')}</p>
                    </div>
                    <ToggleSwitch enabled={biometricsEnabled} setEnabled={handleBiometricsToggle} />
                </div>

                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-bold">{t('app_lock_pin')}</p>
                            <p className="text-xs text-[var(--text-secondary)]">{preferences.appPin ? '****' : t('disabled')}</p>
                        </div>
                        <button 
                            onClick={() => preferences.appPin ? handleRemovePin() : setShowPinModal(true)}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md ${preferences.appPin ? 'bg-red-500/20 text-red-400' : 'bg-[var(--accent-color)] text-[var(--accent-color-text)]'}`}
                        >
                            {preferences.appPin ? t('delete') : t('add')}
                        </button>
                    </div>
                </div>
            </div>
            
            {showPinModal && (
                 <div className="fixed inset-0 z-[100] bg-[var(--bg-primary)] flex flex-col items-center justify-center p-8 animate-fade-in">
                    <p className="text-lg font-bold mb-4">{t('set_pin')}</p>
                    <PinLockScreen correctPin="" onUnlock={handlePinSet} />
                     <button onClick={() => setShowPinModal(false)} className="mt-8 text-sm text-[var(--text-secondary)]">{t('cancel')}</button>
                </div>
            )}
        </div>
    );
};

export default SecuritySettings;
