
import React from 'react';
import CloseIcon from '../icons/CloseIcon';

interface ModalProps {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    type?: 'slide-up' | 'scale-in';
    fullScreen?: boolean;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children, type = 'slide-up', fullScreen = false }) => {
    const animationClass = type === 'slide-up' ? 'animate-slide-up' : 'animate-scale-in';
    
    // Adjust positioning based on fullScreen prop
    const positionClass = fullScreen 
        ? 'items-end sm:items-center' 
        : (type === 'slide-up' ? 'items-end' : 'items-center p-4');
        
    const widthClass = fullScreen ? 'w-full h-full' : 'w-full max-w-md';
    const roundedClass = fullScreen ? 'rounded-none sm:rounded-2xl' : (type === 'slide-up' ? 'rounded-t-2xl' : 'rounded-2xl');
    const paddingClass = fullScreen ? 'p-5 pt-safe' : 'p-5';

    return (
        <div className={`fixed inset-0 bg-black bg-opacity-75 flex justify-center z-50 ${positionClass}`}>
            <div className={`bg-[var(--bg-secondary)] text-[var(--text-primary)] flex flex-col ${widthClass} ${roundedClass} ${paddingClass} ${animationClass}`}>
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-2 rounded-full hover:bg-[var(--bg-tertiary-hover)] transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className={`overflow-y-auto pr-1 ${fullScreen ? 'flex-1' : 'max-h-[70vh]'}`}>
                    {children}
                </div>
            </div>
            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default Modal;
