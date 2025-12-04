
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Asset, Transaction, AppPreferences, UserProfile, Dividend, DividendHistoryEvent, AppStats, AppNotification, PortfolioEvolutionPoint, MonthlyIncome } from '../types';
import { fetchAdvancedAssetData } from '../services/geminiService';
import { fetchBrapiQuotes } from '../services/brapiService';
import { generateNotifications } from '../services/dynamicDataService';
import { usePersistentState, calculatePortfolioMetrics, applyThemeToDocument, CacheManager, toISODate, calculatePortfolioEvolution } from '../utils';
import { DEMO_TRANSACTIONS, DEMO_DIVIDENDS, DEMO_MARKET_DATA, CACHE_TTL, MOCK_USER_PROFILE, APP_THEMES, APP_FONTS, STALE_TIME, STATIC_FII_SECTORS } from '../constants';

interface PortfolioContextType {
  assets: Asset[];
  transactions: Transaction[];
  dividends: Dividend[];
  preferences: AppPreferences;
  isDemoMode: boolean;
  privacyMode: boolean;
  yieldOnCost: number;
  projectedAnnualIncome: number;
  portfolioEvolution: Record<string, PortfolioEvolutionPoint[]>;
  monthlyIncome: MonthlyIncome[];
  lastSync: number | null;
  isRefreshing: boolean;
  marketDataError: string | null;
  userProfile: UserProfile;
  apiStats: AppStats;
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  deferredPrompt: any; // PWA Install Prompt
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
  refreshMarketData: (force?: boolean, silent?: boolean, lite?: boolean) => Promise<void>;
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
  installPwa: () => void;
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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  const initialLoadDone = useRef(false);
  const refreshInProgress = useRef(false);
  const marketDataRef = useRef(marketData);
  useEffect(() => { marketDataRef.current = marketData; }, [marketData]);

  // PWA Install Event Listener
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

  useEffect(() => {
    const startScreen = preferences.startScreen;
    if (startScreen === 'carteira' as any || startScreen === 'analise' as any) {
      // @ts-ignore
      const newScreen = startScreen === 'carteira' ? 'dashboard' : 'carteira';
      updatePreferences({ startScreen: newScreen });
    }
  }, []); 

