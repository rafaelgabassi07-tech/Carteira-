import React, { useState, useMemo } from 'react';
import PageHeader from '../PageHeader';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { APP_THEMES, APP_FONTS } from '../../constants';
import { vibrate } from '../../utils';
import type { AppTheme } from '../../types';
import PaletteIcon from '../icons/PaletteIcon';
import TypeIcon from '../icons/TypeIcon';
import MoonIcon from '../icons/MoonIcon';
import SunIcon from '../icons/SunIcon';
import CheckCircleIcon from '../icons/CheckCircleIcon';

const ThemeCard: React.FC<{ theme: AppTheme; isActive: boolean; onClick: () => void; }> = ({ theme, isActive, onClick }) => {
    const { colors } = theme;
    const borderStyle = isActive ? `2px solid ${colors.accentColor}` : '2px solid transparent';

    return (
        <div 
            onClick={onClick} 
            className="p-1 rounded-2xl cursor-pointer transition-all duration-200 animate-fade-in-up"
            style={{ border: borderStyle }}
        >
            <div className="bg-[var(--bg-secondary)] rounded-[14px] p-2 transition-colors">
                {/* Miniature UI Preview */}
                <div
                    className="w-full aspect-[4/5] rounded-xl overflow-hidden p-2 flex flex-col gap-1.5 border"
                    style={{ backgroundColor: colors.bgPrimary, borderColor: colors.borderColor }}
                >
                    {/* Header */}
                    <div className="h-8 rounded-md p-1.5" style={{ backgroundColor: colors.bgSecondary }}>
                        <div className="w-1/2 h-2 rounded-full" style={{ backgroundColor: colors.textPrimary }}></div>
                        <div className="w-1/3 h-1.5 mt-1 rounded-full" style={{ backgroundColor: colors.textSecondary }}></div>
                    </div>
                    {/* Chart area */}
                    <div className="h-12 rounded-md relative overflow-hidden" style={{ backgroundColor: colors.bgSecondary }}>
                        <svg viewBox="0 0 100 40" className="absolute bottom-0 left-0 w-full h-full" preserveAspectRatio="none">
                            <path d="M0,40 L10,25 L30,30 L50,15 L70,20 L90,10 L100,20 L100,40 Z" fill={colors.accentColor} fillOpacity="0.3"/>
                            <path d="M0,40 L10,25 L30,30 L50,15 L70,20 L90,10 L100,20" stroke={colors.accentColor} strokeWidth="1.5" fill="none"/>
                        </svg>
                    </div>
                    {/* List items */}
                    <div className="flex-1 rounded-md p-1.5 space-y-1.5" style={{ backgroundColor: colors.bgSecondary }}>
                        <div className="flex justify-between items-center">
                            <div className="w-1/3 h-2 rounded-full" style={{ backgroundColor: colors.textSecondary }}></div>
                            <div className="w-1/4 h-2 rounded-full" style={{ backgroundColor: colors.greenText }}></div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="w-1/2 h-2 rounded-full" style={{ backgroundColor: colors.textSecondary }}></div>
                            <div className="w-1/5 h-2 rounded-full" style={{ backgroundColor: colors.redText }}></div>
                        </div>
                    </div>
                </div>
                {/* Details below preview */}
                <div className="p-2">
                    <p className="font-bold text-sm text-[var(--text-primary)] truncate">{theme.name}</p>
                    <p className="text-xs text-[var(--text-secondary)] truncate">{theme.description}</p>
                    <div className="flex gap-1.5 mt-2">
                        {[colors.bgPrimary, colors.bgSecondary, colors.textPrimary, colors.accentColor, colors.greenText].map((color, i) => (
                            <div key={i} className="w-4 h-4 rounded-md border" style={{ backgroundColor: color, borderColor: colors.borderColor }}></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


const AppearanceSettings: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const { preferences, setTheme, setFont, updatePreferences } = usePortfolio();
    const [activeTab, setActiveTab] = useState<'themes' | 'typography'>('themes');
    
    // Theme Filters
    const [themeType, setThemeType] = useState<'dark' | 'light'>(
        preferences.systemTheme === 'light' || (preferences.systemTheme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'light' : 'dark'
    );
    const [visualStyle, setVisualStyle] = useState<'simple' | 'premium'>(preferences.visualStyle);

    const handleThemeClick = (theme: AppTheme) => {
        setTheme(theme.id);
        const newStyle = theme.isPremium ? 'premium' : 'simple';
        if (preferences.visualStyle !== newStyle) {
            updatePreferences({ visualStyle: newStyle });
            setVisualStyle(newStyle);
        }
        vibrate();
    };

    const filteredThemes = useMemo(() => {
        return APP_THEMES.filter(theme => {
            const typeMatch = theme.type === themeType;
            const style = theme.isPremium ? 'premium' : 'simple';
            const styleMatch = style === visualStyle;
            return typeMatch && styleMatch;
        });
    }, [themeType, visualStyle]);


    return (
        <div>
            <PageHeader title={t('theme_gallery')} onBack={onBack} helpText={t('theme_gallery_desc')} />
            
            <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)] mb-4 shadow-inner">
                <button
                    onClick={() => setActiveTab('themes')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'themes' ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                ><PaletteIcon className="w-4 h-4" /> {t('tab_themes')}</button>
                <button
                    onClick={() => setActiveTab('typography')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'typography' ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                ><TypeIcon className="w-4 h-4" /> {t('tab_typography')}</button>
            </div>
            
            {activeTab === 'themes' && (
                <div className="animate-fade-in">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 mb-6">
                        <div className="flex items-center bg-[var(--bg-primary)] p-1 rounded-full border border-[var(--border-color)]">
                            <button onClick={() => setThemeType('dark')} className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full transition-colors ${themeType === 'dark' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                <MoonIcon className="w-4 h-4" /> {t('filter_dark')}
                            </button>
                            <button onClick={() => setThemeType('light')} className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full transition-colors ${themeType === 'light' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                <SunIcon className="w-4 h-4" /> {t('filter_light')}
                            </button>
                        </div>
                         <div className="flex items-center bg-[var(--bg-primary)] p-1 rounded-full border border-[var(--border-color)]">
                            <button onClick={() => setVisualStyle('simple')} className={`px-4 py-1 text-xs font-bold rounded-full transition-colors ${visualStyle === 'simple' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                {t('flat')}
                            </button>
                             <button onClick={() => setVisualStyle('premium')} className={`px-4 py-1 text-xs font-bold rounded-full transition-colors ${visualStyle === 'premium' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                {t('glass')}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {filteredThemes.map((theme, index) => (
                             <ThemeCard
                                key={theme.id}
                                theme={theme}
                                isActive={preferences.currentThemeId === theme.id}
                                onClick={() => handleThemeClick(theme)}
                            />
                        ))}
                    </div>
                </div>
            )}
            
            {activeTab === 'typography' && (
                 <div className="space-y-4 animate-fade-in-up">
                    {APP_FONTS.map(font => (
                        <div key={font.id} onClick={() => { setFont(font.id); vibrate(); }}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${preferences.currentFontId === font.id ? 'border-[var(--accent-color)] bg-[var(--bg-secondary)]' : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--accent-color)]/50'}`}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-lg" style={{ fontFamily: font.family }}>{font.name}</p>
                                    <p className="text-xs text-[var(--text-secondary)] mt-1">{t(font.description as any)}</p>
                                </div>
                                 {preferences.currentFontId === font.id && <CheckCircleIcon filled className="w-6 h-6 text-[var(--accent-color)]" />}
                            </div>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
};

export default AppearanceSettings;