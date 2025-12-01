
import { useState, useEffect, Dispatch, SetStateAction, useRef } from 'react';
import type { Transaction, AppTheme, PortfolioEvolutionPoint, MonthlyIncome, Asset, DividendHistoryEvent, PortfolioSnapshot } from './types';

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

// Helper to find closest price in history before or at target date
export const getClosestPrice = (history: { date: string; price: number }[], targetDate: string): number | null => {
    if (!history || history.length === 0) return null;
    
    // Sort just in case
    // Note: Assuming history is usually sorted, but let's be safe or rely on caller
    // Ideally do a reverse search since we want the latest price <= targetDate
    
    let bestPrice = null;
    let bestDate = '';

    for (const point of history) {
        if (point.date <= targetDate) {
            // Found a candidate, keep updating until we surpass targetDate
            if (!bestDate || point.date > bestDate) {
                bestDate = point.date;
                bestPrice = point.price;
            }
        }
    }
    
    // Fallback: If target date is BEFORE all history, use first available (not ideal but better than 0)
    // Actually, strictly speaking, it should be the purchase price if no market data, 
    // but here we just return what we found.
    
    return bestPrice;
};

/**
 * Calculates Portfolio Evolution (Market Value vs Invested) over time.
 * Uses a Hybrid approach: Persistent Snapshots + Historical Reconstruction.
 */
export const calculatePortfolioEvolution = (
    transactions: Transaction[], 
    marketData: Record<string, any>,
    days: number = 30,
    snapshots: Record<string, PortfolioSnapshot> = {}
): PortfolioEvolutionPoint[] => {
    if (transactions.length === 0) return [];

    const now = new Date();
    const dataPoints: PortfolioEvolutionPoint[] = [];
    
    // Sort transactions
    const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    const firstTxDateStr = sortedTx[0].date;
    const firstTxDate = fromISODate(firstTxDateStr);

    // Determine Start Date
    // If 'days' is huge (like 3650 for 'all'), clamp to first transaction
    let startDate = new Date();
    startDate.setDate(now.getDate() - days);
    if (startDate < firstTxDate) startDate = firstTxDate;
    
    // Limit to reasonable past (e.g. 5 years) to avoid performance kill if user puts 1900 date
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 5);
    if(startDate < minDate) startDate = minDate;

    // Cache holding calculations to avoid O(N^2) loop
    // We will iterate day by day.
    
    const dayCount = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Keep track of current holdings as we iterate through time
    let currentHoldings: Record<string, { qty: number, avgPrice: number }> = {};
    let txIndex = 0;

    // Last known prices for Carry Forward logic (missing weekends/holidays in API)
    const lastKnownPrices: Record<string, number> = {};

    // 1. Advance holdings to start date (if needed)
    const startDateStr = toISODate(startDate);
    while(txIndex < sortedTx.length && sortedTx[txIndex].date < startDateStr) {
        const tx = sortedTx[txIndex];
        if (!currentHoldings[tx.ticker]) currentHoldings[tx.ticker] = { qty: 0, avgPrice: 0 };
        const h = currentHoldings[tx.ticker];
        
        if (tx.type === 'Compra') {
            const cost = tx.quantity * tx.price + (tx.costs || 0);
            const totalCost = (h.qty * h.avgPrice) + cost;
            h.qty += tx.quantity;
            h.avgPrice = h.qty > 0 ? totalCost / h.qty : 0;
        } else {
            h.qty -= tx.quantity;
            if (h.qty < EPSILON) { h.qty = 0; h.avgPrice = 0; }
        }
        txIndex++;
    }

    // 2. Iterate from Start Date to Today
    for (let i = 0; i <= dayCount; i++) {
        const currentDate = new Date(startDate.getTime());
        currentDate.setDate(startDate.getDate() + i);
        const dateStr = toISODate(currentDate);
        
        // A. Update holdings for this day
        while(txIndex < sortedTx.length && sortedTx[txIndex].date === dateStr) {
            const tx = sortedTx[txIndex];
            if (!currentHoldings[tx.ticker]) currentHoldings[tx.ticker] = { qty: 0, avgPrice: 0 };
            const h = currentHoldings[tx.ticker];
            
            if (tx.type === 'Compra') {
                const cost = tx.quantity * tx.price + (tx.costs || 0);
                const totalCost = (h.qty * h.avgPrice) + cost;
                h.qty += tx.quantity;
                h.avgPrice = h.qty > 0 ? totalCost / h.qty : 0;
            } else {
                h.qty -= tx.quantity;
                if (h.qty < EPSILON) { h.qty = 0; h.avgPrice = 0; }
            }
            txIndex++;
        }

        // B. Calculate Values
        // Priority 1: Use Snapshot if available (It is the absolute truth for that day)
        if (snapshots[dateStr]) {
            const s = snapshots[dateStr];
            dataPoints.push({
                month: currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                dateISO: dateStr,
                invested: s.investedValue,
                marketValue: s.marketValue,
                cumulativeDividends: 0
            });
            continue; 
        }

        // Priority 2: Reconstruct using Holdings * Price History
        let dailyInvested = 0;
        let dailyMarketValue = 0;
        
        Object.keys(currentHoldings).forEach(ticker => {
            const h = currentHoldings[ticker];
            if (h.qty > EPSILON) {
                dailyInvested += h.qty * h.avgPrice;
                
                const assetData = marketData[ticker.toUpperCase()];
                let price = 0;

                if (assetData && assetData.priceHistory) {
                    // Try to find exact or closest previous price
                    const histPrice = getClosestPrice(assetData.priceHistory, dateStr);
                    if (histPrice) {
                        price = histPrice;
                        lastKnownPrices[ticker] = price; // Update cache
                    } else if (lastKnownPrices[ticker]) {
                        price = lastKnownPrices[ticker]; // Carry forward
                    } else {
                        // Fallback to average price if we have NO market data yet (e.g. IPO or API error)
                        price = h.avgPrice; 
                    }
                } else if (assetData && assetData.currentPrice) {
                     // If we only have current price (lite mode) and no history
                     // Use current price for today, but for past... logic breaks without snapshots.
                     // Fallback to Cost basis for past to avoid 0 graph.
                     price = (dateStr === getTodayISODate()) ? assetData.currentPrice : h.avgPrice;
                } else {
                    price = h.avgPrice;
                }
                
                dailyMarketValue += h.qty * price;
            }
        });
        
        // Skip days with 0 value if it looks like an error, unless user really has 0 invested
        if (dailyInvested > 0 || i === dayCount) {
             dataPoints.push({
                month: currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                dateISO: dateStr,
                invested: dailyInvested,
                marketValue: dailyMarketValue,
                cumulativeDividends: 0
            });
        }
    }
    return dataPoints;
};

