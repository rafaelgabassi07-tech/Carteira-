import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Asset, Transaction, AppPreferences, MonthlyIncome } from '../types';
// FIX: Corrected import path from non-existent aiService to geminiService.
import { fetchAdvancedAssetData } from '../services/geminiService';
import { fetchBrapiQuotes } from '../services/brapiService';
import { usePersistentState, CacheManager } from '../utils';
import { DEMO_TRANSACTIONS, DEMO_MARKET_DATA, CACHE_TTL } from '../constants';

// --- Types ---
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
  refreshSingleAsset: (ticker: string) => Promise<void>;
  getAssetByTicker: (ticker: string) => Asset | undefined;
  getAveragePriceForTransaction: (transaction: Transaction) => number;
  setDemoMode: (enabled: boolean) => void;
  togglePrivacyMode: () => void;
  resetApp: () => void;
  clearCache: (key?: string) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

// --- Constants ---
const DEFAULT_PREFERENCES: AppPreferences = {
    accentColor: 'blue', systemTheme: 'system', fontSize: 'medium', compactMode: false,
    showCurrencySymbol: true, reduceMotion: false, animationSpeed: 'normal',
    startScreen: 'carteira', hapticFeedback: true, vibrationIntensity: 'medium',
    hideCents: false, restartTutorial: false, privacyOnStart: false, appPin: null,
    defaultBrokerage: 0, csvSeparator: ',', decimalPrecision: 2, defaultSort: 'valueDesc',
    dateFormat: 'dd/mm/yyyy', priceAlertThreshold: 5, globalIncomeGoal: 1000,
    segmentGoals: {}, dndEnabled: false, dndStart: '22:00', dndEnd: '07:00',
    notificationChannels: { push: true, email: false }, autoBackup: false,
    betaFeatures: false, devMode: false
};
const EPSILON = 0.000001; // For floating point comparisons

// --- Unified Calculation Engine ---
const calculatePortfolioMetrics = (transactions: Transaction[]) => {
    const metrics: Record<string, { quantity: number; totalCost: number }> = {};
    const tickers = [...new Set(transactions.map(t => t.ticker))];

    tickers.forEach(ticker => {
        let quantity = 0;
        let totalCost = 0;

        transactions
            .filter(t => t.ticker === ticker)
            .sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                if (a.type === 'Compra' && b.type === 'Venda') return -1;
                if (a.type === 'Venda' && b.type === 'Compra') return 1;
                return 0;
            })
            .forEach(tx => {
                if (tx.type === 'Compra') {
                    const cost = (tx.quantity * tx.price) + (tx.costs || 0);
                    totalCost += cost;
                    quantity += tx.quantity;
                } else if (tx.type === 'Venda') {
                    const sellQuantity = Math.min(tx.quantity, quantity); // Prevent selling more than owned
                    if (quantity > EPSILON) {
                        const avgPrice = totalCost / quantity;
                        const costReduction = sellQuantity * avgPrice;
                        totalCost -= costReduction;
                        quantity -= sellQuantity;
                    }
                }
                if (quantity < EPSILON) {
                    quantity = 0;
                    totalCost = 0;
                }
            });
        
        if (quantity > EPSILON) {
            metrics[ticker] = { quantity, totalCost };
        }
    });

    return metrics;
};

