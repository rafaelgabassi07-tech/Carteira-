
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import RefreshIcon from '../components/icons/RefreshIcon';
import AnalysisIcon from '../components/icons/AnalysisIcon';
import { vibrate } from '../utils';

interface AssetDetailViewProps {
    ticker: string;
    onBack: () => void;
    onViewTransactions: (ticker: string) => void;
}

// Skeleton for loading state
const IndicatorSkeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse">
        {[1, 2].map((group) => (
            <div key={group}>
                <div className="h-4 bg-[var(--bg-tertiary-hover)] rounded w-1/3 mb-3"></div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="h-20 bg-[var(--bg-tertiary-hover)] rounded-xl"></div>
                    <div className="h-20 bg-[var(--bg-tertiary-hover)] rounded-xl"></div>
                    <div className="h-20 bg-[var(--bg-tertiary-hover)] rounded-xl"></div>
                </div>
            </div>
        ))}
    </div>
);

const MetricItem: React.FC<{ label: string; value: string | number; subValue?: string; highlight?: 'green' | 'red' | 'neutral'; className?: string; style?: React.CSSProperties; }> = ({ label, value, subValue, highlight, className, style }) => {
    let valueColor = 'text-[var(--text-primary)]';
    if (highlight === 'green') valueColor = 'text-[var(--green-text)]';
    if (highlight === 'red') valueColor = 'text-[var(--red-text)]';

    return (
        <div style={style} className={`p-3.5 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] flex flex-col justify-center shadow-sm hover:border-[var(--accent-color)]/30 transition-colors ${className}`}>
             <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold mb-1.5">{label}</span>
             <div className="flex items-baseline gap-1">
                <span className={`text-lg font-extrabold leading-none tracking-tight ${valueColor}`}>{value}</span>
                {subValue && <span className="text-xs font-medium text-[var(--text-secondary)] translate-y-[1px]">{subValue}</span>}
             </div>
        </div>
    );
};

