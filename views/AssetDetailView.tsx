import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import PortfolioLineChart from '../components/PortfolioLineChart';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import RefreshIcon from '../components/icons/RefreshIcon';
import { vibrate } from '../utils';

interface AssetDetailViewProps {
    ticker: string;
    onBack: () => void;
    onViewTransactions: (ticker: string) => void;
}

// Skeleton for loading state
const IndicatorSkeleton: React.FC = () => (
    <div className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm animate-pulse">
        {Array.from({ length: 10 }).map((_, i) => (
            <div key={i}>
                <div className="h-3 bg-[var(--bg-tertiary-hover)] rounded w-3/4 mb-1.5"></div>
                <div className="h-4 bg-[var(--bg-tertiary-hover)] rounded w-1/2"></div>
            </div>
        ))}
    </div>
);


const AssetDetailView: React.FC<AssetDetailViewProps> = ({ ticker, onBack, onViewTransactions }) => {
    const { t, formatCurrency, locale } = useI18n();
    const { getAssetByTicker, transactions, dividends, refreshSingleAsset } = usePortfolio();
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

    const assetDividends = useMemo(() => {
        return dividends.filter(d => d.ticker === ticker).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
    }, [dividends, ticker]);


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
    
    const renderIndicator = (label: string, value: string | number | undefined, unit: string = '') => {
        const displayValue = (value === null || value === undefined) ? 'N/A' : `${value}${unit}`;
        return (
            <div>
                <span className="text-xs text-[var(--text-secondary)]">{label}</span>
                <p className="font-bold text-sm">{displayValue}</p>
            </div>
        );
    };

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
                    <h2 className="text-2xl font-bold">{ticker}</h2>
                </div>
                <button onClick={handleRefresh} disabled={isRefreshing} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95">
                    <RefreshIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>
            
            <div className="flex border-b border-[var(--border-color)] mb-4">
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`pb-2 px-4 text-sm font-medium ${activeTab === 'summary' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`}
                >
                    {t('summary')}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-2 px-4 text-sm font-medium ${activeTab === 'history' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`}
                >
                    {t('history')}
                </button>
            </div>
            
            {activeTab === 'summary' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-[var(--text-secondary)]">{t('current_position')}</p>
                                <p className="text-2xl font-bold">{formatCurrency(currentValue)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-[var(--text-secondary)]">{t('result')}</p>
                                <div className={`text-lg font-bold ${variation >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                                    {formatCurrency(variation)} ({variationPercent.toFixed(2)}%)
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[var(--bg-secondary)] p-2 rounded-lg border border-[var(--border-color)]">
                        <h3 className="text-xs text-[var(--text-secondary)] font-bold mb-1 px-2">{t('price_history_7d')}</h3>
                        <div className="h-32">
                           {asset && <PortfolioLineChart data={asset.priceHistory} isPositive={asset.priceHistory[asset.priceHistory.length -1] >= asset.priceHistory[0]} simpleMode={true} />}
                        </div>
                    </div>
                    
                    <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                         <h3 className="font-bold text-base mb-4">{t('key_indicators')}</h3>
                         {isRefreshing || !asset ? <IndicatorSkeleton /> : (
                             <div className="space-y-4">
                                <div className="p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]">
                                    <h4 className="text-xs font-bold text-[var(--accent-color)] mb-2 uppercase">Sua Posição</h4>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                        {renderIndicator(t('quantity'), asset.quantity.toFixed(4))}
                                        {renderIndicator(t('avg_price'), formatCurrency(asset.avgPrice))}
                                        {renderIndicator(t('current_price'), formatCurrency(asset.currentPrice))}
                                        {renderIndicator(t('yield_on_cost'), asset.yieldOnCost?.toFixed(2), '%')}
                                    </div>
                                </div>
                                <div className="p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]">
                                     <h4 className="text-xs font-bold text-[var(--accent-color)] mb-2 uppercase">Valuation</h4>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                         {renderIndicator(t('dy_12m'), asset.dy?.toFixed(2), '%')}
                                         {renderIndicator(t('pvp'), asset.pvp?.toFixed(2))}
                                    </div>
                                </div>
                                <div className="p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]">
                                     <h4 className="text-xs font-bold text-[var(--accent-color)] mb-2 uppercase">Dados do Fundo</h4>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                        {renderIndicator(t('administrator'), asset.administrator)}
                                        {renderIndicator(t('vacancy'), asset.vacancyRate?.toFixed(2), '%')}
                                        {renderIndicator(t('daily_liquidity'), formatCurrency(asset.liquidity || 0))}
                                        {renderIndicator(t('shareholders'), asset.shareholders?.toLocaleString(locale))}
                                    </div>
                                </div>
                             </div>
                         )}
                    </div>
                    
                    <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                        <h3 className="font-bold text-base mb-4">{t('dividends_received')}</h3>
                        {assetDividends.length > 0 ? (
                            <div className="space-y-2 text-xs">
                                <div className="grid grid-cols-4 gap-2 font-bold text-[var(--text-secondary)] px-2">
                                    <div className="text-left">{t('payment_date')}</div>
                                    <div className="text-right">{t('value_per_share')}</div>
                                    <div className="text-right">{t('quantity_at_payment')}</div>
                                    <div className="text-right">{t('total_received')}</div>
                                </div>
                                <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
                                    {assetDividends.map((div, index) => (
                                        <div key={index} className="grid grid-cols-4 gap-2 items-center bg-[var(--bg-primary)] p-2 rounded-md border border-[var(--border-color)]">
                                            <div className="text-left">{new Date(div.paymentDate).toLocaleDateString(locale, { timeZone: 'UTC', day: '2-digit', month: 'short', year: '2-digit' })}</div>
                                            <div className="text-right">{formatCurrency(div.amountPerShare)}</div>
                                            <div className="text-right">{div.quantity}</div>
                                            <div className="text-right font-bold text-sm text-[var(--green-text)]">{formatCurrency(div.amountPerShare * div.quantity)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-center text-[var(--text-secondary)] py-4">{t('no_dividends_for_asset')}</p>
                        )}
                    </div>

                    <button onClick={() => asset && onViewTransactions(asset.ticker)} className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3 rounded-lg mt-2 active:scale-95 transition-transform">
                        {t('view_transactions')}
                    </button>
                </div>
            )}
            {activeTab === 'history' && (
                <div className="space-y-3 animate-fade-in pb-4">
                    {assetTransactions.length > 0 ? assetTransactions.map(tx => (
                        <div key={tx.id} className="bg-[var(--bg-secondary)] p-3 rounded-lg text-sm border border-[var(--border-color)]">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className={`font-bold text-sm ${tx.type === 'Compra' ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>{t(tx.type === 'Compra' ? 'buy' : 'sell')}</p>
                                    <p className="text-xs text-[var(--text-secondary)]">{new Date(tx.date).toLocaleDateString(locale, { timeZone: 'UTC' })}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold">{formatCurrency(tx.quantity * tx.price)}</p>
                                    <p className="text-xs text-[var(--text-secondary)]">{`${tx.quantity} × ${formatCurrency(tx.price)}`}</p>
                                </div>
                            </div>
                        </div>
                    )) : <p className="text-sm text-center text-[var(--text-secondary)] py-8">{t('no_transactions_for_asset')}</p>}
                </div>
            )}
        </div>
    );
};

export default AssetDetailView;