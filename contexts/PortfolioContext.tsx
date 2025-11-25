
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Asset, Transaction, AppPreferences, MonthlyIncome, UserProfile, Dividend, SegmentEvolutionData, PortfolioEvolutionPoint, DividendHistoryEvent, AppStats } from '../types';
import { fetchAdvancedAssetData, fetchHistoricalPrices } from '../services/geminiService';
import { fetchBrapiQuotes } from '../services/brapiService';
import { usePersistentState, CacheManager, fromISODate, calculatePortfolioMetrics, getClosestPrice, applyThemeToDocument } from '../utils';
import { DEMO_TRANSACTIONS, DEMO_DIVIDENDS, DEMO_MARKET_DATA, CACHE_TTL, MOCK_USER_PROFILE, APP_THEMES, APP_FONTS } from '../constants';

// --- Types ---
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
  portfolioEvolution: SegmentEvolutionData;
  lastSync: number | null;
  isRefreshing: boolean;
  marketDataError: string | null;
  userProfile: UserProfile;
  apiStats: AppStats;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  importTransactions: (transactions: Transaction[]) => void;
  restoreData: (data: { transactions: Transaction[], preferences?: Partial<AppPreferences> }) => void;
  updatePreferences: (prefs: Partial<AppPreferences>) => void;
  setTheme: (themeId: string) => void;
  setFont: (fontId: string) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  refreshMarketData: (force?: boolean, silent?: boolean) => Promise<void>;
  refreshAllData: () => Promise<void>;
  refreshSingleAsset: (ticker: string) => Promise<void>;
  getAssetByTicker: (ticker: string) => Asset | undefined;
  getAveragePriceForTransaction: (transaction: Transaction) => number;
  setDemoMode: (enabled: boolean) => void;
  setPrivacyMode: React.Dispatch<React.SetStateAction<boolean>>;
  togglePrivacyMode: () => void;
  resetApp: () => void;
  clearCache: (key?: string) => void;
  logApiUsage: (api: 'gemini' | 'brapi', stats: { requests: number; bytesSent?: number; bytesReceived?: number }) => void;
  resetApiStats: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

// --- Constants ---
const DEFAULT_PREFERENCES: AppPreferences = {
    accentColor: 'blue', systemTheme: 'system', visualStyle: 'premium', fontSize: 'medium', compactMode: false,
    currentThemeId: 'default-dark',
    currentFontId: 'inter',
    showCurrencySymbol: true, reduceMotion: false, animationSpeed: 'normal',
    startScreen: 'carteira', hapticFeedback: true, vibrationIntensity: 'medium',
    hideCents: false, privacyOnStart: false, appPin: null,
    defaultBrokerage: 0, csvSeparator: ',', decimalPrecision: 2, defaultSort: 'valueDesc',
    dateFormat: 'dd/mm/yyyy', priceAlertThreshold: 5, globalIncomeGoal: 1000,
    segmentGoals: {}, dndEnabled: false, dndStart: '22:00', dndEnd: '07:00',
    notificationChannels: { push: true, email: false }, 
    geminiApiKey: null,
    brapiToken: null,
    autoBackup: false, betaFeatures: false, devMode: false
};
const DEFAULT_API_STATS: AppStats = {
    gemini: { requests: 0, bytesSent: 0, bytesReceived: 0 },
    brapi: { requests: 0, bytesSent: 0, bytesReceived: 0 }
};
const EPSILON = 0.000001; // For floating point comparisons

