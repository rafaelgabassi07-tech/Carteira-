import React from 'react';
import { useI18n } from '../../contexts/I18nContext';

interface WelcomeModalProps {
  onClose: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ onClose }) => {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[110] p-4">
      <div className="bg-[var(--bg-secondary)] rounded-2xl w-full max-w-md p-6 text-[var(--text-primary)] animate-fade-in text-center">
        <h2 className="text-2xl font-bold mb-2">{t('welcome_title')}</h2>
        <p className="text-[var(--text-secondary)] mb-6">{t('welcome_subtitle')}</p>
        <button
          onClick={onClose}
          className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3 rounded-lg hover:bg-opacity-90 transition-colors"
        >
          {t('welcome_button')}
        </button>
      </div>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default WelcomeModal;