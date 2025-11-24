
import React, { useState, useMemo, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { APP_THEMES } from '../constants';
import type { AppTheme } from '../types';
import { vibrate } from '../utils';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import SparklesIcon from '../components/icons/SparklesIcon';

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

// --- Realistic Mini App Preview ---
const PhonePreview: React.FC<{ theme: AppTheme, visualStyle: 'simple' | 'premium' }> = ({ theme, visualStyle }) => {
    const c = theme.colors;
    const isPremium = visualStyle === 'premium';
    
    // Helper for hex opacity
    const withOpacity = (hex: string, alpha: number) => {
        // Simple hex to rgba simulation for preview purposes if needed, 
        // but sticking to styles logic is better.
        return hex;
    };

    return (
        <div className="w-full aspect-[9/16] md:aspect-video rounded-2xl overflow-hidden relative border shadow-sm flex flex-col select-none transition-all duration-500" 
             style={{ 
                 backgroundColor: c.bgPrimary, 
                 borderColor: c.borderColor,
                 // Add slight glow for premium preview
                 boxShadow: isPremium ? `0 10px 30px -10px ${c.accentColor}30` : 'none'
             }}>
            
            {/* Background Gradient for Premium */}
            {isPremium && (
                <div className="absolute inset-0 pointer-events-none" style={{
                    background: `radial-gradient(circle at 100% 0%, ${c.accentColor}20, transparent 50%), radial-gradient(circle at 0% 100%, ${c.accentColor}10, transparent 50%)`
                }}></div>
            )}

            {/* Simulated Status Bar */}
            <div className="h-6 w-full flex items-center justify-between px-4 z-10" style={{ backgroundColor: isPremium ? 'transparent' : c.bgPrimary }}>
                <div className="w-8 h-2 rounded-full" style={{ backgroundColor: c.textSecondary }}></div>
                <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.textSecondary }}></div>
                    <div className="w-3 h-3 rounded-full" style={{ border: `1px solid ${c.textSecondary}` }}></div>
                </div>
            </div>

            {/* Header */}
            <div className={`pt-2 pb-3 px-4 flex justify-between items-center z-10 ${isPremium ? 'backdrop-blur-md' : ''}`} 
                 style={{ 
                     borderBottom: `1px solid ${c.borderColor}`,
                     backgroundColor: isPremium ? `${c.bgSecondary}80` : c.bgPrimary 
                 }}>
                <div className="flex flex-col gap-1.5">
                    <div className="h-2.5 w-16 rounded-full opacity-80" style={{ backgroundColor: c.textPrimary }}></div>
                    <div className="h-1.5 w-10 rounded-full opacity-60" style={{ backgroundColor: c.textSecondary }}></div>
                </div>
                <div className="w-8 h-8 rounded-full opacity-20" style={{ backgroundColor: c.textSecondary }}></div>
            </div>

            {/* Content Scroll */}
            <div className="flex-1 p-4 flex flex-col gap-3 relative overflow-hidden z-0">
                
                {/* Summary Card with Chart */}
                <div className={`w-full rounded-xl p-3 relative overflow-hidden flex flex-col justify-between h-28 ${isPremium ? 'shadow-lg' : 'shadow-sm'}`}
                     style={{ 
                         background: isPremium 
                            ? `linear-gradient(135deg, ${c.bgSecondary}AA 0%, ${c.bgSecondary}44 100%)` 
                            : c.bgSecondary,
                         borderColor: c.borderColor,
                         borderWidth: '1px',
                         backdropFilter: isPremium ? 'blur(10px)' : 'none'
                     }}>
                    <div className="flex justify-between items-start z-10">
                        <div className="h-1.5 w-12 rounded-full opacity-60" style={{ backgroundColor: c.textSecondary }}></div>
                        <div className="h-3 w-3 rounded-full opacity-80" style={{ backgroundColor: c.greenText }}></div>
                    </div>
                    
                    <div className="z-10">
                        <div className="h-5 w-24 rounded-md mb-1" style={{ backgroundColor: c.textPrimary }}></div>
                        <div className="h-2 w-14 rounded-full opacity-80" style={{ backgroundColor: c.greenText }}></div>
                    </div>

                    {/* Abstract Chart Background */}
                    <svg className="absolute bottom-0 right-0 w-full h-20 opacity-20" preserveAspectRatio="none" viewBox="0 0 100 50">
                        <path d="M0 50 L0 30 L20 40 L40 20 L60 35 L80 10 L100 25 L100 50 Z" fill={c.accentColor} />
                    </svg>
                </div>

                {/* Asset List */}
                <div className="flex flex-col gap-2 mt-1">
                    {[1, 2].map((i) => (
                        <div key={i} className="h-12 w-full rounded-lg flex items-center px-2 gap-3" 
                             style={{ 
                                 backgroundColor: isPremium ? `${c.bgSecondary}99` : c.bgSecondary, 
                                 borderColor: c.borderColor, 
                                 borderWidth: '1px',
                                 backdropFilter: isPremium ? 'blur(4px)' : 'none'
                             }}>
                            <div className="w-8 h-8 rounded-md opacity-20" style={{ backgroundColor: c.accentColor }}></div>
                            <div className="flex-1 flex flex-col gap-1.5">
                                <div className="h-2 w-12 rounded-full" style={{ backgroundColor: c.textPrimary }}></div>
                                <div className="h-1.5 w-8 rounded-full opacity-60" style={{ backgroundColor: c.textSecondary }}></div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                                <div className="h-2 w-10 rounded-full" style={{ backgroundColor: c.textPrimary }}></div>
                                <div className="h-1.5 w-6 rounded-full" style={{ backgroundColor: i === 1 ? c.greenText : c.redText }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Nav */}
            <div className={`h-12 w-full flex justify-around items-center px-2 z-10 ${isPremium ? 'backdrop-blur-md' : ''}`} 
                 style={{ 
                     backgroundColor: isPremium ? `${c.bgSecondary}CC` : c.bgSecondary, 
                     borderTop: `1px solid ${c.borderColor}` 
                 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: i === 1 ? c.accentColor : c.textSecondary, opacity: i === 1 ? 1 : 0.3 }}></div>
                ))}
            </div>
        </div>
    );
};