// --- Provider ---
export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = usePersistentState<Transaction[]>('transactions', []);
  const [preferences, setPreferences] = usePersistentState<AppPreferences>('app_preferences', DEFAULT_PREFERENCES);
  const [userProfile, setUserProfile] = usePersistentState<UserProfile>('user_profile', MOCK_USER_PROFILE);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [privacyMode, setPrivacyMode] = usePersistentState('privacy_mode', false);
  const [marketData, setMarketData] = usePersistentState<Record<string, any>>('market_data', {});
  const [lastSync, setLastSync] = usePersistentState<number | null>('last_sync', null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [marketDataError, setMarketDataError] = useState<string | null>(null);
  const [portfolioEvolution, setPortfolioEvolution] = useState<SegmentEvolutionData>({ all_types: [] });
  const [historicalPriceCache, setHistoricalPriceCache] = usePersistentState<Record<string, number>>('historical_price_cache', {});
  const [apiStats, setApiStats] = usePersistentState<AppStats>('api_stats', DEFAULT_API_STATS);

  const sourceTransactions = useMemo(() => isDemoMode ? DEMO_TRANSACTIONS : transactions, [isDemoMode, transactions]);
  const sourceMarketData = useMemo(() => isDemoMode ? DEMO_MARKET_DATA : marketData, [isDemoMode, marketData]);

  // --- API Stats Management ---
  const logApiUsage = useCallback((api: 'gemini' | 'brapi', stats: { requests: number; bytesSent?: number; bytesReceived?: number }) => {
      setApiStats(prev => {
          const newStats = { ...prev };
          newStats[api] = {
              requests: newStats[api].requests + stats.requests,
              bytesSent: newStats[api].bytesSent + (stats.bytesSent || 0),
              bytesReceived: newStats[api].bytesReceived + (stats.bytesReceived || 0),
          };
          return newStats;
      });
  }, [setApiStats]);
  
  const resetApiStats = useCallback(() => setApiStats(DEFAULT_API_STATS), [setApiStats]);

  // --- Theme & Font Management ---
  useEffect(() => {
      const themeId = preferences.currentThemeId || 'default-dark';
      const theme = APP_THEMES.find(t => t.id === themeId) || APP_THEMES[0];
      applyThemeToDocument(theme);
  }, [preferences.currentThemeId]);

  useEffect(() => {
      const fontId = preferences.currentFontId || 'inter';
      const font = APP_FONTS.find(f => f.id === fontId) || APP_FONTS[0];
      document.documentElement.style.setProperty('--font-family', font.family);
  }, [preferences.currentFontId]);

  const setTheme = useCallback((themeId: string) => {
      setPreferences(prev => ({ ...prev, currentThemeId: themeId }));
  }, [setPreferences]);

  const setFont = useCallback((fontId: string) => {
      setPreferences(prev => ({ ...prev, currentFontId: fontId }));
  }, [setPreferences]);


  // --- Actions ---
  const addTransaction = useCallback((transaction: Transaction) => setTransactions(prev => [...prev, transaction]), [setTransactions]);
  const updateTransaction = useCallback((transaction: Transaction) => setTransactions(prev => prev.map(t => t.id === transaction.id ? transaction : t)), [setTransactions]);
  const deleteTransaction = useCallback((id: string) => setTransactions(prev => prev.filter(t => t.id !== id)), [setTransactions]);
  
  const importTransactions = useCallback((newTransactions: Transaction[]) => {
      setTransactions(prev => {
          const txIds = new Set(prev.map(t => t.id));
          const toAdd = newTransactions.filter(t => !txIds.has(t.id));
          return [...prev, ...toAdd];
      });
  }, [setTransactions]);

   const restoreData = useCallback((data: { transactions: Transaction[], preferences?: Partial<AppPreferences> }) => {
    setTransactions(data.transactions);
    if (data.preferences) {
      setPreferences(currentPrefs => ({ ...currentPrefs, ...data.preferences }));
    }
  }, [setTransactions, setPreferences]);

  const updatePreferences = useCallback((newPrefs: Partial<AppPreferences>) => setPreferences(prev => ({ ...prev, ...newPrefs })), [setPreferences]);
  const updateUserProfile = useCallback((newProfile: Partial<UserProfile>) => setUserProfile(prev => ({ ...prev, ...newProfile })), [setUserProfile]);
  const togglePrivacyMode = useCallback(() => setPrivacyMode(prev => !prev), [setPrivacyMode]);
  
  const resetApp = useCallback(() => { 
      if(window.confirm("Tem certeza que deseja sair? Todos os seus dados locais serão apagados permanentemente.")) {
        localStorage.clear(); 
        window.location.reload(); 
      }
  }, []);

  const clearCache = useCallback((key?: string) => {
    if (key === 'all') {
      Object.keys(localStorage).forEach(k => { if(k.startsWith('cache_')) localStorage.removeItem(k); });
      setMarketData({}); setLastSync(null); setHistoricalPriceCache({});
    } else if (key) {
      CacheManager.clear(key);
      if (key === 'asset_prices') { setMarketData({}); setLastSync(null); setHistoricalPriceCache({});}
    }
  }, [setMarketData, setLastSync, setHistoricalPriceCache]);

  const refreshMarketData = useCallback(async (force = false, silent = false) => {
    if (isRefreshing) return;
    if (!force && lastSync && Date.now() - lastSync < CACHE_TTL.PRICES) return;

    const uniqueTickers = Array.from(new Set(sourceTransactions.map((t: Transaction) => t.ticker))) as string[];
    if (uniqueTickers.length === 0) { setMarketData({}); setLastSync(Date.now()); return; }

    if (!silent) setIsRefreshing(true);
    setMarketDataError(null);
    
    let hasError = false;
    
    try {
        const [brapiResult, geminiResult] = await Promise.allSettled([
            fetchBrapiQuotes(preferences, uniqueTickers),
            fetchAdvancedAssetData(preferences, uniqueTickers)
        ]);

        setMarketData(prev => {
            const updated = { ...prev };
            
            if (brapiResult.status === 'fulfilled') {
                logApiUsage('brapi', { requests: uniqueTickers.length, bytesReceived: brapiResult.value.stats.bytesReceived });
                Object.keys(brapiResult.value.quotes).forEach(ticker => {
                    updated[ticker] = { ...(updated[ticker] || {}), ...brapiResult.value.quotes[ticker] };
                });
            } else {
                console.error("Brapi Error:", brapiResult.reason);
                hasError = true;
                setMarketDataError((brapiResult.reason as Error)?.message || "Erro ao buscar cotações.");
            }

            if (geminiResult.status === 'fulfilled') {
                 logApiUsage('gemini', { requests: 1, ...geminiResult.value.stats });
                 Object.keys(geminiResult.value.data).forEach(ticker => {
                    updated[ticker] = { ...(updated[ticker] || {}), ...geminiResult.value.data[ticker] };
                });
            } else {
                console.error("Gemini Error:", geminiResult.reason);
            }

            return updated;
        });

        if (!hasError) setLastSync(Date.now());

    } catch (error: any) {
        console.error("Market data refresh critical failure:", error);
        setMarketDataError(error.message);
    } finally {
        if (!silent) setIsRefreshing(false);
    }
  }, [isRefreshing, lastSync, sourceTransactions, preferences, setMarketData, setLastSync, logApiUsage]);

  const refreshAllData = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setMarketDataError(null);

    Object.keys(localStorage).forEach(k => {
        if (k.startsWith('cache_')) {
            localStorage.removeItem(k);
        }
    });

    setLastSync(null);
    setHistoricalPriceCache({});

    try {
        await refreshMarketData(true, true);
    } catch (error: any) {
        console.error("Global refresh failed:", error);
        setMarketDataError(error.message);
    } finally {
        setIsRefreshing(false);
    }
  }, [isRefreshing, refreshMarketData, setLastSync, setHistoricalPriceCache]);

  const refreshSingleAsset = useCallback(async (ticker: string) => {
    if (!ticker) return;
    try {
        const { quotes, stats: brapiStats } = await fetchBrapiQuotes(preferences, [ticker]);
        logApiUsage('brapi', { requests: 1, bytesReceived: brapiStats.bytesReceived });

        const { data: advancedData, stats: geminiStats } = await fetchAdvancedAssetData(preferences, [ticker]);
        logApiUsage('gemini', { requests: 1, ...geminiStats });

        setMarketData(prev => {
            const updated = { ...prev };
            updated[ticker] = { 
                ...(prev[ticker] || {}), 
                ...quotes[ticker], 
                ...advancedData[ticker] 
            };
            return updated;
        });
    } catch(error: any) {
        setMarketDataError(error.message);
        throw error;
    }
  }, [preferences, setMarketData, logApiUsage]);

  const assets = useMemo((): Asset[] => {
    const portfolioMetrics = calculatePortfolioMetrics(sourceTransactions);
    return Object.keys(portfolioMetrics).map((ticker: string) => {
      const metric = portfolioMetrics[ticker];
      const liveData = (sourceMarketData as Record<string, any>)[ticker.toUpperCase()] || {};
      const avgPrice = metric.quantity > 0 ? metric.totalCost / metric.quantity : 0;
      const currentPrice = liveData.currentPrice || avgPrice;
      const totalInvested = metric.quantity * avgPrice;
      const yieldOnCost = totalInvested > 0 && liveData.dy > 0 ? ((currentPrice * (liveData.dy / 100)) / avgPrice) * 100 : 0;
      
      // Merge and de-duplicate dividend histories, giving Gemini's recent data precedence
      const brapiHistory = liveData.dividendsHistory || [];
      const geminiHistory = liveData.recentDividends || [];
      const historyMap = new Map<string, DividendHistoryEvent>();

      brapiHistory.forEach((event: DividendHistoryEvent) => {
        if (event.exDate) historyMap.set(event.exDate, event);
      });
      geminiHistory.forEach((event: DividendHistoryEvent) => {
        if (event.exDate) historyMap.set(event.exDate, event);
      });
      const combinedHistory = Array.from(historyMap.values()).sort((a, b) => b.exDate.localeCompare(a.exDate));

      return {
        ticker,
        quantity: metric.quantity,
        avgPrice,
        currentPrice,
        priceHistory: liveData.priceHistory || [],
        dividendsHistory: combinedHistory,
        dy: liveData.dy,
        pvp: liveData.pvp,
        // Prioritize Gemini's 'assetType' over 'sector'
        segment: liveData.assetType || liveData.sector || 'Outros',
        administrator: liveData.administrator,
        vacancyRate: liveData.vacancyRate,
        liquidity: liveData.dailyLiquidity,
        shareholders: liveData.shareholders,
        yieldOnCost,
        nextPaymentDate: liveData.nextPaymentDate,
        lastDividend: liveData.lastDividend,
      };
    }).filter(asset => asset.quantity > EPSILON);
  }, [sourceTransactions, sourceMarketData]);

  const getAssetByTicker = useCallback((ticker: string): Asset | undefined => {
    return assets.find(a => a.ticker.toUpperCase() === ticker.toUpperCase());
  }, [assets]);
  
  const getAveragePriceForTransaction = useCallback((transaction: Transaction): number => {
    const transactionsBefore = sourceTransactions
        .filter(t => t.ticker === transaction.ticker && new Date(t.date) <= new Date(transaction.date))
        .sort((a, b) => a.date.localeCompare(b.date));
    
    const txIndex = transactionsBefore.findIndex(t => t.id === transaction.id);
    const relevantTransactions = txIndex !== -1 ? transactionsBefore.slice(0, txIndex) : transactionsBefore;

    const metrics = calculatePortfolioMetrics(relevantTransactions);
    const assetMetrics = metrics[transaction.ticker];

    if (assetMetrics && assetMetrics.quantity > EPSILON) {
        return assetMetrics.totalCost / assetMetrics.quantity;
    }
    return 0;
  }, [sourceTransactions]);

  const { yieldOnCost, projectedAnnualIncome } = useMemo(() => {
    const totalInvested = assets.reduce((acc, asset) => acc + (asset.quantity * asset.avgPrice), 0);
    const projectedIncome = assets.reduce((acc, asset) => {
        const annualDividendPerShare = asset.currentPrice * ((asset.dy || 0) / 100);
        return acc + (annualDividendPerShare * asset.quantity);
    }, 0);
    const yoc = totalInvested > 0 ? (projectedIncome / totalInvested) * 100 : 0;
    return { yieldOnCost: yoc, projectedAnnualIncome: projectedIncome };
  }, [assets]);
  
  const dividends = useMemo((): Dividend[] => {
    const realDividends: Dividend[] = [];
    const sortedTransactions = [...sourceTransactions].sort((a, b) => a.date.localeCompare(b.date));
    
    const getQuantityOnDate = (ticker: string, targetDate: string) => {
        let quantity = 0;
        for (const tx of sortedTransactions) {
            if (tx.ticker === ticker && tx.date <= targetDate) {
                if (tx.type === 'Compra') quantity += tx.quantity;
                else quantity -= tx.quantity;
            } else if (tx.date > targetDate) {
                break;
            }
        }
        return quantity > EPSILON ? quantity : 0;
    };

    let hasHistoricalData = false;
    assets.forEach(asset => {
        if (asset.dividendsHistory && asset.dividendsHistory.length > 0) {
            hasHistoricalData = true;
            asset.dividendsHistory.forEach((divEvent: DividendHistoryEvent) => {
                const quantityOnExDate = getQuantityOnDate(asset.ticker, divEvent.exDate);
                if (quantityOnExDate > 0) {
                    realDividends.push({
                        ticker: asset.ticker,
                        amountPerShare: divEvent.value,
                        quantity: quantityOnExDate,
                        paymentDate: divEvent.paymentDate,
                    });
                }
            });
        }
    });

    if (!hasHistoricalData && !isDemoMode) {
      const today = new Date();
      for (let i = 11; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const dateStr = date.toISOString().split('T')[0];
        
        assets.forEach(asset => {
          if ((asset.dy || 0) > 0) {
            const quantityOnDate = getQuantityOnDate(asset.ticker, dateStr);
            if (quantityOnDate > 0) {
              const monthlyDividend = (asset.currentPrice * (asset.dy! / 100)) / 12;
              const paymentDate = new Date(date.getFullYear(), date.getMonth() + 1, 15);
              realDividends.push({
                ticker: asset.ticker,
                amountPerShare: monthlyDividend,
                quantity: quantityOnDate,
                paymentDate: paymentDate.toISOString().split('T')[0],
              });
            }
          }
        });
      }
    }

    if (isDemoMode) return DEMO_DIVIDENDS;

    return realDividends;
}, [assets, sourceTransactions, isDemoMode]);


  const monthlyIncome = useMemo((): MonthlyIncome[] => {
      const incomeMap: Record<string, number> = {};
      const sortedDividends = dividends.sort((a,b) => a.paymentDate.localeCompare(b.paymentDate));

      sortedDividends.forEach(div => {
          const date = fromISODate(div.paymentDate);
          const monthKey = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('. de ', '/');
          incomeMap[monthKey] = (incomeMap[monthKey] || 0) + (div.amountPerShare * div.quantity);
      });
      
      const allMonths = Array.from(new Set(Object.keys(incomeMap)));
      if (allMonths.length > 0) {
        const dateSortedMonths = allMonths.sort((a, b) => {
            const [m1, y1] = a.split('/');
            const [m2, y2] = b.split('/');
            const dateA = new Date(`01/${m1}/20${y1}`);
            const dateB = new Date(`01/${m2}/20${y2}`);
            return dateA.getTime() - dateB.getTime();
        });
        return dateSortedMonths.slice(-12).map(month => ({ month, total: incomeMap[month] }));
      }
      return [];
  }, [dividends]);

  const evolutionResult = useMemo(() => {
    const evolution: SegmentEvolutionData = { all_types: [] };
    const missingPrices: { ticker: string, date: string }[] = [];

    if (sourceTransactions.length === 0) {
        return { evolution, missingPrices };
    }

    const sortedTransactions = [...sourceTransactions].sort((a, b) => a.date.localeCompare(b.date));
    const firstTxDate = fromISODate(sortedTransactions[0].date);
    const today = new Date();
    let currentDate = new Date(firstTxDate.getFullYear(), firstTxDate.getMonth(), 1);
    
    const portfolioState: Record<string, { quantity: number; totalCost: number }> = {};
    const lastKnownPrices: Record<string, number> = {};
    let txIndex = 0;

    while (currentDate <= today) {
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const endOfMonthISO = endOfMonth.toISOString().split('T')[0];

        while (txIndex < sortedTransactions.length && sortedTransactions[txIndex].date <= endOfMonthISO) {
            const tx = sortedTransactions[txIndex];
            if (!portfolioState[tx.ticker]) portfolioState[tx.ticker] = { quantity: 0, totalCost: 0 };
            
            if (tx.type === 'Compra') {
                portfolioState[tx.ticker].quantity += tx.quantity;
                portfolioState[tx.ticker].totalCost += (tx.quantity * tx.price) + (tx.costs || 0);
            } else {
                const sellQuantity = Math.min(tx.quantity, portfolioState[tx.ticker].quantity);
                if (portfolioState[tx.ticker].quantity > EPSILON) {
                    const avgPrice = portfolioState[tx.ticker].totalCost / portfolioState[tx.ticker].quantity;
                    portfolioState[tx.ticker].totalCost -= sellQuantity * avgPrice;
                    portfolioState[tx.ticker].quantity -= sellQuantity;
                }
            }
            if (portfolioState[tx.ticker].quantity < EPSILON) delete portfolioState[tx.ticker];
            txIndex++;
        }

        let monthInvestedTotal = 0;
        let monthMarketValueTotal = 0;

        Object.keys(portfolioState).forEach(ticker => {
            const holdings = portfolioState[ticker];
            const liveData = (sourceMarketData as Record<string, any>)[ticker.toUpperCase()] || {};
            const cacheKey = `${ticker}_${endOfMonthISO}`;
            
            let historicalPrice = getClosestPrice(liveData.priceHistory || [], endOfMonthISO);
            
            if (historicalPrice === null) {
                historicalPrice = historicalPriceCache[cacheKey] || null;
            }
            
            if (historicalPrice !== null) {
                lastKnownPrices[ticker] = historicalPrice;
            } else if (lastKnownPrices[ticker]) {
                historicalPrice = lastKnownPrices[ticker];
            } else {
                missingPrices.push({ ticker, date: endOfMonthISO });
                historicalPrice = (holdings.quantity > 0 ? holdings.totalCost / holdings.quantity : 0);
            }
            
            monthInvestedTotal += holdings.totalCost;
            monthMarketValueTotal += holdings.quantity * historicalPrice;
        });

        const monthLabel = currentDate.toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit', timeZone: 'UTC' });
        
        if (monthInvestedTotal > 0 || monthMarketValueTotal > 0) {
            evolution.all_types.push({ month: monthLabel, invested: monthInvestedTotal, marketValue: monthMarketValueTotal });
        }
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return { evolution, missingPrices };
  }, [sourceTransactions, sourceMarketData, historicalPriceCache]);
  
  useEffect(() => {
      setPortfolioEvolution(evolutionResult.evolution);
  }, [evolutionResult.evolution]);

  const queriesToFetchJSON = useMemo(() => {
      const uniqueQueries = [...new Map(evolutionResult.missingPrices.map((item: { ticker: string; date: string }) => [`${item.ticker}_${item.date}`, item])).values()];
      return JSON.stringify(uniqueQueries);
  }, [evolutionResult.missingPrices]);

  const isFetchingHistory = useRef(false);

  useEffect(() => {
      const queriesToFetch = JSON.parse(queriesToFetchJSON);
      
      if (queriesToFetch.length > 0 && !isFetchingHistory.current) {
          isFetchingHistory.current = true;
          
          const fetchBatched = async () => {
              const BATCH_SIZE = 3;
              for (let i = 0; i < queriesToFetch.length; i += BATCH_SIZE) {
                  const batch = queriesToFetch.slice(i, i + BATCH_SIZE);
                  try {
                      const { data: fetchedPrices, stats } = await fetchHistoricalPrices(preferences, batch);
                      logApiUsage('gemini', { requests: 1, ...stats });
                      if (Object.keys(fetchedPrices).length > 0) {
                          setHistoricalPriceCache(prev => ({ ...prev, ...fetchedPrices }));
                      }
                  } catch (e) {
                      console.warn("Failed to fetch historical prices via Gemini batch", e);
                  }
                  await new Promise(resolve => setTimeout(resolve, 1200));
              }
              isFetchingHistory.current = false;
          };

          const timer = setTimeout(fetchBatched, 1000);
          return () => {
              clearTimeout(timer);
              isFetchingHistory.current = false;
          };
      }
  }, [queriesToFetchJSON, preferences, setHistoricalPriceCache, logApiUsage]);


  const value = useMemo(() => ({
    assets,
    transactions: sourceTransactions,
    dividends,
    preferences,
    isDemoMode,
    privacyMode,
    yieldOnCost,
    projectedAnnualIncome,
    monthlyIncome,
    portfolioEvolution,
    lastSync,
    isRefreshing,
    marketDataError,
    userProfile,
    apiStats,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    importTransactions,
    restoreData,
    updatePreferences,
    setTheme,
    setFont,
    updateUserProfile,
    refreshMarketData,
    refreshAllData,
    refreshSingleAsset,
    getAssetByTicker,
    getAveragePriceForTransaction,
    setDemoMode: setIsDemoMode,
    setPrivacyMode,
    togglePrivacyMode,
    resetApp,
    clearCache,
    logApiUsage,
    resetApiStats,
  }), [
    assets, sourceTransactions, dividends, preferences, isDemoMode, privacyMode,
    yieldOnCost, projectedAnnualIncome, monthlyIncome, portfolioEvolution,
    lastSync, isRefreshing, marketDataError, userProfile, apiStats,
    addTransaction, updateTransaction, deleteTransaction, importTransactions, restoreData,
    updatePreferences, setTheme, setFont, updateUserProfile, refreshMarketData, refreshAllData, refreshSingleAsset,
    getAssetByTicker, getAveragePriceForTransaction, setIsDemoMode, setPrivacyMode,
    togglePrivacyMode, resetApp, clearCache, logApiUsage, resetApiStats
  ]);

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = (): PortfolioContextType => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
