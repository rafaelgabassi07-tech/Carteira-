import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import type { Transaction } from './types';

// --- Hook para estado persistente no localStorage ---
export function usePersistentState<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue === null) {
        return defaultValue;
      }
      const parsedValue = JSON.parse(storedValue);
      // Ensure that a stored "null" value falls back to the default,
      // preventing crashes from expecting an object where null is found.
      return parsedValue !== null ? parsedValue : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, state]);

  return [state, setState];
}

// --- Função para feedback de vibração ---
export const vibrate = (pattern: number | number[] = 10) => { 
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
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

// --- Date Utilities (Timezone Safe) ---

// Returns "YYYY-MM-DD" for the current local date
export const getTodayISODate = (): string => {
    const now = new Date();
    return toISODate(now);
};

// Converts a Date object to "YYYY-MM-DD" string using local time
export const toISODate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Parses "YYYY-MM-DD" string to a Date object set to 12:00 PM local time to avoid rollover issues
export const fromISODate = (dateString: string): Date => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
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

            // Validate structure
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
            // If quota exceeded, try clearing old caches
            if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                 console.warn("Storage quota exceeded, clearing all caches...");
                 Object.keys(localStorage).forEach(k => {
                     if(k.startsWith('cache_')) localStorage.removeItem(k);
                 });
                 // Try setting again after cleanup
                 try {
                    localStorage.setItem(`cache_${key}`, JSON.stringify(item));
                 } catch(e) {}
            }
        }
    },
    
    clear: (key: string): void => {
        localStorage.removeItem(`cache_${key}`);
    }
};

const EPSILON = 0.000001; // For floating point comparisons

export const calculatePortfolioMetrics = (transactions: Transaction[]): Record<string, { quantity: number; totalCost: number }> => {
    const metrics: Record<string, { quantity: number; totalCost: number }> = {};
    const tickers = [...new Set(transactions.map(t => t.ticker))];

    tickers.forEach(ticker => {
        let quantity = 0;
        let totalCost = 0;

        transactions
            .filter(t => t.ticker === ticker)
            .sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                if (a.type === 'Compra' && b.type === 'Venda') return -1;
                if (a.type === 'Venda' && b.type === 'Compra') return 1;
                return 0;
            })
            .forEach(tx => {
                if (tx.type === 'Compra') {
                    const cost = (tx.quantity * tx.price) + (tx.costs || 0);
                    totalCost += cost;
                    quantity += tx.quantity;
                } else if (tx.type === 'Venda') {
                    const sellQuantity = Math.min(tx.quantity, quantity);
                    if (quantity > EPSILON) {
                        const avgPrice = totalCost / quantity;
                        const costReduction = sellQuantity * avgPrice;
                        totalCost -= costReduction;
                        quantity -= sellQuantity;
                    }
                }
                if (quantity < EPSILON) {
                    quantity = 0;
                    totalCost = 0;
                }
            });
        
        if (quantity > EPSILON) {
            metrics[ticker] = { quantity, totalCost };
        }
    });

    return metrics;
};

/**
 * Finds the price for a given date from a sorted price history.
 * If the exact date is not found, it returns the price of the most recent previous date.
 */
export const getClosestPrice = (history: { date: string; price: number }[], targetDate: string): number | null => {
    if (!history || history.length === 0) return null;

    // Use a binary search approach for efficiency if needed, but a simple loop is fine for typical history lengths.
    let closestPrice = null;
    for (const point of history) {
        if (point.date <= targetDate) {
            closestPrice = point.price;
        } else {
            // Since history is sorted, we can break early
            break;
        }
    }
    return closestPrice;
};