/**
 * Calculates Monthly Income based on assets dividend history and user holdings.
 * Centralized logic to keep Context clean.
 */
export const calculateMonthlyDividends = (assets: Asset[], transactions: Transaction[]): MonthlyIncome[] => {
    const incomeMap: Record<string, number> = {};
    const normalizedTransactions = transactions.map(t => ({
        ...t,
        ticker: t.ticker.toUpperCase().trim()
    })).sort((a, b) => a.date.localeCompare(b.date));
    
    assets.forEach(asset => {
        if (!asset.dividendsHistory) return;
        
        asset.dividendsHistory.forEach((div: DividendHistoryEvent) => {
            const divTicker = asset.ticker.toUpperCase().trim();
            // How many did user have on exDate?
            let qty = 0;
            // Iterate all tx up to exDate
            for(const tx of normalizedTransactions) {
                if (tx.date > div.exDate) break; 
                if (tx.ticker === divTicker) {
                    if (tx.type === 'Compra') qty += tx.quantity;
                    else qty -= tx.quantity;
                }
            }
            
            if (qty > 0) {
                const payDate = new Date(div.paymentDate);
                const year = payDate.getFullYear();
                const month = String(payDate.getMonth() + 1).padStart(2, '0');
                const sortKey = `${year}-${month}`; // 2023-11
                
                incomeMap[sortKey] = (incomeMap[sortKey] || 0) + (qty * div.value);
            }
        });
    });

    return Object.entries(incomeMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, value]) => {
               const [y, m] = key.split('-');
               const monthNames = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
               const monthName = monthNames[parseInt(m)-1];
               const shortYear = y.slice(2);
               
               return {
                  month: `${monthName}/${shortYear}`,
                  total: value
               };
          })
        .slice(-12); 
};
