
import React, { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import { useI18n } from '../../contexts/I18nContext';
import { usePersistentState, vibrate } from '../../utils';
import SparklesIcon from '../icons/SparklesIcon';
import RocketIcon from '../icons/RocketIcon';
import TrendingUpIcon from '../icons/TrendingUpIcon';
import MessageSquareIcon from '../icons/MessageSquareIcon';
import BellIcon from '../icons/BellIcon';
import HeartIcon from '../icons/StarIcon'; // Reusing Star as Heart equivalent for now or generic favorite

// --- Components for Icons ---
const CheckCircleIcon = ({className}: {className?: string}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const BugIcon = ({className}: {className?: string}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>;
const ZapIcon = ({className}: {className?: string}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const WrenchIcon = ({className}: {className?: string}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;

// --- Timeline Component for Changelog ---
const TimelineItem: React.FC<{
    version: string;
    isLatest: boolean;
    sections: { title: string; color: string; icon: React.ReactNode; items: string[] }[];
    isLast?: boolean;
    devNote?: { title: string; content: string };
}> = ({ version, isLatest, sections, isLast, devNote }) => {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = useState(isLatest);

    return (
        <div className="flex gap-4 relative animate-fade-in-up">
            {/* Timeline Line */}
            {!isLast && (
                <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-[var(--border-color)] opacity-50" />
            )}
            
            {/* Indicator */}
            <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${isLatest ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-[var(--accent-color-text)] shadow-lg shadow-[var(--accent-color)]/20' : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)]'}`}>
                {isLatest ? <CheckCircleIcon className="w-4 h-4"/> : <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)]"/>}
            </div>

            {/* Content */}
            <div className="flex-1 pb-8">
                <div 
                    onClick={() => { setIsOpen(!isOpen); vibrate(); }} 
                    className={`flex justify-between items-center cursor-pointer group mb-3 p-3 rounded-xl border transition-all ${isLatest ? 'bg-[var(--bg-secondary)] border-[var(--accent-color)]/30' : 'bg-transparent border-transparent hover:bg-[var(--bg-secondary)]'}`}
                >
                    <div className="flex items-center gap-3">
                        <span className={`font-bold text-lg ${isLatest ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{t(version)}</span>
                        {isLatest && <span className="text-[10px] font-bold bg-[var(--accent-color)] text-[var(--accent-color-text)] px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">{t('latest')}</span>}
                    </div>
                     <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} text-[var(--text-secondary)]`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                </div>
                
                {isOpen && (
                    <div className="space-y-3 pl-2">
                         {devNote && (
                            <div className="bg-[var(--bg-tertiary-hover)]/50 p-3 rounded-lg border-l-4 border-[var(--accent-color)] mb-4 italic text-sm text-[var(--text-secondary)]">
                                <p className="font-bold not-italic text-[var(--text-primary)] mb-1 flex items-center gap-2"><MessageSquareIcon className="w-3 h-3"/> {t(devNote.title)}</p>
                                "{t(devNote.content)}"
                            </div>
                        )}

                        {sections.map((section, idx) => (
                            <div key={idx} className="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border-color)]">
                                <div className={`flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider ${section.color}`}>
                                    {section.icon}
                                    {section.title}
                                </div>
                                <ul className="space-y-2">
                                    {section.items.map((item, i) => (
                                        <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                                            <span className="mt-1.5 w-1 h-1 rounded-full bg-[var(--text-secondary)] flex-shrink-0"/>
                                            <span className="leading-relaxed">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Roadmap Component ---
interface Feature {
    id: string;
    title: string;
    status: 'planned' | 'in_progress';
    votes: number;
    category: 'UI' | 'Backend' | 'Feature';
}

const RoadmapTab: React.FC<{ addToast: (msg: string) => void }> = ({ addToast }) => {
    const { t } = useI18n();
    const [votes, setVotes] = usePersistentState<string[]>('roadmap-votes', []);
    const [notifications, setNotifications] = usePersistentState<string[]>('roadmap-notifications', []);
    
    const features: Feature[] = [
        { id: 'f1', title: 'Importação B3 (CEI)', status: 'planned', votes: 124, category: 'Backend' },
        { id: 'f2', title: 'Rebalanceamento Automático', status: 'in_progress', votes: 210, category: 'Feature' },
        { id: 'f3', title: 'Relatórios em PDF', status: 'planned', votes: 56, category: 'Feature' },
        { id: 'f4', title: 'Widgets iOS/Android', status: 'planned', votes: 189, category: 'UI' },
        { id: 'f5', title: 'Modo Escuro Real (OLED)', status: 'in_progress', votes: 150, category: 'UI' },
    ];

    const handleVote = (id: string) => {
        vibrate(10);
        if (!votes.includes(id)) {
            setVotes([...votes, id]);
            addToast(t('toast_vote_registered'));
        }
    };

    const handleNotify = (id: string) => {
        vibrate(10);
        setNotifications(prev => {
            if (prev.includes(id)) return prev.filter(n => n !== id);
            addToast(t('toast_notify_registered'));
            return [...prev, id];
        });
    };

    const getCategoryColor = (cat: string) => {
        switch(cat) {
            case 'UI': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'Backend': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
            default: return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
        }
    };

    return (
        <div className="py-2 animate-fade-in pb-10">
            <div className="text-center mb-6 bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)]">
                <RocketIcon className="w-8 h-8 text-[var(--accent-color)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">{t('roadmap_subtitle')}</p>
            </div>
            <div className="space-y-3">
                {features.sort((a,b) => b.votes - a.votes).map(feature => {
                    const isVoted = votes.includes(feature.id);
                    const isNotified = notifications.includes(feature.id);
                    const voteCount = feature.votes + (isVoted ? 1 : 0);
                    const progress = Math.min((voteCount / 300) * 100, 100);
                    
                    return (
                        <div key={feature.id} className="bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)] hover:border-[var(--accent-color)]/30 transition-all group relative overflow-hidden">
                            {/* Progress Bar Background */}
                            <div className="absolute bottom-0 left-0 h-1 bg-[var(--accent-color)] transition-all duration-1000" style={{ width: `${progress}%`, opacity: 0.3 }} />

                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getCategoryColor(feature.category)}`}>{feature.category}</span>
                                        {feature.status === 'in_progress' && (
                                            <span className="text-[9px] font-bold bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                                                <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse"/>
                                                {t('feature_in_progress')}
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-sm">{feature.title}</h4>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center gap-2">
                                     <button 
                                        onClick={() => handleVote(feature.id)}
                                        disabled={isVoted}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${isVoted ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary-hover)]'}`}
                                    >
                                        <HeartIcon className={`w-3 h-3 ${isVoted ? 'fill-current' : ''}`} />
                                        {isVoted ? t('voted') : t('vote_feature')}
                                        <span className="ml-1 opacity-70">| {voteCount}</span>
                                    </button>
                                </div>
                                <button 
                                    onClick={() => handleNotify(feature.id)}
                                    className={`p-2 rounded-full transition-all ${isNotified ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary-hover)]'}`}
                                >
                                    <BellIcon className={`w-4 h-4 ${isNotified ? 'fill-current' : ''}`}/>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Suggestion Form ---
const SuggestionTab: React.FC<{ addToast: (msg: string) => void }> = ({ addToast }) => {
    const { t } = useI18n();
    const [type, setType] = useState('feature');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        vibrate(20);
        addToast(t('suggestion_sent'));
        (e.target as HTMLFormElement).reset();
    };

    return (
        <div className="animate-fade-in h-full flex flex-col">
             <div className="bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)] mb-4">
                <h3 className="font-bold text-lg mb-1">{t('submit_suggestion')}</h3>
                <p className="text-xs text-[var(--text-secondary)]">Sua opinião molda o futuro do app.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-4">
                <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2 block">{t('suggestion_type')}</label>
                    <div className="flex gap-2">
                        {['feature', 'improvement', 'bug'].map(tType => (
                             <button 
                                key={tType}
                                type="button"
                                onClick={() => setType(tType)}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${type === tType ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] border-[var(--accent-color)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]'}`}
                             >
                                {t(`suggestion_${tType}`)}
                             </button>
                        ))}
                    </div>
                </div>
                
                <div className="flex-1">
                    <textarea 
                        placeholder={t('suggestion_placeholder')} 
                        className="w-full h-32 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] resize-none"
                        required
                    />
                </div>

                <button type="submit" className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-transform">
                    {t('submit_suggestion')}
                </button>
            </form>
        </div>
    )
}

// --- Stats Bar ---
const StatsBar: React.FC = () => {
    const { t } = useI18n();
    return (
        <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="bg-[var(--bg-primary)] rounded-lg p-2 text-center border border-[var(--border-color)]">
                <p className="text-[10px] text-[var(--text-secondary)] uppercase">{t('stats_satisfaction')}</p>
                <p className="text-sm font-bold text-green-400">98%</p>
            </div>
             <div className="bg-[var(--bg-primary)] rounded-lg p-2 text-center border border-[var(--border-color)]">
                <p className="text-[10px] text-[var(--text-secondary)] uppercase">{t('stats_uptime')}</p>
                <p className="text-sm font-bold text-[var(--accent-color)]">99.9%</p>
            </div>
             <div className="bg-[var(--bg-primary)] rounded-lg p-2 text-center border border-[var(--border-color)]">
                <p className="text-[10px] text-[var(--text-secondary)] uppercase">{t('stats_users')}</p>
                <p className="text-sm font-bold text-purple-400">2.4k</p>
            </div>
        </div>
    )
}

// --- Main Modal Component ---
const UpdateCheckModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { t } = useI18n();
    const [checking, setChecking] = useState(true);
    const [activeTab, setActiveTab] = useState<'history' | 'roadmap' | 'suggest'>('history');
    const [updateChannel, setUpdateChannel] = usePersistentState<'stable' | 'beta'>('update-channel', 'stable');
    const [toast, setToast] = useState<string | null>(null);
    const [confetti, setConfetti] = useState(false);

    const addToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2000);
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            setChecking(false);
            setConfetti(true);
            setTimeout(() => setConfetti(false), 3000);
        }, 1500);
        return () => clearTimeout(timer);
    }, [updateChannel]);

    // --- Simple Confetti Implementation ---
    const ConfettiEffect = () => (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {Array.from({ length: 20 }).map((_, i) => (
                <div
                    key={i}
                    className="absolute w-1.5 h-1.5 bg-[var(--accent-color)] rounded-full animate-confetti"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: `-10%`,
                        animationDuration: `${Math.random() * 2 + 1}s`,
                        animationDelay: `${Math.random() * 1}s`,
                        backgroundColor: ['#38bdf8', '#f472b6', '#4ade80', '#fbbf24'][Math.floor(Math.random() * 4)]
                    }}
                />
            ))}
            <style>{`
                @keyframes confetti {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
                }
                .animate-confetti { animation: confetti linear forwards; }
            `}</style>
        </div>
    );

    const changelogData = [
        {
            version: 'changelog_version_title_1_5_0',
            isLatest: true,
            devNote: { title: 'dev_note_title', content: 'dev_note_content' },
            sections: [
                { title: t('changelog_news_title_1_5_0'), color: 'text-sky-400', icon: <RocketIcon className="w-4 h-4"/>, items: t('changelog_news_items_1_5_0').split('|') },
                { title: t('changelog_improvements_title_1_5_0'), color: 'text-purple-400', icon: <WrenchIcon className="w-4 h-4"/>, items: t('changelog_improvements_items_1_5_0').split('|') },
                { title: t('changelog_fixes_title_1_5_0'), color: 'text-emerald-400', icon: <BugIcon className="w-4 h-4"/>, items: t('changelog_fixes_items_1_5_0').split('|') }
            ]
        },
        {
            version: 'changelog_version_title_1_4_3',
            isLatest: false,
            sections: [
                { title: t('changelog_news_title_1_4_3'), color: 'text-sky-400', icon: <SparklesIcon className="w-4 h-4"/>, items: t('changelog_news_items_1_4_3').split('|') },
                { title: t('changelog_improvements_title_1_4_3'), color: 'text-purple-400', icon: <WrenchIcon className="w-4 h-4"/>, items: t('changelog_improvements_items_1_4_3').split('|') },
                { title: t('changelog_fixes_title_1_4_3'), color: 'text-emerald-400', icon: <BugIcon className="w-4 h-4"/>, items: t('changelog_fixes_items_1_4_3').split('|') }
            ]
        },
        {
            version: 'changelog_version_title_1_4_2',
            isLatest: false,
            sections: [
                { title: t('changelog_news_title_1_4_2'), color: 'text-sky-400', icon: <SparklesIcon className="w-4 h-4"/>, items: t('changelog_news_items_1_4_2').split('|') },
                { title: t('changelog_fixes_title_1_4_2'), color: 'text-amber-400', icon: <BugIcon className="w-4 h-4"/>, items: t('changelog_fixes_items_1_4_2').split('|') }
            ]
        }
    ];

    return (
        <Modal title={t('check_for_update')} onClose={onClose} type="slide-up" fullScreen={true}>
            <div className="flex flex-col h-full relative overflow-hidden">
                 {/* Toast Overlay */}
                 {toast && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-3 py-1.5 rounded-full z-50 animate-fade-in-up">
                        {toast}
                    </div>
                 )}
                
                {confetti && <ConfettiEffect />}

                {/* Checking State */}
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
                         {/* Header & Channel Switcher */}
                        <div className="flex justify-between items-center mb-4 relative z-10 flex-shrink-0">
                             <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
                                <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('you_are_up_to_date')}</span>
                             </div>
                             <button 
                                onClick={() => { setUpdateChannel(prev => prev === 'stable' ? 'beta' : 'stable'); setChecking(true); }}
                                className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors uppercase ${updateChannel === 'beta' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-color)]'}`}
                             >
                                {t(`channel_${updateChannel}`)}
                             </button>
                        </div>

                        <StatsBar />

                        {/* Tabs */}
                        <div className="flex p-1 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] mb-4 relative z-10 flex-shrink-0">
                             <button 
                                onClick={() => { setActiveTab('history'); vibrate(); }} 
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                             >
                                {t('tab_history')}
                             </button>
                             <button 
                                onClick={() => { setActiveTab('roadmap'); vibrate(); }} 
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'roadmap' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                             >
                                {t('tab_roadmap')}
                             </button>
                             <button 
                                onClick={() => { setActiveTab('suggest'); vibrate(); }} 
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'suggest' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                             >
                                {t('tab_suggest')}
                             </button>
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 relative z-10 overflow-y-auto pr-1 no-scrollbar pb-safe">
                            {activeTab === 'history' && (
                                <div className="space-y-2 animate-fade-in">
                                    {changelogData.map((data, idx) => (
                                        <TimelineItem 
                                            key={idx} 
                                            {...data} 
                                            isLast={idx === changelogData.length - 1} 
                                        />
                                    ))}
                                </div>
                            )}
                            {activeTab === 'roadmap' && <RoadmapTab addToast={addToast} />}
                            {activeTab === 'suggest' && <SuggestionTab addToast={addToast} />}
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default UpdateCheckModal;
