
import React, { useState, useRef } from 'react';
import type { View } from '../App';
import type { ToastMessage } from '../types';
import RefreshIcon from '../components/icons/RefreshIcon';
import SettingsIcon from '../components/icons/SettingsIcon';
import BellIcon from '../components/icons/BellIcon';
import ShareIcon from '../components/icons/ShareIcon';
import FloatingActionButton from '../components/FloatingActionButton';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate } from '../utils';

// Componentes Organizados
import PortfolioSummary from '../components/cards/PortfolioSummary';
import DividendsSummaryCard from '../components/cards/DividendsSummaryCard';
import PortfolioPieChart from '../components/charts/PortfolioPieChart';
import WalletIcon from '../components/icons/WalletIcon';

// Sub-componente Header Local (limpo)
const Header: React.FC<{ 
    setActiveView: (view: View) => void;
    onRefresh: () => void;
    onShare: () => void;
    isRefreshing: boolean;
    unreadNotificationsCount?: number;
}> = ({ setActiveView, onRefresh, onShare, isRefreshing, unreadNotificationsCount }) => {
    const { t } = useI18n();

    return (
        <header className="px-4 py-3 flex justify-between items-center sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border-color)]/50 transition-all duration-300">
            <div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                    Invest
                    <span className="w-2 h-2 bg-[var(--accent-color)] rounded-full animate-pulse"></span>
                </h1>
            </div>
            <div className="flex items-center gap-1">
                 <button 
                    onClick={() => { onShare(); vibrate(); }} 
                    className="p-2.5 rounded-full hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95"
                    aria-label="Compartilhar"
                >
                     <ShareIcon className="w-5 h-5"/>
                </button>
                <button 
                    onClick={() => { onRefresh(); vibrate(); }} 
                    className={`p-2.5 rounded-full hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-90 ${isRefreshing ? 'animate-spin text-[var(--accent-color)]' : ''}`} 
                    aria-label={t('refresh_prices')}
                >
                     <RefreshIcon className="w-5 h-5"/>
                </button>
                <button 
                    onClick={() => { setActiveView('notificacoes'); vibrate(); }} 
                    className="p-2.5 rounded-full hover:bg-[var(--bg-tertiary-hover)] relative text-[var(--text-secondary)] transition-all active:scale-95"
                >
                    <BellIcon className="w-5 h-5" />
                    {unreadNotificationsCount && unreadNotificationsCount > 0 ? (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[var(--bg-primary)]"></span>
                    ) : null}
                </button>
                <button 
                    onClick={() => { setActiveView('settings'); vibrate(); }} 
                    className="p-2.5 rounded-full hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95" 
                    aria-label={t('nav_settings')}
                >
                     <SettingsIcon className="w-5 h-5"/>
                </button>
            </div>
        </header>
    );
};

// Sub-componente Card de Diversificação
const DiversificationSection: React.FC = () => {
    const { t } = useI18n();
    const { assets, preferences } = usePortfolio();
    
    // Lógica de cálculo simplificada e memorizada no componente pai ou aqui se necessário
    const data = React.useMemo(() => {
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

    if (assets.length === 0) return null;

    return (
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-color)] shadow-sm">
            <h3 className="font-bold text-base text-[var(--text-primary)] mb-4">{t('diversification')}</h3>
            <PortfolioPieChart data={data} goals={preferences.segmentGoals || {}} />
        </div>
    );
};

interface PortfolioViewProps {
    setActiveView: (view: View) => void;
    onSelectAsset: (ticker: string) => void;
    addToast: (message: string, type?: ToastMessage['type']) => void;
    unreadNotificationsCount?: number;
}

