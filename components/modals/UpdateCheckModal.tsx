
import React, { useState } from 'react';
import Modal from './Modal';
import { useI18n } from '../../contexts/I18nContext';
import DownloadIcon from '../icons/DownloadIcon';
import CheckCircleIcon from '../icons/CheckCircleIcon';

interface UpdateCheckModalProps {
    onClose: () => void;
    updateAvailable?: boolean;
    onUpdate?: () => void;
}

const ChangelogItem: React.FC<{ title: string; items: string }> = ({ title, items }) => (
    <div className="mb-4">
        <h4 className="font-bold text-sm text-[var(--text-primary)]">{title}</h4>
        <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] mt-1 space-y-1">
            {items.split('|').map((item, index) => (
                <li key={index}>{item}</li>
            ))}
        </ul>
    </div>
);

const UpdateCheckModal: React.FC<UpdateCheckModalProps> = ({ onClose, updateAvailable, onUpdate }) => {
    const { t } = useI18n();
    const [isUpdating, setIsUpdating] = useState(false);

    const handleUpdate = () => {
        if (onUpdate) {
            setIsUpdating(true);
            onUpdate();
        }
    };

    const isUpdateReady = updateAvailable === true;

    return (
        <Modal title={t('check_for_update')} onClose={onClose} type="scale-in">
            <div className="text-center p-2">
                {isUpdateReady ? (
                    <div className="animate-fade-in">
                        <div className="text-green-400 mb-4 flex justify-center">
                            <DownloadIcon className="w-16 h-16" />
                        </div>
                        <h3 className="font-bold text-lg">{t('new_version_available')}</h3>
                        <div className="text-left my-4 bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)] max-h-48 overflow-y-auto">
                            <ChangelogItem title={t('changelog_news_title_1_7_0')} items={t('changelog_news_items_1_7_0')} />
                        </div>
                        <button
                            onClick={handleUpdate}
                            disabled={isUpdating}
                            className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
                        >
                            {isUpdating ? t('installing_update') : t('download_update')}
                        </button>
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <div className="text-green-400 mb-4 flex justify-center">
                            <CheckCircleIcon className="w-16 h-16" filled />
                        </div>
                        <h3 className="font-bold text-lg">{t('you_are_up_to_date')}</h3>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">Versão 1.7.0 ({t('latest')})</p>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default UpdateCheckModal;
