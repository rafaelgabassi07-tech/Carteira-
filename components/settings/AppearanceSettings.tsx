
import React from 'react';
import PageHeader from '../PageHeader';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import SparklesIcon from '../icons/SparklesIcon';

const AppearanceSettings: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences } = usePortfolio();
    
    const fontSizes = [
        { id: 'small', label: t('font_small') },
        { id: 'medium', label: t('font_medium') },
        { id: 'large', label: t('font_large') },
    ];

    const visualStyles = [
        { id: 'simple', label: t('style_simple') },
        { id: 'premium', label: t('style_premium') },
    ];

    return (
        <div>
            <PageHeader title={t('appearance')} onBack={onBack} />

            <div className="space-y-6">
                 {/* 1. Visual Style (The "Glass" Toggle) */}
                 <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <SparklesIcon className="w-5 h-5 text-[var(--accent-color)]" />
                            <h4 className="font-bold text-base">{t('visual_style')}</h4>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mb-4">{t('visual_style_desc')}</p>
                        
                        <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)] shadow-inner">
                            {visualStyles.map(style => (
                                <button 
                                    key={style.id} 
                                    onClick={() => updatePreferences({ visualStyle: style.id as any })} 
                                    className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all duration-300 ${preferences.visualStyle === style.id ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] shadow-lg ring-1 ring-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                >
                                    {style.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Visual Background Decor based on selection */}
                    {preferences.visualStyle === 'premium' ? (
                        <div className="absolute -top-12 -right-12 w-40 h-40 bg-[var(--accent-color)] opacity-10 blur-3xl rounded-full pointer-events-none transition-opacity duration-700"></div>
                    ) : (
                        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-[var(--text-secondary)] opacity-5 blur-3xl rounded-full pointer-events-none transition-opacity duration-700"></div>
                    )}
                </div>

                {/* 2. Font Size */}
                <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)]">
                    <h4 className="font-bold mb-4 text-base">{t('font_size')}</h4>
                    <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)]">
                        {fontSizes.map(fs => (
                             <button key={fs.id} onClick={() => updatePreferences({ fontSize: fs.id as any })} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${preferences.fontSize === fs.id ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                                {fs.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppearanceSettings;
