import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // Corresponde à duração da animação + tempo de visualização
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    success: 'bg-emerald-500',
    error: 'bg-rose-500',
    info: 'bg-sky-500',
  }[type];

  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 max-w-sm w-full p-4 rounded-lg text-white shadow-lg z-[60] animate-toast-in-out ${bgColor}`}>
      <p className="text-sm font-medium">{message}</p>
      <style>{`
        @keyframes toast-in-out {
          0% {
            transform: translate(-50%, 100px);
            opacity: 0;
          }
          20% {
            transform: translate(-50%, 0);
            opacity: 1;
          }
          80% {
            transform: translate(-50%, 0);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, 100px);
            opacity: 0;
          }
        }
        .animate-toast-in-out {
          animation: toast-in-out 3s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
};

export default Toast;