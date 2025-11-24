import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import BottomNav from './components/BottomNav';
import PortfolioView from './views/PortfolioView';
import OfflineBanner from './components/OfflineBanner';
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import type { ToastMessage } from './types';
import { usePortfolio } from './contexts/PortfolioContext';
import { useI18n } from './contexts/I18nContext';
import { isLowEndDevice } from './utils';
import type { MenuScreen } from './views/SettingsView';

// Icons for Sidebar
import WalletIcon from './components/icons/WalletIcon';
import TransactionIcon from './components/icons/TransactionIcon';
import NewsIcon from './components/icons/NewsIcon';
import AnalysisIcon from './components/icons/AnalysisIcon';
import SettingsIcon from './components/icons/SettingsIcon';

// Lazy Load Views
const NewsView = React.lazy(() => import('./views/NewsView'));
const SettingsView = React.lazy(() => import('./views/SettingsView'));
const TransactionsView = React.lazy(() => import('./views/TransactionsView'));
const NotificationsView = React.lazy(() => import('./views/NotificationsView'));
const AnalysisView = React.lazy(() => import('./views/AnalysisView'));
const AssetDetailView = React.lazy(() => import('./views/AssetDetailView'));
const PinLockScreen = React.lazy(() => import('./components/PinLockScreen'));

export type View = 'carteira' | 'transacoes' | 'analise' | 'noticias' | 'settings' | 'notificacoes' | 'assetDetail';
export type Theme = 'dark' | 'light';

