import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import ToggleSwitch from '../ToggleSwitch';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { copyToClipboard, vibrate } from '../../utils';
import type { ToastMessage } from '../../types';

interface ShareModalProps {
    onClose: () => void;
    addToast: (message: string, type?: ToastMessage['type']) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ onClose, addToast }) => {
    const { t, formatCurrency } = useI18n();
    const { assets, generatePublicLink } = usePortfolio();
    const [isPublicLinkEnabled, setIsPublicLinkEnabled] = useState(false);
    
    const publicLink = useMemo(() => {
        if (isPublicLinkEnabled) {
            return generatePublicLink();
        }
        return '';
    }, [isPublicLinkEnabled, generatePublicLink]);

    const handleShareSnapshot = async () => {
        const totalValue = assets.reduce((acc, asset) => acc + asset.currentPrice * asset.quantity, 0);
        const text = t('share_portfolio_text', { value: formatCurrency(totalValue) });
        if (await copyToClipboard(text)) {
            addToast('Copiado para área de transferência!', 'success');
        }
    };
    
    const handleCopyLink = async () => {
        if (await copyToClipboard(publicLink)) {
            addToast('Link copiado!', 'success');
        }
    };

    return (
        <Modal title={t('share_modal_title')} onClose={onClose}>
            <div className="space-y-6">
                {/* Share Snapshot */}
                <div className="bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)]">
                    <h3 className="font-bold">{t('share_snapshot_title')}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 mb-3">{t('share_snapshot_desc')}</p>
                    <button 
                        onClick={handleShareSnapshot}
                        className="w-full bg-[var(--bg-tertiary-hover)] text-[var(--text-primary)] font-bold py-2 rounded-lg text-sm hover:bg-[var(--accent-color)]/20 transition-colors"
                    >
                        {t('share_snapshot_action')}
                    </button>
                </div>

                {/* Public Link */}
                <div className="bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)]">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-bold">{t('share_public_link_title')}</h3>
                            <p className="text-xs text-[var(--text-secondary)] mt-1 pr-4">{t('share_public_link_desc')}</p>
                        </div>
                        <ToggleSwitch enabled={isPublicLinkEnabled} setEnabled={setIsPublicLinkEnabled} />
                    </div>
                    {isPublicLinkEnabled && (
                        <div className="mt-4 animate-fade-in space-y-3">
                            <input
                                type="text"
                                readOnly
                                value={publicLink}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-2 text-xs text-[var(--text-secondary)] focus:outline-none"
                            />
                            <button 
                                onClick={handleCopyLink}
                                className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-2 rounded-lg text-sm shadow-lg hover:opacity-90 transition-opacity"
                            >
                                {t('share_public_link_copy')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ShareModal;