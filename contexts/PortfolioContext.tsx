import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { AppPreferences, Transaction, AppNotification, Asset, MonthlyIncome } from '../types';
// FIX: import calculatePortfolioMetrics from ../utils
import { usePersistentState, calculatePortfolioMetrics, safeFloat } from '../utils';
import { DEFAULT_PREFERENCES } from '../constants';
import { usePortfolioCalculations, PayerData } from '../hooks/usePortfolioCalculations';
import { fetchBrapiQuotes } from '../services/brapiService';
import { fetchAdvancedAssetData } from '../services/geminiService'; // Import Gemini service

// --- Helper Functions ---
const chunkArray = <T,>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};


interface PortfolioContextType {
    preferences: AppPreferences;
    updatePreferences: (prefs: Partial<AppPreferences>) => void;
    transactions: Transaction[];
    addTransaction: (tx: Transaction) => void;
    updateTransaction: (tx: Transaction) => void;
    deleteTransaction: (id: string) => void;
    importTransactions: (txs: Transaction[]) => void;
    assets: Asset[];
    getAssetByTicker: (ticker: string) => Asset | undefined;
    marketDataError: string | null;
    refreshMarketData: (force?: boolean) => Promise<void>;
    refreshSingleAsset: (ticker: string, force?: boolean) => Promise<void>;
    isRefreshing: boolean;
    
    notifications: AppNotification[];
    unreadNotificationsCount: number;
    markNotificationsAsRead: () => void;
    deleteNotification: (id: number) => void;
    clearAllNotifications: () => void;
    
    userProfile: { name: string; email: string; avatarUrl: string };
    updateUserProfile: (profile: { name: string; email: string; avatarUrl: string }) => void;
    
    setTheme: (themeId: string) => void;
    setFont: (fontId: string) => void;
    resetApp: () => void;
    restoreData: (data: { transactions: Transaction[], preferences?: Partial<AppPreferences> }) => void;
    
    apiStats: { gemini: { requests: number; bytesSent: number; bytesReceived: number }, brapi: { requests: number; bytesReceived: number } };
    logApiUsage: (api: 'gemini' | 'brapi', stats: any) => void;
    resetApiStats: () => void;
    
    deferredPrompt: any;
    installPwa: () => void;
    
    // Calculated values
    portfolioEvolution: any;
    monthlyIncome: MonthlyIncome[];
    payersData: PayerData[];
    totalReceived: number;
    yieldOnCost: number;
    projectedAnnualIncome: number;
    getAveragePriceForTransaction: (tx: Transaction) => number;
    privacyMode: boolean;
    togglePrivacyMode: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // State definitions
    const [preferences, setPreferences] = usePersistentState<AppPreferences>('preferences', DEFAULT_PREFERENCES);
    const [transactions, setTransactions] = usePersistentState<Transaction[]>('transactions', []);
    const [marketData, setMarketData] = usePersistentState<Record<string, any>>('market_data', {});
    const [notifications, setNotifications] = usePersistentState<AppNotification[]>('notifications', []);
    const [userProfile, setUserProfile] = usePersistentState('user_profile', { name: 'Investidor', email: '', avatarUrl: '' });
    const [apiStats, setApiStats] = usePersistentState('api_stats', { gemini: { requests: 0, bytesSent: 0, bytesReceived: 0 }, brapi: { requests: 0, bytesReceived: 0 } });
    const [privacyMode, setPrivacyMode] = usePersistentState('privacy_mode', false);
    
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [marketDataError, setMarketDataError] = useState<string | null>(null);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const marketDataRef = useRef(marketData);

    // Derived State via Hook
    const calculations = usePortfolioCalculations(transactions, marketData);
    