// --- Provider ---
export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = usePersistentState<Transaction[]>('transactions', []);
  const [preferences, setPreferences] = usePersistentState<AppPreferences>('app_preferences', DEFAULT_PREFERENCES);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [privacyMode, setPrivacyMode] = usePersistentState('privacy_mode', false);
  const [marketData, setMarketData] = usePersistentState<Record<string, any>>('market_data', {});
  const [lastSync, setLastSync] = usePersistentState<number | null>('last_sync', null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [marketDataError, setMarketDataError] = useState<string | null>(null);

  const sourceTransactions = useMemo(() => isDemoMode ? DEMO_TRANSACTIONS : transactions, [isDemoMode, transactions]);

  // --- Actions ---
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
  const resetApp = () => { localStorage.clear(); window.location.reload(); };
  const clearCache = (key?: string) => {
    if (key === 'all') {
      Object.keys(localStorage).forEach(k => { if(k.startsWith('cache_')) localStorage.removeItem(k); });
      setMarketData({}); setLastSync(null);
    } else if (key) {
      CacheManager.clear(key);
      if (key === 'asset_prices') { setMarketData({}); setLastSync(null); }
    }
  };

  const refreshMarketData = useCallback(async (force = false, silent = false) => {
    if (isRefreshing) return;
    if (!force && lastSync && Date.now() - lastSync < CACHE_TTL.PRICES) return;

    // FIX: Changed from spread syntax to Array.from and added explicit typing for the map function argument
    // to resolve a type inference issue where uniqueTickers was inferred as 'unknown[]' instead of 'string[]'.
    const uniqueTickers = Array.from(new Set(sourceTransactions.map((t: Transaction) => t.ticker)));
    if (uniqueTickers.length === 0) { setMarketData({}); setLastSync(Date.now()); return; }

    if (!silent) setIsRefreshing(true);
    setMarketDataError(null);
    try {
        // Step 1: Fetch fast, critical price data from Brapi
        const priceData = await fetchBrapiQuotes(uniqueTickers);
        setMarketData(prev => {
            const updated = { ...prev };
            Object.keys(priceData).forEach(ticker => {
                updated[ticker] = { ...(updated[ticker] || {}), ...priceData[ticker] };
            });
            return updated;
        });

        // Step 2: Fetch richer, slower data from AI in the background
        // This will enrich the existing data without blocking the UI
        fetchAdvancedAssetData(uniqueTickers).then(advancedData => {
            setMarketData(prev => {
                const updated = { ...prev };
                Object.keys(advancedData).forEach(ticker => {
                    updated[ticker] = { ...(updated[ticker] || {}), ...advancedData[ticker] };
                });
                return updated;
            });
        }).catch(err => {
            console.warn("AI data enrichment failed:", err);
            // Non-critical error, we can still function with just price data
            // We could set a partial error state here if needed
        });
        
        setLastSync(Date.now());

    } catch (error: any) {
      console.error("Primary market data (Brapi) refresh failed:", error);
      const errorMessage = error.message || "Falha na conexão com API de cotações.";
      setMarketDataError(errorMessage);
      if (force) throw new Error(errorMessage);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [sourceTransactions, isRefreshing, lastSync]);
  
  const refreshSingleAsset = useCallback(async (ticker: string) => {
    if (!ticker) return;
    setMarketDataError(null);
    try {
        const priceData = await fetchBrapiQuotes([ticker]);
        if (priceData && priceData[ticker]) {
            setMarketData(prev => ({ ...prev, [ticker]: { ...(prev[ticker] || {}), ...priceData[ticker] } }));
        }

        const advancedData = await fetchAdvancedAssetData([ticker]);
        if (advancedData && advancedData[ticker]) {
            setMarketData(prev => ({ ...prev, [ticker]: { ...(prev[ticker] || {}), ...advancedData[ticker] } }));
        }
        
        setLastSync(Date.now());
    } catch (error: any) {
      console.error(`Market refresh for ${ticker} failed:`, error);
      const errorMessage = error.message || "Falha na conexão com API.";
      setMarketDataError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [setMarketData, setLastSync]);


  useEffect(() => { refreshMarketData(false, true).catch(() => {}); }, [sourceTransactions, refreshMarketData]);

  // --- Derived State (Calculations) ---
  const portfolioMetrics = useMemo(() => calculatePortfolioMetrics(sourceTransactions), [sourceTransactions]);

  const assets: Asset[] = useMemo(() => {
    const sourceMarketData = isDemoMode ? DEMO_MARKET_DATA : marketData;

    return Object.keys(portfolioMetrics).map(ticker => {
        const metrics = portfolioMetrics[ticker];
        const liveData = sourceMarketData[ticker] || {};
        const avgPrice = metrics.totalCost / metrics.quantity;
        
        let currentPrice = liveData.currentPrice || 0;
        if (currentPrice <= 0 && avgPrice > 0) currentPrice = avgPrice;

        const dy = liveData.dy || 0;
        const yieldOnCost = avgPrice > 0 && dy > 0 ? ((currentPrice * (dy / 100)) / avgPrice) * 100 : 0;
        
        const vacancy = liveData.vacancyRate;

        return {
            ticker,
            quantity: metrics.quantity,
            avgPrice,
            currentPrice,
            priceHistory: liveData.priceHistory || [avgPrice, currentPrice],
            dy,
            yieldOnCost,
            pvp: liveData.pvp || 0,
            segment: liveData.sector || liveData.segment || 'Outros',
            administrator: liveData.administrator || 'N/A',
            vacancyRate: vacancy === -1 ? undefined : vacancy,
            liquidity: liveData.dailyLiquidity || 0,
            shareholders: liveData.shareholders || 0,
        };
    });
  }, [portfolioMetrics, marketData, isDemoMode]);

  const { projectedAnnualIncome, yieldOnCost } = useMemo(() => {
    let income = 0, totalCost = 0;
    assets.forEach(asset => {
        if (asset.dy && asset.dy > 0) income += asset.quantity * asset.currentPrice * (asset.dy / 100);
        totalCost += asset.quantity * asset.avgPrice;
    });
    const yoc = totalCost > 0 ? (income / totalCost) * 100 : 0;
    return { projectedAnnualIncome: income, yieldOnCost: yoc };
  }, [assets]);
  
  const getAveragePriceForTransaction = useCallback((targetTx: Transaction) => {
      const relevantTxs = sourceTransactions.filter(t => 
        t.ticker === targetTx.ticker && 
        (t.date < targetTx.date || (t.date === targetTx.date && t.id < targetTx.id))
      );
      const metrics = calculatePortfolioMetrics(relevantTxs);
      const tickerMetrics = metrics[targetTx.ticker];
      if (tickerMetrics && tickerMetrics.quantity > EPSILON) {
          return tickerMetrics.totalCost / tickerMetrics.quantity;
      }
      return 0;
  }, [sourceTransactions]);

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
    assets, transactions: sourceTransactions, preferences, isDemoMode, privacyMode,
    yieldOnCost, projectedAnnualIncome, monthlyIncome: [], lastSync, isRefreshing, marketDataError,
    addTransaction, updateTransaction, deleteTransaction, importTransactions,
    updatePreferences, refreshMarketData, refreshSingleAsset, getAveragePriceForTransaction, setDemoMode,
    togglePrivacyMode, resetApp, clearCache,
    getAssetByTicker: useCallback((ticker: string) => assets.find(a => a.ticker === ticker), [assets]),
  };

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
};

export const usePortfolio = (): PortfolioContextType => {
  const context = useContext(PortfolioContext);
  if (!context) throw new Error('usePortfolio must be used within a PortfolioProvider');
  return context;
};