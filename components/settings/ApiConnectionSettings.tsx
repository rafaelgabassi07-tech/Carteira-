import React, { useState } from 'react';
import PageHeader from '../PageHeader';
import type { ToastMessage } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { validateApiKey } from '../../services/geminiService';
import { validateBrapiToken } from '../../services/brapiService';
import { vibrate } from '../../utils';

const ApiConnectionSettings: React.FC<{ onBack: () => void; addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ onBack, addToast }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences } = usePortfolio();
    
    const [geminiKey, setGeminiKey] = useState(preferences.geminiApiKey || '');
    const [brapiToken, setBrapiToken] = useState(preferences.brapiToken || '');

    const [testingGemini, setTestingGemini] = useState(false);
    const [testingBrapi, setTestingBrapi] = useState(false);

    const handleTestGemini = async () => {
        vibrate();
        setTestingGemini(true);
        const isValid = await validateApiKey(geminiKey);
        setTestingGemini(false);
        addToast(isValid ? t('toast_connection_success') : t('toast_connection_failed'), isValid ? 'success' : 'error');
    };
    
    const handleTestBrapi = async () => {
        vibrate();
        setTestingBrapi(true);
        const isValid = await validateBrapiToken(brapiToken);
        setTestingBrapi(false);
        addToast(isValid ? t('toast_connection_success') : t('toast_connection_failed'), isValid ? 'success' : 'error');
    };

    const handleSave = () => {
        vibrate(20);
        updatePreferences({ geminiApiKey: geminiKey, brapiToken });
        addToast(t('toast_key_saved'), 'success');
        onBack();
    };

    return (
        <div>
            <PageHeader title={t('api_connections')} onBack={onBack} helpText={t('api_connections_desc')} />

            <div className="space-y-6">
                {/* Gemini API */}
                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                    <label className="font-bold">{t('gemini_api_key')}</label>
                    <p className="text-xs text-[var(--text-secondary)] mb-2">{t('gemini_api_desc')}</p>
                    <input
                        type="password"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder={t('api_key_placeholder')}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2 mt-1 text-sm focus:outline-none focus:border-[var(--accent-color)]"
                    />
                    <button 
                        onClick={handleTestGemini} 
                        disabled={testingGemini}
                        className="w-full mt-3 text-sm font-bold text-[var(--accent-color)] hover:underline disabled:opacity-50 disabled:cursor-wait"
                    >
                        {testingGemini ? `${t('testing')}...` : t('test_connection')}
                    </button>
                </div>

                {/* Brapi API */}
                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                    <label className="font-bold">{t('brapi_token')}</label>
                    <p className="text-xs text-[var(--text-secondary)] mb-2">{t('brapi_desc')}</p>
                    <input
                        type="password"
                        value={brapiToken}
                        onChange={(e) => setBrapiToken(e.target.value)}
                        placeholder={t('api_key_placeholder')}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2 mt-1 text-sm focus:outline-none focus:border-[var(--accent-color)]"
                    />
                     <button 
                        onClick={handleTestBrapi} 
                        disabled={testingBrapi}
                        className="w-full mt-3 text-sm font-bold text-[var(--accent-color)] hover:underline disabled:opacity-50 disabled:cursor-wait"
                    >
                        {testingBrapi ? `${t('testing')}...` : t('test_connection')}
                    </button>
                </div>

                <button onClick={handleSave} className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3 rounded-lg mt-6 active:scale-95 transition-transform">
                    {t('save_key')}
                </button>
            </div>
        </div>
    );
};

export default ApiConnectionSettings;
