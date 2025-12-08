
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AppPreferences, Transaction, AppNotification, Asset, MonthlyIncome } from '../types';
import { usePersistentState } from '../utils';
import { DEFAULT_PREFERENCES } from '../constants';
import { usePortfolioCalculations, PayerData } from '../hooks/usePortfolioCalculations';
import { fetchBrapiQuotes } from '../services/brapiService';

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

    // Derived State via Hook
    const calculations = usePortfolioCalculations(transactions, marketData);

    // Effects
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', preferences.currentThemeId.includes('dark') ? 'dark' : 'light');
    }, [preferences.currentThemeId]);

    useEffect(() => {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });
    }, []);

    // Actions
    const updatePreferences = (prefs: Partial<AppPreferences>) => {
        setPreferences(prev => ({ ...prev, ...prefs }));
    };

    const addTransaction = (tx: Transaction) => setTransactions(prev => [...prev, tx]);
    const updateTransaction = (tx: Transaction) => setTransactions(prev => prev.map(t => t.id === tx.id ? tx : t));
    const deleteTransaction = (id: string) => setTransactions(prev => prev.filter(t => t.id !== id));
    const importTransactions = (txs: Transaction[]) => setTransactions(prev => [...prev, ...txs]);

    const getAssetByTicker = (ticker: string) => calculations.assets.find(a => a.ticker === ticker);

    const refreshMarketData = async (force = false) => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        setMarketDataError(null);
        try {
            const tickers = calculations.assets.map(a => a.ticker);
            const { quotes, stats } = await fetchBrapiQuotes(preferences, tickers);
            setMarketData(prev => {
                const next = { ...prev };
                Object.entries(quotes).forEach(([ticker, data]) => {
                    next[ticker] = { ...next[ticker], ...data, lastUpdated: Date.now() };
                });
                return next;
            });
            logApiUsage('brapi', { requests: 1, ...stats });
        } catch (e: any) {
            setMarketDataError(e.message);
        } finally {
            setIsRefreshing(false);
        }
    };

    const refreshSingleAsset = async (ticker: string, force = false) => {
         // Re-uses general refresh for now, or could target single ticker
         if (isRefreshing) return;
         setIsRefreshing(true);
         try {
            const { quotes, stats } = await fetchBrapiQuotes(preferences, [ticker]);
            setMarketData(prev => ({ ...prev, ...quotes }));
            logApiUsage('brapi', { requests: 1, ...stats });
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
                bytesSent: (prev[api] as any).bytesSent + (stats.bytesSent || 0),
                bytesReceived: prev[api].bytesReceived + (stats.bytesReceived || 0)
            }
        }));
    };
    
    const resetApiStats = () => setApiStats({ gemini: { requests: 0, bytesSent: 0, bytesReceived: 0 }, brapi: { requests: 0, bytesReceived: 0 } });

    const markNotificationsAsRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const deleteNotification = (id: number) => setNotifications(prev => prev.filter(n => n.id !== id));
    const clearAllNotifications = () => setNotifications([]);

    const updateUserProfile = (profile: any) => setUserProfile(profile);
    
    const resetApp = () => {
        localStorage.clear();
        // IndexedDB clear logic implies clearing all used stores
        // We let the browser handle reloading to clear in-memory state
        window.location.reload();
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
        // Mock implementation - real calculation would filter previous txs
        return 0; 
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
