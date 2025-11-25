import React, { useState, useRef } from 'react';
import PageHeader from '../PageHeader';
import type { ToastMessage } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';

const UserProfileDetail: React.FC<{ onBack: () => void; addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ onBack, addToast }) => {
    const { t } = useI18n();
    const { userProfile, updateUserProfile } = usePortfolio();
    const [user, setUser] = useState(userProfile);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = () => {
        // Update name in avatar URL if it's still a ui-avatars URL
        const isUiAvatar = user.avatarUrl.startsWith('https://ui-avatars.com');
        const finalUser = {
            ...user,
            avatarUrl: isUiAvatar 
                ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=0D8ABC&color=fff`
                : user.avatarUrl
        };
        updateUserProfile(finalUser);
        addToast(t('toast_profile_updated'), 'success');
        onBack();
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                addToast('Por favor, selecione um arquivo de imagem.', 'error');
                return;
            }
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                addToast('A imagem é muito grande (máx 2MB).', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setUser({ ...user, avatarUrl: base64String });
                addToast(t('toast_avatar_changed'), 'success');
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div>
            <PageHeader title={t('edit_profile')} onBack={onBack} helpText={t('help_profile')} />
            
            <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)]">
                <div className="flex flex-col items-center mb-8">
                    <div className="relative group">
                        <img src={user.avatarUrl} alt="User Avatar" className="w-24 h-24 rounded-full border-4 border-[var(--accent-color)] shadow-xl object-cover" />
                        <button 
                            onClick={handleAvatarClick}
                            className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleAvatarChange} 
                            className="hidden" 
                            accept="image/png, image/jpeg, image/gif"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)]">{t('name')}</label>
                        <input
                            type="text"
                            value={user.name}
                            onChange={(e) => setUser({ ...user, name: e.target.value })}
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2 mt-1 focus:outline-none focus:border-[var(--accent-color)]"
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
        </div>
    );
};

export default UserProfileDetail;