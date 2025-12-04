import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './contexts/I18nContext';
import { PortfolioProvider } from './contexts/PortfolioContext';
import { OnlineStatusProvider } from './contexts/OnlineStatusContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <OnlineStatusProvider>
      <I18nProvider>
        <PortfolioProvider>
          <App />
        </PortfolioProvider>
      </I18nProvider>
    </OnlineStatusProvider>
  </React.StrictMode>
);