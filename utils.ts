
import { useState, useEffect, Dispatch, SetStateAction, useRef } from 'react';
import type { Transaction, AppTheme, PortfolioEvolutionPoint, MonthlyIncome, Asset } from './types';

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

export const getClosestPrice = (history: { date: string; price: number }[], targetDate: string): number | null => {
    if (!history || history.length === 0) return null;
    if (targetDate < history[0].date) return history[0].price;
    let closestPrice = null;
    for (const point of history) {
        if (point.date <= targetDate) closestPrice = point.price;
        else break; 
    }
    return closestPrice;
};

export const calculatePortfolioEvolution = (
    transactions: Transaction[], 
    marketData: Record<string, any>,
    days: number = 30
): PortfolioEvolutionPoint[] => {
    if (transactions.length === 0) return [];

    const now = new Date();
    const dataPoints: PortfolioEvolutionPoint[] = [];
    const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    const startDate = new Date();
    startDate.setDate(now.getDate() - days);
    
    for (let i = 0; i <= days; i++) {
        const currentDate = new Date(startDate.getTime());
        currentDate.setDate(startDate.getDate() + i);
        const dateStr = toISODate(currentDate);
        
        let dailyInvested = 0;
        let dailyMarketValue = 0;
        const dailyHoldings: Record<string, { qty: number, avgPrice: number }> = {};
        
        for (const tx of sortedTx) {
            if (tx.date > dateStr) break;
            
            if (!dailyHoldings[tx.ticker]) dailyHoldings[tx.ticker] = { qty: 0, avgPrice: 0 };
            const h = dailyHoldings[tx.ticker];
            
            if (tx.type === 'Compra') {
                const cost = tx.quantity * tx.price + (tx.costs || 0);
                const totalCost = (h.qty * h.avgPrice) + cost;
                h.qty += tx.quantity;
                h.avgPrice = h.qty > 0 ? totalCost / h.qty : 0;
            } else {
                h.qty -= tx.quantity;
                if (h.qty < EPSILON) { h.qty = 0; h.avgPrice = 0; }
            }
        }
        
        Object.keys(dailyHoldings).forEach(ticker => {
            const h = dailyHoldings[ticker];
            if (h.qty > EPSILON) {
                dailyInvested += h.qty * h.avgPrice;
                const assetData = marketData[ticker.toUpperCase()];
                if (assetData && assetData.priceHistory) {
                    const histPrice = getClosestPrice(assetData.priceHistory, dateStr);
                    dailyMarketValue += h.qty * (histPrice || assetData.currentPrice || h.avgPrice);
                } else {
                    dailyMarketValue += h.qty * h.avgPrice; 
                }
            }
        });
        
        dataPoints.push({
            month: currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            invested: dailyInvested,
            marketValue: dailyMarketValue,
            cumulativeDividends: 0
        });
    }
    return dataPoints;
};

/**
 * Calculates Monthly Income by merging manual dividends and API dividend history.
 * FIXED: Uses string manipulation for Date grouping to avoid Timezone offsets.
 * E.g., '2023-11-01' stays November regardless of being in UTC-3.
 */
export const calculateDividendIncome = (
    transactions: Transaction[],
    marketData: Record<string, any>,
    manualDividends: any[] = [] // Future use
): MonthlyIncome[] => {
    const incomeMap: Record<string, number> = {}; // Key: "YYYY-MM"
    const holdingsAtDateCache: Record<string, Record<string, number>> = {}; // Date -> Ticker -> Qty

    // 1. Normalize transactions ticker casing once for performance
    const normalizedTransactions = transactions.map(t => ({
        ...t,
        ticker: t.ticker.toUpperCase().trim()
    }));

    // Helper to get holdings at a specific date (Data Com)
    const getHoldingsAtDate = (date: string, ticker: string): number => {
        const normalizedTicker = ticker.toUpperCase().trim();
        
        if (holdingsAtDateCache[date] && holdingsAtDateCache[date][normalizedTicker] !== undefined) {
            return holdingsAtDateCache[date][normalizedTicker];
        }

        let qty = 0;
        // Calculate holdings by replaying history up to that date
        for (const tx of normalizedTransactions) {
            if (tx.ticker !== normalizedTicker) continue;
            // IMPORTANT: logic is tx.date <= exDate (Data Com). 
            // If you bought ON the Data Com, you get the dividend.
            // If the API sends "Data Ex", we should theoretically use < date.
            // Assuming Brapi sends standard Ex-Date or Data Com, simple comparison is usually sufficient for historical agg.
            if (tx.date > date) continue; 
            
            if (tx.type === 'Compra') qty += tx.quantity;
            else qty -= tx.quantity;
        }
        
        if (!holdingsAtDateCache[date]) holdingsAtDateCache[date] = {};
        holdingsAtDateCache[date][normalizedTicker] = Math.max(0, qty);
        return Math.max(0, qty);
    };

    // 2. Iterate over all assets in market data
    Object.entries(marketData).forEach(([ticker, data]) => {
        const history = data.dividendsHistory || [];
        const normalizedTicker = ticker.toUpperCase().trim();

        history.forEach((div: any) => {
            // Check if user held the asset on Ex-Date (Data Com)
            const qtyOwned = getHoldingsAtDate(div.exDate, normalizedTicker);
            
            if (qtyOwned > 0) {
                // Safe date grouping: Split the string directly.
                // Format expected: YYYY-MM-DD
                let sortKey = '';
                if (typeof div.paymentDate === 'string' && div.paymentDate.length >= 7) {
                    // Extract "YYYY-MM" directly from string
                    sortKey = div.paymentDate.substring(0, 7); 
                } else {
                    // Fallback just in case, though unlikely with Brapi
                    const d = new Date(div.paymentDate);
                    const y = d.getUTCFullYear();
                    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                    sortKey = `${y}-${m}`;
                }
                
                const total = qtyOwned * div.value;
                incomeMap[sortKey] = (incomeMap[sortKey] || 0) + total;
            }
        });
    });

    // 3. Convert map to sorted array and format display label consistently
    return Object.entries(incomeMap)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sort by YYYY-MM string
        .map(([key, total]) => {
            const [year, month] = key.split('-');
            
            const monthNames = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
            const monthIndex = parseInt(month) - 1;
            const monthName = monthNames[monthIndex] || month;
            const shortYear = year.slice(2);
            
            return {
                month: `${monthName}/${shortYear}`, 
                total
            };
        })
        .slice(-12); // Last 12 months
};
