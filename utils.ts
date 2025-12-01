
import { useState, useEffect, Dispatch, SetStateAction, useRef } from 'react';
import type { Transaction, AppTheme, Asset, PortfolioEvolutionPoint } from './types';

// --- Hook para estado persistente no localStorage com Debounce ---
export function usePersistentState<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue === null) {
        return defaultValue;
      }
      const parsedValue = JSON.parse(storedValue);
      return parsedValue !== null ? parsedValue : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      return defaultValue;
    }
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.error(`Error setting localStorage key “${key}”:`, error);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [key, state]);

  return [state, setState];
}

// --- Função para feedback de vibração ---
export const vibrate = (pattern: number | number[] = 10) => { 
  if (typeof navigator !== 'undefined' && navigator.vibrate && window.matchMedia('(hover: none)').matches) { 
    navigator.vibrate(pattern);
  }
};

// --- Hardware Detection for Performance ---
export const isLowEndDevice = (): boolean => {
    if (typeof navigator !== 'undefined') {
        if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
            return true;
        }
        // @ts-ignore
        if (navigator.deviceMemory && navigator.deviceMemory < 4) {
            return true;
        }
    }
    return false;
};

// --- Debounce Utility ---
export function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
    let timeout: ReturnType<typeof setTimeout>;
    return ((...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    }) as T;
}

// --- Copy to Clipboard ---
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (!navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    vibrate([5, 30]);
    return true;
  } catch (err) {
    return false;
  }
};

// --- Theme Engine Utilities ---

const hexToRgb = (hex: string): string => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
        `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` 
        : '0, 0, 0';
}

export const applyThemeToDocument = (theme: AppTheme) => {
    if (!document) return;
    const root = document.documentElement;
    root.dataset.theme = theme.type;
    
    const setVar = (name: string, value: string) => {
        root.style.setProperty(`--${name}`, value);
        root.style.setProperty(`--${name}-rgb`, hexToRgb(value));
    };

    setVar('bg-primary', theme.colors.bgPrimary);
    setVar('bg-secondary', theme.colors.bgSecondary);
    setVar('bg-tertiary-hover', theme.colors.bgTertiary);
    setVar('text-primary', theme.colors.textPrimary);
    setVar('text-secondary', theme.colors.textSecondary);
    setVar('border-color', theme.colors.borderColor);
    setVar('accent-color', theme.colors.accentColor);
    root.style.setProperty('--accent-color-text', theme.colors.accentText);
    root.style.setProperty('--green-text', theme.colors.greenText);
    root.style.setProperty('--red-text', theme.colors.redText);
};


// --- Date Utilities (Timezone Safe) ---

export const getTodayISODate = (): string => {
    const now = new Date();
    return toISODate(now);
};

export const toISODate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const fromISODate = (dateString: string): Date => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
};

// --- WebAuthn Buffer Encoding/Decoding for Biometrics ---
export const bufferEncode = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

export const bufferDecode = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

// --- Sistema de Cache ---
interface CacheItem<T> {
    data: T;
    timestamp: number;
}

export const CacheManager = {
    get: <T>(key: string, ttl: number): T | null => {
        try {
            const itemStr = localStorage.getItem(`cache_${key}`);
            if (!itemStr) return null;

            const item: CacheItem<T> = JSON.parse(itemStr);
            const now = Date.now();

            if (!item || typeof item.timestamp !== 'number' || item.data === undefined) {
                localStorage.removeItem(`cache_${key}`);
                return null;
            }

            if (now - item.timestamp > ttl) {
                localStorage.removeItem(`cache_${key}`);
                return null;
            }

            return item.data;
        } catch (error) {
            console.warn("Cache corrupted or invalid, clearing:", key);
            localStorage.removeItem(`cache_${key}`); 
            return null;
        }
    },

    set: <T>(key: string, data: T): void => {
        const item: CacheItem<T> = {
            data,
            timestamp: Date.now(),
        };
        try {
            localStorage.setItem(`cache_${key}`, JSON.stringify(item));
        } catch (error) {
            console.error("Error setting cache:", error);
        }
    },
    
    clear: (key: string): void => {
        localStorage.removeItem(`cache_${key}`);
    }
};

const EPSILON = 0.000001;

