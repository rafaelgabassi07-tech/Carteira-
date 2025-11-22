
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
        {[1, 2, 3].map((group) => (
            <div key={group}>
                <div className="h-4 bg-[var(--bg-tertiary-hover)] rounded w-1/3 mb-3"></div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="h-20 bg-[var(--bg-tertiary-hover)] rounded-xl"></div>
                    <div className="h-20 bg-[var(--bg-tertiary-hover)] rounded-xl"></div>
                </div>
            </div>
        ))}
    </div>
);

const MetricItem: React.FC<{ label: string; value: string | number; subValue?: string; highlight?: 'green' | 'red' | 'neutral'; className?: string }> = ({ label, value, subValue, highlight, className }) => {
    let valueColor = 'text-[var(--text-primary)]';
    if (highlight === 'green') valueColor = 'text-[var(--green-text)]';
    if (highlight === 'red') valueColor = 'text-[var(--red-text)]';

    return (
        <div className={`p-3.5 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] flex flex-col justify-center shadow-sm hover:border-[var(--accent-color)]/30 transition-colors ${className}`}>
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
    const [isRefreshing, setIsRefreshing] = useState(true);
    
    const asset = getAssetByTicker(ticker);

    const handleRefresh = useCallback(async () => {
        if (isRefreshing) return;
        vibrate();
        setIsRefreshing(true);
        try {
            await refreshSingleAsset(ticker);
        } catch (error) {
            console.error("Failed to refresh asset details:", error);
        } finally {
            setIsRefreshing(false);
        }
    }, [ticker, refreshSingleAsset, isRefreshing]);

    useEffect(() => {
        const initialLoad = async () => {
             setIsRefreshing(true);
             try {
                await refreshSingleAsset(ticker);
             } finally {
                setIsRefreshing(false);
             }
        };
        initialLoad();
    }, [ticker, refreshSingleAsset]);

    const assetTransactions = useMemo(() => {
        return transactions.filter(tx => tx.ticker === asset?.ticker).sort((a, b) => b.date.localeCompare(a.date));
    }, [transactions, asset?.ticker]);

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
    
    const totalInvested = asset ? asset.quantity * asset.avgPrice : 0;
    const currentValue = asset ? asset.quantity * asset.currentPrice : 0;
    const variation = currentValue - totalInvested;
    const variationPercent = totalInvested > 0 ? (variation / totalInvested) * 100 : 0;

    return (
        <div className="p-4 pb-20">
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
            
            {activeTab === 'summary' && (
                <div className="space-y-4 animate-fade-in">
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
                         <div className="flex items-center gap-2 mb-6">
                            <div className="p-2 bg-[var(--accent-color)]/10 rounded-lg text-[var(--accent-color)]">
                                <AnalysisIcon className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-lg">{t('key_indicators')}</h3>
                         </div>
                         
                         {isRefreshing || !asset ? <IndicatorSkeleton /> : (
                             <div className="space-y-6">
                                {/* Minha Posição */}
                                <div>
                                    <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]"></div>
                                        Minha Posição
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <MetricItem label={t('quantity')} value={asset.quantity} />
                                        <MetricItem label={t('avg_price')} value={formatCurrency(asset.avgPrice)} />
                                        <MetricItem 
                                            label={t('yield_on_cost')} 
                                            value={asset.yieldOnCost?.toFixed(2) ?? '-'} 
                                            subValue="%" 
                                            highlight={asset.yieldOnCost && asset.yieldOnCost > 8 ? 'green' : undefined} 
                                        />
                                         <MetricItem 
                                            label="Total Investido" 
                                            value={formatCurrency(asset.quantity * asset.avgPrice)} 
                                        />
                                    </div>
                                </div>

                                {/* Valuation & Mercado */}
                                <div>
                                    <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                        Valuation & Mercado
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                         <MetricItem label={t('current_price')} value={formatCurrency(asset.currentPrice)} />
                                         <MetricItem 
                                            label={t('pvp')} 
                                            value={asset.pvp?.toFixed(2) ?? '-'} 
                                            highlight={asset.pvp && asset.pvp < 0.95 ? 'green' : (asset.pvp && asset.pvp > 1.1 ? 'red' : 'neutral')}
                                        />
                                        <MetricItem 
                                            label={t('dy_12m')} 
                                            value={asset.dy?.toFixed(2) ?? '-'} 
                                            subValue="%"
                                            highlight={asset.dy && asset.dy > 10 ? 'green' : undefined}
                                        />
                                         <MetricItem label={t('daily_liquidity')} value={asset.liquidity ? formatCurrency(asset.liquidity) : '-'} className="truncate" />
                                    </div>
                                </div>

                                {/* Dados do Fundo */}
                                <div>
                                     <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                        Dados Operacionais
                                    </h4>
                                     <div className="grid grid-cols-2 gap-3">
                                        <MetricItem label={t('vacancy')} value={asset.vacancyRate?.toFixed(1) ?? '0'} subValue="%" />
                                        <MetricItem label={t('shareholders')} value={asset.shareholders?.toLocaleString(locale) ?? '-'} />
                                        <div className="col-span-2 p-3.5 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] flex flex-col justify-center shadow-sm">
                                            <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold mb-1">{t('administrator')}</span>
                                            <span className="text-sm font-bold truncate leading-tight text-[var(--text-primary)]">{asset.administrator || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                             </div>
                         )}
                    </div>

                    <button onClick={() => asset && onViewTransactions(asset.ticker)} className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3.5 rounded-xl shadow-lg shadow-[var(--accent-color)]/20 hover:shadow-[var(--accent-color)]/40 active:scale-[0.98] transition-all">
                        {t('view_transactions')}
                    </button>
                </div>
            )}
            {activeTab === 'history' && (
                <div className="space-y-3 animate-fade-in pb-4">
                    {assetTransactions.length > 0 ? assetTransactions.map(tx => (
                        <div key={tx.id} className="bg-[var(--bg-secondary)] p-4 rounded-xl text-sm border border-[var(--border-color)] shadow-sm">
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
            )}
        </div>
    );
};

export default AssetDetailView;
