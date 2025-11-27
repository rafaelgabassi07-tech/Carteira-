import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  action?: {
      label: string;
      onClick: () => void;
  };
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, action, onClose }) => {
  useEffect(() => {
    // Only auto-close if there is no action required
    if (!action) {
        const timer = setTimeout(() => {
          onClose();
        }, 4000);
        return () => clearTimeout(timer);
    }
  }, [onClose, action]);

  const bgColor = {
    success: 'bg-emerald-500',
    error: 'bg-rose-500',
    info: 'bg-sky-500',
  }[type];

  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 max-w-sm w-full p-4 rounded-lg text-white shadow-2xl z-[60] animate-toast-in-out landscape-fab ${bgColor} flex items-center justify-between gap-3`}>
      <p className="text-sm font-medium">{message}</p>
      {action && (
          <button 
            onClick={action.onClick}
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
          >
              {action.label}
          </button>
      )}
      {!action && (
          <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
      )}
      <style>{`
        @keyframes toast-in-out {
          0% { transform: translate(-50%, 100px); opacity: 0; }
          10% { transform: translate(-50%, 0); opacity: 1; }
          /* Persistent toasts don't fade out automatically in css */
        }
        .animate-toast-in-out {
          animation: toast-in-out 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default Toast;