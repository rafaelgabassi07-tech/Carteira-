
import React, { useState, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { APP_THEMES } from '../constants';
import type { AppTheme } from '../types';
import { vibrate } from '../utils';
import PaletteIcon from '../components/icons/PaletteIcon';

// --- Mini App Preview Component ---
// This component renders a stylized, non-functional version of the app UI
// using the inline styles from the passed 'theme' object.
const ThemePreview: React.FC<{ theme: AppTheme }> = ({ theme }) => {
    const c = theme.colors;
    return (
        <div className="w-full h-32 rounded-xl overflow-hidden relative border shadow-sm transition-all group-hover:scale-105" style={{ backgroundColor: c.bgPrimary, borderColor: c.borderColor }}>
            {/* Fake Header */}
            <div className="h-8 w-full flex items-center px-3 justify-between" style={{ backgroundColor: c.bgSecondary, borderBottom: `1px solid ${c.borderColor}` }}>
                <div className="flex flex-col gap-1">
                    <div className="h-1.5 w-10 rounded-full" style={{ backgroundColor: c.textPrimary }}></div>
                    <div className="h-1 w-6 rounded-full" style={{ backgroundColor: c.textSecondary }}></div>
                </div>
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: c.bgTertiary }}></div>
            </div>
            
            {/* Fake Content */}
            <div className="p-3 flex gap-2">
                {/* Summary Card */}
                <div className="flex-1 h-16 rounded-lg p-2 flex flex-col justify-between shadow-sm" style={{ backgroundColor: c.bgSecondary, border: `1px solid ${c.borderColor}` }}>
                    <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: c.textSecondary }}></div>
                    <div className="h-3 w-16 rounded-full" style={{ backgroundColor: c.textPrimary }}></div>
                    <div className="flex gap-1">
                        <div className="h-1 w-10 rounded-full" style={{ backgroundColor: c.greenText }}></div>
                    </div>
                </div>
                {/* Side Element (Chart placeholder) */}
                <div className="w-8 h-16 rounded-lg shadow-sm flex items-end justify-center pb-1" style={{ backgroundColor: c.bgSecondary, border: `1px solid ${c.borderColor}` }}>
                     <div className="w-3 h-10 rounded-sm" style={{ backgroundColor: c.accentColor }}></div>
                </div>
            </div>
            
            {/* Floating Action Button Preview */}
            <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full shadow-md flex items-center justify-center" style={{ backgroundColor: c.accentColor }}>
                <div className="w-2 h-2 bg-white rounded-sm opacity-80"></div>
            </div>
        </div>
    );
};

const ThemeCard: React.FC<{ theme: AppTheme; isActive: boolean; onApply: (id: string) => void }> = ({ theme, isActive, onApply }) => {
    const { t } = useI18n();
    
    const handleApply = () => {
        vibrate();
        onApply(theme.id);
    };

    return (
        <div className={`flex flex-col p-3 rounded-2xl border transition-all duration-300 group ${isActive ? 'bg-[var(--bg-secondary)] border-[var(--accent-color)] ring-1 ring-[var(--accent-color)]/50' : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--accent-color)]/50'}`}>
            <ThemePreview theme={theme} />
            
            <div className="mt-3 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-sm text-[var(--text-primary)]">{theme.name}</h3>
                    {isActive && <span className="text-[10px] font-bold text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-1.5 py-0.5 rounded uppercase">{t('applied')}</span>}
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] line-clamp-2 mb-3 flex-1">{theme.description}</p>
                
                <button 
                    onClick={handleApply}
                    disabled={isActive}
                    className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${isActive ? 'bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] cursor-default' : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--accent-color)] hover:text-[var(--accent-color-text)] hover:border-[var(--accent-color)] shadow-sm'}`}
                >
                    {isActive ? t('applied') : t('apply')}
                </button>
            </div>
        </div>
    );
};

const ThemeStoreView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useI18n();
    const { preferences, setTheme } = usePortfolio();
    const [filter, setFilter] = useState<'all' | 'dark' | 'light'>('all');

    const filteredThemes = useMemo(() => {
        if (filter === 'all') return APP_THEMES;
        return APP_THEMES.filter(t => t.type === filter);
    }, [filter]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0">
                <PageHeader title={t('theme_store')} onBack={onBack} helpText={t('theme_store_desc')} />
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1 flex-shrink-0">
                {[
                    { id: 'all', label: t('filter_all') },
                    { id: 'dark', label: t('filter_dark') },
                    { id: 'light', label: t('filter_light') },
                ].map(f => (
                    <button
                        key={f.id}
                        onClick={() => { setFilter(f.id as any); vibrate(); }}
                        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filter === f.id ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow-md' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="overflow-y-auto pr-1 custom-scrollbar pb-24 md:pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredThemes.map((theme, idx) => (
                        <div key={theme.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 50}ms` }}>
                            <ThemeCard 
                                theme={theme} 
                                isActive={preferences.currentThemeId === theme.id} 
                                onApply={setTheme}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ThemeStoreView;
