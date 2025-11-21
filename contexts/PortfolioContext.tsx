import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Asset, Transaction, AppPreferences, MonthlyIncome, UserProfile, Dividend, SegmentEvolutionData, PortfolioEvolutionPoint } from '../types';
import { fetchAdvancedAssetData } from '../services/geminiService';
import { fetchBrapiQuotes } from '../services/brapiService';
import { usePersistentState, CacheManager, fromISODate, calculatePortfolioMetrics, getClosestPrice } from '../utils';
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
  portfolioEvolution: SegmentEvolutionData;
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
  const [preferences, setPreferences] = usePersistentState<AppPreferences>('app_preferences', DEFAULT_PREFERENCES);
  const [userProfile, setUserProfile] = usePersistentState<UserProfile>('user_profile', MOCK_USER_PROFILE);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [privacyMode, setPrivacyMode] = usePersistentState('privacy_mode', false);
  const [marketData, setMarketData] = usePersistentState<Record<string, any>>('market_data', {});
  const [lastSync, setLastSync] = usePersistentState<number | null>('last_sync', null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [marketDataError, setMarketDataError] = useState<string | null>(null);

  const sourceTransactions = useMemo(() => isDemoMode ? DEMO_TRANSACTIONS : transactions, [isDemoMode, transactions]);
  const sourceMarketData = useMemo(() => isDemoMode ? DEMO_MARKET_DATA : marketData, [isDemoMode, marketData]);

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
  const resetApp = () => { 
      if(window.confirm("Tem certeza que deseja sair? Todos os seus dados locais serão apagados.")) {
        localStorage.clear(); 
        window.location.reload(); 
      }
  };
  const setDemoMode = (enabled: boolean) => setIsDemoMode(enabled);
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

        const advancedData = await fetchAdvancedAssetData(preferences, uniqueTickers);
        setMarketData(prev => {
            const updated = { ...prev };
            Object.keys(advancedData).forEach(ticker => {
                updated[ticker] = { ...(prev[ticker] || {}), ...advancedData[ticker] };
            });
            return updated;
        });

        setLastSync(Date.now());
    } catch (error: any) {
        console.error("Market data refresh failed:", error);
        setMarketDataError(error.message || "Unknown error fetching market data");
    } finally {
        if (!silent) setIsRefreshing(false);
    }
  }, [isRefreshing, lastSync, sourceTransactions, preferences]);

  const refreshSingleAsset = useCallback(async (ticker: string) => {
    if (!ticker) return;
    try {
        const priceData = await fetchBrapiQuotes(preferences, [ticker]);
        const advancedData = await fetchAdvancedAssetData(preferences, [ticker]);
        setMarketData(prev => {
            const updated = { ...prev };
            updated[ticker] = { 
                ...(prev[ticker] || {}), 
                ...priceData[ticker], 
                ...advancedData[ticker] 
            };
            return updated;
        });
    } catch(error: any) {
        setMarketDataError(error.message);
        throw error;
    }
  }, [preferences]);

  // --- Derived State Calculations ---
  const assets = useMemo((): Asset[] => {
    const portfolioMetrics = calculatePortfolioMetrics(sourceTransactions);
    return Object.keys(portfolioMetrics).map(ticker => {
      const metric = portfolioMetrics[ticker];
      const liveData = (sourceMarketData as Record<string, any>)[ticker.toUpperCase()] || {};
      const avgPrice = metric.quantity > 0 ? metric.totalCost / metric.quantity : 0;
      const currentPrice = liveData.currentPrice || 0;
      const totalInvested = metric.quantity * avgPrice;
      const yieldOnCost = totalInvested > 0 && liveData.dy > 0 ? ((currentPrice * (liveData.dy / 100)) / avgPrice) * 100 : 0;
      
      return {
        ticker,
        quantity: metric.quantity,
        avgPrice,
        currentPrice,
        priceHistory: liveData.priceHistory || [],
        dy: liveData.dy,
        pvp: liveData.pvp,
        segment: liveData.sector || 'Outros',
        administrator: liveData.administrator,
        vacancyRate: liveData.vacancyRate,
        liquidity: liveData.dailyLiquidity,
        shareholders: liveData.shareholders,
        yieldOnCost,
      };
    }).filter(asset => asset.quantity > EPSILON); // Filter out assets that have been sold off
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
    if (isDemoMode) {
        return DEMO_DIVIDENDS;
    }
    
    if (sourceTransactions.length === 0) {
        return [];
    }

    const simulatedDividends: Dividend[] = [];
    const firstTxDate = new Date(
        Math.min(...sourceTransactions.map(tx => fromISODate(tx.date).getTime()))
    );
    const today = new Date();

    let currentDate = new Date(firstTxDate.getFullYear(), firstTxDate.getMonth(), 1);

    while (currentDate <= today) {
        // The end of the current month is our simulated "ex-dividend date"
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

        const transactionsUpToMonth = sourceTransactions.filter(tx => fromISODate(tx.date) <= endOfMonth);
        
        const portfolioAtMonthEnd = calculatePortfolioMetrics(transactionsUpToMonth);

        Object.keys(portfolioAtMonthEnd).forEach(ticker => {
            const holdings = portfolioAtMonthEnd[ticker];
            const liveData = (sourceMarketData as Record<string, any>)[ticker.toUpperCase()] || {};
            const currentPrice = liveData.currentPrice || 0;
            const dy = liveData.dy || 0;

            if (holdings.quantity > EPSILON && dy > 0 && currentPrice > 0) {
                const amountPerShare = (currentPrice * (dy / 100)) / 12;
                
                // Payment date is simulated as the 15th of the NEXT month
                const paymentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 15);

                // Only generate payments for dates that have already passed or are in the current month
                if (paymentDate <= today) {
                    simulatedDividends.push({
                        ticker,
                        quantity: holdings.quantity,
                        amountPerShare,
                        paymentDate: paymentDate.toISOString().split('T')[0], // YYYY-MM-DD
                    });
                }
            }
        });
        
        // Move to the first day of the next month
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return simulatedDividends;
  }, [sourceTransactions, sourceMarketData, isDemoMode]);

  const monthlyIncome = useMemo((): MonthlyIncome[] => {
      const incomeMap: Record<string, number> = {};
      dividends.forEach(div => {
          const date = fromISODate(div.paymentDate);
          const monthKey = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('. de ', '/');
          incomeMap[monthKey] = (incomeMap[monthKey] || 0) + (div.amountPerShare * div.quantity);
      });
      return Object.entries(incomeMap).map(([month, total]) => ({ month, total }));
  }, [dividends]);

  const portfolioEvolution = useMemo((): SegmentEvolutionData => {
        if (sourceTransactions.length === 0) return {};

        const results: SegmentEvolutionData = { all_types: [] };
        const firstTxDate = fromISODate(sourceTransactions.sort((a, b) => a.date.localeCompare(b.date))[0].date);
        const today = new Date();
        
        let currentDate = new Date(firstTxDate.getFullYear(), firstTxDate.getMonth(), 1);

        while (currentDate <= today) {
            const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            const endOfMonthISO = endOfMonth.toISOString().split('T')[0];

            const transactionsUpToMonth = sourceTransactions.filter(tx => tx.date <= endOfMonthISO);
            const portfolioAtMonthEnd = calculatePortfolioMetrics(transactionsUpToMonth);

            let monthInvestedTotal = 0;
            let monthMarketValueTotal = 0;
            const segmentInvested: Record<string, number> = {};
            const segmentMarketValue: Record<string, number> = {};

            Object.keys(portfolioAtMonthEnd).forEach(ticker => {
                const holdings = portfolioAtMonthEnd[ticker];
                const liveData = (sourceMarketData as Record<string, any>)[ticker.toUpperCase()] || {};
                const segment = liveData.sector || 'Outros';

                const historicalPrice = getClosestPrice(liveData.priceHistory || [], endOfMonthISO);
                const marketValue = historicalPrice !== null ? holdings.quantity * historicalPrice : holdings.totalCost;

                monthInvestedTotal += holdings.totalCost;
                monthMarketValueTotal += marketValue;

                segmentInvested[segment] = (segmentInvested[segment] || 0) + holdings.totalCost;
                segmentMarketValue[segment] = (segmentMarketValue[segment] || 0) + marketValue;
            });

            const monthLabel = currentDate.toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit', timeZone: 'UTC' });
            
            results.all_types.push({
                month: monthLabel,
                invested: monthInvestedTotal,
                marketValue: monthMarketValueTotal
            });

            Object.keys(segmentInvested).forEach(segment => {
                if (!results[segment]) results[segment] = [];
                results[segment].push({
                    month: monthLabel,
                    invested: segmentInvested[segment],
                    marketValue: segmentMarketValue[segment]
                });
            });

            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        return results;
    }, [sourceTransactions, sourceMarketData]);

  useEffect(() => {
    if (preferences.privacyOnStart) {
      setPrivacyMode(true);
    }
  }, [preferences.privacyOnStart]);

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
    addTransaction,
    updateTransaction,
    deleteTransaction,
    importTransactions,
    updatePreferences,
    updateUserProfile,
    refreshMarketData,
    refreshSingleAsset,
    getAssetByTicker,
    getAveragePriceForTransaction,
    setDemoMode,
    togglePrivacyMode,
    resetApp,
    clearCache,
  }), [
    assets, sourceTransactions, dividends, preferences, isDemoMode, privacyMode,
    yieldOnCost, projectedAnnualIncome, monthlyIncome, portfolioEvolution,
    lastSync, isRefreshing, marketDataError, userProfile, refreshMarketData,
    refreshSingleAsset, getAssetByTicker, getAveragePriceForTransaction
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
