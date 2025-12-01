
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import RefreshIcon from '../components/icons/RefreshIcon';
import AnalysisIcon from '../components/icons/AnalysisIcon';
import DividendChart from '../components/DividendChart';
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
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<string | null>(null);
    const hasLoadedRef = useRef(false);
    
    const asset = getAssetByTicker(ticker);

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

    // Initial load control to prevent loops
    useEffect(() => {
        if (!asset && !hasLoadedRef.current) {
             hasLoadedRef.current = true;
             setIsRefreshing(true);
             refreshSingleAsset(ticker, false).finally(() => setIsRefreshing(false));
        }
    }, [ticker, asset, refreshSingleAsset]);

    const assetTransactions = useMemo(() => {
        return transactions.filter(tx => tx.ticker === asset?.ticker).sort((a, b) => b.date.localeCompare(a.date));
    }, [transactions, asset?.ticker]);

    // Calculate REAL dividends received by user based on history and holdings
    const userDividendHistory = useMemo(() => {
        if (!asset || !asset.dividendsHistory) return [];
        
        // Ensure transactions are sorted date ASC for replay
        const txs = transactions.filter(t => t.ticker === asset.ticker).sort((a,b) => a.date.localeCompare(b.date));
        
        return asset.dividendsHistory.map(div => {
            // Calculate holding on ex-date
            let qty = 0;
            for(const tx of txs) {
                if (tx.date > div.exDate) break; // Transaction happened after ex-date
                if (tx.type === 'Compra') qty += tx.quantity;
                else qty -= tx.quantity;
            }
            const userQty = Math.max(0, qty);
            
            return {
                ...div,
                userQuantity: userQty,
                totalReceived: userQty * div.value
            };
        }).filter(d => d.value > 0).sort((a,b) => b.paymentDate.localeCompare(a.paymentDate));
    }, [asset, transactions]);

    const displayedDividends = useMemo(() => {
        return showAllHistory ? userDividendHistory : userDividendHistory.slice(0, 3);
    }, [userDividendHistory, showAllHistory]);

    // --- Dividends Metrics Calculation ---
    const today = new Date();
    const currentYear = today.getFullYear();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(currentYear - 1);

    const totalDividends = useMemo(() => {
        return userDividendHistory.reduce((acc, div) => acc + div.totalReceived, 0);
    }, [userDividendHistory]);

    const totalYTD = useMemo(() => {
        return userDividendHistory
            .filter(d => new Date(d.paymentDate).getFullYear() === currentYear)
            .reduce((acc, div) => acc + div.totalReceived, 0);
    }, [userDividendHistory, currentYear]);

    const totalL12M = useMemo(() => {
        return userDividendHistory
            .filter(d => new Date(d.paymentDate) >= oneYearAgo)
            .reduce((acc, div) => acc + div.totalReceived, 0);
    }, [userDividendHistory, oneYearAgo]);

    const averageMonthly = totalL12M / 12;

    // Real Yield: Sum of per-share amounts L12M / Current Price
    const dyReal = useMemo(() => {
        if (!asset || asset.currentPrice <= 0) return 0;
        const sumPerShareL12M = (asset.dividendsHistory || [])
            .filter(d => new Date(d.paymentDate) >= oneYearAgo)
            .reduce((acc, div) => acc + div.value, 0);
        return (sumPerShareL12M / asset.currentPrice) * 100;
    }, [asset, oneYearAgo]);


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

                        <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm">
                             <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-[var(--accent-color)]/10 rounded-lg text-[var(--accent-color)]">
                                    <AnalysisIcon className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-lg">{t('key_indicators')}</h3>
                             </div>
                             
                             {!asset ? <IndicatorSkeleton /> : (
                                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <MetricItem label={t('quantity')} value={asset.quantity} />
                                    <MetricItem label={t('avg_price')} value={formatCurrency(asset.avgPrice)} />
                                    <MetricItem label={t('current_price')} value={formatCurrency(asset.currentPrice)} />
                                    <MetricItem label="Total Investido" value={formatCurrency(asset.quantity * asset.avgPrice)} className="sm:col-span-1" />
                                    <MetricItem label="Saldo Atual" value={formatCurrency(asset.quantity * asset.currentPrice)} highlight={variation >= 0 ? 'green' : 'red'} />
                                    <MetricItem label={t('result')} value={formatCurrency(variation)} subValue={`(${variationPercent.toFixed(2)}%)`} highlight={variation >= 0 ? 'green' : 'red'} />
                                    <div className="col-span-2 sm:col-span-3 mt-4 mb-1 flex items-center gap-2">
                                        <div className="h-px flex-1 bg-[var(--border-color)] opacity-50"></div>
                                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('nav_analysis')} & {t('data')}</span>
                                        <div className="h-px flex-1 bg-[var(--border-color)] opacity-50"></div>
                                    </div>
                                    <MetricItem label={t('dy_12m')} value={asset.dy?.toFixed(2) ?? '-'} subValue="%" highlight={asset.dy && asset.dy > 10 ? 'green' : undefined} />
                                    <MetricItem label={t('yield_on_cost')} value={asset.yieldOnCost?.toFixed(2) ?? '-'} subValue="%" highlight={asset.yieldOnCost && asset.yieldOnCost > 8 ? 'green' : undefined} />
                                    <MetricItem label={t('pvp')} value={asset.pvp?.toFixed(2) ?? '-'} highlight={asset.pvp && asset.pvp < 1.0 ? 'green' : (asset.pvp && asset.pvp > 1.2 ? 'red' : 'neutral')} />
                                    <MetricItem label={t('vacancy')} value={asset.vacancyRate?.toFixed(1) ?? '0'} subValue="%" />
                                    <MetricItem label={t('shareholders')} value={asset.shareholders ? (asset.shareholders/1000).toFixed(1) + 'k' : '-'} />
                                    <MetricItem label={t('daily_liquidity')} value={asset.liquidity ? (asset.liquidity/1000000).toFixed(1) + 'M' : '-'} />
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
                    <div className="space-y-3 pb-4">
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
            case 'dividends':
                 return (
                    <div className="space-y-4 pb-4">
                        {asset?.dividendsHistory && asset.dividendsHistory.length > 0 ? (
                            <>
                                <DividendChart data={asset.dividendsHistory} />
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)] flex justify-between items-center shadow-sm">
                                        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('total_accumulated')}</span>
                                        <span className="text-xl font-bold text-[var(--green-text)]">{formatCurrency(totalDividends)}</span>
                                    </div>
                                    <MetricItem label={t('total_year', { year: currentYear })} value={formatCurrency(totalYTD)} className="bg-[var(--bg-secondary)]" />
                                    <MetricItem label={t('monthly_average_12m')} value={formatCurrency(averageMonthly)} className="bg-[var(--bg-secondary)]" />
                                    <MetricItem label={t('real_yield_12m')} value={dyReal.toFixed(2)} subValue="%" highlight={dyReal > 10 ? 'green' : 'neutral'} className="bg-[var(--bg-secondary)] col-span-2" />
                                </div>
                                <h3 className="font-bold text-sm text-[var(--text-secondary)] mt-2 px-1 uppercase tracking-wider">
                                    {showAllHistory ? t('full_history') : t('recent_dividends')}
                                </h3>
                                <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
                                    {displayedDividends.map((div, index) => {
                                        return (
                                            <div 
                                                key={`${div.paymentDate}-${index}`} 
                                                className={`p-4 flex justify-between items-center ${index !== displayedDividends.length - 1 ? 'border-b border-[var(--border-color)]' : ''} ${selectedHistoryItem === div.paymentDate ? 'bg-[var(--bg-tertiary-hover)]' : ''}`}
                                                onClick={() => { setSelectedHistoryItem(div.paymentDate); vibrate(); }}
                                            >
                                                <div>
                                                    <p className="font-bold text-sm text-[var(--text-primary)] mb-0.5">{new Date(div.paymentDate).toLocaleDateString(locale, { timeZone: 'UTC' })}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded text-[var(--text-secondary)] border border-[var(--border-color)]">Com: {new Date(div.exDate).toLocaleDateString(locale, { day:'2-digit', month:'2-digit', timeZone: 'UTC' })}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-[var(--green-text)] text-sm">{formatCurrency(div.value * div.userQuantity)}</p>
                                                    <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5">{div.userQuantity} × {formatCurrency(div.value)}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {!showAllHistory && userDividendHistory.length > 3 && (
                                    <button onClick={() => { vibrate(); setShowAllHistory(true); }} className="w-full py-3 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--accent-color)] hover:bg-[var(--bg-secondary)] rounded-xl border border-dashed border-[var(--border-color)] transition-all">
                                        {t('view_full_history')} ({userDividendHistory.length})
                                    </button>
                                )}
                                {showAllHistory && (<button onClick={() => { vibrate(); setShowAllHistory(false); }} className="w-full py-3 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">{t('show_less')}</button>)}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-secondary)]">
                                <div className="w-12 h-12 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-3 border border-[var(--border-color)] opacity-50"><span className="text-xl font-bold">$</span></div>
                                <p className="text-sm font-medium">{t('no_dividends_for_asset')}</p>
                            </div>
                        )}
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
                     <button
                        onClick={() => setActiveTab('dividends')}
                        className={`pb-2 px-4 text-sm font-bold transition-colors ${activeTab === 'dividends' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        {t('dividends_received')}
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