export const calculatePortfolioMetrics = (transactions: Transaction[]): Record<string, { quantity: number; totalCost: number }> => {
    const metrics: Record<string, { quantity: number; totalCost: number }> = {};

    // Clone to avoid mutating original array if sort is in place (though toSorted is better, sticking to compatibility)
    const sortedTransactions = [...transactions].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.type === 'Compra' && b.type === 'Venda') return -1;
        if (a.type === 'Venda' && b.type === 'Compra') return 1;
        return 0;
    });

    for (const tx of sortedTransactions) {
        const ticker = tx.ticker;
        if (!metrics[ticker]) {
            metrics[ticker] = { quantity: 0, totalCost: 0 };
        }
        const position = metrics[ticker];

        if (tx.type === 'Compra') {
            const cost = (tx.quantity * tx.price) + (tx.costs || 0);
            position.totalCost += cost;
            position.quantity += tx.quantity;
        } else if (tx.type === 'Venda') {
            const sellQuantity = Math.min(tx.quantity, position.quantity);
            if (position.quantity > EPSILON) {
                const avgPrice = position.totalCost / position.quantity;
                position.totalCost -= sellQuantity * avgPrice;
                position.quantity -= sellQuantity;
            }
        }
        
        if (position.quantity < EPSILON) {
            position.quantity = 0;
            position.totalCost = 0;
        }
    }
    
    const activeMetrics: Record<string, { quantity: number; totalCost: number }> = {};
    for (const [ticker, data] of Object.entries(metrics)) {
        if (data.quantity > EPSILON) {
            activeMetrics[ticker] = data;
        }
    }
    return activeMetrics;
};

// --- Optimized Portfolio Evolution Calculation ---
export const calculatePortfolioEvolution = (transactions: Transaction[], marketData: Record<string, any>): Record<string, PortfolioEvolutionPoint[]> => {
    if (transactions.length === 0) return { all_types: [] };

    const sortedTxs = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = new Date(sortedTxs[0].date);
    const today = new Date();
    
    // Normalize time to midnight
    const current = new Date(firstDate);
    current.setHours(0,0,0,0);
    today.setHours(0,0,0,0);

    const points: PortfolioEvolutionPoint[] = [];
    const currentHoldings: Record<string, { quantity: number, totalCost: number }> = {};
    const lastPrices: Record<string, number> = {};
    
    // Performance Optimization: Pre-process Market Data into Hash Maps
    // Transforms O(Days * Tickers * History) into O(Days * Tickers)
    const priceCache: Record<string, Map<string, number>> = {};
    Object.keys(marketData).forEach(ticker => {
        const history = marketData[ticker]?.priceHistory || [];
        const map = new Map<string, number>();
        history.forEach((h: any) => map.set(h.date, h.price));
        priceCache[ticker] = map;
    });

    let txIndex = 0;
    let loops = 0;

    // Iterate day by day from first transaction to today
    while (current <= today && loops < 10000) {
        loops++;
        const dateISO = toISODate(current);
        const monthStr = current.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

        // Apply transactions happening on this day
        while (txIndex < sortedTxs.length && sortedTxs[txIndex].date <= dateISO) {
            const tx = sortedTxs[txIndex];
            const tkr = tx.ticker.toUpperCase();
            if (!currentHoldings[tkr]) currentHoldings[tkr] = { quantity: 0, totalCost: 0 };
            
            if (tx.type === 'Compra') {
                currentHoldings[tkr].quantity += tx.quantity;
                currentHoldings[tkr].totalCost += (tx.quantity * tx.price) + (tx.costs || 0);
            } else {
                // Venda: reduce cost proportionally
                const h = currentHoldings[tkr];
                if (h.quantity > 0) {
                    const avg = h.totalCost / h.quantity;
                    h.quantity -= tx.quantity;
                    h.totalCost -= tx.quantity * avg;
                }
            }
            txIndex++;
        }

        let invested = 0;
        let marketValue = 0;

        for (const tkr in currentHoldings) {
            const h = currentHoldings[tkr];
            if (h.quantity > EPSILON) {
                invested += h.totalCost;
                
                // Get price from O(1) cache
                const cachedPrice = priceCache[tkr]?.get(dateISO);
                
                if (cachedPrice !== undefined) {
                    lastPrices[tkr] = cachedPrice;
                }
                
                // Fallback to last known price (Carry Forward) or Avg Price if no history
                const priceToUse = lastPrices[tkr] || (h.totalCost / h.quantity);
                
                marketValue += h.quantity * priceToUse;
            }
        }

        if (invested > 0) {
            points.push({
                dateISO,
                month: monthStr,
                invested,
                marketValue
            });
        }

        current.setDate(current.getDate() + 1);
    }

    return { all_types: points };
};
