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

    // Corrigido: Usar navigator.credentials.get para autenticação (Login)
    // Isso evita que o navegador pergunte se deseja criar uma nova chave.
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
                        transports: ['internal'] // Prioriza TouchID/FaceID
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
            // Pequeno delay para garantir que o componente montou antes de chamar a biometria
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
        <div className="fixed inset-0 z-[100] bg-[var(--bg-primary)] flex flex-col items-center justify-center p-4 animate-fade-in cursor-default user-select-none">
            
            {/* Container Card */}
            <div className="flex flex-col items-center w-full max-w-sm md:bg-[var(--bg-secondary)] md:border md:border-[var(--border-color)] md:shadow-2xl md:rounded-3xl md:p-10 transition-all duration-300">
                
                <div className="mb-8 flex flex-col items-center">
                    <Logo className="w-16 h-16 rounded-2xl mb-4 shadow-lg shadow-[var(--accent-color)]/10" />
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">FII Master</h2>
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
                        <button onClick={() => handleBiometricAuth()} className={`w-16 h-16 md:w-14 md:h-14 rounded-full flex items-center justify-center text-[var(--accent-color)] hover:bg-[var(--bg-tertiary-hover)] transition-all active:scale-95 relative focus:outline-none ${isBiometricScanning ? 'ring-2 ring-[var(--accent-color)]/50' : ''}`}>
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