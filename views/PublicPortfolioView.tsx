
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Asset, Transaction, MinimalTransaction, AppPreferences, MonthlyIncome, ToastMessage } from '../types';
import { calculatePortfolioMetrics, fromISODate } from '../utils';
import { fetchBrapiQuotes } from '../services/brapiService';
import { fetchAdvancedAssetData } from '../services/geminiService';
import { useI18n } from '../contexts/I18nContext';
import LoadingSpinner from '../components/LoadingSpinner';
import PortfolioPieChart from '../components/PortfolioPieChart';
import BarChart from '../components/BarChart';
import CountUp from '../components/CountUp';
import RefreshIcon from '../components/icons/RefreshIcon';
import AssetListItem from '../components/AssetListItem';
import Toast from '../components/Toast';
import WalletIcon from '../components/icons/WalletIcon';

// --- Local Components for Public View ---

const Metric: React.FC<{ label: string; children: React.ReactNode; }> = ({ label, children }) => (
    <div>
        <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">{label}</h3>
        <div className="font-semibold text-lg">{children}</div>
    </div>
);

const PublicPortfolioSummary: React.FC<{ 
    assets: Asset[]; 
    totalInvested: number;
    currentValue: number;
    yieldOnCost: number;
    projectedAnnualIncome: number;
}> = ({ assets, totalInvested, currentValue, yieldOnCost, projectedAnnualIncome }) => {
    const { t, formatCurrency } = useI18n();
    
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

const DashboardCard: React.FC<{ title: string; children: React.ReactNode; delay?: number; className?: string }> = ({ title, children, delay = 0, className = '' }) => (
    <div className={`bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-color)] shadow-sm animate-fade-in-up ${className}`} style={{ animationDelay: `${delay}ms` }}>
        <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">{title}</h3>
        {children}
    </div>
);


// --- Main Public View Component ---

interface PublicPortfolioViewProps {
    initialTransactions: MinimalTransaction[];
}

const PublicPortfolioView: React.FC<PublicPortfolioViewProps> = ({ initialTransactions }) => {
    const { t } = useI18n();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(true);
    const [toast, setToast] = useState<ToastMessage | null>(null);

    const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
        const newToast: ToastMessage = { id: Date.now(), message, type, duration: 3000 };
        setToast(newToast);
    }, []);

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
                    // Fix: Cast data to object to avoid "Spread types may only be created from object types"
                    newMarketData[tkr] = { ...(newMarketData[tkr] || {}), ...(data as object) };
                });
            }

            const metrics = calculatePortfolioMetrics(transactions);
            const newAssets: Asset[] = Object.keys(metrics).map(ticker => {
                const m = metrics[ticker];
                const data = newMarketData[ticker.toUpperCase()] || {};
                const avgPrice = m.quantity > 0 ? m.totalCost / m.quantity : 0;
                const curPrice = data.currentPrice || avgPrice;
                return {
                    ticker, quantity: m.quantity, avgPrice, currentPrice: curPrice,
                    priceHistory: data.priceHistory || [],
                    dividendsHistory: data.dividendsHistory || [],
                    dy: data.dy, pvp: data.pvp, segment: data.assetType || data.sector || 'Outros',
                    administrator: data.administrator, vacancyRate: data.vacancyRate,
                    liquidity: data.dailyLiquidity, shareholders: data.shareholders,
                    yieldOnCost: avgPrice > 0 ? (((curPrice * ((data.dy||0)/100))/avgPrice)*100) : 0,
                };
            }).filter(a => a.quantity > 0.000001);
            
            setAssets(newAssets);
            addToast(t('toast_update_success'), 'success');
        } catch (e) {
            console.error("Failed to fetch public market data", e);
            addToast(t('toast_update_failed'), 'error');
        } finally {
            setIsRefreshing(false);
        }
    }, [transactions, t, addToast]);

    useEffect(() => {
        refreshMarketData();
    }, [refreshMarketData]);

    // Replicated Logic from PortfolioContext
    const getQuantityOnDate = useCallback((ticker: string, date: string) => {
      return transactions
          .filter(t => t.ticker === ticker && t.date <= date)
          .reduce((acc, t) => t.type === 'Compra' ? acc + t.quantity : acc - t.quantity, 0);
    }, [transactions]);

    const { monthlyIncome, projectedAnnualIncome, yieldOnCost, totalInvested, currentValue } = useMemo(() => {
      const incomeMap: Record<string, number> = {};
      let projIncome = 0;
      let totalInv = 0;
      let currentVal = 0;

      assets.forEach(a => {
          totalInv += a.quantity * a.avgPrice;
          currentVal += a.quantity * a.currentPrice;
          projIncome += a.quantity * a.currentPrice * ((a.dy || 0) / 100);
          
          (a.dividendsHistory || []).forEach(event => {
              const qtyOnExDate = getQuantityOnDate(a.ticker, event.exDate);
              if (qtyOnExDate > 0) {
                  const totalReceived = qtyOnExDate * event.value;
                  const dateObj = fromISODate(event.paymentDate);
                  const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                  incomeMap[sortKey] = (incomeMap[sortKey] || 0) + totalReceived;
              }
          });
      });

      const mIncome = Object.entries(incomeMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, total]) => {
            const [year, month] = key.split('-').map(Number);
            const date = new Date(year, month - 1, 1);
            const label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            return { month: label, total };
        });

      return { 
          monthlyIncome: mIncome,
          projectedAnnualIncome: projIncome,
          yieldOnCost: totalInv > 0 ? (projIncome / totalInv) * 100 : 0,
          totalInvested: totalInv,
          currentValue: currentVal,
      };
    }, [assets, getQuantityOnDate]);

    const diversificationData = useMemo(() => {
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

    if (isRefreshing && assets.length === 0) {
        return <LoadingSpinner />;
    }

    return (
        <div className="h-screen w-screen overflow-y-auto custom-scrollbar p-4 pb-8 bg-[var(--bg-primary)]">
            <header className="max-w-7xl mx-auto flex justify-between items-center py-4 px-4 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] mb-6 shadow-sm">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[var(--accent-color)] to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-[var(--accent-color)]/20">
                        <WalletIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-black text-xl text-[var(--text-primary)] tracking-tight leading-none">Invest</h1>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">{t('public_view_header')}</p>
                    </div>
                </div>
                <button 
                    onClick={refreshMarketData} 
                    disabled={isRefreshing}
                    className="p-2 rounded-full bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--accent-color)] hover:bg-[var(--bg-tertiary-hover)] transition-all active:scale-95 border border-[var(--border-color)]"
                >
                    <RefreshIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
            </header>
            
            <main className="max-w-7xl mx-auto">
                <div className="md:max-w-2xl md:mx-auto lg:max-w-3xl">
                    <PublicPortfolioSummary 
                        assets={assets}
                        totalInvested={totalInvested}
                        currentValue={currentValue}
                        yieldOnCost={yieldOnCost}
                        projectedAnnualIncome={projectedAnnualIncome}
                    />
                </div>

                <div className="px-4 mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <DashboardCard title={t('monthly_income')} delay={100}>
                        <div className="h-48 w-full">
                           <BarChart data={monthlyIncome} />
                        </div>
                    </DashboardCard>
                    <DashboardCard title={t('diversification')} delay={200}>
                        <PortfolioPieChart data={diversificationData} goals={{}} />
                    </DashboardCard>
                </div>

                <div className="px-4 mt-8">
                    <h3 className="font-bold text-lg mb-3 px-1">{t('my_assets')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {assets.map((asset, index) => (
                            <AssetListItem 
                                key={asset.ticker}
                                asset={asset}
                                totalValue={currentValue}
                                onClick={() => {}} 
                                style={{ animationDelay: `${index * 50}ms` }}
                                privacyMode={false}
                                hideCents={false}
                            />
                        ))}
                    </div>
                </div>
            </main>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default PublicPortfolioView;
