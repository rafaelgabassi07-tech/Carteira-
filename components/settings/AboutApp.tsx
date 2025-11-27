
import React, { useState } from 'react';
import PageHeader from '../PageHeader';
import PrivacyIcon from '../icons/PrivacyIcon';
import TermsIcon from '../icons/TermsIcon';
import Modal from '../modals/Modal';
import { useI18n } from '../../contexts/I18nContext';

const AboutApp: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const [modalContent, setModalContent] = useState<{ title: string; content: string } | null>(null);

    return (
        <div>
            <PageHeader title={t('about_app')} onBack={onBack} />
            <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)]">
                <div className="flex flex-col items-center text-center my-8">
                    <img src="https://cdn-icons-png.flaticon.com/512/5556/5556468.png" alt="App Logo" className="w-20 h-20 mb-4" />
                    <h1 className="text-2xl font-bold">Invest Portfolio</h1>
                    <p className="text-[var(--text-secondary)]">{t('about_app_desc')}</p>
                    <p className="text-xs text-gray-500 mt-2">{t('version')} 1.6.5</p>
                </div>

                <div className="space-y-2">
                    <div onClick={() => setModalContent({ title: t('privacy_policy'), content: t('privacy_policy_content') })} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-[var(--bg-tertiary-hover)] cursor-pointer">
                        <PrivacyIcon className="w-5 h-5 text-[var(--text-secondary)]" />
                        <span className="text-sm font-medium">{t('privacy_policy')}</span>
                    </div>
                    <div onClick={() => setModalContent({ title: t('terms_of_service'), content: t('terms_of_service_content') })} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-[var(--bg-tertiary-hover)] cursor-pointer">
                        <TermsIcon className="w-5 h-5 text-[var(--text-secondary)]" />
                        <span className="text-sm font-medium">{t('terms_of_service')}</span>
                    </div>
                </div>
                
                <p className="text-center text-xs text-gray-600 mt-12">{new Date().getFullYear()} © Invest Portfolio. {t('all_rights_reserved')}</p>
            </div>
            
            {modalContent && (
                <Modal title={modalContent.title} onClose={() => setModalContent(null)} type="scale-in">
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{modalContent.content}</p>
                </Modal>
            )}
        </div>
    );
};

export default AboutApp;
