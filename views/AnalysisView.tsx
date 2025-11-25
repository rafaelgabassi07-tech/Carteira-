import React, { useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import PatrimonyEvolutionCard from '../components/PatrimonyEvolutionCard';
import PortfolioPieChart from '../components/PortfolioPieChart';
import BarChart from '../components/BarChart';
import CountUp from '../components/CountUp';
import { vibrate } from '../utils';
import RefreshIcon from '../components/icons/RefreshIcon';
import type { ToastMessage } from '../types';

const AnalysisCard: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode; delay?: number; className?: string }> = ({ title, children, action, delay = 0, className = '' }) => (
    <div className={`bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-color)] shadow-sm animate-fade-in-up transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${className}`} style={{ animationDelay: `${delay}ms` }}>
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-[var(--text-primary)]">{title}</h3>
            {action}
        </div>
        {children}
    </div>
);

const IncomeCard: React.FC = () => {
    const { t } = useI18n();
    
    return (
        <AnalysisCard title={t('monthly_income')} delay={100}>
            <div className="h-48 w-full flex items-center justify-center text-sm text-[var(--text-secondary)]">
                {/* Conteúdo removido para começar do zero */}
            </div>
        </AnalysisCard>
    );
};

const DiversificationCard: React.FC = () => {
    const { t } = useI18n();
    const { assets, preferences } = usePortfolio();
    
    const data = useMemo(() => {
        const segments: Record<string, number> = {};
        let totalValue = 0;
        assets.forEach(a => {
            const val = a.quantity * a.currentPrice;
            const seg = a.segment || t('outros');
            segments[seg] = (segments[seg] || 0) + val;
            totalValue += val;
        });
        
        return Object.entries(segments).map(([name, value]) => ({
            name,
            value,
            percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
        })).sort((a, b) => b.value - a.value);
    }, [assets, t]);

    return (
        <AnalysisCard title={t('diversification')} delay={200}>
            <PortfolioPieChart data={data} goals={preferences.segmentGoals || {}} />
        </AnalysisCard>
    );
};

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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="lg:col-span-2">
                        <PatrimonyEvolutionCard />
                    </div>
                    <IncomeCard />
                    <DiversificationCard />
                </div>
            </div>
        </div>
    );
};

export default AnalysisView;