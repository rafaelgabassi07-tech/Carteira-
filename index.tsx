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

// --- Definitive Service Worker Path ---
// In sandboxed environments, window.location can be unreliable.
// import.meta.url provides the true URL of the current module.
let swUrl = './sw.js'; // Fallback
try {
    const baseUrl = new URL('.', import.meta.url).href;
    swUrl = new URL('sw.js', baseUrl).href;
} catch (e) {
    console.warn('Could not determine absolute SW path, falling back to relative.', e);
}
// ---

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <OnlineStatusProvider>
      <I18nProvider>
        <PortfolioProvider>
          <App swUrl={swUrl} />
        </PortfolioProvider>
      </I18nProvider>
    </OnlineStatusProvider>
  </React.StrictMode>
);
