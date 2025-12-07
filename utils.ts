
import { useState, useEffect, Dispatch, SetStateAction, useRef } from 'react';
import type { Transaction, AppTheme, PortfolioEvolutionPoint } from './types';

// --- IndexedDB Wrapper ---
const DB_NAME = 'fii_master_db';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

export const idb = {
    open: (): Promise<IDBDatabase> => {
        return new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                reject(new Error("IndexedDB not supported"));
                return;
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    get: <T>(key: string): Promise<T | undefined> => {
        return idb.open().then(db => {
            return new Promise((resolve, reject) => {
                try {
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    const store = tx.objectStore(STORE_NAME);
                    const request = store.get(key);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                } catch (e) {
                    reject(e);
                }
            });
        });
    },
    set: (key: string, value: any): Promise<void> => {
        return idb.open().then(db => {
            return new Promise((resolve, reject) => {
                try {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    const request = store.put(value, key);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                } catch (e) {
                    reject(e);
                }
            });
        });
    },
    del: (key: string): Promise<void> => {
         return idb.open().then(db => {
            return new Promise((resolve, reject) => {
                try {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    const request = store.delete(key);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                } catch (e) {
                    reject(e);
                }
            });
        });
    },
    clear: (): Promise<void> => {
         return idb.open().then(db => {
            return new Promise((resolve, reject) => {
                try {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    const request = store.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
};

// --- Hook para estado persistente no IndexedDB com fallback e migração ---
export function usePersistentState<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
        try {
            // 1. Try IndexedDB
            let value = await idb.get<T>(key);
            
            // 2. If not in DB, check LocalStorage (Migration)
            if (value === undefined) {
                const local = localStorage.getItem(key);
                if (local) {
                    try {
                        value = JSON.parse(local);
                        // Save to IDB immediately
                        await idb.set(key, value);
                        // Clean up LocalStorage to free space
                        localStorage.removeItem(key);
                        console.log(`Migrated ${key} from LocalStorage to IndexedDB`);
                    } catch (e) {
                        console.warn(`Failed to parse legacy localStorage for ${key}`, e);
                    }
                }
            }

            if (isMounted && value !== undefined) {
                setState(value);
            }
        } catch (e) { 
            console.error(`Error loading ${key} from storage:`, e); 
        } finally {
            if (isMounted) setIsHydrated(true);
        }
    };
    load();
    return () => { isMounted = false; };
  }, [key]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Only save if data has been loaded initially to avoid overwriting DB with defaultValue
    if (!isHydrated) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      idb.set(key, state).catch(err => console.error(`Error saving ${key}:`, err));
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [key, state, isHydrated]);

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
    // Set to noon to avoid timezone rollover issues
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

// --- Sistema de Cache (Async via IndexedDB) ---
interface CacheItem<T> {
    data: T;
    timestamp: number;
}

export const CacheManager = {
    get: async <T>(key: string, ttl: number): Promise<T | null> => {
        try {
            const cacheKey = `cache_${key}`;
            let item: CacheItem<T> | undefined = await idb.get<CacheItem<T>>(cacheKey);
            
            // Migration for old localStorage cache
            if (!item) {
                const localItem = localStorage.getItem(cacheKey);
                if (localItem) {
                    try {
                        item = JSON.parse(localItem);
                        await idb.set(cacheKey, item);
                        localStorage.removeItem(cacheKey);
                    } catch (e) {}
                }
            }

            if (!item) return null;

            const now = Date.now();
            if (!item || typeof item.timestamp !== 'number' || item.data === undefined) {
                await idb.del(cacheKey);
                return null;
            }

            if (now - item.timestamp > ttl) {
                await idb.del(cacheKey);
                return null;
            }

            return item.data;
        } catch (error) {
            console.warn("Cache corrupted or invalid:", key, error);
            return null;
        }
    },

    set: async <T>(key: string, data: T): Promise<void> => {
        const item: CacheItem<T> = {
            data,
            timestamp: Date.now(),
        };
        try {
            await idb.set(`cache_${key}`, item);
        } catch (error) {
            console.error("Error setting cache:", error);
        }
    },
    
    clear: async (key: string): Promise<void> => {
        await idb.del(`cache_${key}`);
    },

    clearAll: async (): Promise<void> => {
        // Warning: This clears everything in the store, not just cache keys
        // A safer way if store is shared is to iterate keys.
        // For now we assume sharing the store, so we only clear keys starting with cache_
        // IDB generic clear is too aggressive if we share the store with main data.
        // But since we use one store for everything, we shouldn't use idb.clear().
        // We will implement a specialized clear if needed, or simply let data expire.
        // Ideally, 'clear' in this app context often means 'reset app'.
        // For explicit cache clearing, we might need a key scan.
        // Simple strategy: Clear keys via cursor if strictly needed.
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

// --- Optimized Portfolio Evolution Algorithm (Continuous Timeline) ---
export const calculatePortfolioEvolution = (transactions: Transaction[], marketData: Record<string, any>): Record<string, PortfolioEvolutionPoint[]> => {
    if (transactions.length === 0) return { all_types: [] };

    // 1. Determine timeline bounds
    const transactionDates = transactions.map(t => t.date);
    const sortedTxDates = transactionDates.sort();
    const startDateStr = sortedTxDates[0];
    const endDateStr = toISODate(new Date());

    // 2. Generate Full Daily Timeline
    const timeline: string[] = [];
    let current = fromISODate(startDateStr);
    const end = fromISODate(endDateStr);
    
    while (current <= end) {
        timeline.push(toISODate(current));
        current.setDate(current.getDate() + 1);
    }

    // 3. Pre-process transactions map
    const transactionsByDate: Record<string, Transaction[]> = {};
    transactions.forEach(tx => {
        if (!transactionsByDate[tx.date]) transactionsByDate[tx.date] = [];
        transactionsByDate[tx.date].push(tx);
    });

    // 4. Pre-process Market Data map (Ticker -> Date -> Price)
    const priceMap: Record<string, Record<string, number>> = {};
    const involvedTickers = new Set(transactions.map(t => t.ticker.toUpperCase()));
    
    involvedTickers.forEach(ticker => {
        priceMap[ticker] = {};
        const history = marketData[ticker]?.priceHistory || [];
        history.forEach((h: any) => {
            if (h.price > 0) priceMap[ticker][h.date] = h.price;
        });
        // Add current price as fallback for today
        if (marketData[ticker]?.currentPrice > 0) {
            priceMap[ticker][endDateStr] = marketData[ticker].currentPrice;
        }
    });

    // 5. Simulation Loop
    const points: PortfolioEvolutionPoint[] = [];
    const holdings: Record<string, number> = {}; 
    const invested: Record<string, number> = {}; 
    const lastKnownPrice: Record<string, number> = {}; // Carry-forward prices

    for (const date of timeline) {
        // A. Apply transactions for this day
        const daysTxs = transactionsByDate[date] || [];
        daysTxs.forEach(tx => {
            const tkr = tx.ticker.toUpperCase();
            if (tx.type === 'Compra') {
                holdings[tkr] = (holdings[tkr] || 0) + tx.quantity;
                invested[tkr] = (invested[tkr] || 0) + (tx.quantity * tx.price + (tx.costs || 0));
                
                // CRITICAL: Initialize price if unknown (for new assets)
                if (lastKnownPrice[tkr] === undefined) {
                    lastKnownPrice[tkr] = tx.price;
                }
            } else {
                const currentQty = holdings[tkr] || 0;
                const currentInvested = invested[tkr] || 0;
                const avgPrice = currentQty > 0 ? currentInvested / currentQty : 0;
                const sellQty = Math.min(tx.quantity, currentQty);
                
                holdings[tkr] = currentQty - sellQty;
                invested[tkr] = Math.max(0, currentInvested - (sellQty * avgPrice));
            }
        });

        // B. Update Prices (Check API or carry forward)
        involvedTickers.forEach(ticker => {
            if (priceMap[ticker]?.[date]) {
                lastKnownPrice[ticker] = priceMap[ticker][date];
            }
        });

        // C. Calculate Portfolio Totals
        let totalInvested = 0;
        let totalMarket = 0;

        involvedTickers.forEach(tkr => {
            const qty = holdings[tkr] || 0;
            if (qty > EPSILON) {
                totalInvested += invested[tkr] || 0;
                
                // Use last known price (from history or transaction) or fallback to cost avg
                let price = lastKnownPrice[tkr];
                if (!price) price = invested[tkr] / qty;
                
                totalMarket += qty * price;
            }
        });

        // Only record points where portfolio has value
        if (totalInvested > 0 || totalMarket > 0) {
            const [y, m, d] = date.split('-');
            points.push({
                dateISO: date,
                month: `${d}/${m}`,
                invested: totalInvested,
                marketValue: totalMarket
            });
        }
    }

    return { all_types: points };
};
