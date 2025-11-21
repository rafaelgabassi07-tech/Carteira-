import React, { useState, useEffect } from 'react';
import PageHeader from '../PageHeader';
import ToggleSwitch from '../ToggleSwitch';
import type { ToastMessage } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { usePersistentState, vibrate } from '../../utils';
import PinLockScreen from '../PinLockScreen';

// A new component designed specifically for setting a PIN.
// This avoids misusing the `PinLockScreen` and resolves the type error.
const PinSetScreen: React.FC<{ onPinSet: (pin: string) => void; onCancel: () => void; }> = ({ onPinSet, onCancel }) => {
    const [pin, setPin] = useState('');
    const { t } = useI18n();

    const handleDigit = (digit: string) => {
        vibrate(5);
        if (pin.length < 4) {
            const newPin = pin + digit;
            setPin(newPin);
            if (newPin.length === 4) {
                setTimeout(() => onPinSet(newPin), 200);
            }
        }
    };

    const handleDelete = () => {
        vibrate(5);
        setPin(prev => prev.slice(0, -1));
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[var(--bg-primary)] flex flex-col items-center justify-center p-8 animate-fade-in">
             <div className="mb-8 flex flex-col items-center">
                 <h2 className="text-xl font-bold text-[var(--text-primary)]">{t('set_pin')}</h2>
                <p className="text-[var(--text-secondary)] text-sm mt-1">Defina um código de 4 dígitos.</p>
            </div>
            <div className="flex space-x-4 mb-8">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${pin.length > i ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'border-[var(--text-secondary)]'}`} />
                ))}
            </div>
             <div className="grid grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button key={num} onClick={() => handleDigit(String(num))} className="w-16 h-16 rounded-full bg-[var(--bg-secondary)] text-2xl font-bold text-[var(--text-primary)] shadow-sm hover:bg-[var(--bg-tertiary-hover)] transition-colors active:scale-95 border border-[var(--border-color)]">
                        {num}
                    </button>
                ))}
                <div />
                <button onClick={() => handleDigit('0')} className="w-16 h-16 rounded-full bg-[var(--bg-secondary)] text-2xl font-bold text-[var(--text-primary)] shadow-sm hover:bg-[var(--bg-tertiary-hover)] transition-colors active:scale-95 border border-[var(--border-color)]">0</button>
                <button onClick={handleDelete} className="w-16 h-16 rounded-full flex items-center justify-center text-[var(--text-primary)] hover:text-red-400 transition-colors active:scale-95">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><line x1="18" y1="9" x2="12" y2="15"></line><line x1="12" y1="9" x2="18" y2="15"></line></svg>
                </button>
            </div>
            <button onClick={onCancel} className="mt-8 text-sm text-[var(--text-secondary)]">{t('cancel')}</button>
        </div>
    );
};


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
            
            {/* FIX: The `PinLockScreen` component was misused for setting a PIN, causing a type error
                 because its `onUnlock` prop doesn't pass the entered PIN. This has been replaced
                 with a new, purpose-built `PinSetScreen` component that correctly handles
                 the PIN setting logic and calls back with the new PIN. */}
            {showPinModal && (
                 <PinSetScreen 
                    onPinSet={handlePinSet}
                    onCancel={() => setShowPinModal(false)}
                 />
            )}
        </div>
    );
};

export default SecuritySettings;