    // Effects
    useEffect(() => {
        marketDataRef.current = marketData;
    }, [marketData]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', preferences.currentThemeId.includes('dark') ? 'dark' : 'light');
    }, [preferences.currentThemeId]);

    useEffect(() => {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });
    }, []);
    
    // Initial Load
    useEffect(() => {
        const hasAssets = calculations.assets.length > 0;
        const hasMarketData = calculations.assets.some(a => a.lastUpdated);
        if(hasAssets && !hasMarketData) {
            console.log("Initial Load: Missing data detected, forcing refresh.");
            refreshMarketData(true);
        }
    }, [calculations.assets.length]);

    // Actions
    const updatePreferences = (prefs: Partial<AppPreferences>) => {
        setPreferences(prev => ({ ...prev, ...prefs }));
    };

    const addTransaction = (tx: Transaction) => setTransactions(prev => [...prev, tx]);
    const updateTransaction = (tx: Transaction) => setTransactions(prev => prev.map(t => t.id === tx.id ? tx : t));
    const deleteTransaction = (id: string) => setTransactions(prev => prev.filter(t => t.id !== id));
    const importTransactions = (txs: Transaction[]) => setTransactions(prev => [...prev, ...txs]);

    const getAssetByTicker = (ticker: string) => calculations.assets.find(a => a.ticker === ticker);

    const refreshMarketData = useCallback(async (force = false) => {
        if (isRefreshing || calculations.assets.length === 0) return;
        setIsRefreshing(true);
        setMarketDataError(null);
        let brapiErrorOccurred = false;
        let geminiErrorOccurred = false;
        const failedGeminiTickers: string[] = [];
    
        try {
            // --- Step 1: Fetch Prices from Brapi ---
            const allTickers = (calculations.assets as Asset[]).map(a => a.ticker);
            try {
                const { quotes: priceQuotes, stats: brapiStats } = await fetchBrapiQuotes(preferences, allTickers);
                logApiUsage('brapi', { requests: 1, ...brapiStats });
                
                setMarketData(prev => {
                    const next = { ...prev };
                    // FIX: Use Object.keys to ensure ticker is a string and avoid potential type errors.
                    Object.keys(priceQuotes).forEach(ticker => {
                        const data = priceQuotes[ticker as keyof typeof priceQuotes];
                        next[ticker] = { ...(prev[ticker] || {}), ...data, lastUpdated: Date.now() };
                    });
                    return next;
                });
            } catch (brapiError) {
                console.error("Brapi Error:", brapiError);
                brapiErrorOccurred = true;
            }
    
            // --- Step 2: Fetch Fundamental Data from Gemini in Batches ---
            const ONE_DAY_MS = 24 * 60 * 60 * 1000;
            // FIX: Cast calculations.assets to Asset[] to fix type inference issues causing downstream errors.
            const assetsNeedingUpdate = force 
                ? allTickers 
                : (calculations.assets as Asset[])
                    .filter(a => !a.lastFundamentalUpdate || Date.now() - (a.lastFundamentalUpdate || 0) > ONE_DAY_MS)
                    .map(a => a.ticker);
    
            if (assetsNeedingUpdate.length > 0) {
                // Batch processing to be nicer to the Gemini API
                const batches = chunkArray(assetsNeedingUpdate, 5); // Process in batches of 5
                
                for (let i = 0; i < batches.length; i++) {
                    const batch = batches[i];
                    try {
                        const { data: fundamentalData, stats: geminiStats } = await fetchAdvancedAssetData(preferences, batch);
                        logApiUsage('gemini', { requests: 1, ...geminiStats });
    
                        setMarketData(prev => {
                            const next = { ...prev };
                            // FIX: Use Object.keys to ensure ticker is a string and fix indexing errors with 'unknown' type.
                            Object.keys(fundamentalData).forEach(ticker => {
                                const data = fundamentalData[ticker];
                                next[ticker] = { ...(prev[ticker] || {}), ...data, lastFundamentalUpdate: Date.now() };
                            });
                            return next;
                        });

                        // Check which tickers in batch were not returned
                        // FIX: With assetsNeedingUpdate typed correctly, 'ticker' is now a string, fixing this check.
                        batch.forEach(ticker => {
                            if (!fundamentalData[ticker]) {
                                failedGeminiTickers.push(ticker);
                            }
                        });

                    } catch (geminiError: any) {
                        console.error(`Gemini Fundamentals Error for batch ${i+1}:`, geminiError);
                        geminiErrorOccurred = true;
                        failedGeminiTickers.push(...batch);
                    }
    
                    // Wait between batches to avoid rate limiting
                    if (i < batches.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 5000)); // 5-second delay
                    }
                }
            }
    
        } catch (e: any) {
            // General catch for unexpected errors
            setMarketDataError(e.message);
        } finally {
            setIsRefreshing(false);
            // Consolidated error reporting
            if (brapiErrorOccurred && geminiErrorOccurred) {
                setMarketDataError('Falha ao atualizar preços e fundamentos.');
            } else if (brapiErrorOccurred) {
                setMarketDataError('Falha ao atualizar preços (Brapi). Fundamentos OK.');
            } else if (failedGeminiTickers.length > 0) {
                 setMarketDataError(`Alguns dados fundamentais falharam: ${failedGeminiTickers.slice(0, 3).join(', ')}...`);
            }
        }
    }, [isRefreshing, calculations.assets, preferences]);

    const refreshSingleAsset = async (ticker: string, force = false) => {
         if (isRefreshing) return;
         setIsRefreshing(true);
         try {
            await refreshMarketData(true);
         } catch (e: any) {
             console.error("Single asset refresh failed", e);
         } finally {
             setIsRefreshing(false);
         }
    };

    const logApiUsage = (api: 'gemini' | 'brapi', stats: any) => {
        setApiStats(prev => ({
            ...prev,
            [api]: {
                requests: prev[api].requests + (stats.requests || 0),
                bytesSent: safeFloat((prev[api] as any).bytesSent + (stats.bytesSent || 0)),
                bytesReceived: safeFloat(prev[api].bytesReceived + (stats.bytesReceived || 0))
            }
        }));
    };
    
    const resetApiStats = () => setApiStats({ gemini: { requests: 0, bytesSent: 0, bytesReceived: 0 }, brapi: { requests: 0, bytesReceived: 0 } });

    const markNotificationsAsRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const deleteNotification = (id: number) => setNotifications(prev => prev.filter(n => n.id !== id));
    const clearAllNotifications = () => setNotifications([]);

    const updateUserProfile = (profile: any) => setUserProfile(profile);
    
    const resetApp = async () => {
        try {
            await caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))));
            localStorage.clear();
            sessionStorage.clear();
            
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(reg => reg.unregister()));
            }
            // IndexedDB clear logic
            const dbs = await indexedDB.databases();
            dbs.forEach(db => { if(db.name) indexedDB.deleteDatabase(db.name) });

        } catch (e) {
            console.error("Error clearing data:", e);
        } finally {
            window.location.reload();
        }
    };

    const restoreData = (data: any) => {
        if (data.transactions) setTransactions(data.transactions);
        if (data.preferences) setPreferences(prev => ({ ...prev, ...data.preferences }));
    };

    const setTheme = (id: string) => updatePreferences({ currentThemeId: id });
    const setFont = (id: string) => updatePreferences({ currentFontId: id });
    
    const installPwa = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
        }
    };

    const getAveragePriceForTransaction = (tx: Transaction) => {
        const previousTxs = transactions
            .filter(t => t.ticker === tx.ticker && t.date < tx.date)
            .sort((a,b) => a.date.localeCompare(b.date));

        const metrics = calculatePortfolioMetrics(previousTxs)[tx.ticker];
        return metrics && metrics.quantity > 0 ? metrics.totalCost / metrics.quantity : 0;
    };
    
    const togglePrivacyMode = () => setPrivacyMode(prev => !prev);

    const value: PortfolioContextType = {
        preferences, updatePreferences,
        transactions, addTransaction, updateTransaction, deleteTransaction, importTransactions,
        assets: calculations.assets, getAssetByTicker,
        marketDataError, refreshMarketData, refreshSingleAsset, isRefreshing,
        notifications, unreadNotificationsCount: notifications.filter(n => !n.read).length,
        markNotificationsAsRead, deleteNotification, clearAllNotifications,
        userProfile, updateUserProfile,
        setTheme, setFont, resetApp, restoreData,
        apiStats, logApiUsage, resetApiStats,
        deferredPrompt, installPwa,
        portfolioEvolution: calculations.portfolioEvolution,
        monthlyIncome: calculations.monthlyIncome,
        payersData: calculations.payersData,
        totalReceived: calculations.totalReceived,
        yieldOnCost: calculations.yieldOnCost,
        projectedAnnualIncome: calculations.projectedAnnualIncome,
        getAveragePriceForTransaction,
        privacyMode, togglePrivacyMode
    };

    return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
};

export const usePortfolio = () => {
    const context = useContext(PortfolioContext);
    if (!context) throw new Error('usePortfolio must be used within a PortfolioProvider');
    return context;
};
