
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
  refreshMarketData: (force?: boolean) => Promise<void>;
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
  const [privacyMode, setPrivacyMode] = useState(false);
  const [marketData, setMarketData] = usePersistentState<Record<string, any>>('market_data', {});
  const [lastSync, setLastSync] = usePersistentState<number | null>('last_sync_timestamp', null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [marketDataError, setMarketDataError] = useState<string | null>(null);

  // Derived Assets State
  const assets = useMemo<Asset[]>(() => {
    const currentTransactions = isDemoMode ? DEMO_TRANSACTIONS : transactions;
    const grouped: Record<string, { quantity: number; totalCost: number; avgPrice: number }> = {};

    const sortedTx = [...currentTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTx.forEach(tx => {
        if (!grouped[tx.ticker]) grouped[tx.ticker] = { quantity: 0, totalCost: 0, avgPrice: 0 };
        
        if (tx.type === 'Compra') {
            const cost = (tx.quantity * tx.price) + (tx.costs || 0);
            grouped[tx.ticker].quantity += tx.quantity;
            grouped[tx.ticker].totalCost += cost;
            grouped[tx.ticker].avgPrice = grouped[tx.ticker].totalCost / grouped[tx.ticker].quantity;
        } else {
            grouped[tx.ticker].quantity -= tx.quantity;
            grouped[tx.ticker].totalCost = grouped[tx.ticker].quantity * grouped[tx.ticker].avgPrice;
        }
    });

    const currentMarketData = isDemoMode ? DEMO_MARKET_DATA : marketData;

    return Object.entries(grouped)
        .filter(([_, data]) => data.quantity > 0)
        .map(([ticker, data]) => {
            const mData = currentMarketData[ticker] || {};
            const currentPrice = mData.currentPrice || data.avgPrice; 
            const dy = mData.dy || 0;
            
            return {
                ticker,
                quantity: data.quantity,
                avgPrice: data.avgPrice,
                currentPrice: currentPrice,
                priceHistory: mData.priceHistory || [currentPrice],
                dy: dy,
                pvp: mData.pvp,
                segment: mData.sector,
                administrator: mData.administrator,
                vacancyRate: 0,
                liquidity: 0,
                shareholders: 0,
                yieldOnCost: data.avgPrice > 0 ? (dy * currentPrice / data.avgPrice) : 0,
            };
        });
  }, [transactions, marketData, isDemoMode]);

  const refreshMarketData = useCallback(async (force = false) => {
    if (isDemoMode) return;
    
    const tickers = Array.from(new Set(transactions.map(t => t.ticker)));
    if (tickers.length === 0) return;

    // Only skip if we have recent data AND we are not forcing (manual pull-to-refresh)
    if (!force && lastSync && (Date.now() - lastSync < 5 * 60 * 1000)) {
        return;
    }

    setIsRefreshing(true);
    setMarketDataError(null);

    try {
        // Attempt to fetch new data
        const newData = await fetchRealTimeData(tickers, preferences.customApiKey);
        
        if (Object.keys(newData).length > 0) {
            setMarketData(prev => {
                const merged = { ...prev };
                Object.keys(newData).forEach(ticker => {
                    if (newData[ticker]) {
                        // Preserve history if it exists
                        const oldHistory = merged[ticker]?.priceHistory || [];
                        const newPrice = newData[ticker].currentPrice;
                        
                        // Avoid duplicate price entries if price hasn't changed significantly to keep chart clean
                        let updatedHistory = oldHistory;
                        if (newPrice > 0) {
                             updatedHistory = [...oldHistory.slice(-29), newPrice];
                        }
                        
                        merged[ticker] = {
                            ...merged[ticker], // Keep old fields if any
                            ...newData[ticker], // Overwrite with new
                            priceHistory: updatedHistory
                        };
                    }
                });
                return merged;
            });
            setLastSync(Date.now());
        }
    } catch (error: any) {
        console.error("Market refresh failed:", error);
        setMarketDataError(error.message || 'Falha na atualização. Verifique sua conexão ou chave API.');
        throw error; // Re-throw so UI can catch it for toasts
    } finally {
        setIsRefreshing(false);
    }
  }, [transactions, isDemoMode, setMarketData, setLastSync, preferences.customApiKey, lastSync]);

  // Auto-refresh on mount
  useEffect(() => {
    if (!isDemoMode && transactions.length > 0) {
        refreshMarketData(false);
    }
  }, [isDemoMode, transactions.length, refreshMarketData]);

  // ... (Rest of context)
  const monthlyIncome = useMemo<MonthlyIncome[]>(() => {
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const currentMonthIndex = new Date().getMonth();
      const rotatedMonths = [...months.slice(currentMonthIndex + 1), ...months.slice(0, currentMonthIndex + 1)];
      return rotatedMonths.map((month) => {
          const total = assets.reduce((acc, asset) => {
              const monthlyYield = (asset.currentPrice * ((asset.dy || 0) / 100)) / 12;
              return acc + (monthlyYield * asset.quantity);
          }, 0);
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
          if (key === 'asset_prices') setMarketData({});
      } else {
          Object.keys(localStorage).forEach(k => {
              if (k.startsWith('cache_')) localStorage.removeItem(k);
          });
          setMarketData({});
          setLastSync(null);
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
  const getRawData = () => ({ assets, transactions, preferences, marketData, lastSync });

  return (
    <PortfolioContext.Provider value={{
      assets, transactions, preferences, isDemoMode, privacyMode, yieldOnCost, projectedAnnualIncome, monthlyIncome, lastSync, isRefreshing, marketDataError,
      addTransaction, updateTransaction, deleteTransaction, importTransactions, updatePreferences, refreshMarketData, getAssetByTicker,
      getAssetAveragePriceBeforeDate, setDemoMode: setIsDemoMode, togglePrivacyMode, resetApp, clearCache, getStorageUsage, getRawData
    }}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (!context) throw new Error('usePortfolio must be used within a PortfolioProvider');
  return context;
};