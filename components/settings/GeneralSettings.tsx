import React from 'react';
import PageHeader from '../PageHeader';
import ToggleSwitch from '../ToggleSwitch';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';

const GeneralSettings: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences, setDemoMode } = usePortfolio();
    
    const startScreens = [
        { id: 'carteira', label: t('nav_portfolio') },
        { id: 'analise', label: t('nav_analysis') },
        { id: 'noticias', label: t('nav_news') },
    ];
    
    const handleRestartTutorial = () => {
        updatePreferences({ restartTutorial: true });
        // A simple reload is the easiest way to re-trigger the tour logic in App.tsx
        window.location.reload();
    };

    return (
        <div>
            <PageHeader title={t('general')} onBack={onBack} />

            <div className="space-y-6">
                <div>
                    <h4 className="font-bold mb-2">{t('start_screen')}</h4>
                    <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)]">
                        {startScreens.map(screen => (
                            <button 
                                key={screen.id} 
                                onClick={() => updatePreferences({ startScreen: screen.id as any })} 
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${preferences.startScreen === screen.id ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                            >
                                {screen.label}
                            </button>
                        ))}
                    </div>
                </div>
                
                 <div className="bg-[var(--bg-secondary)] p-4 rounded-lg flex justify-between items-center border border-[var(--border-color)]">
                    <div>
                        <p className="font-bold">{t('haptic_feedback')}</p>
                    </div>
                    <ToggleSwitch enabled={preferences.hapticFeedback} setEnabled={(val) => updatePreferences({ hapticFeedback: val })} />
                </div>

                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                    <button onClick={handleRestartTutorial} className="w-full text-center font-bold text-[var(--accent-color)] text-sm">
                        {t('restart_tutorial')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GeneralSettings;
