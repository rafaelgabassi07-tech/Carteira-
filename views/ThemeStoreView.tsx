import React, { useState, useMemo, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { APP_THEMES, APP_FONTS } from '../constants';
import type { AppTheme } from '../types';
import { vibrate } from '../utils';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import TypeIcon from '../components/icons/TypeIcon';
import PaletteIcon from '../components/icons/PaletteIcon';
import LayoutGridIcon from '../components/icons/LayoutGridIcon';
import ToggleSwitch from '../components/ToggleSwitch';

// --- Icons for this view ---
const MoonIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
);

const SunIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
    </svg>
);

// --- Sub-Components for the View ---

const PhonePreview: React.FC<{ theme: AppTheme, visualStyle: 'simple' | 'premium' }> = ({ theme, visualStyle }) => {
    const c = theme.colors;
    const isPremium = visualStyle === 'premium';
    
    return (
        <div className="w-full max-w-[150px] md:max-w-[180px] mx-auto md:mx-0 aspect-[9/19] rounded-xl overflow-hidden relative border shadow-sm flex flex-col select-none transition-all duration-500" 
             style={{ 
                 backgroundColor: c.bgPrimary, 
                 borderColor: c.borderColor,
                 boxShadow: isPremium ? `0 10px 20px -10px ${c.accentColor}20` : 'none'
             }}>
            
            {isPremium && (
                <div className="absolute inset-0 pointer-events-none" style={{
                    background: `radial-gradient(circle at 100% 0%, ${c.accentColor}20, transparent 50%), radial-gradient(circle at 0% 100%, ${c.accentColor}10, transparent 50%)`
                }}></div>
            )}

            <div className="h-5 w-full flex items-center justify-between px-2 z-10" style={{ backgroundColor: isPremium ? 'transparent' : c.bgPrimary }}>
                <div className="w-6 h-1.5 rounded-full" style={{ backgroundColor: c.textSecondary }}></div>
                <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.textSecondary }}></div>
                    <div className="w-2 h-2 rounded-full" style={{ border: `1px solid ${c.textSecondary}` }}></div>
                </div>
            </div>

            <div className={`pt-1 pb-2 px-3 flex justify-between items-center z-10 ${isPremium ? 'backdrop-blur-sm' : ''}`} 
                 style={{ 
                     borderBottom: `1px solid ${c.borderColor}`,
                     backgroundColor: isPremium ? `${c.bgSecondary}80` : c.bgPrimary 
                 }}>
                <div className="flex flex-col gap-1">
                    <div className="h-2 w-12 rounded-full opacity-80" style={{ backgroundColor: c.textPrimary }}></div>
                    <div className="h-1 w-8 rounded-full opacity-60" style={{ backgroundColor: c.textSecondary }}></div>
                </div>
                <div className="w-6 h-6 rounded-full opacity-20" style={{ backgroundColor: c.textSecondary }}></div>
            </div>

            <div className="flex-1 p-2 flex flex-col gap-2 relative overflow-hidden z-0">
                
                <div className={`w-full rounded-lg p-2 relative overflow-hidden flex flex-col justify-between flex-1 ${isPremium ? 'shadow-md' : 'shadow-sm'}`}
                     style={{ 
                         background: isPremium 
                            ? `linear-gradient(135deg, ${c.bgSecondary}AA 0%, ${c.bgSecondary}44 100%)` 
                            : c.bgSecondary,
                         borderColor: c.borderColor,
                         borderWidth: '1px',
                         backdropFilter: isPremium ? 'blur(10px)' : 'none'
                     }}>
                    <div className="flex justify-between items-start z-10">
                        <div className="h-1 w-8 rounded-full opacity-60" style={{ backgroundColor: c.textSecondary }}></div>
                        <div className="w-2 h-2 rounded-full opacity-80" style={{ backgroundColor: c.greenText }}></div>
                    </div>
                    
                    <div className="z-10">
                        <div className="h-4 w-16 rounded-md mb-0.5" style={{ backgroundColor: c.textPrimary }}></div>
                        <div className="h-1.5 w-10 rounded-full opacity-80" style={{ backgroundColor: c.greenText }}></div>
                    </div>

                    <svg className="absolute bottom-0 right-0 w-full h-12 opacity-20" preserveAspectRatio="none" viewBox="0 0 100 50">
                        <path d="M0 50 L0 30 L20 40 L40 20 L60 35 L80 10 L100 25 L100 50 Z" fill={c.accentColor} />
                    </svg>
                </div>

                <div className="flex flex-col gap-1.5 mt-1">
                    {[1, 2].map((i) => (
                        <div key={i} className="h-8 w-full rounded-md flex items-center px-1.5 gap-2" 
                             style={{ 
                                 backgroundColor: isPremium ? `${c.bgSecondary}99` : c.bgSecondary, 
                                 borderColor: c.borderColor, 
                                 borderWidth: '1px',
                                 backdropFilter: isPremium ? 'blur(4px)' : 'none'
                             }}>
                            <div className="w-6 h-6 rounded-sm opacity-20" style={{ backgroundColor: c.accentColor }}></div>
                            <div className="flex-1 flex flex-col gap-1">
                                <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: c.textPrimary }}></div>
                                <div className="h-1 w-6 rounded-full opacity-60" style={{ backgroundColor: c.textSecondary }}></div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className="h-1.5 w-6 rounded-full" style={{ backgroundColor: c.textPrimary }}></div>
                                <div className="h-1 w-4 rounded-full" style={{ backgroundColor: i === 1 ? c.greenText : c.redText }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className={`h-8 w-full flex justify-around items-center px-2 z-10 ${isPremium ? 'backdrop-blur-sm' : ''}`} 
                 style={{ 
                     backgroundColor: isPremium ? `${c.bgSecondary}CC` : c.bgSecondary, 
                     borderTop: `1px solid ${c.borderColor}` 
                 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: i === 1 ? c.accentColor : c.textSecondary, opacity: i === 1 ? 1 : 0.3 }}></div>
                ))}
            </div>
        </div>
    );
};

