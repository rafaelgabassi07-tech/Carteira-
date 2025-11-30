
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Asset, Transaction, AppPreferences, MonthlyIncome, UserProfile, Dividend, DividendHistoryEvent, AppStats, SegmentEvolutionData, PortfolioEvolutionPoint, AppNotification } from '../types';
import { fetchAdvancedAssetData } from '../services/geminiService';
import { fetchBrapiQuotes } from '../services/brapiService';
import { generateNotifications } from '../services/dynamicDataService';
import { usePersistentState, calculatePortfolioMetrics, applyThemeToDocument, fromISODate, CacheManager, getTodayISODate, toISODate } from '../utils';
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
  notifications: AppNotification[];
  unreadNotificationsCount: number;
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
  markNotificationsAsRead: () => void;
  deleteNotification: (id: number) => void;
  clearAllNotifications: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

// Defaults
const DEFAULT_PREFERENCES: AppPreferences = {
    accentColor: 'blue', systemTheme: 'system', visualStyle: 'premium', fontSize: 'medium', compactMode: false,
    currentThemeId: 'default-dark', currentFontId: 'inter', showCurrencySymbol: true, reduceMotion: false, animationSpeed: 'normal',
    startScreen: 'dashboard', hapticFeedback: true, vibrationIntensity: 'medium', hideCents: false, privacyOnStart: false, appPin: null,
    defaultBrokerage: 0, csvSeparator: ',', decimalPrecision: 2, defaultSort: 'valueDesc', dateFormat: 'dd/mm/yyyy',
    priceAlertThreshold: 5, globalIncomeGoal: 1000, segmentGoals: {}, dndEnabled: false, dndStart: '22:00', dndEnd: '07:00',
    notificationChannels: { push: true, email: false }, geminiApiKey: null, brapiToken: null, autoBackup: false, betaFeatures: false, devMode: false
};