const AssetDetailView: React.FC<AssetDetailViewProps> = ({ ticker, onBack, onViewTransactions }) => {
    const { t, formatCurrency, locale } = useI18n();
    const { getAssetByTicker, transactions, refreshSingleAsset } = usePortfolio();
    const [activeTab, setActiveTab] = useState('summary');
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Obter ativo do contexto
    const asset = getAssetByTicker(ticker);

    // Efeito para buscar dados se estiverem faltando ou desatualizados ao entrar
    useEffect(() => {
        const checkAndLoad = async () => {
            // Check staleness: If we don't have a timestamp, OR if it's been more than 5 minutes
            const isStale = !asset?.lastUpdated || (Date.now() - asset.lastUpdated > 5 * 60 * 1000);
            
            // Only force refresh if data is missing AND we haven't checked recently
            // This prevents spamming API for assets that simply don't have dividends (like some stocks or incomplete data)
            if (isStale && (!asset || !asset.dividendsHistory || asset.dividendsHistory.length === 0)) {
                setIsRefreshing(true);
                try {
                    await refreshSingleAsset(ticker, true);
                } catch (e) {
                    console.error("Erro ao atualizar ativo:", e);
                } finally {
                    setIsRefreshing(false);
                }
            }
        };
        checkAndLoad();
    }, [ticker, refreshSingleAsset, asset?.lastUpdated]); 

    const handleRefresh = useCallback(async () => {
        if (isRefreshing) return;
        vibrate();
        setIsRefreshing(true);
        try {
            await refreshSingleAsset(ticker, true); // Force refresh
        } catch (error) {
            console.error("Failed to refresh asset details:", error);
        } finally {
            setIsRefreshing(false);
        }
    }, [ticker, refreshSingleAsset, isRefreshing]);

    const assetTransactions = useMemo(() => {
        return transactions.filter(tx => tx.ticker === ticker).sort((a, b) => b.date.localeCompare(a.date));
    }, [transactions, ticker]);

    if (!asset && !isRefreshing) {
        return (
            <div className="p-4">
                <div className="flex items-center mb-6">
                     <button onClick={onBack} className="p-2 -ml-2 mr-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary-hover)]"><ChevronLeftIcon className="w-6 h-6" /></button>
                     <h2 className="text-2xl font-bold">{t('error')}</h2>
                </div>
                <p>{t('asset_not_found')}</p>
            </div>
        );
    }
    
    // Dados para o Summary Tab
    const currentValue = asset ? asset.quantity * asset.currentPrice : 0;
    const totalInvested = asset ? asset.quantity * asset.avgPrice : 0;
    const variation = currentValue - totalInvested;
    const variationPercent = totalInvested > 0 ? (variation / totalInvested) * 100 : 0;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'summary':
                return (
                    <div className="space-y-4">
                        <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('current_position')}</p>
                                    <p className="text-3xl font-bold text-[var(--text-primary)]">{formatCurrency(currentValue)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('result')}</p>
                                    <div className={`text-lg font-bold flex items-center justify-end gap-1 ${variation >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                                        {variation >= 0 ? '+' : ''}{formatCurrency(variation)}
                                    </div>
                                    <span className={`text-xs font-semibold ${variation >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                                        ({variationPercent.toFixed(2)}%)
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm animate-fade-in-up">
                             <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-[var(--accent-color)]/10 rounded-lg text-[var(--accent-color)]">
                                    <AnalysisIcon className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-lg">{t('key_indicators')}</h3>
                             </div>
                             
                             {!asset ? <IndicatorSkeleton /> : (
                                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <MetricItem label={t('quantity')} value={asset.quantity} className="animate-fade-in-up" style={{animationDelay: '0ms'}}/>
                                    <MetricItem label={t('avg_price')} value={formatCurrency(asset.avgPrice)} className="animate-fade-in-up" style={{animationDelay: '50ms'}}/>
                                    <MetricItem label={t('current_price')} value={formatCurrency(asset.currentPrice)} className="animate-fade-in-up" style={{animationDelay: '100ms'}}/>
                                    
                                    <MetricItem 
                                        label="Total Investido" 
                                        value={formatCurrency(asset.quantity * asset.avgPrice)} 
                                        className="sm:col-span-1 animate-fade-in-up" style={{animationDelay: '150ms'}}
                                    />
                                    <MetricItem 
                                        label="Saldo Atual" 
                                        value={formatCurrency(asset.quantity * asset.currentPrice)} 
                                        highlight={variation >= 0 ? 'green' : 'red'}
                                        className="animate-fade-in-up" style={{animationDelay: '200ms'}}
                                    />
                                     <MetricItem 
                                        label={t('result')} 
                                        value={formatCurrency(variation)} 
                                        subValue={`(${variationPercent.toFixed(2)}%)`}
                                        highlight={variation >= 0 ? 'green' : 'red'}
                                        className="animate-fade-in-up" style={{animationDelay: '250ms'}}
                                    />

                                    {/* Analysis Section Header */}
                                    <div className="col-span-2 sm:col-span-3 mt-4 mb-1 flex items-center gap-2">
                                        <div className="h-px flex-1 bg-[var(--border-color)] opacity-50"></div>
                                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('nav_analysis')} & {t('data')}</span>
                                        <div className="h-px flex-1 bg-[var(--border-color)] opacity-50"></div>
                                    </div>

                                    <MetricItem 
                                        label={t('dy_12m')} 
                                        value={asset.dy?.toFixed(2) ?? '-'} 
                                        subValue="%" 
                                        highlight={asset.dy && asset.dy > 10 ? 'green' : undefined}
                                        className="animate-fade-in-up" style={{animationDelay: '300ms'}}
                                    />
                                    <MetricItem 
                                        label={t('yield_on_cost')} 
                                        value={asset.yieldOnCost?.toFixed(2) ?? '-'} 
                                        subValue="%" 
                                        highlight={asset.yieldOnCost && asset.yieldOnCost > 8 ? 'green' : undefined}
                                        className="animate-fade-in-up" style={{animationDelay: '350ms'}}
                                    />
                                    <MetricItem 
                                        label={t('pvp')} 
                                        value={asset.pvp?.toFixed(2) ?? '-'} 
                                        highlight={asset.pvp && asset.pvp < 1.0 ? 'green' : (asset.pvp && asset.pvp > 1.2 ? 'red' : 'neutral')}
                                        className="animate-fade-in-up" style={{animationDelay: '400ms'}}
                                    />
                                     <MetricItem label={t('vacancy')} value={asset.vacancyRate?.toFixed(1) ?? '0'} subValue="%" className="animate-fade-in-up" style={{animationDelay: '450ms'}}/>
                                     <MetricItem label={t('shareholders')} value={asset.shareholders ? (asset.shareholders/1000).toFixed(1) + 'k' : '-'} className="animate-fade-in-up" style={{animationDelay: '500ms'}}/>
                                     <MetricItem label={t('daily_liquidity')} value={asset.liquidity ? (asset.liquidity/1000000).toFixed(1) + 'M' : '-'} className="animate-fade-in-up" style={{animationDelay: '550ms'}}/>
                                </div>
                             )}
                        </div>

                        <button onClick={() => asset && onViewTransactions(asset.ticker)} className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3.5 rounded-xl shadow-lg shadow-[var(--accent-color)]/20 hover:shadow-[var(--accent-color)]/40 active:scale-[0.98] transition-all">
                            {t('view_transactions')}
                        </button>
                    </div>
                );
            case 'history':
                return (
                    <div className="space-y-3 animate-fade-in pb-4">
                        {assetTransactions.length > 0 ? assetTransactions.map((tx, index) => (
                            <div key={tx.id} className="bg-[var(--bg-secondary)] p-4 rounded-xl text-sm border border-[var(--border-color)] shadow-sm animate-fade-in-up" style={{ animationDelay: `${index * 50}ms`}}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className={`font-bold text-base mb-0.5 ${tx.type === 'Compra' ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>{t(tx.type === 'Compra' ? 'buy' : 'sell')}</p>
                                        <p className="text-xs text-[var(--text-secondary)] font-medium">{new Date(tx.date).toLocaleDateString(locale, { timeZone: 'UTC' })}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-[var(--text-primary)]">{formatCurrency(tx.quantity * tx.price)}</p>
                                        <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">{`${tx.quantity} × ${formatCurrency(tx.price)}`}</p>
                                    </div>
                                </div>
                            </div>
                        )) : <p className="text-sm text-center text-[var(--text-secondary)] py-12">{t('no_transactions_for_asset')}</p>}
                    </div>
                );
            default: return null;
        }
    }


    return (
        <div className="p-4 pb-20 landscape-pb-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <button 
                            onClick={onBack} 
                            className="p-2 -ml-2 mr-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary-hover)] transition-all duration-200 active:scale-95"
                            aria-label={t('back')}
                        >
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                        <h2 className="text-2xl font-bold tracking-tight">{ticker}</h2>
                    </div>
                    <button onClick={handleRefresh} disabled={isRefreshing} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95">
                        <RefreshIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                
                <div className="flex border-b border-[var(--border-color)] mb-4">
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`pb-2 px-4 text-sm font-bold transition-colors ${activeTab === 'summary' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        {t('summary')}
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`pb-2 px-4 text-sm font-bold transition-colors ${activeTab === 'history' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        {t('history')}
                    </button>
                </div>
                
                <div key={activeTab} className="animate-fade-in">
                    {renderTabContent()}
                </div>
            </div>
        </div>
    );
};

export default AssetDetailView;