const ThemeStoreView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useI18n();
    const { preferences, setTheme, updatePreferences } = usePortfolio();
    
    // Initialize filter based on the currently active theme type
    const activeThemeData = useMemo(() => 
        APP_THEMES.find(t => t.id === preferences.currentThemeId) || APP_THEMES[0], 
    [preferences.currentThemeId]);

    const [filter, setFilter] = useState<'dark' | 'light'>(activeThemeData.type);

    // Update filter if theme changes externally or on first load (to match current theme)
    useEffect(() => {
        setFilter(activeThemeData.type);
    }, [activeThemeData.type]);

    const filteredThemes = useMemo(() => {
        return APP_THEMES.filter(t => t.type === filter);
    }, [filter]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0">
                <PageHeader title={t('theme_store')} onBack={onBack} helpText={t('theme_store_desc')} />
            </div>

            {/* Content */}
            <div className="overflow-y-auto custom-scrollbar pb-24 md:pb-6 px-1 relative">
                
                {/* Hero: Active Theme */}
                <div className="mb-6 animate-fade-in">
                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-1">{t('applied')}</h3>
                    <div className="bg-[var(--bg-secondary)] rounded-3xl p-4 border border-[var(--accent-color)] shadow-lg shadow-[var(--accent-color)]/10 relative overflow-hidden">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                            <div className="order-2 md:order-1">
                                <PhonePreview theme={activeThemeData} visualStyle={preferences.visualStyle} />
                            </div>
                            <div className="order-1 md:order-2 flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircleIcon className="w-6 h-6 text-[var(--accent-color)]" filled />
                                    <h2 className="text-2xl font-bold text-[var(--text-primary)]">{activeThemeData.name}</h2>
                                </div>
                                <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">{activeThemeData.description}</p>
                                <div className="flex gap-2">
                                    {Object.values(activeThemeData.colors).slice(0, 5).map((c, i) => (
                                        <div key={i} className="w-6 h-6 rounded-full border border-[var(--border-color)] shadow-sm" style={{ backgroundColor: c }}></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sticky Filter & Visual Style Header */}
                <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-[var(--border-color)] -mx-1 px-1 py-3 mb-6 transition-colors duration-300 flex flex-col gap-3">
                    
                    {/* Row 1: Dark/Light Filter */}
                    <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)] shadow-sm">
                        <button
                            onClick={() => { setFilter('dark'); vibrate(); }}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${filter === 'dark' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-md transform scale-[1.02]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            <MoonIcon className="w-4 h-4" />
                            {t('filter_dark')}
                        </button>
                        <button
                            onClick={() => { setFilter('light'); vibrate(); }}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${filter === 'light' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-md transform scale-[1.02]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            <SunIcon className="w-4 h-4" />
                            {t('filter_light')}
                        </button>
                    </div>

                    {/* Row 2: Visual Style (Integrated) */}
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                            <SparklesIcon className="w-4 h-4" />
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

                {/* Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredThemes.filter(t => t.id !== preferences.currentThemeId).map((theme, idx) => (
                        <div 
                            key={theme.id} 
                            onClick={() => { setTheme(theme.id); vibrate(20); }}
                            className="group bg-[var(--bg-secondary)] rounded-2xl p-3 border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in-up shadow-sm hover:shadow-xl"
                            style={{ animationDelay: `${idx * 50}ms` }}
                        >
                            <div className="rounded-xl overflow-hidden border border-[var(--border-color)] group-hover:border-transparent transition-colors mb-3 shadow-inner relative">
                                <PhonePreview theme={theme} visualStyle={preferences.visualStyle} />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                            </div>
                            <div className="px-1">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className="font-bold text-sm text-[var(--text-primary)] truncate pr-2">{theme.name}</h4>
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.colors.accentColor }}></div>
                                </div>
                                <p className="text-[10px] text-[var(--text-secondary)] line-clamp-1">{theme.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
                
                {filteredThemes.filter(t => t.id !== preferences.currentThemeId).length === 0 && (
                    <div className="text-center py-10 text-[var(--text-secondary)] animate-fade-in">
                        <p className="text-sm font-medium">Todos os temas desta categoria já estão em uso ou não há opções disponíveis.</p>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ThemeStoreView;
