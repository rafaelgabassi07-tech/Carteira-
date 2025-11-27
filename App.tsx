
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
export type Theme = 'dark' | 'light';

const App: React.FC = () => {
  const { assets, preferences, marketDataError, setPrivacyMode, setTheme } = usePortfolio();
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

  useEffect(() => {
    const handleResize = () => {
      // Check specifically for mobile landscape (width > height but still small screen)
      const isLandscape = window.innerWidth > window.innerHeight && window.innerWidth < 1024;
      setIsMobileLandscape(isLandscape);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
  
  useEffect(() => {
    const applyTheme = () => {
        let themeToApply = preferences.systemTheme;
        if (preferences.systemTheme === 'system') {
            themeToApply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.dataset.theme = themeToApply;
    };
    applyTheme();
    
    // Auto-apply premium style if not low-end device
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
            const timeInBackground = Date.now() - lastVisibleTimestamp.current;
            if (preferences.appPin && timeInBackground > 60000) { // Lock after 1 minute
                setIsLocked(true);
            }
        } else {
            lastVisibleTimestamp.current = Date.now();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [preferences.appPin]);

  const handleSetView = (view: View) => {
    setPreviousView(activeView);
    setActiveView(view);
    if(view === 'transacoes') setTransactionFilter(null);
  };
  
  const handleSelectAsset = (ticker: string) => {
    setSelectedTicker(ticker);
    handleSetView('assetDetail');
  };
  
  const handleBackFromDetail = () => {
    handleSetView(previousView);
  };

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
      case 'analise': return <AnalysisView addToast={addToast} />;
      case 'assetDetail': return selectedTicker ? <AssetDetailView ticker={selectedTicker} onBack={handleBackFromDetail} onViewTransactions={handleViewTransactionsForAsset} /> : <PortfolioView setActiveView={handleSetView} onSelectAsset={handleSelectAsset} addToast={addToast} setTransactionFilter={setTransactionFilter} />;
      default: return <PortfolioView setActiveView={handleSetView} onSelectAsset={handleSelectAsset} addToast={addToast} setTransactionFilter={setTransactionFilter} />;
    }
  };

  if (isLocked) {
      return (
          <Suspense fallback={<LoadingSpinner />}>
             <PinLockScreen onUnlock={() => setIsLocked(false)} correctPin={preferences.appPin!} allowBiometrics={!!localStorage.getItem('biometric-credential-id')} />
          </Suspense>
      );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen w-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
        <OfflineBanner />
        
        {/* Desktop Sidebar (Visible only on LG+) */}
        <Sidebar activeView={activeView} setActiveView={handleSetView} />

        {/* Mobile Landscape Sidebar (Visible only on landscape mobile/tablet) */}
        {isMobileLandscape && (
            <div className="mobile-landscape-sidebar h-full overflow-y-auto bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex-shrink-0 w-64">
                 <div className="p-4">
                    <MainMenu 
                        setScreen={(s: MenuScreen) => {
                            setActiveView('settings');
                            setSettingsStartScreen(s);
                        }} 
                        addToast={addToast} 
                        activeScreen={activeView === 'settings' ? settingsStartScreen : undefined}
                        onShowUpdateModal={() => {}}
                    />
                </div>
            </div>
        )}
        
        {/* Main Content Area */}
        <main id="main-content" className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
          <Suspense fallback={<LoadingSpinner />}>
            <div className="h-full overflow-y-auto no-scrollbar lg:p-6 lg:max-w-6xl lg:mx-auto lg:w-full">
                {renderView()}
            </div>
          </Suspense>
        </main>
        
        {/* Mobile Bottom Nav (Hidden on LG+) */}
        <div className={`w-full max-w-md mx-auto z-40 ${isMobileLandscape ? 'hidden' : ''}`}>
           <BottomNav activeView={activeView} setActiveView={handleSetView} />
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </ErrorBoundary>
  );
};

export default App;
