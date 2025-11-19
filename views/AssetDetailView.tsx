
import React, { useState, useMemo, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import PageHeader from '../components/PageHeader';
import PortfolioLineChart from '../components/PortfolioLineChart';
import type { Transaction } from '../types';

interface AssetDetailViewProps {
    ticker: string;
    onBack: () => void;
    onViewTransactions: (ticker: string) => void;
}

const AssetDetailView: React.FC<AssetDetailViewProps> = ({ ticker, onBack, onViewTransactions }) => {
    const { t, formatCurrency, locale } = useI18n();
    const { getAssetByTicker, transactions } = usePortfolio();
    const [activeTab, setActiveTab] = useState('summary');
    
    const asset = getAssetByTicker(ticker);

    const assetTransactions = useMemo(() => {
        return transactions.filter(tx => tx.ticker === asset?.ticker).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, asset?.ticker]);

    if (!asset) {
        return (
            <div className="p-4">
                <PageHeader title={t('error')} helpText="" onBack={onBack} />
                <p>{t('asset_not_found')}</p>
            </div>
        );
    }
    
    const totalInvested = asset.quantity * asset.avgPrice;
    const currentValue = asset.quantity * asset.currentPrice;
    const variation = currentValue - totalInvested;
    const variationPercent = totalInvested > 0 ? (variation / totalInvested) * 100 : 0;
    
    return (
        <div className="p-4">
            <PageHeader title={ticker} helpText="" onBack={onBack} />
            
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
                    <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
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

                    <div>
                        <h3 className="text-sm text-[var(--text-secondary)] font-bold mb-2">{t('price_history_7d')}</h3>
                        <div className="h-32 bg-[var(--bg-secondary)] rounded-lg p-2">
                            <PortfolioLineChart data={asset.priceHistory} isPositive={asset.priceHistory[asset.priceHistory.length -1] > asset.priceHistory[0]} simpleMode={true} />
                        </div>
                    </div>
                    
                    <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
                         <h3 className="font-bold text-lg mb-2">{t('key_indicators')}</h3>
                         <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-[var(--text-secondary)]">{t('quantity')}:</span> <span className="font-bold">{asset.quantity.toFixed(4)}</span></div>
                            <div><span className="text-[var(--text-secondary)]">{t('current_price')}:</span> <span className="font-bold">{formatCurrency(asset.currentPrice)}</span></div>
                            <div><span className="text-[var(--text-secondary)]">{t('avg_price')}:</span> <span className="font-bold">{formatCurrency(asset.avgPrice)}</span></div>
                            <div><span className="text-[var(--text-secondary)]">{t('yield_on_cost')}:</span> <span className="font-bold">{asset.yieldOnCost?.toFixed(2)}%</span></div>
                            <div><span className="text-[var(--text-secondary)]">{t('dy_12m')}:</span> <span className="font-bold">{asset.dy ? `${asset.dy.toFixed(2)}%` : 'N/A'}</span></div>
                            <div><span className="text-[var(--text-secondary)]">{t('pvp')}:</span> <span className="font-bold">{asset.pvp ? asset.pvp.toFixed(2) : 'N/A'}</span></div>
                            <div><span className="text-[var(--text-secondary)]">{t('administrator')}:</span> <span className="font-bold">{asset.administrator || 'N/A'}</span></div>
                            <div><span className="text-[var(--text-secondary)]">{t('vacancy')}:</span> <span className="font-bold">{asset.vacancyRate?.toFixed(2) || 'N/A'}%</span></div>
                            <div><span className="text-[var(--text-secondary)]">{t('daily_liquidity')}:</span> <span className="font-bold">{formatCurrency(asset.liquidity || 0)}</span></div>
                            <div><span className="text-[var(--text-secondary)]">{t('shareholders')}:</span> <span className="font-bold">{asset.shareholders?.toLocaleString(locale) || 'N/A'}</span></div>
                        </div>
                    </div>
                    <button onClick={() => onViewTransactions(asset.ticker)} className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-2 rounded-lg">{t('view_transactions')}</button>
                </div>
            )}
            {activeTab === 'history' && (
                <div className="space-y-2 animate-fade-in">
                    {assetTransactions.length > 0 ? assetTransactions.map(tx => (
                        <div key={tx.id} className="bg-[var(--bg-secondary)] p-3 rounded-lg text-sm">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className={`font-bold ${tx.type === 'Compra' ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>{t(tx.type === 'Compra' ? 'buy' : 'sell')}</p>
                                    <p className="text-xs text-[var(--text-secondary)]">{new Date(tx.date).toLocaleDateString(locale, { timeZone: 'UTC' })}</p>
                                </div>
                                <div className="text-right">
                                    <p>{t('shares_times_price', { count: tx.quantity, price: formatCurrency(tx.price) })}</p>
                                    <p className="font-bold">{formatCurrency(tx.quantity * tx.price)}</p>
                                </div>
                            </div>
                            {tx.notes && <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-[var(--border-color)] italic">"{tx.notes}"</p>}
                        </div>
                    )) : <p className="text-sm text-center text-[var(--text-secondary)] py-4">{t('no_transactions_for_asset')}</p>}
                </div>
            )}
        </div>
    );
};

export default AssetDetailView;