  useEffect(() => {
      setUnreadNotificationsCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

  const sourceTransactions = isDemoMode ? DEMO_TRANSACTIONS : transactions;
  const sourceMarketData = isDemoMode ? DEMO_MARKET_DATA : marketData;

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
          
          let advancedData = {};
          const isFundamentalsStale = !currentData || !currentData.lastFundamentalUpdate || (now - currentData.lastFundamentalUpdate > STALE_TIME.FUNDAMENTALS);
          const hasMissingDividends = !currentData?.dividendsHistory || currentData.dividendsHistory.length === 0;

          if (force || isFundamentalsStale || hasMissingDividends) {
             const adv = await fetchAdvancedAssetData(preferences, [ticker]);
             advancedData = adv.data;
          }
          
          setMarketData(prev => ({
              ...prev,
              [ticker.toUpperCase()]: {
                  ...(prev[ticker.toUpperCase()] || {}),
                  ...(quotes[ticker.toUpperCase()] || {}),
                  ...(advancedData[ticker.toUpperCase()] || {}),
                  lastUpdated: now,
                  lastFundamentalUpdate: Object.keys(advancedData).length > 0 ? now : (prev[ticker.toUpperCase()]?.lastFundamentalUpdate || 0)
              }
          }));
      } catch (e) { console.error(e); }
  }, [preferences, setMarketData]);
  
  const addTransaction = useCallback((t: Transaction) => {
    const existingTickers = new Set(sourceTransactions.map(tx => tx.ticker.toUpperCase()));
    const isNewAsset = !existingTickers.has(t.ticker.toUpperCase());
    
    setTransactions(p => [...p, t]);

    if (isNewAsset) {
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

  const refreshMarketData = useCallback(async (force = false, silent = false, lite = false) => {
      if(refreshInProgress.current) return;
      
      const now = Date.now();
      if(!force && lastSync && now - lastSync < STALE_TIME.MARKET_DATA) return; 

      const tickers = Array.from(new Set(sourceTransactions.map(t => t.ticker)));
      if(tickers.length === 0) return;

      refreshInProgress.current = true;
      if(!silent) setIsRefreshing(true);
      setMarketDataError(null);

      try {
          const promises: Promise<any>[] = [fetchBrapiQuotes(preferences, tickers, lite)];
          
          const firstAsset = marketDataRef.current[tickers[0].toUpperCase()];
          const fundamentalsStale = !firstAsset?.lastFundamentalUpdate || (now - firstAsset.lastFundamentalUpdate > STALE_TIME.FUNDAMENTALS);
          
          const anyMissingDividends = tickers.some(t => {
              const data = marketDataRef.current[t.toUpperCase()];
              return !data?.dividendsHistory || data.dividendsHistory.length === 0;
          });

          if (!lite && (force || fundamentalsStale || anyMissingDividends)) {
              console.log("CONTEXT: Fetching fresh fundamentals/dividends via Gemini...");
              promises.push(fetchAdvancedAssetData(preferences, tickers));
          } else {
              promises.push(Promise.resolve(null));
          }

          const results = await Promise.allSettled(promises);
          const brapiRes = results[0];
          const geminiRes = results[1];

          setMarketData(prev => {
              const next = { ...prev };
              let hasChanges = false;
              
              if(brapiRes.status === 'fulfilled') {
                  const res = brapiRes.value;
                  logApiUsage('brapi', { requests: tickers.length, bytesReceived: res.stats.bytesReceived });
                  Object.entries(res.quotes).forEach(([tkr, data]) => {
                      const prevData = next[tkr] || {};
                      const newData = data as any;
                      
                      next[tkr] = { 
                          ...prevData, 
                          ...newData,
                          priceHistory: newData.priceHistory?.length > 0 ? newData.priceHistory : prevData.priceHistory || [],
                          dividendsHistory: prevData.dividendsHistory || [], 
                          lastUpdated: now 
                      };
                      hasChanges = true;
                  });
              }

              if(geminiRes && geminiRes.status === 'fulfilled' && geminiRes.value) {
                  const res = geminiRes.value as { data: any; stats: { bytesSent: number; bytesReceived: number } };
                  logApiUsage('gemini', { requests: 1, ...res.stats as any });
                  Object.entries(res.data).forEach(([tkr, data]) => {
                      next[tkr] = { 
                          ...(next[tkr] || {}), 
                          ...(data as object),
                          lastFundamentalUpdate: now
                      };
                      hasChanges = true;
                  });
              }
              
              return hasChanges ? next : prev;
          });
          setLastSync(now);
      } catch(e: any) {
          setMarketDataError(e.message);
      } finally {
          refreshInProgress.current = false;
          if(!silent) setIsRefreshing(false);
      }
  }, [lastSync, sourceTransactions, preferences, setMarketData, setLastSync, logApiUsage]);

  useEffect(() => {
      const checkAndRefresh = () => {
          if (document.hidden) return;
          const now = new Date();
          const day = now.getDay();
          const hour = now.getHours();
          const isWeekDay = day >= 1 && day <= 5;
          const isMarketHours = hour >= 10 && hour < 18;
          const isOnline = navigator.onLine;

          if (isWeekDay && isMarketHours && isOnline) {
              refreshMarketData(true, true, true);
          }
      };
      const intervalId = setInterval(checkAndRefresh, 10 * 60 * 1000); // 10 minutes
      return () => clearInterval(intervalId);
  }, [refreshMarketData]);

  const refreshAllData = useCallback(async () => {
      await refreshMarketData(true, false, false); 
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
          
          let segment = data.assetType || data.sector;
          if (!segment || segment === 'Outros') {
              segment = STATIC_FII_SECTORS[ticker.toUpperCase()];
          }
          if (!segment) segment = 'Outros';

          return {
              ticker, quantity: m.quantity, avgPrice, currentPrice: curPrice,
              priceHistory: data.priceHistory || [],
              dividendsHistory: Array.from(histMap.values()).sort((a,b) => b.exDate.localeCompare(a.exDate)),
              dy: data.dy, pvp: data.pvp, segment: segment,
              administrator: data.administrator, vacancyRate: data.vacancyRate, liquidity: data.dailyLiquidity,
              shareholders: data.shareholders, yieldOnCost: avgPrice > 0 ? ((curPrice * ((data.dy||0)/100))/avgPrice)*100 : 0,
              nextPaymentDate: data.nextPaymentDate, lastDividend: data.lastDividend,
              lastUpdated: data.lastUpdated,
              lastFundamentalUpdate: data.lastFundamentalUpdate,
              netWorth: data.netWorth,
              vpPerShare: data.vpPerShare,
              businessDescription: data.businessDescription,
              riskAssessment: data.riskAssessment,
              strengths: data.strengths,
              dividendCAGR: data.dividendCAGR,
              capRate: data.capRate,
              managementFee: data.managementFee
          };
      });
  }, [sourceTransactions, sourceMarketData]);

  useEffect(() => {
    if (!refreshInProgress.current && !isDemoMode && sourceTransactions.length > 0 && !initialLoadDone.current) {
      initialLoadDone.current = true;
      const now = Date.now();
      const isStale = !lastSync || (now - lastSync > STALE_TIME.MARKET_DATA);
      if (isStale) {
          refreshMarketData(true, true, false); 
      }
    }
  }, [sourceTransactions.length, isDemoMode, refreshMarketData, lastSync]);

  const currentPatrimony = useMemo(() => {
    return assets.reduce((acc, a) => acc + a.quantity * a.currentPrice, 0);
  }, [assets]);

  useEffect(() => {
    if (isDemoMode) return;
    const timeoutId = setTimeout(() => {
        const newNotifications = generateNotifications(assets, currentPatrimony);
        if (newNotifications.length > 0) {
            setNotifications(prev => {
                const existingIds = new Set(prev.map(n => n.id));
                const trulyNew = newNotifications.filter(n => !existingIds.has(n.id));
                if (trulyNew.length > 0) {
                    setUnreadNotificationsCount(prevCount => prevCount + trulyNew.length);
                    return [...trulyNew, ...prev];
                }
                return prev;
            });
        }
    }, 1000);
    return () => clearTimeout(timeoutId);
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

  const portfolioEvolution = useMemo(() => {
      return calculatePortfolioEvolution(sourceTransactions, sourceMarketData);
  }, [sourceTransactions, sourceMarketData]);

  const monthlyIncome = useMemo(() => {
      const incomeMap: Record<string, number> = {};
      const transactionsByTicker: Record<string, Transaction[]> = {};
      sourceTransactions.forEach(tx => {
          if (!transactionsByTicker[tx.ticker]) transactionsByTicker[tx.ticker] = [];
          transactionsByTicker[tx.ticker].push(tx);
      });
      
      Object.values(transactionsByTicker).forEach(list => list.sort((a, b) => a.date.localeCompare(b.date)));

      assets.forEach(asset => {
          const hist = asset.dividendsHistory || [];
          if (hist.length === 0) return;
          
          const txs = transactionsByTicker[asset.ticker] || [];
          
          hist.forEach(div => {
              if (div.value <= 0) return;
              let qty = 0;
              for (const tx of txs) {
                  if (tx.date > div.exDate) break; 
                  if (tx.type === 'Compra') qty += tx.quantity;
                  else qty -= tx.quantity;
              }
              const userQty = Math.max(0, qty);
              if (userQty > 0) {
                  const payDate = div.paymentDate; 
                  const monthKey = payDate.substring(0, 7); 
                  incomeMap[monthKey] = (incomeMap[monthKey] || 0) + (userQty * div.value);
              }
          });
      });

      const sortedMonths = Object.keys(incomeMap).sort();
      const relevantMonths = sortedMonths.slice(-12);

      return relevantMonths.map(key => {
          const [year, month] = key.split('-').map(Number);
          const date = new Date(year, month - 1, 15); 
          const monthStr = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
          return {
              month: monthStr,
              total: incomeMap[key]
          };
      });
  }, [assets, sourceTransactions]);

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

  const value = useMemo(() => ({
      assets, transactions: sourceTransactions, dividends, preferences, isDemoMode, privacyMode,
      yieldOnCost, projectedAnnualIncome, portfolioEvolution, monthlyIncome, lastSync, isRefreshing, marketDataError, userProfile, apiStats, notifications, unreadNotificationsCount, deferredPrompt,
      addTransaction, updateTransaction, deleteTransaction, importTransactions, restoreData,
      updatePreferences, setTheme, setFont, updateUserProfile,
      refreshMarketData, refreshAllData, refreshSingleAsset, getAssetByTicker, getAveragePriceForTransaction,
      setDemoMode: setIsDemoMode, setPrivacyMode, togglePrivacyMode, resetApp, clearCache, logApiUsage, resetApiStats, markNotificationsAsRead,
      deleteNotification, clearAllNotifications, installPwa
  }), [
      assets, sourceTransactions, dividends, preferences, isDemoMode, privacyMode,
      yieldOnCost, projectedAnnualIncome, portfolioEvolution, monthlyIncome, lastSync, isRefreshing, marketDataError, userProfile, apiStats, notifications, unreadNotificationsCount, deferredPrompt,
      addTransaction, updateTransaction, deleteTransaction, importTransactions, restoreData,
      updatePreferences, setTheme, setFont, updateUserProfile,
      refreshMarketData, refreshAllData, refreshSingleAsset, getAssetByTicker, getAveragePriceForTransaction,
      setIsDemoMode, setPrivacyMode, togglePrivacyMode, resetApp, clearCache, logApiUsage, resetApiStats, markNotificationsAsRead,
      deleteNotification, clearAllNotifications, installPwa
  ]);

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
};

export const usePortfolio = () => {
    const ctx = useContext(PortfolioContext);
    if(!ctx) throw new Error("usePortfolio missing");
    return ctx;
};
