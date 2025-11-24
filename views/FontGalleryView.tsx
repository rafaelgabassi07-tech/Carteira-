import React from 'react';
import PageHeader from '../components/PageHeader';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { APP_FONTS } from '../constants';
import { vibrate } from '../utils';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import TypeIcon from '../components/icons/TypeIcon';

const FontGalleryView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences } = usePortfolio();

    const handleSetFont = (fontId: string) => {
        vibrate(20);
        updatePreferences({ currentFontId: fontId });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0">
                <PageHeader title={t('typography')} onBack={onBack} helpText={t('typography_desc')} />
            </div>

            <div className="overflow-y-auto custom-scrollbar pb-24 md:pb-6 px-1 space-y-8">
                {/* Font Family Selection */}
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
                                            <p className="text-xs text-[var(--text-secondary)] mt-1">{t(`font_${font.id}_desc`)}</p>
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

                {/* Font Size Selection */}
                <div>
                     <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                        <TypeIcon className="w-4 h-4" />
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
        </div>
    );
};

export default FontGalleryView;