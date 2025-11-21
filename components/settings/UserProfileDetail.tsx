
import React, { useState } from 'react';
import PageHeader from '../PageHeader';
import type { ToastMessage } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';

const UserProfileDetail: React.FC<{ onBack: () => void; addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ onBack, addToast }) => {
    const { t } = useI18n();
    // FIX: Destructure userProfile and updateUserProfile from context.
    const { userProfile, updateUserProfile } = usePortfolio();
    // FIX: Initialize state with userProfile from context instead of mock data.
    const [user, setUser] = useState(userProfile);
    const [isEditing, setIsEditing] = useState(false);

    const handleSave = () => {
        // FIX: Update the user profile in the global context.
        updateUserProfile(user);
        addToast(t('toast_profile_updated'), 'success');
        setIsEditing(false);
    };

    return (
        <div>
            <PageHeader title={t('edit_profile')} onBack={onBack} helpText={t('help_profile')} />

            <div className="flex flex-col items-center mb-8">
                <div className="relative group">
                    <img src={user.avatarUrl} alt="User Avatar" className="w-24 h-24 rounded-full border-4 border-[var(--accent-color)] shadow-xl" />
                    <button className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => addToast(t('toast_avatar_changed'), 'info')}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)]">{t('name')}</label>
                    <input
                        type="text"
                        value={user.name}
                        onChange={(e) => setUser({ ...user, name: e.target.value })}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-2 mt-1 focus:outline-none focus:border-[var(--accent-color)]"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)]">{t('email')}</label>
                    <input
                        type="email"
                        value={user.email}
                        readOnly
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2 mt-1 text-[var(--text-secondary)] cursor-not-allowed"
                    />
                </div>
                 <button onClick={handleSave} className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3 rounded-lg mt-6">
                    {t('save_changes')}
                </button>
            </div>
        </div>
    );
};

export default UserProfileDetail;
