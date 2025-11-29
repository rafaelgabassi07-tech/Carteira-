import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import OfflineBanner from './components/OfflineBanner';
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import type { ToastMessage, MinimalTransaction } from './types';
import { usePortfolio } from './contexts/PortfolioContext';
import { useI18n } from './contexts/I18nContext';
import { isLowEndDevice, urlSafeDecode } from './utils';
import type { MenuScreen } from './views/SettingsView';
import MainMenu from './components/settings/MainMenu';

// Lazy Load Views
const PortfolioView = React.lazy(() => import('./views/PortfolioView'));
const NewsView = React.lazy(() => import('./views/NewsView'));
const SettingsView = React.lazy(() => import('./views/SettingsView'));
const TransactionsView = React.lazy(() => import('./views/TransactionsView'));
const NotificationsView = React.lazy(() => import('./views/NotificationsView'));
const AnalysisView = React.lazy(() => import('./views/AnalysisView'));
const AssetDetailView = React.lazy(() => import('./views/AssetDetailView'));
const PinLockScreen = React.lazy(() => import('./components/PinLockScreen'));
const PublicPortfolioView = React.lazy(() => import('./views/PublicPortfolioView'));


export type View = 'dashboard' | 'carteira' | 'transacoes' | 'noticias' | 'settings' | 'notificacoes' | 'assetDetail';

const App: React.FC = () => {
  const { assets, preferences, marketDataError, setTheme, unreadNotificationsCount } = usePortfolio();
  const { t } = useI18n();
  const [activeView, setActiveView] = useState<View>(preferences.startScreen as View || 'dashboard');
  const [previousView, setPreviousView] = useState<View>('dashboard');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [transactionFilter, setTransactionFilter] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [settingsStartScreen, setSettingsStartScreen] = useState<MenuScreen>('main');
  const [isLocked, setIsLocked] = useState(!!preferences.appPin);
  const lastVisibleTimestamp = useRef(Date.now());
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [publicViewData, setPublicViewData] = useState<MinimalTransaction[] | null>(null);
  
  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info', action?: ToastMessage['action'], duration = 3000) => {
    const newToast: ToastMessage = { id: Date.now(), message, type, action, duration };
    setToast(newToast);
    if (duration > 0) {
        setTimeout(() => {
            setToast(t => (t?.id === newToast.id ? null : t));
        }, duration);
    }
  }, []);

  // Public View Router
  useEffect(() => {
    const handleHashChange = () => {
        const hash = window.location.hash;
        if (hash.startsWith('#view=')) {
            try {
                const encodedData = hash.substring(6);
                const decodedJson = urlSafeDecode(encodedData);
                const transactions = JSON.parse(decodedJson);
                if (Array.isArray(transactions)) {
                    setPublicViewData(transactions);
                }
            } catch (error) {
                console.error("Failed to parse public portfolio link:", error);
                window.location.hash = '';
                setPublicViewData(null);
            }
        } else {
            setPublicViewData(null);
        }
    };
    handleHashChange(); // Check on initial load
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Responsive & Theme Handlers
  useEffect(() => {
    const handleResize = () => {
      const isLandscape = window.innerWidth > window.innerHeight && window.innerWidth < 1024;
      setIsMobileLandscape(isLandscape);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
      case 'dashboard': return <PortfolioView setActiveView={handleSetView} onSelectAsset={handleSelectAsset} addToast={addToast} unreadNotificationsCount={unreadNotificationsCount} />;
      case 'noticias': return <NewsView addToast={addToast} />;
      case 'settings': return <SettingsView addToast={addToast} initialScreen={settingsStartScreen} />;
      case 'transacoes': return <TransactionsView initialFilter={transactionFilter} clearFilter={() => setTransactionFilter(null)} addToast={addToast} />;
      case 'notificacoes': return <NotificationsView setActiveView={handleSetView} onSelectAsset={handleSelectAsset} onOpenSettings={handleOpenSettingsScreen} />;
      case 'carteira': return <AnalysisView addToast={addToast} onSelectAsset={handleSelectAsset} />;
      case 'assetDetail': return selectedTicker ? <AssetDetailView ticker={selectedTicker} onBack={handleBackFromDetail} onViewTransactions={handleViewTransactionsForAsset} /> : <PortfolioView setActiveView={handleSetView} onSelectAsset={handleSelectAsset} addToast={addToast} unreadNotificationsCount={unreadNotificationsCount} />;
      default: return <PortfolioView setActiveView={handleSetView} onSelectAsset={handleSelectAsset} addToast={addToast} unreadNotificationsCount={unreadNotificationsCount} />;
    }
  };

  if (publicViewData) {
      return (
          <Suspense fallback={<LoadingSpinner />}>
              <PublicPortfolioView initialTransactions={publicViewData} />
          </Suspense>
      );
  }

  if (isLocked) {
      return <Suspense fallback={<LoadingSpinner />}><PinLockScreen onUnlock={() => setIsLocked(false)} correctPin={preferences.appPin!} allowBiometrics={!!localStorage.getItem('biometric-credential-id')} /></Suspense>;
  }

  return (
    <ErrorBoundary>
      <div className="h-screen w-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden grid grid-cols-1 lg:grid-cols-[var(--sidebar-width)_1fr] transition-all duration-300">
        
        <OfflineBanner />
        
        {/* Desktop Sidebar */}
        <div className="hidden lg:block h-full border-r border-[var(--border-color)] bg-[var(--bg-secondary)] z-20">
            <Sidebar activeView={activeView} setActiveView={handleSetView} />
        </div>

        {/* Mobile Landscape Sidebar (Conditional) */}
        {isMobileLandscape && (
            <div className="fixed left-0 top-0 bottom-0 w-64 z-30 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] overflow-y-auto">
                 <div className="p-4">
                    <MainMenu setScreen={(s) => { setActiveView('settings'); setSettingsStartScreen(s); }} addToast={addToast} />
                </div>
            </div>
        )}
        
        {/* Main Content */}
        <main className={`relative h-full w-full overflow-hidden flex flex-col ${isMobileLandscape ? 'pl-64' : ''}`}>
          <Suspense fallback={<LoadingSpinner />}>
            <div className="h-full w-full overflow-y-auto custom-scrollbar p-0 lg:p-8">
                <div className="mx-auto w-full max-w-[1600px]">
                    {renderView()}
                </div>
            </div>
          </Suspense>
        </main>
        
        {/* Mobile Bottom Nav (Hidden on LG) */}
        <div className={`lg:hidden z-40 ${isMobileLandscape ? 'hidden' : ''}`}>
           <BottomNav activeView={activeView} setActiveView={handleSetView} />
        </div>

        {toast && <Toast message={toast.message} type={toast.type} action={toast.action} onClose={() => setToast(null)} />}
      </div>
    </ErrorBoundary>
  );
};

export default App;