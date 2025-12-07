
import React, { useState, useEffect } from 'react';

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
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = action ? 6000 : 4000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 400); // Allow exit animation to complete
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, action]);

  const handleClose = () => {
      setIsExiting(true);
      setTimeout(onClose, 400);
  }

  const bgColor = {
    success: 'bg-emerald-500',
    error: 'bg-rose-500',
    info: 'bg-sky-500',
  }[type];
  
  const animationClass = isExiting ? 'animate-toast-out' : 'animate-toast-in';

  return (
    <div className={`fixed bottom-[110px] left-1/2 -translate-x-1/2 max-w-sm w-[90%] p-4 rounded-2xl text-white shadow-2xl z-[120] ${animationClass} landscape-fab ${bgColor} flex items-center justify-between gap-3 border border-white/10 backdrop-blur-md`}>
      <p className="text-sm font-medium">{message}</p>
      {action ? (
          <button 
            onClick={action.onClick}
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
              {action.label}
          </button>
      ) : (
          <button onClick={handleClose} className="text-white/60 hover:text-white p-1 rounded-full -mr-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
      )}
      <style>{`
        @keyframes toast-in {
          from { transform: translate(-50%, 80px) scale(0.9); opacity: 0; }
          to { transform: translate(-50%, 0) scale(1); opacity: 1; }
        }
        @keyframes toast-out {
          from { transform: translate(-50%, 0) scale(1); opacity: 1; }
          to { transform: translate(-50%, 80px) scale(0.9); opacity: 0; }
        }
        .animate-toast-in {
          animation: toast-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-toast-out {
          animation: toast-out 0.4s cubic-bezier(0.7, 0, 0.84, 0) forwards;
        }
      `}</style>
    </div>
  );
};

export default Toast;