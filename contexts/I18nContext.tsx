import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import type { Locale } from '../types';
import { translations } from '../i18n/idiomas';

export interface I18nContextType {
  locale: Locale;
  t: (key: string, options?: { [key: string]: string | number }) => string;
  formatCurrency: (value: number) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const locale: Locale = 'pt-BR';

  const t = useCallback((key: string, options?: { [key: string]: string | number }) => {
    const lang = translations['pt-BR'];
    let translation = lang[key as keyof typeof lang] || key;
    if (options) {
      Object.keys(options).forEach(optionKey => {
        translation = translation.replace(`{{${optionKey}}}`, String(options[optionKey]));
      });
    }
    return translation;
  }, []);

  const formatCurrency = useCallback((value: number) => {
    const options = {
      style: 'currency',
      currency: 'BRL',
    };
    return value.toLocaleString('pt-BR', options);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, t, formatCurrency }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};