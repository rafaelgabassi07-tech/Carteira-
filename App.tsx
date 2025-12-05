

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import BottomNav from './components/BottomNav';
import OfflineBanner from './components/OfflineBanner';
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import type { ToastMessage } from './types';
import { usePortfolio } from './contexts/PortfolioContext';
import { useI18n } from './contexts/I18nContext';
import { isLowEndDevice } from './utils';
import type { MenuScreen } from './views/SettingsView';

// Lazy Load Views
const PortfolioView = React.lazy(() => import('./views/PortfolioView'));
const NewsView = React.lazy(() => import('./views/NewsView'));
const SettingsView = React.lazy(() => import('./views/SettingsView'));
const TransactionsView = React.lazy(() => import('./views/TransactionsView'));
const NotificationsView = React.lazy(() => import('./views/NotificationsView'));
const AssetDetailView = React.lazy(() => import('./views/AssetDetailView'));
const MarketView = React.lazy(() => import('./views/MarketView'));
const PinLockScreen = React.lazy(() => import('./components/PinLockScreen'));

export type View = 'dashboard' | 'transacoes' | 'noticias' | 'settings' | 'notificacoes' | 'assetDetail' | 'mercado';

const App: React.FC = () => {
  const { preferences, marketDataError, setTheme, unreadNotificationsCount } = usePortfolio();
  const { t } = useI18n();
  const [activeView, setActiveView] = useState<View>(preferences.startScreen as View || 'dashboard');
  const [previousView, setPreviousView] = useState<View>('dashboard');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [transactionFilter, setTransactionFilter] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [settingsStartScreen, setSettingsStartScreen] = useState<MenuScreen>('main');
  const [isLocked, setIsLocked] = useState(!!preferences.appPin);
  const lastVisibleTimestamp = useRef(Date.now());
  
  // --- PWA Update Logic (Simplified for Automatic Updates) ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker registered successfully.');
            }).catch(error => {
                console.error('Service Worker registration failed:', error);
            });

        // This listener fires when the new service worker has taken control.
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                window.location.reload();
                refreshing = true;
            }
        });
    }
  }, []);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info', action?: ToastMessage['action'], duration = 3000) => {
    const newToast: ToastMessage = { id: Date.now(), message, type, action, duration };
    setToast(newToast);
    if (duration > 0) {
        setTimeout(() => {
            setToast(t => (t?.id === newToast.id ? null : t));
        }, duration);
    }
  }, []);

  // --- End PWA Update Logic ---
  
  // PWA Deep Linking & Share Target Handler
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const shareParam = params.get('share_q'); // From Share Target

      if (shareParam) {
          // If receiving shared text, go to Market
          setActiveView('mercado');
      } else if (viewParam && ['dashboard', 'transacoes', 'noticias', 'settings', 'mercado'].includes(viewParam)) {
          // If coming from Shortcut
          setActiveView(viewParam as View);
      }
  }, []);

  useEffect(() => {
    if (marketDataError && !marketDataError.includes("Chave de API")) {
        if (marketDataError.includes("Falha") || marketDataError.includes("Token")) {
             addToast(marketDataError, 'error');
        }
    }
  }, [marketDataError, addToast]);
  
  useEffect(() => {
    const applyTheme = () => {
        let themeToApply = preferences.systemTheme;
        if (preferences.systemTheme === 'system') {
            themeToApply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.dataset.theme = themeToApply;
    };
    applyTheme();
    
    const visualStyle = (isLowEndDevice() && preferences.visualStyle === 'premium') ? 'simple' : preferences.visualStyle;
    document.documentElement.dataset.style = visualStyle;
    document.documentElement.classList.toggle('compact', preferences.compactMode);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [preferences.systemTheme, preferences.visualStyle, preferences.compactMode, setTheme]);

  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            if (preferences.appPin && (Date.now() - lastVisibleTimestamp.current > 60000)) {
                setIsLocked(true);
            }
        } else {
            lastVisibleTimestamp.current = Date.now();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [preferences.appPin]);

  // Navigation Handlers
  const handleSetView = (view: View) => {
    setPreviousView(activeView);
    setActiveView(view);
    if(view === 'transacoes') setTransactionFilter(null);
  };
  
  const handleSelectAsset = (ticker: string) => {
    setSelectedTicker(ticker);
    handleSetView('assetDetail');
  };
  
  const handleBackFromDetail = () => handleSetView(previousView);

  const handleViewTransactionsForAsset = (ticker: string) => {
    setTransactionFilter(ticker);
    handleSetView('transacoes');
  };
  
  const handleOpenSettingsScreen = (screen: MenuScreen) => {
      setSettingsStartScreen(screen);
      handleSetView('settings');
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <PortfolioView setActiveView={handleSetView} setTransactionFilter={setTransactionFilter} onSelectAsset={handleSelectAsset} addToast={addToast} unreadNotificationsCount={unreadNotificationsCount} />;
      case 'mercado': return <MarketView addToast={addToast} />;
      case 'noticias': return <NewsView addToast={addToast} />;
      case 'settings': return <SettingsView addToast={addToast} initialScreen={settingsStartScreen} />;
      case 'transacoes': return <TransactionsView initialFilter={transactionFilter} clearFilter={() => setTransactionFilter(null)} addToast={addToast} />;
      case 'notificacoes': return <NotificationsView setActiveView={handleSetView} onSelectAsset={handleSelectAsset} onOpenSettings={handleOpenSettingsScreen} />;
      case 'assetDetail': return selectedTicker ? <AssetDetailView ticker={selectedTicker} onBack={handleBackFromDetail} onViewTransactions={handleViewTransactionsForAsset} /> : <PortfolioView setActiveView={handleSetView} setTransactionFilter={setTransactionFilter} onSelectAsset={handleSelectAsset} addToast={addToast} />;
      default: return <PortfolioView setActiveView={handleSetView} setTransactionFilter={setTransactionFilter} onSelectAsset={handleSelectAsset} addToast={addToast} />;
    }
  };

  if (isLocked) {
      return <Suspense fallback={<LoadingSpinner />}><PinLockScreen onUnlock={() => setIsLocked(false)} correctPin={preferences.appPin!} allowBiometrics={!!localStorage.getItem('biometric-credential-id')} /></Suspense>;
  }

  return (
    <ErrorBoundary>
        <div className="h-[100dvh] w-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden relative transition-colors duration-300">
            <OfflineBanner />
            
            {/* Main Content Area */}
            <main className="flex-1 relative w-full h-full flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    <Suspense fallback={<LoadingSpinner />}>
                        <div key={activeView} className="animate-page-enter h-full w-full">
                            {renderView()}
                        </div>
                    </Suspense>
                </div>
            </main>

            {/* Floating Bottom Nav - Visible on all screens */}
            <BottomNav 
                activeView={activeView} 
                setActiveView={handleSetView}
            />

            {toast && <Toast message={toast.message} type={toast.type} action={toast.action} onClose={() => setToast(null)} />}
        </div>
    </ErrorBoundary>
  );
};

export default App;