const PortfolioView: React.FC<PortfolioViewProps> = ({ setActiveView, addToast, unreadNotificationsCount }) => {
    const { t, formatCurrency } = useI18n();
    const { assets, refreshMarketData, isRefreshing: isContextRefreshing } = usePortfolio();
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);
    
    const isRefreshing = isContextRefreshing || isPullRefreshing;

    // Lógica Pull to Refresh
    const touchStartY = useRef(0);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (containerRef.current && containerRef.current.scrollTop === 0) {
            touchStartY.current = e.targetTouches[0].clientY;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartY.current > 0 && !isRefreshing) {
            const touchY = e.targetTouches[0].clientY;
            const dist = touchY - touchStartY.current;
            if (dist > 0) {
                setPullDistance(Math.min(dist * 0.4, 80));
            }
        }
    };

    const handleTouchEnd = () => {
        if (pullDistance > 60) handleRefreshPrices();
        setPullDistance(0);
        touchStartY.current = 0;
    };

    const handleRefreshPrices = async () => {
        setIsPullRefreshing(true);
        vibrate(20);
        addToast(t('toast_updating_prices'));
        try {
            await refreshMarketData(true);
            addToast(t('toast_update_success'), 'success');
        } catch (error: any) {
            addToast(error.message || t('toast_update_failed'), 'error');
        } finally {
            setIsPullRefreshing(false);
        }
    };

    const handleShare = async () => {
        const totalValue = assets.reduce((acc, asset) => acc + asset.currentPrice * asset.quantity, 0);
        const shareData = {
            title: t('share_portfolio_title'),
            text: t('share_portfolio_text', { value: formatCurrency(totalValue) }),
            url: window.location.origin,
        };
        try {
            if (navigator.share) await navigator.share(shareData);
            else {
                await navigator.clipboard.writeText(shareData.text);
                addToast('Copiado para área de transferência!', 'success');
            }
        } catch (err) {}
    };

    return (
        <div 
            className="h-full flex flex-col overflow-y-auto overscroll-contain no-scrollbar landscape-pb-6 bg-[var(--bg-primary)]"
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Spinner Pull-to-Refresh */}
            <div 
                className="fixed top-20 left-0 right-0 flex justify-center pointer-events-none z-20 transition-transform duration-200"
                style={{ 
                    transform: `translateY(${pullDistance > 0 ? pullDistance : (isRefreshing ? 10 : -50)}px)`, 
                    opacity: Math.min(pullDistance / 40, 1) 
                }}
            >
                <div className="bg-[var(--bg-secondary)] p-2 rounded-full shadow-lg border border-[var(--border-color)]">
                    <RefreshIcon className={`w-5 h-5 text-[var(--accent-color)] ${isRefreshing ? 'animate-spin' : ''}`} />
                </div>
            </div>

            <div className="max-w-5xl mx-auto w-full pb-24 md:pb-6">
                <Header 
                    setActiveView={setActiveView} 
                    onShare={handleShare} 
                    onRefresh={handleRefreshPrices} 
                    isRefreshing={isRefreshing} 
                    unreadNotificationsCount={unreadNotificationsCount} 
                />
                
                {assets.length > 0 ? (
                    <div className="animate-fade-in space-y-6 p-4">
                        <PortfolioSummary />

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <DividendsSummaryCard setActiveView={setActiveView} />
                            <DiversificationSection />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center animate-fade-in">
                        <div className="w-24 h-24 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-6 border border-[var(--border-color)] shadow-sm">
                            <WalletIcon className="w-10 h-10 text-[var(--text-secondary)] opacity-50"/>
                        </div>
                        <h2 className="text-xl font-bold mb-2 text-[var(--text-primary)]">{t('portfolio_empty_title')}</h2>
                        <p className="text-[var(--text-secondary)] mb-8 max-w-xs leading-relaxed">{t('portfolio_empty_subtitle')}</p>
                        <button 
                            onClick={() => { setActiveView('transacoes'); vibrate(); }}
                            className="bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3 px-8 rounded-xl shadow-lg shadow-[var(--accent-color)]/20 active:scale-95 transition-all"
                        >
                            Adicionar Transação
                        </button>
                    </div>
                )}
            </div>
            
            {assets.length > 0 && (
                <FloatingActionButton id="add-transaction-fab" onClick={() => { setActiveView('transacoes'); vibrate(); }} />
            )}
        </div>
    );
};

export default PortfolioView;
    