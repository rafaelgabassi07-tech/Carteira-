import React from 'react';
import PageHeader from '../PageHeader';
import ToggleSwitch from '../ToggleSwitch';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import type { AppPreferences } from '../../types';

const GeneralSettings: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences } = usePortfolio();
    
    const startScreens: { id: AppPreferences['startScreen'], label: string }[] = [
        { id: 'dashboard', label: t('nav_portfolio') }, // "Dashboard"
        { id: 'carteira', label: t('nav_analysis') }, // "Carteira"
        { id: 'noticias', label: t('nav_news') },
    ];

    return (
        <div>
            <PageHeader title={t('general')} onBack={onBack} />
            <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)] space-y-6">
                <div>
                    <h4 className="font-bold mb-3 text-sm">{t('start_screen')}</h4>
                    <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)]">
                        {startScreens.map(screen => (
                            <button 
                                key={screen.id} 
                                onClick={() => updatePreferences({ startScreen: screen.id })} 
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${preferences.startScreen === screen.id ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                            >
                                {screen.label}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="flex justify-between items-center">
                    <p className="font-bold text-sm">{t('haptic_feedback')}</p>
                    <ToggleSwitch enabled={preferences.hapticFeedback} setEnabled={(val) => updatePreferences({ hapticFeedback: val })} />
                </div>
            </div>
        </div>
    );
};

export default GeneralSettings;