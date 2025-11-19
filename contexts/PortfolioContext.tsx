
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Asset, Transaction, AppPreferences, MonthlyIncome } from '../types';
import { fetchRealTimeData } from '../services/geminiService';
import { usePersistentState, CacheManager } from '../utils';
import { DEMO_TRANSACTIONS, DEMO_MARKET_DATA, CACHE_TTL } from '../constants';

interface PortfolioContextType {
  assets: Asset[];
  transactions: Transaction[];
  preferences: AppPreferences;
  isDemoMode: boolean;
  privacyMode: boolean;
  yieldOnCost: number;
  projectedAnnualIncome: number;
  monthlyIncome: MonthlyIncome[];
  lastSync: number | null;
  isRefreshing: boolean;
  marketDataError: string | null;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  importTransactions: (transactions: Transaction[]) => void;
  updatePreferences: (prefs: Partial<AppPreferences>) => void;
  refreshMarketData: (force?: boolean, silent?: boolean) => Promise<void>;
  getAssetByTicker: (ticker: string) => Asset | undefined;
  getAssetAveragePriceBeforeDate: (ticker: string, date: string) => number;
  setDemoMode: (enabled: boolean) => void;
  togglePrivacyMode: () => void;
  resetApp: () => void;
  clearCache: (key?: string) => void;
  getStorageUsage: () => number;
  getRawData: () => any;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

const DEFAULT_PREFERENCES: AppPreferences = {
    accentColor: 'blue',
    systemTheme: 'system',
    fontSize: 'medium',
    compactMode: false,
    showCurrencySymbol: true,
    reduceMotion: false,
    animationSpeed: 'normal',
    startScreen: 'carteira',
    hapticFeedback: true,
    vibrationIntensity: 'medium',
    hideCents: false,
    restartTutorial: false,
    privacyOnStart: false,
    appPin: null,
    defaultBrokerage: 0,
    csvSeparator: ',',
    decimalPrecision: 2,
    defaultSort: 'valueDesc',
    dateFormat: 'dd/mm/yyyy',
    priceAlertThreshold: 5,
    globalIncomeGoal: 1000,
    segmentGoals: {},
    dndEnabled: false,
    dndStart: '22:00',
    dndEnd: '07:00',
    notificationChannels: { push: true, email: false },
    customApiKey: null,
    autoBackup: false,
    betaFeatures: false,
    devMode: false
};

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = usePersistentState<Transaction[]>('transactions', []);
  const [preferences, setPreferences] = usePersistentState<AppPreferences>('app_preferences', DEFAULT_PREFERENCES);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [privacyMode, setPrivacyMode] = usePersistentState('privacy_mode', false);
  const [marketData, setMarketData] = usePersistentState<Record<string, any>>('market_data', {});
  const [lastSync, setLastSync] = usePersistentState<number | null>('last_sync', null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState<MonthlyIncome[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [marketDataError, setMarketDataError] = useState<string | null>(null);

  const addTransaction = (transaction: Transaction) => setTransactions(prev => [...prev, transaction]);
  const updateTransaction = (transaction: Transaction) => setTransactions(prev => prev.map(t => t.id === transaction.id ? transaction : t));
  const deleteTransaction = (id: string) => setTransactions(prev => prev.filter(t => t.id !== id));
  const importTransactions = (newTransactions: Transaction[]) => {
      setTransactions(prev => {
          const txIds = new Set(prev.map(t => t.id));
          const toAdd = newTransactions.filter(t => !txIds.has(t.id));
          return [...prev, ...toAdd];
      });
  };

  const updatePreferences = (newPrefs: Partial<AppPreferences>) => setPreferences(prev => ({ ...prev, ...newPrefs }));

  const togglePrivacyMode = () => setPrivacyMode(prev => !prev);
  
  const resetApp = () => {
    localStorage.clear();
    window.location.reload();
  };

  const clearCache = (key?: string) => {
    if (key === 'all') {
      Object.keys(localStorage).forEach(k => {
        if(k.startsWith('cache_')) localStorage.removeItem(k);
      });
      setMarketData({});
      setLastSync(null);
    } else if (key) {
      CacheManager.clear(key);
      if (key === 'asset_prices') {
        setMarketData({});
        setLastSync(null);
      }
    }
  };

  const getStorageUsage = () => {
    return Object.keys(localStorage).reduce((acc, key) => acc + (localStorage.getItem(key)?.length || 0), 0);
  };

  const getRawData = () => ({
    assets,
    transactions,
    preferences,
    marketData,
    lastSync
  });

  const refreshMarketData = useCallback(async (force = false, silent = false) => {
    if (isRefreshing) return;
    
    if (!force && lastSync && Date.now() - lastSync < CACHE_TTL.PRICES) {
      return;
    }

    const uniqueTickers = Array.from(new Set(transactions.map(t => t.ticker)));
    if (uniqueTickers.length === 0) {
      setMarketData({});
      setLastSync(Date.now());
      return;
    };

    if (!silent) setIsRefreshing(true);
    setMarketDataError(null);
    try {
      const data = await fetchRealTimeData(uniqueTickers, preferences.customApiKey);
      setMarketData(prev => ({ ...prev, ...data }));
      setLastSync(Date.now());
    } catch (error: any) {
      console.error("Market refresh failed:", error);
      setMarketDataError(error.message || "Falha na conexão com API.");
      throw error;
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [transactions, preferences.customApiKey, isRefreshing, lastSync]);

  useEffect(() => {
    // Silent background refresh on initial load
    refreshMarketData(false, true).catch(() => {});
  }, [transactions.length]);


  useEffect(() => {
    const sourceTransactions = isDemoMode ? DEMO_TRANSACTIONS : transactions;
    const sourceMarketData = isDemoMode ? DEMO_MARKET_DATA : marketData;

    const calculateAssets = () => {
        const assetMap: { [ticker: string]: { quantity: number; totalCost: number } } = {};

        const sortedTransactions = [...sourceTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (const tx of sortedTransactions) {
            if (!assetMap[tx.ticker]) {
                assetMap[tx.ticker] = { quantity: 0, totalCost: 0 };
            }

            const asset = assetMap[tx.ticker];
            const avgPrice = asset.quantity > 0 ? asset.totalCost / asset.quantity : 0;

            if (tx.type === 'Compra') {
                asset.totalCost += tx.quantity * tx.price + (tx.costs || 0);
                asset.quantity += tx.quantity;
            } else { // Venda
                if (asset.quantity > 0) {
                    asset.totalCost -= tx.quantity * avgPrice;
                    asset.quantity -= tx.quantity;
                }
            }
            if (asset.quantity <= 0) {
                 asset.quantity = 0;
                 asset.totalCost = 0;
            }
        }

        const finalAssets: Asset[] = Object.entries(assetMap)
            .filter(([, data]) => data.quantity > 0.0001)
            .map(([ticker, data]) => {
                const liveData = sourceMarketData[ticker] || {};
                const avgPrice = data.quantity > 0 ? data.totalCost / data.quantity : 0;
                const currentPrice = liveData.currentPrice || 0;
                const dy = liveData.dy || 0;

                return {
                    ticker,
                    quantity: data.quantity,
                    avgPrice: avgPrice,
                    currentPrice: currentPrice,
                    priceHistory: liveData.priceHistory || [avgPrice, currentPrice],
                    dy: dy,
                    pvp: liveData.pvp || 0,
                    segment: liveData.sector || liveData.segment || 'Outros',
                    administrator: liveData.administrator || 'N/A',
                    vacancyRate: liveData.vacancyRate || 0,
                    liquidity: liveData.liquidity || 0,
                    shareholders: liveData.shareholders || 0,
                    yieldOnCost: avgPrice > 0 && dy > 0 ? ( (currentPrice * (dy / 100)) / avgPrice ) * 100 : 0,
                };
            });

        setAssets(finalAssets);
    };
    
    calculateAssets();
  }, [transactions, marketData, isDemoMode]);
  
  const { projectedAnnualIncome, yieldOnCost } = useMemo(() => {
    let income = 0;
    let totalCost = 0;
    
    assets.forEach(asset => {
        if (asset.dy && asset.dy > 0) {
            income += asset.quantity * asset.currentPrice * (asset.dy / 100);
        }
        totalCost += asset.quantity * asset.avgPrice;
    });

    const yoc = totalCost > 0 ? (income / totalCost) * 100 : 0;
    return { projectedAnnualIncome: income, yieldOnCost: yoc };
  }, [assets]);

  useEffect(() => {
    const incomeHistory: MonthlyIncome[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthShort = monthDate.toLocaleString('default', { month: 'short' });
        
        let monthTotal = 0;
        assets.forEach(asset => {
             if (asset.dy && asset.dy > 0) {
                 monthTotal += (asset.quantity * asset.currentPrice * (asset.dy / 100)) / 12;
             }
        });
        monthTotal *= (0.9 + Math.random() * 0.2); 
        
        incomeHistory.push({ month: monthShort, total: monthTotal });
    }
    setMonthlyIncome(incomeHistory);
  }, [assets]);
  
  const getAssetByTicker = useCallback((ticker: string) => {
    return assets.find(a => a.ticker.toUpperCase() === ticker.toUpperCase());
  }, [assets]);
  
  const getAssetAveragePriceBeforeDate = useCallback((ticker: string, date: string) => {
      const targetDate = new Date(date).getTime();
      const relevantTransactions = transactions
          .filter(tx => tx.ticker === ticker && new Date(tx.date).getTime() < targetDate)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let quantity = 0;
      let totalCost = 0;
      
      for (const tx of relevantTransactions) {
          const avgPrice = quantity > 0 ? totalCost / quantity : 0;
          if (tx.type === 'Compra') {
              totalCost += tx.quantity * tx.price + (tx.costs || 0);
              quantity += tx.quantity;
          } else {
              totalCost -= tx.quantity * avgPrice;
              quantity -= tx.quantity;
          }
      }
      return quantity > 0 ? totalCost / quantity : 0;
  }, [transactions]);
  
  const setDemoMode = (enabled: boolean) => {
    setIsDemoMode(enabled);
    if(enabled) {
        setMarketData(DEMO_MARKET_DATA);
    } else {
        setMarketData({});
        refreshMarketData(true).catch(() => {});
    }
  };

  const value = {
    assets,
    transactions,
    preferences,
    isDemoMode,
    privacyMode,
    yieldOnCost,
    projectedAnnualIncome,
    monthlyIncome,
    lastSync,
    isRefreshing,
    marketDataError,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    importTransactions,
    updatePreferences,
    refreshMarketData,
    getAssetByTicker,
    getAssetAveragePriceBeforeDate,
    setDemoMode,
    togglePrivacyMode,
    resetApp,
    clearCache,
    getStorageUsage,
    getRawData,
  };

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
};

export const usePortfolio = (): PortfolioContextType => {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
