import React from 'react';
import PageHeader from '../PageHeader';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import ToggleSwitch from '../ToggleSwitch';
import PaletteIcon from '../icons/PaletteIcon';
import TypeIcon from '../icons/TypeIcon';

const AppearanceSettings: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences } = usePortfolio();

    return (
        <div>
            <PageHeader title={t('appearance')} onBack={onBack} />

            <div className="space-y-6">
                
                {/* Banners to Galleries */}
                <div className="bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-[var(--accent-color)] rounded-lg text-[var(--accent-color-text)]">
                                <PaletteIcon className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold text-lg">{t('theme_gallery')}</h4>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed max-w-xs">
                            {t('open_theme_store_desc')}
                        </p>
                        <div className="inline-flex items-center text-sm font-bold text-[var(--accent-color)]">
                           Acesse no menu de Ajustes →
                        </div>
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-[var(--accent-color)] opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity"></div>
                </div>

                <div className="bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-[var(--accent-color)] rounded-lg text-[var(--accent-color-text)]">
                                <TypeIcon className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold text-lg">{t('typography')}</h4>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed max-w-xs">
                            {t('typography_desc')}
                        </p>
                         <div className="inline-flex items-center text-sm font-bold text-[var(--accent-color)]">
                           Acesse no menu de Ajustes →
                        </div>
                    </div>
                </div>

                {/* Interface Settings */}
                <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)]">
                    <h4 className="font-bold mb-4 text-sm uppercase tracking-wider text-[var(--text-secondary)]">{t('ui_interface')}</h4>
                    
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold text-sm">{t('compact_mode')}</p>
                            </div>
                            <ToggleSwitch enabled={preferences.compactMode} setEnabled={(val) => updatePreferences({ compactMode: val })} />
                        </div>

                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold text-sm">{t('show_currency')}</p>
                            </div>
                            <ToggleSwitch enabled={preferences.showCurrencySymbol} setEnabled={(val) => updatePreferences({ showCurrencySymbol: val })} />
                        </div>

                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold text-sm">{t('reduce_motion')}</p>
                            </div>
                            <ToggleSwitch enabled={preferences.reduceMotion} setEnabled={(val) => updatePreferences({ reduceMotion: val })} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppearanceSettings;