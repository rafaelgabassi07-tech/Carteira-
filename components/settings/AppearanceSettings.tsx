import React from 'react';
import PageHeader from '../PageHeader';
import type { AppColor } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';

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

            <div className="space-y-6">
                 <div>
                    <h4 className="font-bold mb-2">{t('accent_color')}</h4>
                    <div className="flex space-x-3 p-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
                        {colors.map(color => (
                            <button key={color.id} onClick={() => updatePreferences({ accentColor: color.id })} className={`w-10 h-10 rounded-full transition-all duration-200 ${preferences.accentColor === color.id ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-secondary)] ring-[var(--accent-color)]' : ''}`} style={{ backgroundColor: color.hex }} />
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="font-bold mb-2">{t('system_theme')}</h4>
                    <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)]">
                        {themes.map(theme => (
                            <button key={theme.id} onClick={() => updatePreferences({ systemTheme: theme.id as any })} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${preferences.systemTheme === theme.id ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>
                                {theme.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="font-bold mb-2">{t('font_size')}</h4>
                    <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)]">
                        {fontSizes.map(fs => (
                             <button key={fs.id} onClick={() => updatePreferences({ fontSize: fs.id as any })} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${preferences.fontSize === fs.id ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>
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
