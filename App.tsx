import React, { useState, useEffect, useCallback } from 'react';
import BottomNav from './components/BottomNav';
import PortfolioView from './views/PortfolioView';
import NewsView from './views/NewsView';
import SettingsView from './views/SettingsView';
import TransactionsView from './views/TransactionsView';
import NotificationsView from './views/NotificationsView';
import AnalysisView from './views/AnalysisView';
import AssetDetailView from './views/AssetDetailView';
import PinLockScreen from './components/PinLockScreen';
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/Toast';
import Tour from './components/tour/Tour';
import type { ToastMessage } from './types';
import { usePortfolio } from './contexts/PortfolioContext';
import { useI18n } from './contexts/I18nContext';

export type View = 'carteira' | 'transacoes' | 'analise' | 'noticias' | 'settings' | 'notificacoes' | 'assetDetail';
export type Theme = 'dark' | 'light';

const App: React.FC = () => {
  const { assets, preferences, setDemoMode, isDemoMode, marketDataError } = usePortfolio();
  const { t } = useI18n();
  const [activeView, setActiveView] = useState<View>(preferences.startScreen as View || 'carteira');
  const [previousView, setPreviousView] = useState<View>('carteira');
  const [showTour, setShowTour] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [transactionFilter, setTransactionFilter] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLocked, setIsLocked] = useState(!!preferences.appPin);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const newToast: ToastMessage = { id: Date.now(), message, type };
    setToast(newToast);
    setTimeout(() => {
      setToast(t => (t?.id === newToast.id ? null : t));
    }, 3000);
  }, []);

  // Global handler for background data sync errors
  useEffect(() => {
    if (marketDataError) {
        // Avoid showing redundant "API key not configured" toast, as Settings view handles it.
        if (!marketDataError.includes("Chave de API")) {
            addToast(`${t('toast_update_failed')}: ${marketDataError}`, 'error');
        }
    }
  }, [marketDataError, addToast, t]);

  // Theme Management
  useEffect(() => {
    const applyTheme = () => {
        let themeToApply = preferences.systemTheme;
        if (preferences.systemTheme === 'system') {
            themeToApply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.dataset.theme = themeToApply;
    };
    applyTheme();
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
        if (preferences.systemTheme === 'system') applyTheme();
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [preferences.systemTheme]);
  
  // Font Size Management
  useEffect(() => {
      const root = document.documentElement;
      root.classList.remove('text-sm', 'text-base', 'text-lg');
      if(preferences.fontSize === 'small') root.classList.add('text-sm');
      else if(preferences.fontSize === 'large') root.classList.add('text-lg');
      else root.classList.add('text-base');
  }, [preferences.fontSize]);

  useEffect(() => {
    // Apply Accent Color
    const colors: Record<string, string> = {
        blue: '#38bdf8',
        green: '#4ade80',
        purple: '#a78bfa',
        orange: '#fb923c',
        rose: '#fb7185'
    };
    const color = colors[preferences.accentColor] || colors.blue;
    document.documentElement.style.setProperty('--accent-color', color);
    
    const currentTheme = document.documentElement.dataset.theme;
    if (currentTheme === 'light') {
         const lightColors: Record<string, string> = {
            blue: '#0284c7',
            green: '#16a34a',
            purple: '#7c3aed',
            orange: '#ea580c',
            rose: '#e11d48'
        };
        const lightColor = lightColors[preferences.accentColor] || lightColors.blue;
        document.documentElement.style.setProperty('--accent-color', lightColor);
    }

  }, [preferences.accentColor, preferences.systemTheme]); 

  useEffect(() => {
    // Show tour only if unlocked and first visit
    if (!isLocked) {
        const hasVisited = localStorage.getItem('hasVisited');
        
        if (!hasVisited || preferences.restartTutorial) {
            setDemoMode(true); // Enable Demo Data
            setShowTour(true);
        }

        if (!isInitialized) {
            setActiveView(preferences.startScreen as View || 'carteira');
            setIsInitialized(true);
        }
    }
  }, [isLocked, preferences.startScreen, isInitialized, preferences.restartTutorial, setDemoMode]);

  const handleTourFinish = () => {
    setDemoMode(false); // Clear Demo Data (Back to zero/user data)
    setShowTour(false);
    localStorage.setItem('hasVisited', 'true');
  };

  const navigateTo = (view: View) => {
    setPreviousView(activeView);
    setActiveView(view);
  };

  const handleSelectAsset = (ticker: string) => {
    setSelectedTicker(ticker);
    navigateTo('assetDetail');
  };

  const handleBack = () => {
    setSelectedTicker(null);
    setActiveView(previousView);
  };

  const renderView = () => {
    switch (activeView) {
      case 'carteira':
        return <PortfolioView 
            setActiveView={navigateTo} 
            setTransactionFilter={setTransactionFilter}
            onSelectAsset={handleSelectAsset}
            addToast={addToast}
        />;
      case 'transacoes':
        return <TransactionsView 
            initialFilter={transactionFilter}
            clearFilter={() => setTransactionFilter(null)}
            addToast={addToast}
        />;
       case 'analise':
        return <AnalysisView />;
      case 'noticias':
        return <NewsView addToast={addToast} />;
      case 'settings':
        return <SettingsView addToast={addToast} />;
      case 'notificacoes':
        return <NotificationsView setActiveView={navigateTo} />;
      case 'assetDetail':
        return <AssetDetailView ticker={selectedTicker!} onBack={handleBack} onViewTransactions={handleViewTransactions} />;
      default:
        return <PortfolioView 
            setActiveView={navigateTo} 
            setTransactionFilter={setTransactionFilter}
            onSelectAsset={handleSelectAsset}
            addToast={addToast}
        />;
    }
  };
  
  const handleViewTransactions = (ticker: string) => {
    setTransactionFilter(ticker);
    navigateTo('transacoes');
  };

  // Pin Lock / Biometric Check
  if (isLocked && preferences.appPin) {
      const biometricsEnabled = localStorage.getItem('security-biometrics') === 'true';
      return (
        <PinLockScreen 
            correctPin={preferences.appPin} 
            onUnlock={() => setIsLocked(false)} 
            allowBiometrics={biometricsEnabled}
        />
      );
  }

  return (
    <div className="bg-[var(--bg-primary)] min-h-screen font-sans text-[var(--text-primary)] transition-colors duration-300">
       {showTour && <Tour onFinish={handleTourFinish} isPortfolioEmpty={isDemoMode ? false : assets.length === 0} />}
      <div className="max-w-md mx-auto pb-20 overflow-x-hidden min-h-screen">
        <ErrorBoundary>
            <div className="view-container">
                {renderView()}
            </div>
        </ErrorBoundary>
      </div>
      {activeView !== 'assetDetail' && <BottomNav activeView={activeView} setActiveView={navigateTo} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;