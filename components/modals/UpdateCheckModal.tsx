
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useI18n } from '../../contexts/I18nContext';
import { vibrate } from '../../utils';
import RocketIcon from '../icons/RocketIcon';
import MessageSquareIcon from '../icons/MessageSquareIcon';

// --- Icons ---
const CheckCircleIcon = ({className}: {className?: string}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const WrenchIcon = ({className}: {className?: string}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
const BugIcon = ({className}: {className?: string}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>;


// --- Changelog Accordion Item ---
const ChangelogCard: React.FC<{
    version: string;
    isLatest: boolean;
    devNote?: { title: string; content: string };
    sections: { titleKey: string; color: string; icon: React.ReactNode; itemsKey: string }[];
}> = ({ version, isLatest, devNote, sections }) => {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = useState(isLatest);

    return (
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden animate-fade-in-up">
            <button
                onClick={() => { setIsOpen(!isOpen); vibrate(); }}
                className="w-full flex justify-between items-center p-4 text-left"
            >
                <div className="flex items-center gap-3">
                    <span className="font-bold text-lg text-[var(--text-primary)]">{t(version)}</span>
                    {isLatest && <span className="text-[10px] font-bold bg-[var(--accent-color)] text-[var(--accent-color-text)] px-2 py-0.5 rounded-full uppercase tracking-wider">{t('latest')}</span>}
                </div>
                <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} text-[var(--text-secondary)]`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
            </button>
            
            {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                     {devNote && (
                        <div className="bg-[var(--bg-primary)] p-3 rounded-lg border-l-4 border-[var(--accent-color)] italic text-sm text-[var(--text-secondary)]">
                            <p className="font-bold not-italic text-[var(--text-primary)] mb-1 flex items-center gap-2"><MessageSquareIcon className="w-4 h-4"/> {t(devNote.title)}</p>
                            "{t(devNote.content)}"
                        </div>
                    )}
                    
                    <div className="space-y-3">
                        {sections.map((section, idx) => (
                            <div key={idx}>
                                <div className={`flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider ${section.color}`}>
                                    {section.icon}
                                    {t(section.titleKey)}
                                </div>
                                <ul className="space-y-1.5 pl-2">
                                    {t(section.itemsKey).split('|').map((item, i) => (
                                        <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2.5">
                                            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] flex-shrink-0"/>
                                            <span className="leading-relaxed">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Main Modal Component ---
const UpdateCheckModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { t } = useI18n();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setChecking(false), 1200);
        return () => clearTimeout(timer);
    }, []);

    const changelogData = [
        {
            version: 'changelog_version_title_1_6_0',
            isLatest: true,
            devNote: { title: 'dev_note_title', content: 'dev_note_content' },
            sections: [
                { titleKey: 'changelog_news_title_1_6_0', color: 'text-sky-400', icon: <RocketIcon className="w-4 h-4"/>, itemsKey: 'changelog_news_items_1_6_0' },
                { titleKey: 'changelog_improvements_title_1_6_0', color: 'text-purple-400', icon: <WrenchIcon className="w-4 h-4"/>, itemsKey: 'changelog_improvements_items_1_6_0' },
                { titleKey: 'changelog_fixes_title_1_6_0', color: 'text-emerald-400', icon: <BugIcon className="w-4 h-4"/>, itemsKey: 'changelog_fixes_items_1_6_0' }
            ]
        },
        {
            version: 'changelog_version_title_1_5_0',
            isLatest: false,
            sections: [
                { titleKey: 'changelog_news_title_1_5_0', color: 'text-sky-400', icon: <RocketIcon className="w-4 h-4"/>, itemsKey: 'changelog_news_items_1_5_0' },
                { titleKey: 'changelog_improvements_title_1_5_0', color: 'text-purple-400', icon: <WrenchIcon className="w-4 h-4"/>, itemsKey: 'changelog_improvements_items_1_5_0' },
                { titleKey: 'changelog_fixes_title_1_5_0', color: 'text-emerald-400', icon: <BugIcon className="w-4 h-4"/>, itemsKey: 'changelog_fixes_items_1_5_0' }
            ]
        },
        {
            version: 'changelog_version_title_1_4_3',
            isLatest: false,
            sections: [
                { titleKey: 'changelog_news_title_1_4_3', color: 'text-sky-400', icon: <RocketIcon className="w-4 h-4"/>, itemsKey: 'changelog_news_items_1_4_3' },
                { titleKey: 'changelog_fixes_title_1_4_3', color: 'text-emerald-400', icon: <BugIcon className="w-4 h-4"/>, itemsKey: 'changelog_fixes_items_1_4_3' }
            ]
        },
    ];

    return (
        <Modal title={t('check_for_update')} onClose={onClose} type="slide-up" fullScreen={true}>
            <div className="flex flex-col h-full relative overflow-hidden">
                {checking ? (
                    <div className="flex-1 flex flex-col items-center justify-center animate-fade-in">
                        <div className="relative">
                             <div className="w-16 h-16 border-4 border-t-transparent border-[var(--accent-color)] rounded-full animate-spin mb-4"></div>
                             <div className="absolute inset-0 flex items-center justify-center">
                                <RocketIcon className="w-6 h-6 text-[var(--accent-color)] animate-pulse"/>
                             </div>
                        </div>
                        <p className="text-[var(--text-secondary)] font-medium animate-pulse">{t('checking_for_updates')}</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-[var(--bg-secondary)] p-4 rounded-xl mb-6 border border-[var(--border-color)] flex items-center gap-3 animate-fade-in-up">
                            <div className="w-12 h-12 flex-shrink-0 bg-[var(--accent-color)]/10 rounded-full flex items-center justify-center text-[var(--accent-color)]">
                                <CheckCircleIcon className="w-7 h-7" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">{t('you_are_up_to_date')}</h3>
                                <p className="text-xs text-[var(--text-secondary)]">{t('version')} 1.6.0 • {t('channel_stable')}</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 no-scrollbar pb-safe space-y-3">
                            {changelogData.map((data, idx) => (
                                <div style={{ animationDelay: `${100 + idx * 100}ms` }}>
                                    <ChangelogCard key={idx} {...data} />
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default UpdateCheckModal;
