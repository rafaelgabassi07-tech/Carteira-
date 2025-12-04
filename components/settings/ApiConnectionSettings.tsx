

import React, { useState } from 'react';
import PageHeader from '../PageHeader';
import type { ToastMessage } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { validateGeminiKey } from '../../services/geminiService';
import { validateBrapiToken } from '../../services/brapiService';
import { vibrate } from '../../utils';
import TrashIcon from '../icons/TrashIcon';

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const MetricCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-color)] text-center">
        <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">{label}</p>
        <p className="font-mono font-bold text-sm mt-1">{value}</p>
    </div>
);


const ApiConnectionSettings: React.FC<{ onBack: () => void; addToast: (message: string, type?: ToastMessage['type']) => void; }> = ({ onBack, addToast }) => {
    const { t } = useI18n();
    const { preferences, updatePreferences, apiStats, resetApiStats } = usePortfolio();
    
    const [geminiKey, setGeminiKey] = useState(preferences.geminiApiKey || '');
    const [brapiToken, setBrapiToken] = useState(preferences.brapiToken || '');
    const [testingGemini, setTestingGemini] = useState(false);
    const [testingBrapi, setTestingBrapi] = useState(false);

    const handleTestGemini = async () => {
        vibrate();
        setTestingGemini(true);
        const isValid = await validateGeminiKey(geminiKey);
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

    const handleResetStats = () => {
        if (window.confirm(t('confirm_reset_stats'))) {
            resetApiStats();
            addToast(t('reset_stats') + '!', 'success');
        }
    }

    return (
        <div>
            <PageHeader title={t('api_connections')} onBack={onBack} helpText={t('api_connections_desc')} />
            <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)] space-y-6">
                {/* Gemini API */}
                <div>
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
                <div>
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

            {/* Stats */}
            <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)] mt-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-base">{t('api_usage_stats')}</h3>
                    <button onClick={handleResetStats} className="text-xs text-red-400 hover:underline font-bold flex items-center gap-1">
                        <TrashIcon className="w-3 h-3" /> {t('reset_stats')}
                    </button>
                </div>
                <div className="space-y-4">
                    {/* Gemini Stats */}
                    <div>
                        <p className="font-bold text-sm mb-2">Gemini API (Google)</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                           <MetricCard label={t('requests')} value={apiStats.gemini.requests} />
                           <MetricCard label={t('sent')} value={formatBytes(apiStats.gemini.bytesSent)} />
                           <MetricCard label={t('received')} value={formatBytes(apiStats.gemini.bytesReceived)} />
                           <MetricCard label={t('total_data')} value={formatBytes(apiStats.gemini.bytesSent + apiStats.gemini.bytesReceived)} />
                        </div>
                    </div>
                     {/* Brapi Stats */}
                    <div>
                        <p className="font-bold text-sm mb-2">Brapi API</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                           <MetricCard label={t('requests')} value={apiStats.brapi.requests} />
                           <MetricCard label={t('received')} value={formatBytes(apiStats.brapi.bytesReceived)} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApiConnectionSettings;