
import React, { useState, useEffect } from 'react';
import { vibrate, bufferDecode } from '../utils';
import FingerprintIcon from './icons/FingerprintIcon';
import Logo from './Logo';

interface PinLockScreenProps {
    onUnlock: () => void;
    correctPin: string;
    allowBiometrics?: boolean;
}

const PinLockScreen: React.FC<PinLockScreenProps> = ({ onUnlock, correctPin, allowBiometrics = false }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [isBiometricScanning, setIsBiometricScanning] = useState(false);

    const handleBiometricAuth = async () => {
        const isBioEnabled = localStorage.getItem('biometrics-enabled') === 'true' || allowBiometrics;
        const storedCredentialId = localStorage.getItem('biometric-credential-id');
        
        if (!isBioEnabled || !storedCredentialId) return;

        setIsBiometricScanning(true);
        try {
            const credential = await navigator.credentials.get({
                publicKey: {
                    challenge: crypto.getRandomValues(new Uint8Array(32)),
                    rpId: window.location.hostname,
                    allowCredentials: [{
                        type: 'public-key',
                        id: bufferDecode(storedCredentialId),
                        transports: ['internal']
                    }],
                    userVerification: 'required',
                    timeout: 60000,
                }
            });

            if (credential) {
                vibrate(20);
                onUnlock();
            }
        } catch (err) {
            console.error("Biometric auth failed or cancelled:", err);
        } finally {
            setIsBiometricScanning(false);
        }
    };

    useEffect(() => {
        const isBioEnabled = localStorage.getItem('biometrics-enabled') === 'true' || allowBiometrics;
        if (isBioEnabled) {
            const timer = setTimeout(() => handleBiometricAuth(), 500);
            return () => clearTimeout(timer);
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
                    setTimeout(() => {
                        setPin('');
                        setError(false);
                    }, 500);
                }
            }
        }
    };

    const handleDelete = () => {
        vibrate(5);
        setPin(prev => prev.slice(0, -1));
        setError(false);
    };

    // Keyboard Support
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isBiometricScanning || e.ctrlKey || e.metaKey || e.altKey) return;

            if (/^\d$/.test(e.key)) {
                e.preventDefault();
                handleDigit(e.key);
            }
            else if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                handleDelete();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pin, isBiometricScanning, correctPin]);

    return (
        <div className="fixed inset-0 z-[100] bg-[var(--bg-primary)] flex flex-col items-center justify-between p-6 animate-fade-in select-none overflow-hidden">
            
            {/* Header Content */}
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-xs space-y-8">
                <div className="flex flex-col items-center">
                    <div className="mb-6 p-1 rounded-3xl">
                        <Logo className="w-20 h-20 text-[var(--text-primary)]" />
                    </div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Bem-vindo de volta</h2>
                    <p className="text-[var(--text-secondary)] text-sm mt-1 font-medium">Digite seu PIN para acessar</p>
                </div>

                {/* PIN Dots with Shake Animation */}
                <div className={`flex space-x-6 ${error ? 'animate-shake' : ''}`}>
                    {[0, 1, 2, 3].map(i => (
                        <div 
                            key={i} 
                            className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                                pin.length > i 
                                    ? (error ? 'bg-red-500 border-red-500 scale-110' : 'bg-[var(--accent-color)] border-[var(--accent-color)] scale-110') 
                                    : 'border-[var(--border-color)] bg-[var(--bg-secondary)]'
                            }`} 
                        />
                    ))}
                </div>
            </div>

            {/* Keypad */}
            <div className="w-full max-w-xs mb-8">
                <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button 
                            key={num} 
                            onClick={() => handleDigit(String(num))} 
                            className="w-20 h-20 rounded-full bg-[var(--bg-secondary)]/50 backdrop-blur-sm text-3xl font-medium text-[var(--text-primary)] transition-all active:scale-90 active:bg-[var(--bg-tertiary-hover)] focus:outline-none flex items-center justify-center mx-auto"
                        >
                            {num}
                        </button>
                    ))}
                    
                    {/* Biometric Button */}
                    <div className="flex items-center justify-center">
                        {(localStorage.getItem('biometrics-enabled') === 'true' || allowBiometrics) && (
                            <button 
                                onClick={() => handleBiometricAuth()} 
                                className={`w-20 h-20 rounded-full flex items-center justify-center text-[var(--accent-color)] transition-all active:scale-90 active:bg-[var(--accent-color)]/10 focus:outline-none ${isBiometricScanning ? 'animate-pulse' : ''}`}
                            >
                                <FingerprintIcon className="w-9 h-9" />
                            </button>
                        )}
                    </div>
                    
                    <button 
                        onClick={() => handleDigit('0')} 
                        className="w-20 h-20 rounded-full bg-[var(--bg-secondary)]/50 backdrop-blur-sm text-3xl font-medium text-[var(--text-primary)] transition-all active:scale-90 active:bg-[var(--bg-tertiary-hover)] focus:outline-none flex items-center justify-center mx-auto"
                    >
                        0
                    </button>
                    
                    <div className="flex items-center justify-center">
                        {pin.length > 0 && (
                            <button 
                                onClick={handleDelete} 
                                className="w-20 h-20 rounded-full flex items-center justify-center text-[var(--text-primary)] hover:text-red-400 transition-all active:scale-90 focus:outline-none"
                            >
                                <span className="text-sm font-bold uppercase tracking-wider">Apagar</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                }
            `}</style>
        </div>
    );
};

export default PinLockScreen;