const SNAPSHOT_PREFIX = 'snapshot_';

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
  const [notifications, setNotifications] = usePersistentState<AppNotification[]>('app-notifications', []);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // --- One-time Preference Migration ---
  useEffect(() => {
    const startScreen = preferences.startScreen;
    if (startScreen === 'carteira' as any || startScreen === 'analise' as any) {
      // @ts-ignore
      const newScreen = startScreen === 'carteira' ? 'dashboard' : 'carteira';
      updatePreferences({ startScreen: newScreen });
      console.log(`Migrated startScreen from '${startScreen}' to '${newScreen}'`);
    }
  }, []); // Runs only once

  useEffect(() => {
      setUnreadNotificationsCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

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

  // Market Data Refresh for a single asset
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
  
  // Basic Actions
  const addTransaction = useCallback((t: Transaction) => {
    const existingTickers = new Set(sourceTransactions.map(tx => tx.ticker.toUpperCase()));
    const isNewAsset = !existingTickers.has(t.ticker.toUpperCase());
    
    setTransactions(p => [...p, t]);

    if (isNewAsset) {
      console.log(`New asset detected: ${t.ticker}. Fetching market data...`);
      refreshSingleAsset(t.ticker, true);
    }
  }, [setTransactions, sourceTransactions, refreshSingleAsset]);

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
                  const res = geminiRes.value as { data: any; stats: { bytesSent: number; bytesReceived: number } };
                  logApiUsage('gemini', { requests: 1, ...res.stats as any });
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

  // --- Auto Refresh Logic (Market Hours) ---
  useEffect(() => {
      const checkAndRefresh = () => {
          const now = new Date();
          const day = now.getDay(); // 0 = Sun, 6 = Sat
          const hour = now.getHours();
          
          const isWeekDay = day >= 1 && day <= 5;
          const isMarketHours = hour >= 10 && hour < 18;
          
          const isVisible = document.visibilityState === 'visible';
          const isOnline = navigator.onLine;

          if (isWeekDay && isMarketHours && isVisible && isOnline) {
              refreshMarketData(true, true);
          }
      };
      const intervalId = setInterval(checkAndRefresh, 10 * 60 * 1000);
      return () => clearInterval(intervalId);
  }, [refreshMarketData]);

  const refreshAllData = useCallback(async () => {
      await refreshMarketData(true);
  }, [refreshMarketData]);

  const assets = useMemo(() => {
      const metrics = calculatePortfolioMetrics(sourceTransactions);
      return Object.keys(metrics).map(ticker => {
          const m = metrics[ticker];
          const data = (sourceMarketData as any)[ticker.toUpperCase()] || {};
          const avgPrice = m.quantity > 0 ? m.totalCost / m.quantity : 0;
          const curPrice = data.currentPrice || avgPrice;
          
          const histMap = new Map<string, DividendHistoryEvent>();
          (data.dividendsHistory || []).forEach((d: DividendHistoryEvent) => histMap.set(d.exDate, d));
          (data.recentDividends || []).forEach((d: DividendHistoryEvent) => histMap.set(d.exDate, d)); // Gemini overrides
          
          return {
              ticker, quantity: m.quantity, avgPrice, currentPrice: curPrice,
              priceHistory: data.priceHistory || [],
              dividendsHistory: Array.from(histMap.values()).sort((a,b) => b.exDate.localeCompare(a.exDate)),
              dy: data.dy, pvp: data.pvp, segment: data.assetType || data.sector || 'Outros',
              administrator: data.administrator, vacancyRate: data.vacancyRate, liquidity: data.dailyLiquidity,
              shareholders: data.shareholders, yieldOnCost: avgPrice > 0 ? ((curPrice * ((data.dy||0)/100))/avgPrice)*100 : 0,
              nextPaymentDate: data.nextPaymentDate, lastDividend: data.lastDividend
          };
      }).filter(a => a.quantity > 0.000001);
  }, [sourceTransactions, sourceMarketData]);

  // --- Daily Snapshot & Notification Generation ---
  const currentPatrimony = useMemo(() => {
    return assets.reduce((acc, a) => acc + a.quantity * a.currentPrice, 0);
  }, [assets]);

  useEffect(() => {
    if (currentPatrimony > 0 && !isDemoMode) {
      const todayStr = getTodayISODate();
      const key = `${SNAPSHOT_PREFIX}${todayStr}`;
      localStorage.setItem(key, JSON.stringify({ value: currentPatrimony, ts: Date.now() }));
      
      const newNotifications = generateNotifications(assets, currentPatrimony);
      if (newNotifications.length > 0) {
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const trulyNew = newNotifications.filter(n => !existingIds.has(n.id));
          if (trulyNew.length > 0) {
            setUnreadNotificationsCount(prevCount => prevCount + trulyNew.length);
            
            // --- TRIGGER SYSTEM NOTIFICATION ---
            if (Notification.permission === 'granted' && navigator.serviceWorker) {
                navigator.serviceWorker.ready.then(registration => {
                    trulyNew.forEach(n => {
                        registration.showNotification(n.title, {
                            body: n.description,
                            icon: '/logo.svg',
                            badge: '/logo.svg',
                            tag: n.relatedTicker || 'general',
                            data: { url: '/' }
                        });
                    });
                });
            }
            // ------------------------------------

            return [...trulyNew, ...prev];
          }
          return prev;
        });
      }
    }
  }, [currentPatrimony, isDemoMode, assets, setNotifications]);

  const getAssetByTicker = useCallback((ticker: string) => {
      return assets.find(a => a.ticker === ticker);
  }, [assets]);

  const dividends = useMemo(() => {
      return isDemoMode ? DEMO_DIVIDENDS : [];
  }, [isDemoMode]);

  const yieldOnCost = useMemo(() => {
      const totalInvested = assets.reduce((acc, a) => acc + (a.quantity * a.avgPrice), 0);
      if (totalInvested === 0) return 0;
      const totalProjectedIncome = assets.reduce((acc, a) => acc + (a.quantity * a.currentPrice * ((a.dy || 0) / 100)), 0);
      return (totalProjectedIncome / totalInvested) * 100;
  }, [assets]);

  const projectedAnnualIncome = useMemo(() => {
      return assets.reduce((acc, a) => acc + (a.quantity * a.currentPrice * ((a.dy || 0) / 100)), 0);
  }, [assets]);

  const monthlyIncome = useMemo(() => {
      const incomeMap: Record<string, number> = {};
      dividends.forEach(div => {
          const date = new Date(div.paymentDate);
          const monthYear = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
          const total = div.amountPerShare * div.quantity;
          incomeMap[monthYear] = (incomeMap[monthYear] || 0) + total;
      });
      return Object.entries(incomeMap).map(([month, total]) => ({ month, total }));
  }, [dividends]);

  const [portfolioEvolution] = useState<SegmentEvolutionData>({});

  const getAveragePriceForTransaction = useCallback(() => 0, []);

  // OTIMIZAÇÃO: Memoize o objeto value para prevenir re-renders desnecessários
  const value = useMemo(() => ({
      assets, transactions: sourceTransactions, dividends, preferences, isDemoMode, privacyMode,
      yieldOnCost, projectedAnnualIncome, monthlyIncome, lastSync, isRefreshing, marketDataError, userProfile, apiStats, portfolioEvolution,
      notifications, unreadNotificationsCount,
      addTransaction, updateTransaction, deleteTransaction, importTransactions, restoreData,
      updatePreferences, setTheme, setFont, updateUserProfile,
      refreshMarketData, refreshAllData, refreshSingleAsset, getAssetByTicker, getAveragePriceForTransaction,
      setDemoMode: setIsDemoMode, setPrivacyMode, togglePrivacyMode, resetApp, clearCache, logApiUsage, resetApiStats, markNotificationsAsRead,
      deleteNotification, clearAllNotifications
  }), [
      assets, sourceTransactions, dividends, preferences, isDemoMode, privacyMode,
      yieldOnCost, projectedAnnualIncome, monthlyIncome, lastSync, isRefreshing, marketDataError, userProfile, apiStats, portfolioEvolution,
      notifications, unreadNotificationsCount,
      addTransaction, updateTransaction, deleteTransaction, importTransactions, restoreData,
      updatePreferences, setTheme, setFont, updateUserProfile,
      refreshMarketData, refreshAllData, refreshSingleAsset, getAssetByTicker, getAveragePriceForTransaction,
      setIsDemoMode, setPrivacyMode, togglePrivacyMode, resetApp, clearCache, logApiUsage, resetApiStats, markNotificationsAsRead,
      deleteNotification, clearAllNotifications
  ]);

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
};

export const usePortfolio = () => {
    const ctx = useContext(PortfolioContext);
    if(!ctx) throw new Error("usePortfolio missing");
    return ctx;
};
