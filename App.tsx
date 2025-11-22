
import React, { useState, useEffect, useCallback, useRef } from 'react';
import BottomNav from './components/BottomNav';
import PortfolioView from './views/PortfolioView';
import NewsView from './views/NewsView';
import SettingsView, { type MenuScreen } from './views/SettingsView';
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

// Icons for Sidebar
import WalletIcon from './components/icons/WalletIcon';
import TransactionIcon from './components/icons/TransactionIcon';
import NewsIcon from './components/icons/NewsIcon';
import AnalysisIcon from './components/icons/AnalysisIcon';
import SettingsIcon from './components/icons/SettingsIcon';

export type View = 'carteira' | 'transacoes' | 'analise' | 'noticias' | 'settings' | 'notificacoes' | 'assetDetail';
export type Theme = 'dark' | 'light';

const App: React.FC = () => {
  const { assets, preferences, setDemoMode, isDemoMode, marketDataError, setPrivacyMode } = usePortfolio();
  const { t } = useI18n();
  const [activeView, setActiveView] = useState<View>(preferences.startScreen as View || 'carteira');
  const [previousView, setPreviousView] = useState<View>('carteira');
  const [showTour, setShowTour] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [transactionFilter, setTransactionFilter] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [settingsStartScreen, setSettingsStartScreen] = useState<MenuScreen>('main');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLocked, setIsLocked] = useState(!!preferences.appPin);
  const lastVisibleTimestamp = useRef(Date.now());

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
        const isCompleteMessage = marketDataError.includes("Falha ao atualizar:") || marketDataError.includes("Token da API");
        if (isCompleteMessage) {
            addToast(marketDataError, 'error');
        } else if (!marketDataError.includes("Chave de API")) {
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
    if (!isLocked) {
        const hasVisited = localStorage.getItem('hasVisited');
        
        if (!hasVisited || preferences.restartTutorial) {
            setDemoMode(true);
            setShowTour(true);
        }

        if (!isInitialized) {
            if (preferences.privacyOnStart) {
              setPrivacyMode(true);
            }
            setActiveView(preferences.startScreen as View || 'carteira');
            setIsInitialized(true);
        }
    }
  }, [isLocked, preferences.startScreen, isInitialized, preferences.restartTutorial, setDemoMode, preferences.privacyOnStart, setPrivacyMode]);
  
  // Re-lock on backgrounding
  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            lastVisibleTimestamp.current = Date.now();
        }
        if (document.visibilityState === 'visible' && preferences.appPin) {
            const timeInBackground = Date.now() - lastVisibleTimestamp.current;
            // Re-lock if the app was in background for more than 60 seconds
            if (timeInBackground > 60 * 1000) { 
                setIsLocked(true);
            }
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [preferences.appPin]);

  const handleTourFinish = () => {
    setDemoMode(false);
    setShowTour(false);
    localStorage.setItem('hasVisited', 'true');
  };

  const navigateTo = (view: View) => {
    setPreviousView(activeView);
    // Reset settings screen to main when navigating normally
    if (view === 'settings') setSettingsStartScreen('main');
    setActiveView(view);
  };

  const navigateToSettings = (screen: MenuScreen) => {
      setSettingsStartScreen(screen);
      setActiveView('settings');
  };

  const handleSelectAsset = (ticker: string) => {
    setSelectedTicker(ticker);
    navigateTo('assetDetail');
  };

  const handleBack = () => {
    setSelectedTicker(null);
    setActiveView(previousView);
  };

  const handleViewTransactions = (ticker: string) => {
    setTransactionFilter(ticker);
    navigateTo('transacoes');
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
        return <AnalysisView addToast={addToast} />;
      case 'noticias':
        return <NewsView addToast={addToast} />;
      case 'settings':
        return <SettingsView addToast={addToast} initialScreen={settingsStartScreen} />;
      case 'notificacoes':
        return <NotificationsView setActiveView={navigateTo} onSelectAsset={handleSelectAsset} onOpenSettings={navigateToSettings} />;
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

  const isNavVisible = !['assetDetail', 'notificacoes'].includes(activeView);

  return (
    <div className="bg-[var(--bg-primary)] min-h-screen font-sans text-[var(--text-primary)] transition-colors duration-300 flex flex-col md:flex-row overflow-hidden mobile-landscape-layout selection:bg-[var(--accent-color)] selection:text-[var(--accent-color-text)]">
       {showTour && <Tour onFinish={handleTourFinish} isPortfolioEmpty={isDemoMode ? false : assets.length === 0} />}
       
       {/* Sidebar for Desktop & Mobile Landscape */}
       <aside className="hidden md:flex flex-col w-64 xl:w-72 h-screen bg-[var(--bg-secondary)]/50 backdrop-blur-xl border-r border-[var(--border-color)] flex-shrink-0 z-20 mobile-landscape-sidebar shadow-2xl shadow-black/10">
          <div className="p-6 flex items-center gap-3 sidebar-title mb-2">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-color)] to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
             </div>
             <div>
                 <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">Invest</h1>
                 <p className="text-[10px] text-[var(--text-secondary)] font-bold tracking-[0.2em] uppercase">Portfolio</p>
             </div>
          </div>
          
          <nav className="flex-1 px-4 space-y-2 overflow-y-auto py-2">
             {[
                 { id: 'carteira', label: t('nav_portfolio'), icon: <WalletIcon /> },
                 { id: 'transacoes', label: t('nav_transactions'), icon: <TransactionIcon /> },
                 { id: 'analise', label: t('nav_analysis'), icon: <AnalysisIcon /> },
                 { id: 'noticias', label: t('nav_news'), icon: <NewsIcon /> },
                 { id: 'settings', label: t('nav_settings'), icon: <SettingsIcon /> },
             ].map(item => (
                 <button
                    key={item.id}
                    onClick={() => { navigateTo(item.id as View); }}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 w-full text-left text-sm font-bold group ${activeView === item.id ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary-hover)] hover:text-[var(--text-primary)]'}`}
                 >
                    {React.cloneElement(item.icon as React.ReactElement, { className: `w-5 h-5 transition-transform duration-300 ${activeView === item.id ? 'scale-110' : 'group-hover:scale-110'}` })}
                    <span>{item.label}</span>
                    {activeView === item.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] shadow-[0_0_8px_var(--accent-color)]"></div>}
                 </button>
             ))}
          </nav>

          <div className="p-4 border-t border-[var(--border-color)]">
              <div className="bg-[var(--bg-tertiary-hover)]/50 rounded-xl p-3 flex items-center gap-3 backdrop-blur-md border border-[var(--border-color)]/50">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">Mercado Aberto</span>
              </div>
          </div>
       </aside>

       {/* Main Content */}
       <main className="flex-1 h-screen relative flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-hidden bg-[var(--bg-primary)] relative">
            <ErrorBoundary>
              <div className="view-container h-full animate-subtle-fade-in" key={activeView}>
                {renderView()}
              </div>
            </ErrorBoundary>
          </div>
          
          {/* Mobile Bottom Nav Wrapper */}
          <div className="md:hidden mobile-landscape-bottom-nav">
             {isNavVisible && <BottomNav activeView={activeView} setActiveView={navigateTo} />}
          </div>
       </main>

       {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;
