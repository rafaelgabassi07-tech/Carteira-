import React, { useState, useEffect } from 'react';
import PageHeader from '../PageHeader';
import ToggleSwitch from '../ToggleSwitch';
import type { ToastMessage } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { usePersistentState, vibrate, bufferEncode } from '../../utils';
import PinLockScreen from '../PinLockScreen';

const PinSetScreen: React.FC<{ onPinSet: (pin: string) => void; onCancel: () => void; }> = ({ onPinSet, onCancel }) => {
    const [pin, setPin] = useState('');
    const [step, setStep] = useState<'new' | 'confirm'>('new');
    const [firstPin, setFirstPin] = useState('');
    const [error, setError] = useState(false);
    const { t } = useI18n();

    const handleDigit = (digit: string) => {
        vibrate(5);
        if (pin.length < 4) {
            const newPin = pin + digit;
            setPin(newPin);
            if (newPin.length === 4) {
                setTimeout(() => {
                    if (step === 'new') {
                        setFirstPin(newPin);
                        setPin('');
                        setStep('confirm');
                        vibrate(10);
                    } else {
                        // Confirm Step
                        if (newPin === firstPin) {
                            onPinSet(newPin);
                        } else {
                            vibrate([50, 50, 50]);
                            setError(true);
                            // Reset flow after short delay to show error state
                            setTimeout(() => {
                                setPin('');
                                setFirstPin('');
                                setStep('new');
                                setError(false);
                            }, 1000);
                        }
                    }
                }, 200);
            }
        }
    };

    const handleDelete = () => {
        vibrate(5);
        setPin(prev => prev.slice(0, -1));
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[var(--bg-primary)] flex flex-col items-center justify-center p-8 animate-fade-in">
             <div className="mb-8 flex flex-col items-center text-center">
                 <h2 className={`text-xl font-bold ${error ? 'text-red-500' : 'text-[var(--text-primary)]'} transition-colors`}>
                     {error ? t('error') : (step === 'new' ? t('set_pin') : t('confirm_pin'))}
                 </h2>
                <p className={`text-[var(--text-secondary)] text-sm mt-1 ${error ? 'text-red-400 font-bold' : ''}`}>
                    {error ? t('pin_mismatch') : (step === 'new' ? t('create_pin_desc') : t('confirm_pin_desc'))}
                </p>
            </div>
            <div className="flex space-x-4 mb-8">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${pin.length > i ? (error ? 'bg-red-500 border-red-500' : 'bg-[var(--accent-color)] border-[var(--accent-color)]') : 'border-[var(--text-secondary)]'}`} />
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
            <button onClick={onCancel} className="mt-8 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">{t('cancel')}</button>
        </div>
    );
};


const SecuritySettings: React.FC<{ onBack: () => void; addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ onBack, addToast }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences } = usePortfolio();
    const [biometricsEnabled, setBiometricsEnabled] = usePersistentState('security-biometrics', false);
    const [showPinModal, setShowPinModal] = useState(false);

    const handleBiometricsToggle = async (enabled: boolean) => {
        vibrate();
        if (enabled) {
            try {
                if (!window.PublicKeyCredential || !(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())) {
                    addToast(t('toast_biometric_not_supported'), 'error');
                    return;
                }

                const credential = await navigator.credentials.create({
                    publicKey: {
                        challenge: new Uint8Array(16), // In a real app, this should be a random challenge from a server
                        rp: { name: "Invest Portfolio" },
                        user: { id: new Uint8Array(16), name: "user@invest.app", displayName: "User" },
                        pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
                        authenticatorSelection: {
                            authenticatorAttachment: "platform",
                            userVerification: "required",
                        },
                        timeout: 60000,
                    }
                });
                
                if (credential) {
                    localStorage.setItem('biometric-credential-id', bufferEncode((credential as any).rawId));
                    setBiometricsEnabled(true);
                    addToast(t('toast_biometric_enabled'), 'success');
                }
            } catch (err) {
                 console.error("Biometric registration failed:", err);
                 addToast('Falha ao registrar biometria.', 'error');
            }
        } else {
            localStorage.removeItem('biometric-credential-id');
            setBiometricsEnabled(false);
            addToast(t('toast_biometric_disabled'), 'info');
        }
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
            <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)] space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-bold">{t('privacy_on_start')}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{preferences.privacyOnStart ? t('enabled') : t('disabled')}</p>
                    </div>
                    <ToggleSwitch enabled={preferences.privacyOnStart} setEnabled={(val) => updatePreferences({ privacyOnStart: val })} />
                </div>
                
                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-bold">{t('biometric_login')}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{biometricsEnabled ? t('enabled') : t('disabled')}</p>
                    </div>
                    <ToggleSwitch enabled={biometricsEnabled} setEnabled={handleBiometricsToggle} />
                </div>

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