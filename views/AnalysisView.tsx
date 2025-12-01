
import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import PatrimonyEvolutionCard from '../components/PatrimonyEvolutionCard';
import RefreshIcon from '../components/icons/RefreshIcon';
import { vibrate } from '../utils';
import type { ToastMessage } from '../types';

interface AnalysisViewProps {
    addToast: (message: string, type?: ToastMessage['type']) => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ addToast }) => {
    const { t } = useI18n();
    const { refreshMarketData, isRefreshing } = usePortfolio();

    const handleRefresh = async () => {
        vibrate();
        addToast(t('toast_updating_prices'));
        try {
            await refreshMarketData(true);
            addToast(t('toast_update_success'), 'success');
        } catch (error: any) {
            addToast(error.message || t('toast_update_failed'), 'error');
        }
    };
    
    return (
        <div className="p-4 pb-24 md:pb-6 h-full overflow-y-auto custom-scrollbar landscape-pb-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">{t('nav_analysis')}</h1>
                    <button 
                        onClick={handleRefresh} 
                        disabled={isRefreshing}
                        className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95 disabled:opacity-50"
                        aria-label={t('refresh_prices')}
                    >
                        <RefreshIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-[var(--accent-color)]' : ''}`} />
                    </button>
                </div>
                <div className="flex flex-col gap-6">
                    <div className="w-full">
                        <PatrimonyEvolutionCard />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalysisView;