const App: React.FC = () => {
  const { assets, preferences, marketDataError, setPrivacyMode } = usePortfolio();
  const { t } = useI18n();
  const [activeView, setActiveView] = useState<View>(preferences.startScreen as View || 'carteira');
  const [previousView, setPreviousView] = useState<View>('carteira');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [transactionFilter, setTransactionFilter] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [settingsStartScreen, setSettingsStartScreen] = useState<MenuScreen>('main');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLocked, setIsLocked] = useState(!!preferences.appPin);
  const lastVisibleTimestamp = useRef(Date.now());
  
  const [isMarketOpen, setIsMarketOpen] = useState(false);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const newToast: ToastMessage = { id: Date.now(), message, type };
    setToast(newToast);
    setTimeout(() => {
      setToast(t => (t?.id === newToast.id ? null : t));
    }, 3000);
  }, []);

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
  
  // Theme & Visual Style Management
  useEffect(() => {
    const applyTheme = () => {
        let themeToApply = preferences.systemTheme;
        if (preferences.systemTheme === 'system') {
            themeToApply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.dataset.theme = themeToApply;
    };
    applyTheme();
    
    if (isLowEndDevice() && preferences.visualStyle === 'premium') {
        document.documentElement.dataset.style = 'simple';
    } else {
        document.documentElement.dataset.style = preferences.visualStyle || 'premium';
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
        if (preferences.systemTheme === 'system') applyTheme();
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [preferences.systemTheme, preferences.visualStyle]);
  
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
    
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '56, 189, 248';
    }
    document.documentElement.style.setProperty('--accent-rgb', hexToRgb(color));
    
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
        document.documentElement.style.setProperty('--accent-rgb', hexToRgb(lightColor));
    }

  }, [preferences.accentColor, preferences.systemTheme]); 

  useEffect(() => {
    if (!isLocked) {
        if (!isInitialized) {
            if (preferences.privacyOnStart) {
              setPrivacyMode(true);
            }
            setActiveView(preferences.startScreen as View || 'carteira');
            setIsInitialized(true);
        }
    }
  }, [isLocked, preferences.startScreen, isInitialized, preferences.privacyOnStart, setPrivacyMode]);
  
  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            lastVisibleTimestamp.current = Date.now();
        }
        if (document.visibilityState === 'visible' && preferences.appPin) {
            const timeInBackground = Date.now() - lastVisibleTimestamp.current;
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

  useEffect(() => {
    const checkMarketStatus = () => {
      const now = new Date();
      const spTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
      
      const day = spTime.getDay();
      const hour = spTime.getHours();
      const minute = spTime.getMinutes();
      
      const isWeekday = day >= 1 && day <= 5;
      const isOpenHours = (hour > 10 || (hour === 10 && minute >= 0)) && (hour < 17 || (hour === 17 && minute <= 55));
      
      setIsMarketOpen(isWeekday && isOpenHours);
    };

    checkMarketStatus();
    const interval = setInterval(checkMarketStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const navigateTo = (view: View) => {
    setPreviousView(activeView);
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
        return <PortfolioView setActiveView={navigateTo} setTransactionFilter={setTransactionFilter} onSelectAsset={handleSelectAsset} addToast={addToast} />;
      case 'transacoes':
        return <TransactionsView initialFilter={transactionFilter} clearFilter={() => setTransactionFilter(null)} addToast={addToast} />;
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
        return <PortfolioView setActiveView={navigateTo} setTransactionFilter={setTransactionFilter} onSelectAsset={handleSelectAsset} addToast={addToast} />;
    }
  };

  if (isLocked && preferences.appPin) {
      const biometricsEnabled = localStorage.getItem('security-biometrics') === 'true';
      return (
        <Suspense fallback={null}>
            <PinLockScreen correctPin={preferences.appPin} onUnlock={() => setIsLocked(false)} allowBiometrics={biometricsEnabled} />
        </Suspense>
      );
  }

  const isNavVisible = !['assetDetail', 'notificacoes'].includes(activeView);
  const isPremium = preferences.visualStyle === 'premium';

  return (
    <div className="bg-[var(--bg-primary)] min-h-screen font-sans text-[var(--text-primary)] transition-colors duration-300 flex flex-col md:flex-row overflow-hidden mobile-landscape-layout selection:bg-[var(--accent-color)] selection:text-[var(--accent-color-text)]">
       <OfflineBanner />
       
       <aside className={`hidden md:flex flex-col w-64 xl:w-72 flex-shrink-0 z-20 mobile-landscape-sidebar transition-all duration-300
            ${isPremium 
                ? 'bg-[var(--bg-secondary)] rounded-3xl m-4 h-[calc(100vh-2rem)]' 
                : 'bg-[var(--bg-secondary)] border-r border-[var(--border-color)] h-screen'}`
       }>
          <div className={`p-6 flex items-center gap-3 sidebar-title mb-2 ${isPremium ? '' : 'pt-8'}`}>
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-color)] to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
             </div>
             <div>
                 <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">Invest</h1>
                 <p className="text-[10px] text-[var(--text-secondary)] font-bold tracking-[0.2em] uppercase">Portfolio</p>
             </div>
          </div>
          
          <nav className="flex-1 px-4 space-y-2 overflow-y-auto py-2 custom-scrollbar">
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

          <div className={`p-4 ${isPremium ? '' : 'border-t border-[var(--border-color)]'}`}>
              <div className="bg-[var(--bg-tertiary-hover)]/50 rounded-xl p-3 flex items-center gap-3 backdrop-blur-md border border-[var(--border-color)]/50">
                  <div className={`w-2.5 h-2.5 rounded-full ${isMarketOpen ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]'}`}></div>
                  <span className={`text-xs font-bold ${isMarketOpen ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                      {isMarketOpen ? 'Mercado Aberto' : 'Mercado Fechado'}
                  </span>
              </div>
          </div>
       </aside>

       <main className="flex-1 h-screen relative flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-hidden bg-[var(--bg-primary)] relative">
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                  <div className="view-container h-full animate-subtle-fade-in" key={activeView}>
                    {renderView()}
                  </div>
              </Suspense>
            </ErrorBoundary>
          </div>
          
          <div className="md:hidden mobile-landscape-bottom-nav">
             {isNavVisible && <BottomNav activeView={activeView} setActiveView={navigateTo} />}
          </div>
       </main>

       {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;