
import React from 'react';
import PageHeader from '../PageHeader';
import type { AppColor } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import SparklesIcon from '../icons/SparklesIcon';

const AppearanceSettings: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences } = usePortfolio();

    const themes = [
        { id: 'system', label: t('system_theme') },
        { id: 'light', label: t('light_theme') },
        { id: 'dark', label: t('dark_theme') },
    ];
    
    const fontSizes = [
        { id: 'small', label: t('font_small') },
        { id: 'medium', label: t('font_medium') },
        { id: 'large', label: t('font_large') },
    ];

    const visualStyles = [
        { id: 'simple', label: t('style_simple') },
        { id: 'premium', label: t('style_premium') },
    ];

    const colors: { id: AppColor, hex: string }[] = [
        { id: 'blue', hex: '#38bdf8' },
        { id: 'green', hex: '#4ade80' },
        { id: 'purple', hex: '#a78bfa' },
        { id: 'orange', hex: '#fb923c' },
        { id: 'rose', hex: '#fb7185' },
    ];

    return (
        <div>
            <PageHeader title={t('appearance')} onBack={onBack} />

            <div className="space-y-4">
                 {/* Visual Style Selector */}
                 <div className="bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)] relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-3">
                        <SparklesIcon className="w-4 h-4 text-[var(--accent-color)]" />
                        <h4 className="font-bold text-sm">{t('visual_style')}</h4>
                    </div>
                    <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)] relative z-10">
                        {visualStyles.map(style => (
                            <button 
                                key={style.id} 
                                onClick={() => updatePreferences({ visualStyle: style.id as any })} 
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${preferences.visualStyle === style.id ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-lg ring-1 ring-[var(--border-color)]' : 'text-[var(--text-secondary)]'}`}
                            >
                                {style.label}
                            </button>
                        ))}
                    </div>
                    {/* Decor */}
                    {preferences.visualStyle === 'premium' && (
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--accent-color)] opacity-10 blur-3xl rounded-full pointer-events-none"></div>
                    )}
                </div>

                 <div className="bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)]">
                    <h4 className="font-bold mb-3 text-sm">{t('accent_color')}</h4>
                    <div className="flex justify-around p-1">
                        {colors.map(color => (
                            <button key={color.id} onClick={() => updatePreferences({ accentColor: color.id })} className={`w-10 h-10 rounded-full transition-all duration-200 ${preferences.accentColor === color.id ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-secondary)] ring-[var(--accent-color)] scale-110' : ''}`} style={{ backgroundColor: color.hex }} />
                        ))}
                    </div>
                </div>

                <div className="bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)]">
                    <h4 className="font-bold mb-3 text-sm">{t('system_theme')}</h4>
                    <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)]">
                        {themes.map(theme => (
                            <button key={theme.id} onClick={() => updatePreferences({ systemTheme: theme.id as any })} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${preferences.systemTheme === theme.id ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>
                                {theme.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)]">
                    <h4 className="font-bold mb-3 text-sm">{t('font_size')}</h4>
                    <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)]">
                        {fontSizes.map(fs => (
                             <button key={fs.id} onClick={() => updatePreferences({ fontSize: fs.id as any })} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${preferences.fontSize === fs.id ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>
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
