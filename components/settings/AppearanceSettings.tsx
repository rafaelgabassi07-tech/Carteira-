
import React from 'react';
import PageHeader from '../PageHeader';
import type { AppColor } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import SparklesIcon from '../icons/SparklesIcon';
import ThemeIcon from '../icons/ThemeIcon';

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
            <PageHeader title={t('themes')} onBack={onBack} />

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

                 {/* 2. Color Palette */}
                 <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)]">
                    <h4 className="font-bold mb-1 text-base">{t('accent_color')}</h4>
                    <p className="text-xs text-[var(--text-secondary)] mb-4">{t('accent_color_desc')}</p>
                    
                    <div className="flex justify-between items-center px-2">
                        {colors.map(color => (
                            <button 
                                key={color.id} 
                                onClick={() => updatePreferences({ accentColor: color.id })} 
                                className={`relative w-12 h-12 rounded-full transition-all duration-300 flex items-center justify-center ${preferences.accentColor === color.id ? 'scale-110 shadow-lg shadow-[var(--accent-color)]/30' : 'opacity-70 hover:opacity-100 hover:scale-105'}`}
                                style={{ backgroundColor: color.hex }}
                            >
                                {preferences.accentColor === color.id && (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. System Theme (Dark/Light) */}
                <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)]">
                    <div className="flex items-center gap-2 mb-4">
                        <ThemeIcon className="w-5 h-5 text-[var(--text-secondary)]" />
                        <h4 className="font-bold text-base">{t('system_theme')}</h4>
                    </div>
                    <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)]">
                        {themes.map(theme => (
                            <button key={theme.id} onClick={() => updatePreferences({ systemTheme: theme.id as any })} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${preferences.systemTheme === theme.id ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                                {theme.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 4. Font Size */}
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
