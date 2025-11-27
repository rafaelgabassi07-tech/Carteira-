
import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import OfflineBanner from './components/OfflineBanner';
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import type { ToastMessage } from './types';
import { usePortfolio } from './contexts/PortfolioContext';
import { useI18n } from './contexts/I18nContext';
import { isLowEndDevice } from './utils';
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

export type View = 'carteira' | 'transacoes' | 'analise' | 'noticias' | 'settings' | 'notificacoes' | 'assetDetail';

const App: React.FC = () => {
  const { assets, preferences, marketDataError, setTheme } = usePortfolio();
  const { t } = useI18n();
  const [activeView, setActiveView] = useState<View>(preferences.startScreen as View || 'carteira');
  const [previousView, setPreviousView] = useState<View>('carteira');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [transactionFilter, setTransactionFilter] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [settingsStartScreen, setSettingsStartScreen] = useState<MenuScreen>('main');
  const [isLocked, setIsLocked] = useState(!!preferences.appPin);
  const lastVisibleTimestamp = useRef(Date.now());
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  
  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const newToast: ToastMessage = { id: Date.now(), message, type };
    setToast(newToast);
    setTimeout(() => {
      setToast(t => (t?.id === newToast.id ? null : t));
    }, 3000);
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
        // Clean error message or just show specific critical ones
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
      case 'carteira': return <PortfolioView setActiveView={handleSetView} onSelectAsset={handleSelectAsset} addToast={addToast} setTransactionFilter={setTransactionFilter} />;
      case 'noticias': return <NewsView addToast={addToast} />;
      case 'settings': return <SettingsView addToast={addToast} initialScreen={settingsStartScreen} />;
      case 'transacoes': return <TransactionsView initialFilter={transactionFilter} clearFilter={() => setTransactionFilter(null)} addToast={addToast} />;
      case 'notificacoes': return <NotificationsView setActiveView={handleSetView} onSelectAsset={handleSelectAsset} onOpenSettings={handleOpenSettingsScreen} />;
      case 'analise': return <AnalysisView addToast={addToast} onSelectAsset={handleSelectAsset} />;
      case 'assetDetail': return selectedTicker ? <AssetDetailView ticker={selectedTicker} onBack={handleBackFromDetail} onViewTransactions={handleViewTransactionsForAsset} /> : <PortfolioView setActiveView={handleSetView} onSelectAsset={handleSelectAsset} addToast={addToast} setTransactionFilter={setTransactionFilter} />;
      default: return <PortfolioView setActiveView={handleSetView} onSelectAsset={handleSelectAsset} addToast={addToast} setTransactionFilter={setTransactionFilter} />;
    }
  };

  if (isLocked) {
      return <Suspense fallback={<LoadingSpinner />}><PinLockScreen onUnlock={() => setIsLocked(false)} correctPin={preferences.appPin!} allowBiometrics={!!localStorage.getItem('biometric-credential-id')} /></Suspense>;
  }

  // CSS Grid Layout ensures Desktop Sidebar is respected properly
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
                    <MainMenu setScreen={(s) => { setActiveView('settings'); setSettingsStartScreen(s); }} addToast={addToast} onShowUpdateModal={() => {}} />
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

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </ErrorBoundary>
  );
};

export default App;
