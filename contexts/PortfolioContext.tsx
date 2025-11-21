import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Asset, Transaction, AppPreferences, MonthlyIncome, UserProfile, Dividend } from '../types';
import { fetchAdvancedAssetData } from '../services/geminiService';
import { fetchBrapiQuotes } from '../services/brapiService';
import { usePersistentState, CacheManager, fromISODate, calculatePortfolioMetrics } from '../utils';
import { DEMO_TRANSACTIONS, DEMO_DIVIDENDS, DEMO_MARKET_DATA, CACHE_TTL, MOCK_USER_PROFILE } from '../constants';

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
  lastSync: number | null;
  isRefreshing: boolean;
  marketDataError: string | null;
  userProfile: UserProfile;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  importTransactions: (transactions: Transaction[]) => void;
  updatePreferences: (prefs: Partial<AppPreferences>) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
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
    notificationChannels: { push: true, email: false }, 
    geminiApiKey: null,
    brapiToken: null,
    autoBackup: false, betaFeatures: false, devMode: false
};
const EPSILON = 0.000001; // For floating point comparisons

// --- Provider ---
export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = usePersistentState<Transaction[]>('transactions', []);
  const [dividends, setDividends] = usePersistentState<Dividend[]>('dividends', []);
  const [preferences, setPreferences] = usePersistentState<AppPreferences>('app_preferences', DEFAULT_PREFERENCES);
  const [userProfile, setUserProfile] = usePersistentState<UserProfile>('user_profile', MOCK_USER_PROFILE);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [privacyMode, setPrivacyMode] = usePersistentState('privacy_mode', false);
  const [marketData, setMarketData] = usePersistentState<Record<string, any>>('market_data', {});
  const [lastSync, setLastSync] = usePersistentState<number | null>('last_sync', null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [marketDataError, setMarketDataError] = useState<string | null>(null);

  const sourceTransactions = useMemo(() => isDemoMode ? DEMO_TRANSACTIONS : transactions, [isDemoMode, transactions]);
  const sourceDividends = useMemo(() => isDemoMode ? DEMO_DIVIDENDS : dividends, [isDemoMode, dividends]);

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
  const updateUserProfile = (newProfile: Partial<UserProfile>) => setUserProfile(prev => ({ ...prev, ...newProfile }));
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

    const uniqueTickers = Array.from(new Set(sourceTransactions.map((t: Transaction) => t.ticker))) as string[];
    if (uniqueTickers.length === 0) { setMarketData({}); setLastSync(Date.now()); return; }

    if (!silent) setIsRefreshing(true);
    setMarketDataError(null);
    try {
        const priceData = await fetchBrapiQuotes(preferences, uniqueTickers);
        setMarketData(prev => {
            const updated = { ...prev };
            Object.keys(priceData).forEach(ticker => {
                updated[ticker] = { ...(updated[ticker] || {}), ...priceData[ticker] };
            });
            return updated;
        });

        fetchAdvancedAssetData(preferences, uniqueTickers).then(advancedData => {
            setMarketData(prev => {
                const updated = { ...prev };
                Object.keys(advancedData).forEach(ticker => {
                    updated[ticker] = { ...(updated[ticker] || {}), ...advancedData[ticker] };
                });
                return updated;
            });
        }).catch(err => {
            console.warn("AI data enrichment failed:", err);
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
  }, [sourceTransactions, isRefreshing, lastSync, preferences]);
  
  const refreshSingleAsset = useCallback(async (ticker: string) => {
    if (!ticker) return;
    setMarketDataError(null);
    try {
        const priceData = await fetchBrapiQuotes(preferences, [ticker]);
        if (priceData && priceData[ticker]) {
            setMarketData(prev => ({ ...prev, [ticker]: { ...(prev[ticker] || {}), ...priceData[ticker] } }));
        }

        const advancedData = await fetchAdvancedAssetData(preferences, [ticker]);
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
  }, [setMarketData, setLastSync, preferences]);


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
            priceHistory: liveData.priceHistory || [],
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

  const { projectedAnnualIncome, yieldOnCost, monthlyIncome } = useMemo(() => {
    let income = 0, totalCost = 0;
    assets.forEach(asset => {
        if (asset.dy && asset.dy > 0) income += asset.quantity * asset.currentPrice * (asset.dy / 100);
        totalCost += asset.quantity * asset.avgPrice;
    });
    const yoc = totalCost > 0 ? (income / totalCost) * 100 : 0;

    const calculateProjectedHistoricalIncome = (): MonthlyIncome[] => {
        if (sourceTransactions.length === 0) return [];

        const sortedTxs = [...sourceTransactions].sort((a, b) => a.date.localeCompare(b.date));
        const firstTxDate = fromISODate(sortedTxs[0].date);
        const today = new Date();
        const startDate = new Date(firstTxDate.getFullYear(), firstTxDate.getMonth(), 1);
        
        const incomeByMonth: Record<string, number> = {};
        
        const assetDataMap: Record<string, { dy?: number; currentPrice?: number }> = {};
        assets.forEach(asset => {
            assetDataMap[asset.ticker] = { dy: asset.dy, currentPrice: asset.currentPrice };
        });

        let currentDate = new Date(startDate);
        while (currentDate <= today) {
            const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

            const txsUpToMonth = sortedTxs.filter(tx => fromISODate(tx.date) <= endOfMonth);
            const monthlyPortfolio = calculatePortfolioMetrics(txsUpToMonth);
            
            let monthlyIncomeTotal = 0;
            Object.keys(monthlyPortfolio).forEach(ticker => {
                const holding = monthlyPortfolio[ticker];
                const marketInfo = assetDataMap[ticker];
                if (holding && marketInfo?.dy && marketInfo?.currentPrice) {
                    const estimatedMonthlyDividend = holding.quantity * marketInfo.currentPrice * (marketInfo.dy / 100) / 12;
                    monthlyIncomeTotal += estimatedMonthlyDividend;
                }
            });

            incomeByMonth[monthKey] = monthlyIncomeTotal;
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        return Object.entries(incomeByMonth)
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            .map(([key, total]) => {
                const [year, month] = key.split('-');
                const date = new Date(Number(year), Number(month) - 1, 1);
                const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace(/\./g, '');
                return { month: monthName, total };
            });
    };

    const historicalMonthlyIncome = calculateProjectedHistoricalIncome();

    return { projectedAnnualIncome: income, yieldOnCost: yoc, monthlyIncome: historicalMonthlyIncome };
  }, [assets, sourceTransactions]);
  
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
    assets, transactions: sourceTransactions, dividends: sourceDividends, preferences, isDemoMode, privacyMode,
    yieldOnCost, projectedAnnualIncome, monthlyIncome, lastSync, isRefreshing, marketDataError,
    userProfile,
    addTransaction, updateTransaction, deleteTransaction, importTransactions,
    updatePreferences, refreshMarketData, refreshSingleAsset, getAveragePriceForTransaction, setDemoMode,
    togglePrivacyMode, resetApp, clearCache,
    updateUserProfile,
    getAssetByTicker: useCallback((ticker: string) => assets.find(a => a.ticker === ticker), [assets]),
  };

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
};

export const usePortfolio = (): PortfolioContextType => {
  const context = useContext(PortfolioContext);
  if (!context) throw new Error('usePortfolio must be used within a PortfolioProvider');
  return context;
};