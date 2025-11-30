
import { useState, useEffect, Dispatch, SetStateAction, useRef } from 'react';
import type { Transaction, AppTheme, PortfolioEvolutionPoint, MonthlyIncome, Asset } from './types';

// --- Hook para estado persistente no localStorage com Debounce ---
// Otimização: Evita travar a UI escrevendo no disco a cada tecla digitada
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

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Cancela o timeout anterior se o estado mudar rapidamente
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Agenda a gravação no localStorage para daqui a 300ms
    // Isso evita que a UI trave se o estado mudar muito rápido (ex: digitando ou slider)
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
  if (typeof navigator !== 'undefined' && navigator.vibrate && window.matchMedia('(hover: none)').matches) { // Vibrate only on touch devices
    navigator.vibrate(pattern);
  }
};

// --- Hardware Detection for Performance ---
export const isLowEndDevice = (): boolean => {
    if (typeof navigator !== 'undefined') {
        // Se tiver menos de 4 núcleos ou pouca memória (se a API estiver disponível)
        if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
            return true;
        }
        // @ts-ignore - deviceMemory is non-standard but useful
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
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
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
    
    // 1. Set the data-theme attribute for broad CSS selectors
    root.dataset.theme = theme.type;

    // 2. Inject CSS Variables for Colors
    // We set both the HEX value (e.g. --bg-primary) and the RGB value (e.g. --bg-primary-rgb)
    // Tailwind uses the RGB value for opacity utilities: bg-[var(--bg-primary)]/50
    
    const setVar = (name: string, value: string) => {
        root.style.setProperty(`--${name}`, value);
        // Also set the RGB version for Tailwind opacity modifiers
        root.style.setProperty(`--${name}-rgb`, hexToRgb(value));
    };

    setVar('bg-primary', theme.colors.bgPrimary);
    setVar('bg-secondary', theme.colors.bgSecondary);
    setVar('bg-tertiary-hover', theme.colors.bgTertiary);
    setVar('text-primary', theme.colors.textPrimary);
    setVar('text-secondary', theme.colors.textSecondary);
    setVar('border-color', theme.colors.borderColor);
    setVar('accent-color', theme.colors.accentColor);
    
    // Special cases (might not need RGB for all)
    root.style.setProperty('--accent-color-text', theme.colors.accentText);
    root.style.setProperty('--green-text', theme.colors.greenText);
    root.style.setProperty('--red-text', theme.colors.redText);
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

    // Sort transactions by date (Oldest first) to calculate average price correctly
    const sortedTransactions = [...transactions].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        // If dates are equal, process Buy before Sell
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
            // Sell reduces quantity and totalCost proportionally based on average price
            const sellQuantity = Math.min(tx.quantity, position.quantity);
            
            if (position.quantity > EPSILON) {
                const avgPrice = position.totalCost / position.quantity;
                const costReduction = sellQuantity * avgPrice;
                
                position.totalCost -= costReduction;
                position.quantity -= sellQuantity;
            }
        }

        // Cleanup precision errors
        if (position.quantity < EPSILON) {
            position.quantity = 0;
            position.totalCost = 0;
        }
    }

    // Filter out closed positions
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
        else break; // Since history is sorted ascending
    }
    return closestPrice;
};

// --- Financial Calculations (Re-implemented for Reliability) ---

/**
 * Calculates the portfolio evolution (Invested vs Market Value) over time.
 * Cross-references daily history of prices with transaction history.
 */
export const calculatePortfolioEvolution = (
    transactions: Transaction[], 
    marketData: Record<string, any>,
    days: number = 30
): PortfolioEvolutionPoint[] => {
    if (transactions.length === 0) return [];

    const now = new Date();
    const dataPoints: PortfolioEvolutionPoint[] = [];
    
    // Sort transactions
    const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    
    // Determine start date
    const startDate = new Date();
    startDate.setDate(now.getDate() - days);
    
    for (let i = 0; i <= days; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateStr = toISODate(currentDate);
        
        let dailyInvested = 0;
        let dailyMarketValue = 0;
        
        // Calculate holdings for this specific day
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
        
        // Sum up values
        Object.keys(dailyHoldings).forEach(ticker => {
            const h = dailyHoldings[ticker];
            if (h.qty > EPSILON) {
                dailyInvested += h.qty * h.avgPrice;
                
                // Get price from history
                const assetData = marketData[ticker.toUpperCase()];
                if (assetData && assetData.priceHistory) {
                    const histPrice = getClosestPrice(assetData.priceHistory, dateStr);
                    dailyMarketValue += h.qty * (histPrice || assetData.currentPrice || h.avgPrice);
                } else {
                    // Fallback if no history
                    dailyMarketValue += h.qty * h.avgPrice; 
                }
            }
        });
        
        dataPoints.push({
            month: currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            invested: dailyInvested,
            marketValue: dailyMarketValue,
            cumulativeDividends: 0 // Not implemented in this simplified view
        });
    }
    
    return dataPoints;
};

/**
 * Calculates Monthly Income by merging manual dividends and API dividend history
 */
export const calculateDividendIncome = (
    transactions: Transaction[],
    marketData: Record<string, any>,
    manualDividends: any[] = [] // Future use
): MonthlyIncome[] => {
    const incomeMap: Record<string, number> = {};
    const holdingsAtDateCache: Record<string, Record<string, number>> = {}; // Date -> Ticker -> Qty

    // Helper to get holdings at a specific date
    const getHoldingsAtDate = (date: string, ticker: string): number => {
        if (holdingsAtDateCache[date] && holdingsAtDateCache[date][ticker] !== undefined) {
            return holdingsAtDateCache[date][ticker];
        }

        let qty = 0;
        for (const tx of transactions) {
            if (tx.ticker !== ticker) continue;
            if (tx.date > date) continue; // Transaction happened after ex-date
            
            if (tx.type === 'Compra') qty += tx.quantity;
            else qty -= tx.quantity;
        }
        
        if (!holdingsAtDateCache[date]) holdingsAtDateCache[date] = {};
        holdingsAtDateCache[date][ticker] = Math.max(0, qty);
        return Math.max(0, qty);
    };

    // Iterate over all assets in market data
    Object.entries(marketData).forEach(([ticker, data]) => {
        const history = data.dividendsHistory || [];
        history.forEach((div: any) => {
            // Check if user held the asset on Ex-Date
            const qtyOwned = getHoldingsAtDate(div.exDate, ticker);
            if (qtyOwned > 0) {
                const payDate = new Date(div.paymentDate);
                const monthKey = payDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                const total = qtyOwned * div.value;
                
                incomeMap[monthKey] = (incomeMap[monthKey] || 0) + total;
            }
        });
    });

    // Merge manual dividends (if any) - assuming manual dividends are already total amounts
    // (This part would need adjustment based on how manual dividends are stored in context)

    // Convert map to array and sort
    return Object.entries(incomeMap)
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => {
            const [mA, yA] = a.month.split('/');
            const [mB, yB] = b.month.split('/');
            // Basic sort logic for 'nov/23' format
            const dateA = new Date(`20${yA}-${mA}-01`); 
            const dateB = new Date(`20${yB}-${mB}-01`);
            return dateA.getTime() - dateB.getTime();
        })
        .slice(-12); // Last 12 months
};