const ThemesSection: React.FC = () => {
    const { t } = useI18n();
    const { preferences, setTheme, updatePreferences } = usePortfolio();

    const activeThemeData = useMemo(() => 
        APP_THEMES.find(t => t.id === preferences.currentThemeId) || APP_THEMES[0], 
    [preferences.currentThemeId]);

    const [filter, setFilter] = useState<'dark' | 'light'>(activeThemeData.type);

    useEffect(() => {
        setFilter(activeThemeData.type);
    }, [activeThemeData.type]);

    const filteredThemes = useMemo(() => {
        return APP_THEMES.filter(t => t.type === filter);
    }, [filter]);

    return (
        <div className="px-1">
            <div className="mb-4 animate-fade-in">
                <div className="bg-[var(--bg-secondary)] rounded-2xl p-3 border border-[var(--accent-color)] shadow-lg shadow-[var(--accent-color)]/10 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="w-full md:w-auto flex-shrink-0">
                            <PhonePreview theme={activeThemeData} visualStyle={preferences.visualStyle} />
                        </div>
                        <div className="flex-1 w-full">
                            <div className="flex items-center gap-2 mb-1">
                                <CheckCircleIcon className="w-5 h-5 text-[var(--accent-color)]" filled />
                                <h2 className="text-xl font-bold text-[var(--text-primary)]">{activeThemeData.name}</h2>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">{activeThemeData.description}</p>
                            <div className="flex gap-1.5">
                                {Object.values(activeThemeData.colors).slice(0, 5).map((c, i) => (
                                    <div key={i} className="w-5 h-5 rounded-full border border-[var(--border-color)] shadow-sm" style={{ backgroundColor: c }}></div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-[var(--border-color)] -mx-1 px-1 py-3 mb-6 transition-colors duration-300 flex flex-col gap-3">
                <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)] shadow-sm">
                    <button
                        onClick={() => { setFilter('dark'); vibrate(); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${filter === 'dark' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-md transform scale-[1.02]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <MoonIcon className="w-5 h-5" />
                        {t('filter_dark')}
                    </button>
                    <button
                        onClick={() => { setFilter('light'); vibrate(); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${filter === 'light' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-md transform scale-[1.02]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <SunIcon className="w-5 h-5" />
                        {t('filter_light')}
                    </button>
                </div>

                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                        <SparklesIcon className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-wider">{t('visual_finish')}</span>
                    </div>
                    <div className="flex bg-[var(--bg-secondary)] p-0.5 rounded-lg border border-[var(--border-color)]">
                         <button 
                            onClick={() => { updatePreferences({ visualStyle: 'simple' }); vibrate(); }}
                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${preferences.visualStyle === 'simple' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                         >
                             {t('style_simple')}
                         </button>
                         <button 
                            onClick={() => { updatePreferences({ visualStyle: 'premium' }); vibrate(); }}
                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${preferences.visualStyle === 'premium' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                         >
                             {t('style_premium')}
                         </button>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredThemes.filter(t => t.id !== preferences.currentThemeId).map((theme, idx) => (
                    <div 
                        key={theme.id} 
                        onClick={() => { setTheme(theme.id); vibrate(20); }}
                        className="group rounded-2xl border border-transparent hover:border-[var(--accent-color)] hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in-up shadow-sm hover:shadow-xl overflow-hidden"
                        style={{ animationDelay: `${idx * 50}ms` }}
                    >
                        <div className="shadow-inner relative">
                            <PhonePreview theme={theme} visualStyle={preferences.visualStyle} />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                            <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 via-black/50 to-transparent pointer-events-none">
                                <h4 className="font-bold text-sm text-white truncate">{theme.name}</h4>
                                <p className="text-xs text-gray-300 line-clamp-1">{theme.description}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const TypographySection: React.FC = () => {
    const { t } = useI18n();
    const { preferences, updatePreferences } = usePortfolio();

    const handleSetFont = (fontId: string) => {
        vibrate(20);
        updatePreferences({ currentFontId: fontId });
    };

    return (
        <div className="px-1 space-y-8">
            <div>
                <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-1">{t('font_family')}</h3>
                <div className="space-y-4">
                    {APP_FONTS.map(font => {
                        const isActive = preferences.currentFontId === font.id;
                        return (
                            <div 
                                key={font.id} 
                                onClick={() => handleSetFont(font.id)}
                                className={`bg-[var(--bg-secondary)] rounded-2xl p-4 border transition-all duration-200 cursor-pointer hover:-translate-y-0.5 ${isActive ? 'border-[var(--accent-color)] ring-2 ring-[var(--accent-color)]/20 shadow-lg' : 'border-[var(--border-color)] hover:border-[var(--accent-color)]/50'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-lg" style={{ fontFamily: font.family }}>{font.name}</h4>
                                        <p className="text-xs text-[var(--text-secondary)] mt-1">{t(font.description)}</p>
                                    </div>
                                    {isActive && <CheckCircleIcon filled className="w-6 h-6 text-[var(--accent-color)] flex-shrink-0" />}
                                </div>
                                <div className="mt-4 p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]">
                                    <p className="text-sm" style={{ fontFamily: font.family }}>
                                        A rápida raposa marrom salta sobre o cão preguiçoso. 123.456,78
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/90 backdrop-blur-xl -mx-1 px-1 py-3 mb-2">
                 <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                    <TypeIcon className="w-5 h-5" />
                    {t('text_size')}
                </h3>
                <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)] shadow-sm">
                    <button 
                        onClick={() => { updatePreferences({ fontSize: 'small' }); vibrate(); }}
                        className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${preferences.fontSize === 'small' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-md' : 'text-[var(--text-secondary)]'}`}
                    >
                        {t('font_small')}
                    </button>
                    <button 
                        onClick={() => { updatePreferences({ fontSize: 'medium' }); vibrate(); }}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${preferences.fontSize === 'medium' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-md' : 'text-[var(--text-secondary)]'}`}
                    >
                        {t('font_medium')}
                    </button>
                    <button 
                        onClick={() => { updatePreferences({ fontSize: 'large' }); vibrate(); }}
                        className={`flex-1 py-3 text-base font-bold rounded-lg transition-all ${preferences.fontSize === 'large' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-md' : 'text-[var(--text-secondary)]'}`}
                    >
                        {t('font_large')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ThemeStoreView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<'themes' | 'typography'>('themes');

    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0">
                <PageHeader title={t('theme_gallery')} onBack={onBack} helpText={t('theme_gallery_desc')} />
            </div>

            <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)] mb-6 shadow-inner mx-1">
                <button
                    onClick={() => setActiveTab('themes')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'themes' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                    <PaletteIcon className="w-5 h-5" />
                    {t('tab_themes')}
                </button>
                 <button
                    onClick={() => setActiveTab('typography')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'typography' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                    <TypeIcon className="w-5 h-5" />
                    {t('tab_typography')}
                </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar pb-24 md:pb-6 flex-1">
                <div key={activeTab} className="animate-fade-in">
                    {activeTab === 'themes' && <ThemesSection />}
                    {activeTab === 'typography' && <TypographySection />}
                </div>
            </div>
        </div>
    );
};

export default ThemeStoreView;