
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
  getAveragePriceForTransaction: (transaction: Transaction) => number;
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

// Helper for precise float math
const EPSILON = 0.000001;

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

  const sourceTransactions = useMemo(() => isDemoMode ? DEMO_TRANSACTIONS : transactions, [isDemoMode, transactions]);

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

    const uniqueTickers: string[] = Array.from(new Set(sourceTransactions.map(t => t.ticker)));
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
  }, [sourceTransactions, preferences.customApiKey, isRefreshing, lastSync]);

  useEffect(() => {
    refreshMarketData(false, true).catch(() => {});
  }, [sourceTransactions.length]);

  // --- UNIFIED CALCULATION ENGINE ---
  // This function calculates the state of a single asset by replaying its history.
  // Used for both 'assets' view and 'getAveragePriceForTransaction'.
  const calculateAssetMetrics = useCallback((ticker: string, upToTransactionId?: string) => {
      // 1. Filter Transactions for this ticker
      let tickerTxs = sourceTransactions.filter(t => t.ticker === ticker);

      // 2. Sort Chronologically
      // Critical: Date ASC. If Date same -> Buy before Sell.
      tickerTxs.sort((a, b) => {
          if (a.date !== b.date) {
              return a.date.localeCompare(b.date);
          }
          if (a.type === 'Compra' && b.type === 'Venda') return -1;
          if (a.type === 'Venda' && b.type === 'Compra') return 1;
          return 0;
      });

      let quantity = 0;
      let totalCost = 0; // This is "Total Invested" book value

      for (const tx of tickerTxs) {
          // If we are looking for a specific point in time (for transaction history), stop here
          if (upToTransactionId && tx.id === upToTransactionId) {
              break;
          }

          if (tx.type === 'Compra') {
              // Buy: Increase Quantity and Increase Cost
              const cost = (tx.quantity * tx.price) + (tx.costs || 0);
              totalCost += cost;
              quantity += tx.quantity;
          } else if (tx.type === 'Venda') {
              // Sell: Decrease Quantity. 
              // Reduce Cost proportionally to the Average Price.
              // Avg Price DOES NOT CHANGE on sell.
              if (quantity > EPSILON) {
                  const avgPrice = totalCost / quantity;
                  const costReduction = tx.quantity * avgPrice;
                  totalCost -= costReduction;
                  quantity -= tx.quantity;
              }
          }

          // Floating Point Cleanup
          if (quantity <= EPSILON) {
              quantity = 0;
              totalCost = 0;
          }
      }
      
      const avgPrice = quantity > EPSILON ? totalCost / quantity : 0;

      return { quantity, totalCost, avgPrice };
  }, [sourceTransactions]);


  useEffect(() => {
    const sourceMarketData = isDemoMode ? DEMO_MARKET_DATA : marketData;

    // Calculate all assets based on the unified engine
    const uniqueTickers = Array.from(new Set(sourceTransactions.map(t => t.ticker))) as string[];
    
    const finalAssets: Asset[] = uniqueTickers.map((ticker): Asset | null => {
        const metrics = calculateAssetMetrics(ticker);
        
        if (metrics.quantity <= EPSILON) return null;

        const liveData = sourceMarketData[ticker] || {};
        
        // Fallback: Use AvgPrice if Market Price is missing/zero to prevent -100% gain display
        let currentPrice = liveData.currentPrice || 0;
        if (currentPrice <= 0 && metrics.avgPrice > 0) {
            currentPrice = metrics.avgPrice;
        }

        const dy = liveData.dy || 0;
        
        return {
            ticker,
            quantity: metrics.quantity,
            avgPrice: metrics.avgPrice,
            currentPrice: currentPrice,
            priceHistory: liveData.priceHistory || [metrics.avgPrice, currentPrice],
            dy: dy,
            pvp: liveData.pvp || 0,
            segment: liveData.sector || liveData.segment || 'Outros',
            administrator: liveData.administrator || 'N/A',
            vacancyRate: liveData.vacancyRate || 0,
            liquidity: liveData.liquidity || 0,
            shareholders: liveData.shareholders || 0,
            yieldOnCost: metrics.avgPrice > 0 && dy > 0 ? ( (currentPrice * (dy / 100)) / metrics.avgPrice ) * 100 : 0,
        };
    }).filter((a): a is Asset => a !== null);

    setAssets(finalAssets);

  }, [sourceTransactions, marketData, isDemoMode, calculateAssetMetrics]);
  
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
  
  // Uses the exact same engine as the main portfolio to ensure data consistency
  const getAveragePriceForTransaction = useCallback((targetTx: Transaction) => {
      const metrics = calculateAssetMetrics(targetTx.ticker, targetTx.id);
      return metrics.avgPrice;
  }, [calculateAssetMetrics]);
  
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
    transactions: sourceTransactions,
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
    getAveragePriceForTransaction,
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
