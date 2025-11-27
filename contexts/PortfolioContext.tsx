
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Asset, Transaction, AppPreferences, MonthlyIncome, UserProfile, Dividend, DividendHistoryEvent, AppStats, SegmentEvolutionData, PortfolioEvolutionPoint } from '../types';
import { fetchAdvancedAssetData } from '../services/geminiService';
import { fetchBrapiQuotes } from '../services/brapiService';
import { usePersistentState, calculatePortfolioMetrics, applyThemeToDocument, getClosestPrice, fromISODate, CacheManager } from '../utils';
import { DEMO_TRANSACTIONS, DEMO_DIVIDENDS, DEMO_MARKET_DATA, CACHE_TTL, MOCK_USER_PROFILE, APP_THEMES, APP_FONTS, STALE_TIME } from '../constants';

// ... (Keep interfaces mostly the same)
interface PortfolioContextType {
  assets: Asset[];
  transactions: Transaction[];
  dividends: Dividend[];
  preferences: AppPreferences;
  isDemoMode: boolean;
  privacyMode: boolean;
  yieldOnCost: number;
  projectedAnnualIncome: number;
  monthlyIncome: MonthlyIncome[];
  lastSync: number | null;
  isRefreshing: boolean;
  marketDataError: string | null;
  userProfile: UserProfile;
  apiStats: AppStats;
  portfolioEvolution: SegmentEvolutionData;
  // Actions
  addTransaction: (t: Transaction) => void;
  updateTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;
  importTransactions: (t: Transaction[]) => void;
  restoreData: (data: any) => void;
  updatePreferences: (p: Partial<AppPreferences>) => void;
  setTheme: (id: string) => void;
  setFont: (id: string) => void;
  updateUserProfile: (p: Partial<UserProfile>) => void;
  refreshMarketData: (force?: boolean, silent?: boolean) => Promise<void>;
  refreshAllData: () => Promise<void>;
  refreshSingleAsset: (ticker: string, force?: boolean) => Promise<void>;
  getAssetByTicker: (ticker: string) => Asset | undefined;
  getAveragePriceForTransaction: (t: Transaction) => number;
  setDemoMode: (e: boolean) => void;
  setPrivacyMode: React.Dispatch<React.SetStateAction<boolean>>;
  togglePrivacyMode: () => void;
  resetApp: () => void;
  clearCache: (key?: string) => void;
  logApiUsage: (api: 'gemini'|'brapi', stats: any) => void;
  resetApiStats: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

// Defaults
const DEFAULT_PREFERENCES: AppPreferences = {
    accentColor: 'blue', systemTheme: 'system', visualStyle: 'premium', fontSize: 'medium', compactMode: false,
    currentThemeId: 'default-dark', currentFontId: 'inter', showCurrencySymbol: true, reduceMotion: false, animationSpeed: 'normal',
    startScreen: 'carteira', hapticFeedback: true, vibrationIntensity: 'medium', hideCents: false, privacyOnStart: false, appPin: null,
    defaultBrokerage: 0, csvSeparator: ',', decimalPrecision: 2, defaultSort: 'valueDesc', dateFormat: 'dd/mm/yyyy',
    priceAlertThreshold: 5, globalIncomeGoal: 1000, segmentGoals: {}, dndEnabled: false, dndStart: '22:00', dndEnd: '07:00',
    notificationChannels: { push: true, email: false }, geminiApiKey: null, brapiToken: null, autoBackup: false, betaFeatures: false, devMode: false
};

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State Management
  const [transactions, setTransactions] = usePersistentState<Transaction[]>('transactions', []);
  const [preferences, setPreferences] = usePersistentState<AppPreferences>('app_preferences', DEFAULT_PREFERENCES);
  const [userProfile, setUserProfile] = usePersistentState<UserProfile>('user_profile', MOCK_USER_PROFILE);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [privacyMode, setPrivacyMode] = usePersistentState('privacy_mode', false);
  const [marketData, setMarketData] = usePersistentState<Record<string, any>>('market_data', {});
  const [lastSync, setLastSync] = usePersistentState<number | null>('last_sync', null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [marketDataError, setMarketDataError] = useState<string | null>(null);
  const [apiStats, setApiStats] = usePersistentState<AppStats>('api_stats', { gemini: {requests:0, bytesSent:0, bytesReceived:0}, brapi: {requests:0, bytesSent:0, bytesReceived:0} });

  const sourceTransactions = isDemoMode ? DEMO_TRANSACTIONS : transactions;
  const sourceMarketData = isDemoMode ? DEMO_MARKET_DATA : marketData;

  // API Usage Logger
  const logApiUsage = useCallback((api: 'gemini' | 'brapi', stats: any) => {
      setApiStats(prev => ({
          ...prev,
          [api]: {
              requests: prev[api].requests + (stats.requests || 0),
              bytesSent: prev[api].bytesSent + (stats.bytesSent || 0),
              bytesReceived: prev[api].bytesReceived + (stats.bytesReceived || 0),
          }
      }));
  }, [setApiStats]);
  const resetApiStats = useCallback(() => setApiStats({ gemini: {requests:0, bytesSent:0, bytesReceived:0}, brapi: {requests:0, bytesSent:0, bytesReceived:0} }), [setApiStats]);

  // Theme Engine
  useEffect(() => {
      const theme = APP_THEMES.find(t => t.id === preferences.currentThemeId) || APP_THEMES[0];
      applyThemeToDocument(theme);
  }, [preferences.currentThemeId]);

  useEffect(() => {
      const font = APP_FONTS.find(f => f.id === preferences.currentFontId) || APP_FONTS[0];
      document.documentElement.style.setProperty('--font-family', font.family);
  }, [preferences.currentFontId]);

  // Basic Actions
  const addTransaction = useCallback((t: Transaction) => setTransactions(p => [...p, t]), [setTransactions]);
  const updateTransaction = useCallback((t: Transaction) => setTransactions(p => p.map(tr => tr.id === t.id ? t : tr)), [setTransactions]);
  const deleteTransaction = useCallback((id: string) => setTransactions(p => p.filter(t => t.id !== id)), [setTransactions]);
  
  const importTransactions = useCallback((newT: Transaction[]) => {
      setTransactions(prev => {
          const ids = new Set(prev.map(t => t.id));
          return [...prev, ...newT.filter(t => !ids.has(t.id))];
      });
  }, [setTransactions]);

  const restoreData = useCallback((data: any) => {
      setTransactions(data.transactions || []);
      if(data.preferences) setPreferences(p => ({...p, ...data.preferences}));
  }, [setTransactions, setPreferences]);

  const updatePreferences = useCallback((p: Partial<AppPreferences>) => setPreferences(prev => ({...prev, ...p})), [setPreferences]);
  const updateUserProfile = useCallback((p: Partial<UserProfile>) => setUserProfile(prev => ({...prev, ...p})), [setUserProfile]);
  const setTheme = useCallback((id: string) => setPreferences(p => ({...p, currentThemeId: id})), [setPreferences]);
  const setFont = useCallback((id: string) => setPreferences(p => ({...p, currentFontId: id})), [setPreferences]);
  const togglePrivacyMode = useCallback(() => setPrivacyMode(p => !p), [setPrivacyMode]);
  
  const resetApp = useCallback(() => {
      if(window.confirm("Resetar App?")) { localStorage.clear(); window.location.reload(); }
  }, []);

  const clearCache = useCallback((key?: string) => {
      if(key === 'all') { 
          Object.keys(localStorage).forEach(k => k.startsWith('cache_') && localStorage.removeItem(k)); 
          setMarketData({}); setLastSync(null); 
      } else if (key) CacheManager.clear(key);
  }, [setMarketData, setLastSync]);

  // Market Data Refresh
  const refreshMarketData = useCallback(async (force = false, silent = false) => {
      if(isRefreshing) return;
      if(!force && lastSync && Date.now() - lastSync < CACHE_TTL.PRICES) return; // Throttle

      const tickers = Array.from(new Set(sourceTransactions.map(t => t.ticker)));
      if(tickers.length === 0) return;

      if(!silent) setIsRefreshing(true);
      setMarketDataError(null);

      try {
          // Parallel fetch
          const [brapiRes, geminiRes] = await Promise.allSettled([
              fetchBrapiQuotes(preferences, tickers),
              fetchAdvancedAssetData(preferences, tickers)
          ]);

          setMarketData(prev => {
              const next = { ...prev };
              
              if(brapiRes.status === 'fulfilled') {
                  const res = brapiRes.value;
                  logApiUsage('brapi', { requests: tickers.length, bytesReceived: res.stats.bytesReceived });
                  Object.entries(res.quotes).forEach(([tkr, data]) => {
                      next[tkr] = { ...(next[tkr] || {}), ...data, lastUpdated: Date.now() };
                  });
              }

              if(geminiRes.status === 'fulfilled') {
                  // Explicit cast to handle tuple vs array inference in Promise.allSettled
                  const res = geminiRes.value as { data: any; stats: { bytesSent: number; bytesReceived: number } };
                  logApiUsage('gemini', { requests: 1, ...res.stats });
                  Object.entries(res.data).forEach(([tkr, data]) => {
                      next[tkr] = { ...(next[tkr] || {}), ...(data as object), lastUpdated: Date.now() };
                  });
              }
              return next;
          });
          setLastSync(Date.now());
      } catch(e: any) {
          setMarketDataError(e.message);
      } finally {
          if(!silent) setIsRefreshing(false);
      }
  }, [isRefreshing, lastSync, sourceTransactions, preferences, setMarketData, setLastSync, logApiUsage]);

  const refreshSingleAsset = useCallback(async (ticker: string, force = false) => {
      if(!ticker) return;
      const now = Date.now();
      const current = marketData[ticker.toUpperCase()];
      
      if(!force && current && current.lastUpdated && (now - current.lastUpdated < STALE_TIME.PRICES)) return;

      try {
          const { quotes } = await fetchBrapiQuotes(preferences, [ticker]);
          const { data } = await fetchAdvancedAssetData(preferences, [ticker]);
          
          setMarketData(prev => ({
              ...prev,
              [ticker.toUpperCase()]: {
                  ...(prev[ticker.toUpperCase()] || {}),
                  ...(quotes[ticker.toUpperCase()] || {}),
                  ...(data[ticker.toUpperCase()] || {}),
                  lastUpdated: now
              }
          }));
      } catch (e) { console.error(e); }
  }, [marketData, preferences, setMarketData]);

  const refreshAllData = useCallback(async () => {
      await refreshMarketData(true);
  }, [refreshMarketData]);

  // --- Calculated Values (Assets, Evolution, Income) ---
  
  const assets = useMemo(() => {
      const metrics = calculatePortfolioMetrics(sourceTransactions);
      return Object.keys(metrics).map(ticker => {
          const m = metrics[ticker];
          const data = (sourceMarketData as any)[ticker.toUpperCase()] || {};
          const avgPrice = m.quantity > 0 ? m.totalCost / m.quantity : 0;
          const curPrice = data.currentPrice || avgPrice;
          
          // Combined Dividends
          const histMap = new Map<string, DividendHistoryEvent>();
          (data.dividendsHistory || []).forEach((d: DividendHistoryEvent) => histMap.set(d.exDate, d));
          (data.recentDividends || []).forEach((d: DividendHistoryEvent) => histMap.set(d.exDate, d)); // Gemini overrides if same date
          
          return {
              ticker,
              quantity: m.quantity,
              avgPrice,
              currentPrice: curPrice,
              priceHistory: data.priceHistory || [],
              dividendsHistory: Array.from(histMap.values()).sort((a,b) => b.exDate.localeCompare(a.exDate)),
              dy: data.dy,
              pvp: data.pvp,
              segment: data.assetType || data.sector || 'Outros',
              administrator: data.administrator,
              vacancyRate: data.vacancyRate,
              liquidity: data.dailyLiquidity,
              shareholders: data.shareholders,
              yieldOnCost: avgPrice > 0 ? ((curPrice * ((data.dy||0)/100))/avgPrice)*100 : 0,
              nextPaymentDate: data.nextPaymentDate,
              lastDividend: data.lastDividend
          };
      }).filter(a => a.quantity > 0.000001);
  }, [sourceTransactions, sourceMarketData]);

  // Helper: Get Asset
  const getAssetByTicker = useCallback((t: string) => assets.find(a => a.ticker === t), [assets]);

  // Helper: Get Quantity on specific date
  const getQuantityOnDate = useCallback((ticker: string, date: string) => {
      return sourceTransactions
          .filter(t => t.ticker === ticker && t.date <= date)
          .reduce((acc, t) => t.type === 'Compra' ? acc + t.quantity : acc - t.quantity, 0);
  }, [sourceTransactions]);

  // Heavy Calc: Evolution
  const portfolioEvolution = useMemo((): SegmentEvolutionData => {
      // Optimized Evolution Calculation
      const points: PortfolioEvolutionPoint[] = [];
      const today = new Date();
      
      // 1. Generate Dates (Last 12 months)
      const checkDates: Date[] = [];
      for(let i=12; i>=0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
          checkDates.push(d > today ? today : d);
      }
      // Dedup
      const uniqueDates = Array.from(new Set(checkDates.map(d => d.toISOString().split('T')[0]))).sort();

      // 2. Sort Transactions
      const sortedTx = [...sourceTransactions].sort((a,b) => a.date.localeCompare(b.date));

      uniqueDates.forEach(dateStr => {
          // Fast state reconstruction
          let invested = 0;
          const holdings: Record<string, number> = {}; // Ticker -> Quantity

          // Replay history up to dateStr
          for(const tx of sortedTx) {
              if(tx.date > dateStr) break;
              const cost = (tx.quantity * tx.price) + (tx.costs||0);
              if(tx.type === 'Compra') {
                  holdings[tx.ticker] = (holdings[tx.ticker] || 0) + tx.quantity;
                  invested += cost;
              } else {
                  // Average price logic approximation for performance
                  holdings[tx.ticker] -= tx.quantity; 
              }
          }

          // 3. Calculate Market Value
          let marketVal = 0;
          Object.keys(holdings).forEach(t => {
              if(holdings[t] > 0) {
                  const assetData = (sourceMarketData as any)[t.toUpperCase()];
                  const price = getClosestPrice(assetData?.priceHistory || [], dateStr) || (assetData?.currentPrice) || 0;
                  marketVal += holdings[t] * price;
                  
                  // If no price history, assume price = avg price (breakeven) to avoid graph drops to 0
                  if (price === 0 && assetData?.currentPrice) marketVal += holdings[t] * assetData.currentPrice; 
              }
          });

          points.push({ 
              month: new Date(dateStr).toLocaleDateString('pt-BR', {month:'short', year:'2-digit'}),
              invested: Math.max(0, invested), 
              marketValue: marketVal 
          });
      });

      return { all_types: points };
  }, [sourceTransactions, sourceMarketData]);

  // Dividends & Income (HISTORICAL ACCURACY FIX)
  const { dividends, monthlyIncome, projectedAnnualIncome, yieldOnCost } = useMemo(() => {
      const divs: Dividend[] = [];
      // Key as YYYY-MM for correct sorting
      const incomeMap: Record<string, number> = {};
      let projIncome = 0;
      let totalInv = 0;

      // Calculate Projected Income and Current Yield on Cost based on CURRENT holdings
      assets.forEach(a => {
          totalInv += a.quantity * a.avgPrice;
          projIncome += a.quantity * a.currentPrice * ((a.dy||0)/100);
      });

      // Calculate HISTORICAL Income based on PAST holdings
      // Iterate through all known dividend events for assets we have ever held
      const distinctTickers = Array.from(new Set(sourceTransactions.map(t => t.ticker)));
      
      distinctTickers.forEach(ticker => {
          const assetData = (sourceMarketData as any)[ticker.toUpperCase()];
          const dividendsHistory: DividendHistoryEvent[] = assetData?.dividendsHistory || [];
          const recentDividends: DividendHistoryEvent[] = assetData?.recentDividends || [];
          
          // Merge histories
          const combinedHistory = new Map<string, DividendHistoryEvent>();
          dividendsHistory.forEach(d => combinedHistory.set(d.exDate, d));
          recentDividends.forEach(d => combinedHistory.set(d.exDate, d));

          combinedHistory.forEach(event => {
              // Crucial Step: How many shares did I have on the Ex-Date?
              const qtyOnExDate = getQuantityOnDate(ticker, event.exDate);
              
              if (qtyOnExDate > 0) {
                  const totalReceived = qtyOnExDate * event.value;
                  
                  divs.push({
                      ticker: ticker,
                      amountPerShare: event.value,
                      quantity: qtyOnExDate, // Historical quantity
                      paymentDate: event.paymentDate
                  });

                  // Use YYYY-MM as key for sorting (e.g., "2023-10")
                  const dateObj = fromISODate(event.paymentDate);
                  const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                  incomeMap[sortKey] = (incomeMap[sortKey] || 0) + totalReceived;
              }
          });
      });

      // Convert map to array and sort by key (chronologically), then format label
      const mIncome = Object.entries(incomeMap)
        .sort((a, b) => a[0].localeCompare(b[0])) // Sort keys "2023-10", "2023-11", etc.
        .map(([key, total]) => {
            const [year, month] = key.split('-').map(Number);
            // Create date for formatting (using day 1 to avoid timezone shifts)
            const date = new Date(year, month - 1, 1);
            const label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            return { month: label, total };
        });

      return { 
          dividends: divs.sort((a,b) => b.paymentDate.localeCompare(a.paymentDate)), 
          monthlyIncome: mIncome, 
          projectedAnnualIncome: projIncome,
          yieldOnCost: totalInv > 0 ? (projIncome/totalInv)*100 : 0
      };
  }, [assets, sourceTransactions, sourceMarketData, getQuantityOnDate]);

  // Helper
  const getAveragePriceForTransaction = useCallback(() => 0, []); // Placeholder

  const value = {
      assets, transactions: sourceTransactions, dividends, preferences, isDemoMode, privacyMode,
      yieldOnCost, projectedAnnualIncome, monthlyIncome, lastSync, isRefreshing, marketDataError, userProfile, apiStats, portfolioEvolution,
      addTransaction, updateTransaction, deleteTransaction, importTransactions, restoreData,
      updatePreferences, setTheme, setFont, updateUserProfile,
      refreshMarketData, refreshAllData, refreshSingleAsset, getAssetByTicker, getAveragePriceForTransaction,
      setDemoMode: setIsDemoMode, setPrivacyMode, togglePrivacyMode, resetApp, clearCache, logApiUsage, resetApiStats
  };

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
};

export const usePortfolio = () => {
    const ctx = useContext(PortfolioContext);
    if(!ctx) throw new Error("usePortfolio missing");
    return ctx;
};
