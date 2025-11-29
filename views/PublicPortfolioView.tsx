import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Asset, Transaction, MinimalTransaction, AppPreferences, MonthlyIncome } from '../types';
import { calculatePortfolioMetrics, fromISODate, toISODate } from '../utils';
import { fetchBrapiQuotes } from '../services/brapiService';
import { fetchAdvancedAssetData } from '../services/geminiService';
import { useI18n } from '../contexts/I18nContext';
import LoadingSpinner from '../components/LoadingSpinner';
import PortfolioPieChart from '../components/PortfolioPieChart';
import BarChart from '../components/BarChart';
import CountUp from '../components/CountUp';
import RefreshIcon from '../components/icons/RefreshIcon';

const Metric: React.FC<{ label: string; children: React.ReactNode; }> = ({ label, children }) => (
    <div>
        <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">{label}</h3>
        <div className="font-semibold text-lg">{children}</div>
    </div>
);

const PublicPortfolioSummary: React.FC<{ assets: Asset[] }> = ({ assets }) => {
    const { t, formatCurrency, locale } = useI18n();
    
    const { totalInvested, currentValue, yieldOnCost, projectedAnnualIncome } = useMemo(() => {
        let totalInv = 0, currentVal = 0, projIncome = 0;
        assets.forEach(asset => {
            totalInv += asset.quantity * asset.avgPrice;
            currentVal += asset.quantity * asset.currentPrice;
            projIncome += asset.quantity * asset.currentPrice * ((asset.dy || 0) / 100);
        });
        const yoc = totalInv > 0 ? (projIncome / totalInv) * 100 : 0;
        return { totalInvested: totalInv, currentValue: currentVal, yieldOnCost: yoc, projectedAnnualIncome: projIncome };
    }, [assets]);
    
    const unrealizedGain = currentValue - totalInvested;
    const unrealizedGainPercent = totalInvested > 0 ? (unrealizedGain / totalInvested) * 100 : 0;

    return (
         <div className="bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] p-6 rounded-2xl mx-4 mt-4 shadow-lg border border-[var(--border-color)] animate-scale-in">
            <div className="relative z-10">
                <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('my_portfolio')}</h2>
                <p className="text-4xl font-bold tracking-tight mt-2 mb-1 text-[var(--text-primary)]">
                    <CountUp end={currentValue} formatter={formatCurrency} />
                </p>
                <p className={`text-sm font-semibold flex items-center gap-1 ${unrealizedGain >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                    {unrealizedGain >= 0 ? '▲' : '▼'}
                    <CountUp end={Math.abs(unrealizedGain)} formatter={formatCurrency} /> 
                    <span className="opacity-80">({unrealizedGainPercent.toFixed(2)}%)</span>
                </p>
                <div className="border-t border-[var(--border-color)]/50 my-5"></div>
                <div className="grid grid-cols-2 gap-y-5 gap-x-2">
                    <Metric label={t('total_invested')}><p className="text-[var(--text-primary)]"><CountUp end={totalInvested} formatter={formatCurrency} /></p></Metric>
                    <Metric label={t('yield_on_cost')}><p className="text-[var(--accent-color)]"><CountUp end={yieldOnCost} decimals={2} />%</p></Metric>
                    <Metric label={t('projected_annual_income')}><p className="text-[var(--text-primary)]"><CountUp end={projectedAnnualIncome} formatter={formatCurrency} /></p></Metric>
                    <Metric label={t('capital_gain')}><p className={unrealizedGain >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}><CountUp end={unrealizedGain} formatter={formatCurrency} /></p></Metric>
                </div>
            </div>
        </div>
    );
};

interface PublicPortfolioViewProps {
    initialTransactions: MinimalTransaction[];
}

const PublicPortfolioView: React.FC<PublicPortfolioViewProps> = ({ initialTransactions }) => {
    const { t } = useI18n();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(true);

    const transactions: Transaction[] = useMemo(() => {
        return initialTransactions.map((tx, i) => ({
            id: `pub_${i}`,
            ticker: tx.t,
            quantity: tx.q,
            price: tx.p,
            date: tx.d,
            type: tx.y === 'C' ? 'Compra' : 'Venda'
        }));
    }, [initialTransactions]);

    const refreshMarketData = useCallback(async () => {
        setIsRefreshing(true);
        const tickers = Array.from(new Set(transactions.map(t => t.ticker)));
        if (tickers.length === 0) {
            setIsRefreshing(false);
            return;
        }

        // Use public fallback API keys
        const publicPrefs = { geminiApiKey: null, brapiToken: null } as AppPreferences;

        try {
            const [brapiRes, geminiRes] = await Promise.allSettled([
                fetchBrapiQuotes(publicPrefs, tickers),
                fetchAdvancedAssetData(publicPrefs, tickers)
            ]);

            const newMarketData: Record<string, any> = {};

            if (brapiRes.status === 'fulfilled') {
                Object.entries(brapiRes.value.quotes).forEach(([tkr, data]) => {
                    newMarketData[tkr] = { ...(newMarketData[tkr] || {}), ...data };
                });
            }
            if (geminiRes.status === 'fulfilled') {
                Object.entries(geminiRes.value.data).forEach(([tkr, data]) => {
// --- FIX START ---
// Cast `data` to `object` before spreading to resolve "Spread types may only be created from object types" error.
                    newMarketData[tkr] = { ...(newMarketData[tkr] || {}), ...(data as object) };
// --- FIX END ---
                });
            }

            const metrics = calculatePortfolioMetrics(transactions);
            const newAssets: Asset[] = Object.keys(metrics).map(ticker => {
                const m = metrics[ticker];
                const data = newMarketData[ticker.toUpperCase()] || {};
                const avgPrice = m.quantity > 0 ? m.totalCost / m.quantity : 0;
                return {
                    ticker, quantity: m.quantity, avgPrice, currentPrice: data.currentPrice || avgPrice,
                    priceHistory: data.priceHistory || [],
                    dividendsHistory: data.dividendsHistory || [],
                    dy: data.dy, pvp: data.pvp, segment: data.assetType || data.sector || 'Outros',
                    administrator: data.administrator, vacancyRate: data.vacancyRate,
                    liquidity: data.dailyLiquidity, shareholders: data.shareholders,
                    yieldOnCost: avgPrice > 0 ? (( (data.currentPrice || avgPrice) * ((data.dy||0)/100))/avgPrice)*100 : 0,
                };
            }).filter(a => a.quantity > 0.000001);
            
            setAssets(newAssets);

        } catch (e) {
            console.error("Failed to fetch public market data", e);
        } finally {
            setIsRefreshing(false);
        }
    }, [transactions]);

    useEffect(() => {
        refreshMarketData();
    }, [refreshMarketData]);

    if (isRefreshing && assets.length === 0) {
        return <LoadingSpinner />;
    }

    return (
        <div className="h-screen w-screen overflow-y-auto custom-scrollbar p-4 pb-8">
            <header className="max-w-7xl mx-auto flex justify-between items-center py-3 px-4">
                 <div>
                    <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)] leading-tight">{t('public_view_title')}</h1>
                    <p className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-wider">{t('public_view_header')}</p>
                </div>
                <button 
                    onClick={refreshMarketData} 
                    disabled={isRefreshing}
                    className="p-2 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                >
                    <RefreshIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
            </header>
            <div className="max-w-7xl mx-auto">
                <div className="md:max-w-2xl md:mx-auto lg:max-w-3xl">
                    <PublicPortfolioSummary assets={assets} />
                </div>
            </div>
        </div>
    );
};

export default PublicPortfolioView;