

import React from 'react';
import PageHeader from '../PageHeader';
import ToggleSwitch from '../ToggleSwitch';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';

const GeneralSettings: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences } = usePortfolio();
    
    const startScreens = [
        { id: 'carteira', label: t('nav_portfolio') },
        { id: 'analise', label: t('nav_analysis') },
        { id: 'noticias', label: t('nav_news') },
    ];

    return (
        <div>
            <PageHeader title={t('general')} onBack={onBack} />

            <div className="space-y-4">
                <div className="bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)]">
                    <h4 className="font-bold mb-3 text-sm">{t('start_screen')}</h4>
                    <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)]">
                        {startScreens.map(screen => (
                            <button 
                                key={screen.id} 
                                onClick={() => updatePreferences({ startScreen: screen.id as any })} 
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${preferences.startScreen === screen.id ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                            >
                                {screen.label}
                            </button>
                        ))}
                    </div>
                </div>
                
                 <div className="bg-[var(--bg-secondary)] p-4 rounded-lg flex justify-between items-center border border-[var(--border-color)]">
                    <p className="font-bold text-sm">{t('haptic_feedback')}</p>
                    <ToggleSwitch enabled={preferences.hapticFeedback} setEnabled={(val) => updatePreferences({ hapticFeedback: val })} />
                </div>

                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg flex justify-between items-center border border-[var(--border-color)]">
                    <div>
                        <p className="font-bold text-sm">{t('compact_mode')}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{t('compact_mode_desc')}</p>
                    </div>
                    <ToggleSwitch enabled={preferences.compactMode} setEnabled={(val) => updatePreferences({ compactMode: val })} />
                </div>

                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg flex justify-between items-center border border-[var(--border-color)]">
                    <div>
                        <p className="font-bold text-sm">{t('reduce_motion')}</p>
                    </div>
                    <ToggleSwitch enabled={preferences.reduceMotion} setEnabled={(val) => updatePreferences({ reduceMotion: val })} />
                </div>
            </div>
        </div>
    );
};

export default GeneralSettings;