import React from 'react';
import { useI18n } from '../contexts/I18nContext';

const PatrimonyEvolutionCard: React.FC = () => {
    const { t } = useI18n();

    return (
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 mb-4 border border-[var(--border-color)] shadow-sm animate-fade-in-up">
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">{t('evolution_of_patrimony')}</h3>
            
            <div className="h-72 w-full pt-2 flex items-center justify-center text-sm text-[var(--text-secondary)]">
                {/* Conteúdo removido para começar do zero */}
            </div>
        </div>
    );
};

export default PatrimonyEvolutionCard;