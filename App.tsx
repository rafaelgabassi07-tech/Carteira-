
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
const SettingsView = React.lazy(() => import('./views/SettingsView'));
const NotificationsView = React.lazy(() => import('./views/NotificationsView'));
const AnalysisView = React.lazy(() => import('./views/AnalysisView'));
const AssetDetailView = React.lazy(() => import('./views/AssetDetailView'));
const MarketView = React.lazy(() => import('./views/MarketView'));
const IncomeReportView = React.lazy(() => import('./views/IncomeReportView'));
const PinLockScreen = React.lazy(() => import('./components/PinLockScreen'));


export type View = 'carteira' | 'mercado' | 'settings' | 'notificacoes' | 'assetDetail' | 'incomeReport' | 'dashboard' | 'transacoes';

const App: React.FC = () => {
  const { preferences, marketDataError, setTheme, unreadNotificationsCount } = usePortfolio();
  const { t } = useI18n();
  
  const startScreen = preferences.startScreen === 'mercado' ? 'mercado' : 'carteira';
  const [activeView, setActiveView] = useState<View>(startScreen as View);
  const [previousView, setPreviousView] = useState<View>('carteira');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [transactionFilter, setTransactionFilter] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [settingsStartScreen, setSettingsStartScreen] = useState<MenuScreen>('main');
  const [isLocked, setIsLocked] = useState(!!preferences.appPin);
  const lastVisibleTimestamp = useRef(Date.now());
  
  // PWA Deep Linking & Share Target Handler
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const shareParam = params.get('share_q'); // From Share Target

      if (shareParam) {
          // If receiving shared text, go to Market
          setActiveView('mercado');
      } else if (viewParam && ['carteira', 'settings', 'mercado'].includes(viewParam)) {
          // If coming from Shortcut
          setActiveView(viewParam as View);
          if (viewParam === 'transacoes') {
              // Legacy support: redirect to carteira with transactions tab
              setActiveView('carteira');
          }
      }
  }, []);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info', action?: ToastMessage['action'], duration = 4000) => {
    const newToast: ToastMessage = { id: Date.now(), message, type, action, duration };
    setToast(newToast);
    if (duration > 0) {
        setTimeout(() => {
            setToast(t => (t?.id === newToast.id ? null : t));
        }, duration);
    }
  }, []);

  useEffect(() => {
    if (marketDataError) {
        addToast(marketDataError, 'error');
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
    // Clear transaction filter when leaving/changing views if needed, 
    // but we might want to persist it if we go back to wallet.
    // For now, let's keep it simple.
  };
  
  const handleSelectAsset = (ticker: string) => {
    setSelectedTicker(ticker);
    handleSetView('assetDetail');
  };
  
  const handleBackFromDetail = () => handleSetView(previousView);

  const handleViewTransactionsForAsset = (ticker: string) => {
    setTransactionFilter(ticker);
    handleSetView('carteira'); // Now transactions are inside carteira
  };
  
  const handleOpenSettingsScreen = (screen: MenuScreen) => {
      setSettingsStartScreen(screen);
      handleSetView('settings');
  }

  const renderView = () => {
    switch (activeView) {
      case 'settings': return <SettingsView addToast={addToast} initialScreen={settingsStartScreen} />;
      case 'notificacoes': return <NotificationsView setActiveView={handleSetView} onSelectAsset={handleSelectAsset} onOpenSettings={handleOpenSettingsScreen} />;
      case 'carteira': 
      case 'dashboard':
        return <AnalysisView addToast={addToast} onSelectAsset={handleSelectAsset} unreadNotificationsCount={unreadNotificationsCount} setActiveView={handleSetView} initialTransactionFilter={transactionFilter} clearTransactionFilter={() => setTransactionFilter(null)} />;
      case 'transacoes':
        return <AnalysisView addToast={addToast} onSelectAsset={handleSelectAsset} unreadNotificationsCount={unreadNotificationsCount} setActiveView={handleSetView} initialTab='transactions' />;
      case 'mercado': return <MarketView addToast={addToast} />;
      case 'assetDetail': return selectedTicker ? <AssetDetailView ticker={selectedTicker} onBack={handleBackFromDetail} onViewTransactions={handleViewTransactionsForAsset} addToast={addToast} /> : <AnalysisView addToast={addToast} onSelectAsset={handleSelectAsset} unreadNotificationsCount={unreadNotificationsCount} setActiveView={handleSetView} />;
      case 'incomeReport': return <IncomeReportView onBack={handleBackFromDetail} />;
      default: return <AnalysisView addToast={addToast} onSelectAsset={handleSelectAsset} unreadNotificationsCount={unreadNotificationsCount} setActiveView={handleSetView} />;
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
            <main className="flex-1 relative w-full h-full flex flex-col min-w-0 overflow-hidden">
                <div className="flex-1 relative h-full w-full">
                    <Suspense fallback={<LoadingSpinner />}>
                        <div key={activeView} className="h-full w-full">
                            {renderView()}
                        </div>
                    </Suspense>
                </div>
                
                {/* Floating Bottom Nav - Visible on all screens */}
                <div>
                    <BottomNav activeView={activeView} setActiveView={handleSetView} />
                </div>
            </main>

            {toast && <Toast message={toast.message} type={toast.type} action={toast.action} onClose={() => setToast(null)} />}
        </div>
    </ErrorBoundary>
  );
};

export default App;
