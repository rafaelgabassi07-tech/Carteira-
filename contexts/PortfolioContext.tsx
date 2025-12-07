
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Asset, Transaction, AppPreferences, UserProfile, Dividend, DividendHistoryEvent, AppStats, AppNotification, PortfolioEvolutionPoint, MonthlyIncome } from '../types';
import { fetchAdvancedAssetData } from '../services/geminiService';
import { fetchBrapiQuotes } from '../services/brapiService';
import { generateNotifications } from '../services/dynamicDataService';
import { usePersistentState, applyThemeToDocument, CacheManager, toISODate, idb } from '../utils';
import { DEMO_TRANSACTIONS, DEMO_DIVIDENDS, DEMO_MARKET_DATA, CACHE_TTL, MOCK_USER_PROFILE, APP_THEMES, APP_FONTS, STALE_TIME } from '../constants';
import { usePortfolioCalculations, PayerData } from '../hooks/usePortfolioCalculations';

interface PortfolioContextType {
  assets: Asset[];
  transactions: Transaction[];
  preferences: AppPreferences;
  isDemoMode: boolean;
  yieldOnCost: number;
  projectedAnnualIncome: number;
  portfolioEvolution: Record<string, PortfolioEvolutionPoint[]>;
  monthlyIncome: MonthlyIncome[];
  payersData: PayerData[];
  totalReceived: number;
  lastSync: number | null;
  isRefreshing: boolean;
  marketDataError: string | null;
  userProfile: UserProfile;
  apiStats: AppStats;
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  deferredPrompt: any;
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
  resetApp: () => void;
  clearCache: (key?: string) => void;
  logApiUsage: (api: 'gemini'|'brapi', stats: any) => void;
  resetApiStats: () => void;
  privacyMode: boolean;
  togglePrivacyMode: () => void;
  markNotificationsAsRead: () => void;
  deleteNotification: (id: number) => void;
  clearAllNotifications: () => void;
  installPwa: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

const DEFAULT_PREFERENCES: AppPreferences = {
    accentColor: 'blue', systemTheme: 'system', visualStyle: 'premium', fontSize: 'medium', compactMode: false,
    currentThemeId: 'default-dark', currentFontId: 'inter', showCurrencySymbol: true, reduceMotion: false, animationSpeed: 'normal',
    startScreen: 'dashboard', hapticFeedback: true, vibrationIntensity: 'medium', hideCents: false, appPin: null,
    defaultBrokerage: 0, csvSeparator: ',', decimalPrecision: 2, defaultSort: 'valueDesc', dateFormat: 'dd/mm/yyyy',
    priceAlertThreshold: 5, globalIncomeGoal: 1000, segmentGoals: {}, dndEnabled: false, dndStart: '22:00', dndEnd: '07:00',
    notificationChannels: { push: true, email: false }, geminiApiKey: null, brapiToken: null, autoBackup: false, betaFeatures: false, devMode: false
};

const chunkArray = <T,>(array: T[], size: number): T[][] => {
    const chunked: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
};

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = usePersistentState<Transaction[]>('transactions', []);
  const [preferences, setPreferences] = usePersistentState<AppPreferences>('app_preferences', DEFAULT_PREFERENCES);
  const [userProfile, setUserProfile] = usePersistentState<UserProfile>('user_profile', MOCK_USER_PROFILE);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [marketData, setMarketData] = usePersistentState<Record<string, any>>('market_data', {});
  const [lastSync, setLastSync] = usePersistentState<number | null>('last_sync', null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [marketDataError, setMarketDataError] = useState<string | null>(null);
  const [apiStats, setApiStats] = usePersistentState<AppStats>('api_stats', { gemini: {requests:0, bytesSent:0, bytesReceived:0}, brapi: {requests:0, bytesSent:0, bytesReceived:0} });
  const [privacyMode, setPrivacyMode] = useState(false);
  const [notifications, setNotifications] = usePersistentState<AppNotification[]>('app-notifications', []);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  const initialLoadDone = useRef(false);
  const refreshInProgress = useRef(false);
  // CRITICAL FIX: Ensure marketDataRef is always up to date
  const marketDataRef = useRef(marketData);

  useEffect(() => { marketDataRef.current = marketData; }, [marketData]);

  useEffect(() => {
      const handleBeforeInstallPrompt = (e: any) => {
          e.preventDefault();
          setDeferredPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const installPwa = useCallback(() => {
      if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choiceResult: any) => {
              if (choiceResult.outcome === 'accepted') {
                  setDeferredPrompt(null);
              }
          });
      }
  }, [deferredPrompt]);
  
  const sourceTransactions = isDemoMode ? DEMO_TRANSACTIONS : transactions;
  const sourceMarketData = isDemoMode ? DEMO_MARKET_DATA : marketData;

  const {
      assets,
      portfolioEvolution,
      monthlyIncome,
      payersData,
      totalReceived,
      yieldOnCost,
      projectedAnnualIncome
  } = usePortfolioCalculations(sourceTransactions, sourceMarketData);

  useEffect(() => {
      setUnreadNotificationsCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

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

  const togglePrivacyMode = useCallback(() => setPrivacyMode(p => !p), []);

  useEffect(() => {
      const theme = APP_THEMES.find(t => t.id === preferences.currentThemeId) || APP_THEMES[0];
      applyThemeToDocument(theme);
  }, [preferences.currentThemeId]);

  useEffect(() => {
      const font = APP_FONTS.find(f => f.id === preferences.currentFontId) || APP_FONTS[0];
      document.documentElement.style.setProperty('--font-family', font.family);
  }, [preferences.currentFontId]);

  const refreshSingleAsset = useCallback(async (ticker: string, force = false) => {
      if(!ticker) return;
      const now = Date.now();
      const currentData = marketDataRef.current[ticker.toUpperCase()];
      
      if(!force && currentData && currentData.lastUpdated && (now - currentData.lastUpdated < STALE_TIME.PRICES)) return;

      try {
          const { quotes } = await fetchBrapiQuotes(preferences, [ticker], false);
          
          setMarketData(prev => ({
              ...prev,
              [ticker.toUpperCase()]: {
                  ...(prev[ticker.toUpperCase()] || {}),
                  ...(quotes[ticker.toUpperCase()] || {}),
                  lastUpdated: now,
              }
          }));

          const isFundamentalsStale = !currentData || !currentData.lastFundamentalUpdate || (now - currentData.lastFundamentalUpdate > STALE_TIME.FUNDAMENTALS);
          const hasMissingDividends = !currentData?.dividendsHistory || currentData.dividendsHistory.length === 0;

          if (force || isFundamentalsStale || hasMissingDividends) {
             const {data, stats} = await fetchAdvancedAssetData(preferences, [ticker]);
             logApiUsage('gemini', { requests: 1, ...stats });
             
             setMarketData(prev => ({
                ...prev,
                [ticker.toUpperCase()]: {
                    ...(prev[ticker.toUpperCase()] || {}),
                    ...(data[ticker.toUpperCase()] || {}),
                    lastFundamentalUpdate: now
                }
             }));
          }
      } catch (e: any) { 
          console.error("Erro ao atualizar ativo individual:", e);
          throw e;
      }
  }, [preferences, setMarketData, logApiUsage]);
  
  const addTransaction = useCallback((t: Transaction) => {
    const isNewAsset = !assets.some(a => a.ticker === t.ticker.toUpperCase());
    setTransactions(p => [...p, t]);
    if (isNewAsset) {
      refreshSingleAsset(t.ticker, true);
    }
  }, [setTransactions, assets, refreshSingleAsset]);

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
  
  const resetApp = useCallback(async () => {
      if(window.confirm("Resetar App?")) { 
          await idb.clear();
          localStorage.clear(); 
          window.location.reload(); 
      }
  }, []);

  const clearCache = useCallback(async (key?: string) => {
      if(key === 'all') { 
          setMarketData({}); 
          setLastSync(null); 
      } else if (key) {
          await CacheManager.clear(key);
      }
  }, [setMarketData, setLastSync]);

  const markNotificationsAsRead = useCallback(() => {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadNotificationsCount(0);
  }, [setNotifications]);

  const deleteNotification = useCallback((id: number) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  }, [setNotifications]);

  const clearAllNotifications = useCallback(() => {
      setNotifications([]);
      setUnreadNotificationsCount(0);
  }, [setNotifications]);

  // --- REFACTORED ROBUST DATA FETCHING ---
  const refreshMarketData = useCallback(async (force = false, silent = false) => {
      if (refreshInProgress.current) {
          console.log("Update already in progress, skipping.");
          return;
      }

      const tickers = Array.from(new Set(sourceTransactions.map(t => t.ticker.toUpperCase())));
      if (tickers.length === 0) return;

      refreshInProgress.current = true;
      if (!silent) setIsRefreshing(true);
      setMarketDataError(null);

      const now = Date.now();

      try {
          // --- Phase 1: Prices (Brapi) - Independent execution ---
          let brapiFailed = false;
          
          try {
              const brapiRes = await fetchBrapiQuotes(preferences, tickers, false);
              logApiUsage('brapi', { requests: 1, bytesReceived: brapiRes.stats.bytesReceived });
              
              // Immediate Partial State Update for Prices
              setMarketData(prev => {
                  const updated = { ...prev };
                  Object.entries(brapiRes.quotes).forEach(([tkr, data]) => {
                      updated[tkr] = { 
                          ...(updated[tkr] || {}), 
                          ...(data as any),
                          lastUpdated: now 
                      };
                  });
                  return updated;
              });

          } catch (e: any) {
              console.warn("Brapi update failed:", e);
              brapiFailed = true;
          }

          // --- Phase 2: Fundamentals (Gemini) - Independent execution ---
          
          // Get fresh state from ref to decide what to update
          const currentMarketData = marketDataRef.current;
          
          const assetsNeedingUpdate = tickers.filter(t => {
              const data = currentMarketData[t.toUpperCase()];
              
              // Always try to fetch if Brapi failed to at least get a price approximation via Google Search
              if (brapiFailed || !data?.currentPrice) return true;
              
              if (force) return true;
              
              // Check Stale Time for Fundamentals (usually 24h)
              const fundamentalsStale = !data?.lastFundamentalUpdate || (now - data.lastFundamentalUpdate > STALE_TIME.FUNDAMENTALS);
              const missingDividends = !data?.dividendsHistory || data.dividendsHistory.length === 0;
              
              return fundamentalsStale || missingDividends;
          });

          const failedTickers: string[] = [];

          if (assetsNeedingUpdate.length > 0) {
              // Batch processing changed to 1 (Request per Asset) for maximum isolation and stability
              const batches = chunkArray(assetsNeedingUpdate, 1); 
              
              for (let i = 0; i < batches.length; i++) {
                  const batch = batches[i];
                  try {
                      const geminiRes = await fetchAdvancedAssetData(preferences, batch);
                      logApiUsage('gemini', { requests: 1, ...geminiRes.stats });

                      // Incrementally update state per batch
                      setMarketData(prev => {
                          const updated = { ...prev };
                          Object.entries(geminiRes.data).forEach(([tkr, data]) => {
                              updated[tkr] = {
                                  ...(updated[tkr] || {}),
                                  ...(data as object),
                                  lastFundamentalUpdate: now
                              };
                          });
                          return updated;
                      });
                  } catch (e: any) {
                      console.error("Gemini Asset Failed:", batch, e);
                      failedTickers.push(...batch);
                  }
                  
                  // Rate limit delay: Wait 2.0s between individual asset requests
                  if (i < batches.length - 1) {
                      await new Promise(resolve => setTimeout(resolve, 2000));
                  }
              }
          }
          
          setLastSync(now);

          // Unified Error Reporting
          if (failedTickers.length > 0) {
              const msg = brapiFailed 
                ? `Falha parcial. Fundamentos não atualizados para: ${failedTickers.join(', ')}`
                : `Dados fundamentais falharam para: ${failedTickers.join(', ')}`;
              setMarketDataError(msg);
          } else if (brapiFailed) {
              setMarketDataError("Falha na atualização de preços (Brapi).");
          }

      } catch (e: any) {
          console.error("Critical refresh error:", e);
          setMarketDataError(e.message || "Erro crítico na atualização.");
      } finally {
          refreshInProgress.current = false;
          setIsRefreshing(false);
      }
  }, [sourceTransactions, preferences, setMarketData, setLastSync, logApiUsage]);

  useEffect(() => {
      const checkAndRefresh = () => {
          if (document.hidden) return;
          const now = new Date();
          // Auto-refresh during market hours on weekdays
          if (now.getDay() >= 1 && now.getDay() <= 5 && now.getHours() >= 10 && now.getHours() < 18) {
              refreshMarketData(false, true);
          }
      };
      const intervalId = setInterval(checkAndRefresh, 10 * 60 * 1000);
      return () => clearInterval(intervalId);
  }, [refreshMarketData]);

  const refreshAllData = useCallback(async () => {
      await refreshMarketData(true, false); 
  }, [refreshMarketData]);

  // Initial Load Strategy: Be Aggressive if data is missing or empty
  useEffect(() => {
    if (!refreshInProgress.current && !isDemoMode && sourceTransactions.length > 0 && !initialLoadDone.current) {
      initialLoadDone.current = true;
      
      const missingData = sourceTransactions.some(t => {
          const data = marketDataRef.current[t.ticker.toUpperCase()];
          return !data || !data.currentPrice || !data.dividendsHistory;
      });

      if (missingData) {
          console.log("Initial Load: Missing data detected, forcing refresh.");
          refreshMarketData(true, true); 
      }
    }
  }, [sourceTransactions.length, isDemoMode, refreshMarketData]);

  const getAssetByTicker = useCallback((ticker: string) => {
      return assets.find(a => a.ticker === ticker);
  }, [assets]);

  const getAveragePriceForTransaction = useCallback((targetTx: Transaction) => {
      if (targetTx.type !== 'Venda') return 0;
      const tickerTxs = sourceTransactions
          .filter(t => t.ticker === targetTx.ticker && t.date <= targetTx.date && t.id !== targetTx.id)
          .sort((a, b) => a.date.localeCompare(b.date));

      let totalQty = 0;
      let totalCost = 0;

      for (const tx of tickerTxs) {
          if (tx.type === 'Compra') {
              const cost = (tx.quantity * tx.price) + (tx.costs || 0);
              totalCost += cost;
              totalQty += tx.quantity;
          } else if (tx.type === 'Venda') {
              const sellQty = Math.min(tx.quantity, totalQty);
              if (totalQty > 0) {
                  const avgPrice = totalCost / totalQty;
                  totalCost -= sellQty * avgPrice;
                  totalQty -= sellQty;
              }
          }
      }
      return totalQty > 0 ? totalCost / totalQty : 0;
  }, [sourceTransactions]);

  const value: PortfolioContextType = {
      assets, transactions: sourceTransactions, preferences, isDemoMode,
      yieldOnCost, projectedAnnualIncome, portfolioEvolution, monthlyIncome, payersData, totalReceived, lastSync, isRefreshing, marketDataError, userProfile, apiStats, notifications, unreadNotificationsCount, deferredPrompt,
      addTransaction, updateTransaction, deleteTransaction, importTransactions, restoreData,
      updatePreferences, setTheme, setFont, updateUserProfile,
      refreshMarketData, refreshAllData, refreshSingleAsset, getAssetByTicker, getAveragePriceForTransaction,
      setDemoMode: setIsDemoMode, resetApp, clearCache, logApiUsage, resetApiStats, privacyMode, togglePrivacyMode, markNotificationsAsRead,
      deleteNotification, clearAllNotifications, installPwa,
  };

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
};

export const usePortfolio = () => {
    const ctx = useContext(PortfolioContext);
    if(!ctx) throw new Error("usePortfolio must be used within a PortfolioProvider");
    return ctx;
};
