import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Asset, Transaction, AppPreferences, MonthlyIncome } from '../types';
import { fetchRealTimeData } from '../services/geminiService';
import { usePersistentState, CacheManager } from '../utils';
import { DEMO_TRANSACTIONS, DEMO_MARKET_DATA } from '../constants';

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
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  importTransactions: (transactions: Transaction[]) => void;
  updatePreferences: (prefs: Partial<AppPreferences>) => void;
  refreshMarketData: () => Promise<void>;
  getAssetByTicker: (ticker: string) => Asset | undefined;
  getAssetAveragePriceBeforeDate: (ticker: string, date: string) => number;
  setDemoMode: (enabled: boolean) => void;
  togglePrivacyMode: () => void;
  resetApp: () => void;
  clearCache: (key?: string) => void;
  getStorageUsage: () => number;
  getRawData: () => any; // New function for debugging
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
    segmentGoals: {}, // Default empty goals
    dndEnabled: false,
    dndStart: '22:00',
    dndEnd: '07:00',
    notificationChannels: { push: true, email: false },
    // FIX: Removed customApiKey per coding guidelines.
    autoBackup: false,
    betaFeatures: false,
    devMode: false
};

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = usePersistentState<Transaction[]>('transactions', []);
  const [preferences, setPreferences] = usePersistentState<AppPreferences>('app_preferences', DEFAULT_PREFERENCES);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [marketData, setMarketData] = usePersistentState<Record<string, any>>('market_data', {});
  const [lastSync, setLastSync] = usePersistentState<number | null>('last_sync_timestamp', null);

  // Derived Assets State
  const assets = useMemo<Asset[]>(() => {
    const currentTransactions = isDemoMode ? DEMO_TRANSACTIONS : transactions;
    const grouped: Record<string, { quantity: number; totalCost: number; avgPrice: number }> = {};

    // Sort by date ascending to calculate average price correctly
    const sortedTx = [...currentTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTx.forEach(tx => {
        if (!grouped[tx.ticker]) grouped[tx.ticker] = { quantity: 0, totalCost: 0, avgPrice: 0 };
        
        if (tx.type === 'Compra') {
            const cost = (tx.quantity * tx.price) + (tx.costs || 0);
            grouped[tx.ticker].quantity += tx.quantity;
            grouped[tx.ticker].totalCost += cost;
            // Weighted Average Price
            grouped[tx.ticker].avgPrice = grouped[tx.ticker].totalCost / grouped[tx.ticker].quantity;
        } else {
            // Sell reduces quantity but doesn't change average price (in Brazilian tax rules mostly)
            // However, we reduce totalCost proportionally to keep AvgPrice constant
            grouped[tx.ticker].quantity -= tx.quantity;
            grouped[tx.ticker].totalCost = grouped[tx.ticker].quantity * grouped[tx.ticker].avgPrice;
        }
    });

    const currentMarketData = isDemoMode ? DEMO_MARKET_DATA : marketData;

    return Object.entries(grouped)
        .filter(([_, data]) => data.quantity > 0) // Filter out closed positions
        .map(([ticker, data]) => {
            const mData = currentMarketData[ticker] || {};
            const currentPrice = mData.currentPrice || data.avgPrice; // Fallback to avg price if no market data
            const dy = mData.dy || 0;
            
            return {
                ticker,
                quantity: data.quantity,
                avgPrice: data.avgPrice,
                currentPrice: currentPrice,
                priceHistory: mData.priceHistory || [currentPrice], // Mock history if missing
                dy: dy,
                pvp: mData.pvp,
                segment: mData.sector,
                administrator: mData.administrator,
                vacancyRate: 0, // Placeholder
                liquidity: 0, // Placeholder
                shareholders: 0, // Placeholder
                yieldOnCost: data.avgPrice > 0 ? (dy * currentPrice / data.avgPrice) : 0,
            };
        });
  }, [transactions, marketData, isDemoMode]);

  const refreshMarketData = useCallback(async () => {
      if (isDemoMode) return; // Don't refresh in demo mode

      const tickers = Array.from(new Set(transactions.map(t => t.ticker)));
      if (tickers.length === 0) return;

      try {
          // FIX: Removed customApiKey from fetchRealTimeData call per guidelines.
          const newData = await fetchRealTimeData(tickers);
          
          // Smart Merge: Only update tickers that returned valid data
          // This prevents wiping out cache for tickers that failed in a partial update
          setMarketData(prev => {
              const merged = { ...prev };
              Object.keys(newData).forEach(ticker => {
                  if (newData[ticker] && newData[ticker].currentPrice > 0) {
                      // Maintain price history
                      const oldHistory = merged[ticker]?.priceHistory || [];
                      const newPrice = newData[ticker].currentPrice;
                      // Only add to history if price changed significantly or it's a new day (simplified here)
                      const updatedHistory = [...oldHistory.slice(-29), newPrice]; 
                      
                      merged[ticker] = {
                          ...newData[ticker],
                          priceHistory: updatedHistory
                      };
                  }
              });
              return merged;
          });
          
          setLastSync(Date.now()); // Update timestamp
      } catch (error) {
          console.error("Failed to refresh market data", error);
          throw error;
      }
      // FIX: Removed preferences.customApiKey from dependency array as it's no longer used.
  }, [transactions, isDemoMode, setMarketData, setLastSync]);

  // Initial Load of Market Data
  useEffect(() => {
      if (!isDemoMode && transactions.length > 0) {
         // If no last sync or synced more than 15 mins ago, refresh
         if (!lastSync || (Date.now() - lastSync > 15 * 60 * 1000)) {
             refreshMarketData();
         }
      }
  }, [isDemoMode, transactions.length, lastSync, refreshMarketData]);

  const monthlyIncome = useMemo<MonthlyIncome[]>(() => {
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const currentMonthIndex = new Date().getMonth();
      
      const rotatedMonths = [
          ...months.slice(currentMonthIndex + 1),
          ...months.slice(0, currentMonthIndex + 1)
      ];

      return rotatedMonths.map((month) => {
          const total = assets.reduce((acc, asset) => {
              // Accurate projection: (Price * DY% / 12) * Quantity
              const monthlyYield = (asset.currentPrice * ((asset.dy || 0) / 100)) / 12;
              return acc + (monthlyYield * asset.quantity);
          }, 0);
          
          // Safety check
          return { month, total: isFinite(total) ? total : 0 };
      });
  }, [assets]);

  const yieldOnCost = useMemo(() => {
      if (assets.length === 0) return 0;
      const totalInvested = assets.reduce((acc, a) => acc + (a.avgPrice * a.quantity), 0);
      const totalIncome = assets.reduce((acc, a) => acc + ((a.currentPrice * (a.dy || 0) / 100) * a.quantity), 0);
      
      const result = totalInvested > 0 ? (totalIncome / totalInvested) * 100 : 0;
      return isFinite(result) ? result : 0;
  }, [assets]);
  
  const projectedAnnualIncome = useMemo(() => {
      const result = assets.reduce((acc, a) => acc + ((a.currentPrice * (a.dy || 0) / 100) * a.quantity), 0);
      return isFinite(result) ? result : 0;
  }, [assets]);

  const addTransaction = (transaction: Transaction) => {
      setTransactions(prev => [...prev, transaction]);
  };

  const updateTransaction = (transaction: Transaction) => {
      setTransactions(prev => prev.map(t => t.id === transaction.id ? transaction : t));
  };

  const deleteTransaction = (id: string) => {
      setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const importTransactions = (newTransactions: Transaction[]) => {
      setTransactions(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const uniqueNew = newTransactions.filter(t => !existingIds.has(t.id));
          return [...prev, ...uniqueNew];
      });
  };

  const updatePreferences = (newPrefs: Partial<AppPreferences>) => {
      setPreferences(prev => ({ ...prev, ...newPrefs }));
  };

  const getAssetByTicker = (ticker: string) => assets.find(a => a.ticker === ticker);

  const getAssetAveragePriceBeforeDate = (ticker: string, date: string) => {
      const txs = transactions
        .filter(t => t.ticker === ticker && new Date(t.date) < new Date(date) && t.type === 'Compra')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      if (txs.length === 0) return 0;

      let totalQty = 0;
      let totalCost = 0;
      
      txs.forEach(tx => {
          totalQty += tx.quantity;
          totalCost += (tx.quantity * tx.price) + (tx.costs || 0);
      });

      const result = totalQty > 0 ? totalCost / totalQty : 0;
      return isFinite(result) ? result : 0;
  };

  const togglePrivacyMode = () => setPrivacyMode(prev => !prev);

  const resetApp = () => {
      localStorage.clear();
      window.location.reload();
  };

  const clearCache = (key?: string) => {
      if (key && key !== 'all') {
          CacheManager.clear(key);
          // If clearing price cache, reset market data in state to trigger UI update
          if (key === 'asset_prices') setMarketData({});
      } else {
          // Clear all keys starting with 'cache_'
          Object.keys(localStorage).forEach(k => {
              if (k.startsWith('cache_')) localStorage.removeItem(k);
          });
          setMarketData({});
      }
  };

  const getStorageUsage = () => {
      let total = 0;
      for (let x in localStorage) {
          if (localStorage.hasOwnProperty(x)) {
              total += ((localStorage[x].length + x.length) * 2);
          }
      }
      return total;
  };

  const getRawData = () => ({
      assets,
      transactions,
      preferences,
      marketData,
      lastSync
  });

  return (
    <PortfolioContext.Provider value={{
      assets,
      transactions,
      preferences,
      isDemoMode,
      privacyMode,
      yieldOnCost,
      projectedAnnualIncome,
      monthlyIncome,
      lastSync,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      importTransactions,
      updatePreferences,
      refreshMarketData,
      getAssetByTicker,
      getAssetAveragePriceBeforeDate,
      setDemoMode: setIsDemoMode,
      togglePrivacyMode,
      resetApp,
      clearCache,
      getStorageUsage,
      getRawData
    }}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
