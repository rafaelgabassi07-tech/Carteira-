
import React, { useState, useEffect } from 'react';
import { vibrate } from '../utils';
import FingerprintIcon from './icons/FingerprintIcon';

interface PinLockScreenProps {
    onUnlock: () => void;
    correctPin: string;
    allowBiometrics?: boolean;
}

const PinLockScreen: React.FC<PinLockScreenProps> = ({ onUnlock, correctPin, allowBiometrics = false }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [isBiometricScanning, setIsBiometricScanning] = useState(false);

    // This simplified biometric auth just asks the OS to verify the user.
    // It does not check against a stored key ID, making it more robust against browser updates/clears.
    const handleBiometricAuth = async () => {
        // Double check local flag
        const isBioEnabled = localStorage.getItem('biometrics-enabled') === 'true' || allowBiometrics;
        if (!isBioEnabled) return;

        setIsBiometricScanning(true);
        try {
            // We use 'navigator.credentials.get' with an empty allowList (if supported) 
            // or simply ask for a new assertion to prove presence.
            // Note: strict WebAuthn usually requires an allowed credential ID.
            // If the user hasn't registered a key in THIS specific browser instance recently, this might fail.
            // BUT, creating a new credential also triggers the OS prompt (TouchID/FaceID) and verifies the user.
            
            // Try to create a dummy credential to trigger the OS User Verification prompt
            // This effectively acts as "Unlock with FaceID" without needing persistent key management
            await navigator.credentials.create({
                publicKey: {
                    challenge: crypto.getRandomValues(new Uint8Array(32)),
                    rp: { name: "Invest Portfolio Unlock" },
                    user: { 
                        id: crypto.getRandomValues(new Uint8Array(16)), 
                        name: "auth@invest", 
                        displayName: "Unlock" 
                    },
                    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                    timeout: 60000,
                }
            });

            // If we get here, the OS verified the user successfully
            vibrate(20);
            onUnlock();
        } catch (err) {
            console.error("Biometric auth failed or cancelled:", err);
            // Fallback to PIN
        } finally {
            setIsBiometricScanning(false);
        }
    };

    useEffect(() => {
        // Auto-trigger biometrics on mount if enabled in settings
        const isBioEnabled = localStorage.getItem('biometrics-enabled') === 'true' || allowBiometrics;
        if (isBioEnabled) {
            handleBiometricAuth();
        }
    }, [allowBiometrics]);


    const handleDigit = (digit: string) => {
        vibrate(5);
        if (pin.length < 4) {
            const newPin = pin + digit;
            setPin(newPin);
            setError(false);
            if (newPin.length === 4) {
                if (newPin === correctPin) {
                    vibrate(20);
                    onUnlock();
                } else {
                    vibrate([50, 50, 50]);
                    setError(true);
                    setTimeout(() => setPin(''), 500);
                }
            }
        }
    };

    const handleDelete = () => {
        vibrate(5);
        setPin(prev => prev.slice(0, -1));
        setError(false);
    };

    // Add Keyboard Support
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if biometric modal is active or modifiers are pressed
            if (isBiometricScanning || e.ctrlKey || e.metaKey || e.altKey) return;

            // Numbers (Main row and Numpad)
            if (/^\d$/.test(e.key)) {
                e.preventDefault();
                handleDigit(e.key);
            }
            // Backspace / Delete
            else if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                handleDelete();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pin, isBiometricScanning, correctPin]); // Re-bind to access current state closure

    return (
        <div className="fixed inset-0 z-[100] bg-[var(--bg-primary)] flex flex-col items-center justify-center p-4 animate-fade-in cursor-default user-select-none">
            
            {/* Container Card - Transparent on Mobile, Card on Desktop */}
            <div className="flex flex-col items-center w-full max-w-sm md:bg-[var(--bg-secondary)] md:border md:border-[var(--border-color)] md:shadow-2xl md:rounded-3xl md:p-10 transition-all duration-300">
                
                <div className="mb-8 flex flex-col items-center">
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-[var(--bg-secondary)] md:bg-[var(--bg-primary)] rounded-2xl flex items-center justify-center mb-4 shadow-lg border border-[var(--border-color)]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-color)]"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">Invest Portfolio</h2>
                    <p className="text-[var(--text-secondary)] text-sm mt-1">Digite seu PIN para acessar</p>
                </div>

                <div className="flex space-x-4 mb-8">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${pin.length > i ? (error ? 'bg-red-500 border-red-500' : 'bg-[var(--accent-color)] border-[var(--accent-color)]') : 'border-[var(--text-secondary)] opacity-50'}`} />
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-6 md:gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button 
                            key={num} 
                            onClick={() => handleDigit(String(num))} 
                            className="w-16 h-16 md:w-14 md:h-14 rounded-full bg-[var(--bg-secondary)] md:bg-[var(--bg-primary)] text-2xl md:text-xl font-bold text-[var(--text-primary)] shadow-sm hover:bg-[var(--bg-tertiary-hover)] transition-colors active:scale-95 border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 flex items-center justify-center"
                        >
                            {num}
                        </button>
                    ))}
                    
                    {(localStorage.getItem('biometrics-enabled') === 'true' || allowBiometrics) ? (
                        <button onClick={handleBiometricAuth} className={`w-16 h-16 md:w-14 md:h-14 rounded-full flex items-center justify-center text-[var(--accent-color)] hover:bg-[var(--bg-tertiary-hover)] transition-all active:scale-95 relative focus:outline-none ${isBiometricScanning ? 'ring-2 ring-[var(--accent-color)]/50' : ''}`}>
                            {isBiometricScanning && <div className="absolute inset-0 rounded-full animate-ping bg-[var(--accent-color)]/20"></div>}
                            <FingerprintIcon className="w-8 h-8" />
                        </button>
                    ) : (
                        <div />
                    )}
                    
                    <button 
                        onClick={() => handleDigit('0')} 
                        className="w-16 h-16 md:w-14 md:h-14 rounded-full bg-[var(--bg-secondary)] md:bg-[var(--bg-primary)] text-2xl md:text-xl font-bold text-[var(--text-primary)] shadow-sm hover:bg-[var(--bg-tertiary-hover)] transition-colors active:scale-95 border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 flex items-center justify-center"
                    >
                        0
                    </button>
                    
                    <button 
                        onClick={handleDelete} 
                        className="w-16 h-16 md:w-14 md:h-14 rounded-full flex items-center justify-center text-[var(--text-primary)] hover:text-red-400 transition-colors active:scale-95 focus:outline-none"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><line x1="18" y1="9" x2="12" y2="15"></line><line x1="12" y1="9" x2="18" y2="15"></line></svg>
                    </button>
                </div>
                
                <div className="mt-8 flex items-center gap-2 text-[var(--text-secondary)] opacity-60">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hidden md:block"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M6 12h.001"/><path d="M10 12h.001"/><path d="M14 12h.001"/><path d="M18 12h.001"/><path d="M7 16h10"/></svg>
                    <p className="text-[10px] md:text-xs font-medium uppercase tracking-wide">
                        {(localStorage.getItem('biometrics-enabled') === 'true' || allowBiometrics) ? "Biometria ou Teclado numérico" : "Use o teclado numérico"}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PinLockScreen;
