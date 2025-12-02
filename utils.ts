
import { useState, useEffect, Dispatch, SetStateAction, useRef } from 'react';
import type { Transaction, AppTheme, PortfolioEvolutionPoint } from './types';

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

export const calculatePortfolioEvolution = (transactions: Transaction[], marketData: Record<string, any>): Record<string, PortfolioEvolutionPoint[]> => {
    if (transactions.length === 0) return { all_types: [] };

    // 1. Coletar todas as datas relevantes (histórico de preços + datas de transação)
    const dateSet = new Set<string>();
    const involvedTickers = new Set(transactions.map(t => t.ticker.toUpperCase()));

    // Adiciona datas de histórico disponíveis
    involvedTickers.forEach(ticker => {
        const history = marketData[ticker]?.priceHistory || [];
        history.forEach((h: any) => dateSet.add(h.date));
    });
    
    // Se não houver histórico, usa pelo menos as datas das transações
    transactions.forEach(t => dateSet.add(t.date));

    // Ordena as datas
    const sortedDates = Array.from(dateSet).sort();
    
    // Mapa de transações por data para acesso rápido
    const transactionsByDate: Record<string, Transaction[]> = {};
    transactions.forEach(tx => {
        if (!transactionsByDate[tx.date]) transactionsByDate[tx.date] = [];
        transactionsByDate[tx.date].push(tx);
    });

    const points: PortfolioEvolutionPoint[] = [];
    const holdings: Record<string, number> = {}; // Qtd atual por ticker
    const invested: Record<string, number> = {}; // Valor investido atual por ticker

    sortedDates.forEach(date => {
        // A. Processar transações até esta data (cumulativo)
        // Precisamos processar todas as transações que aconteceram NESTA data ou ANTES, 
        // mas como estamos iterando sortedDates, precisamos ter cuidado com lacunas se usássemos apenas 'transactionsByDate[date]'.
        // Mas a lógica correta de "evolução" é recalcular o estado do portfólio para cada ponto no tempo.
        
        // Vamos iterar DIA a DIA no array de datas sortedDates.
        // Mas precisamos aplicar as transações que ocorreram NAQUELE dia.
        const todaysTransactions = transactionsByDate[date] || [];
        
        todaysTransactions.forEach(tx => {
            const tkr = tx.ticker.toUpperCase();
            if (tx.type === 'Compra') {
                holdings[tkr] = (holdings[tkr] || 0) + tx.quantity;
                invested[tkr] = (invested[tkr] || 0) + (tx.quantity * tx.price + (tx.costs || 0));
            } else {
                const currentQty = holdings[tkr] || 0;
                const currentInvested = invested[tkr] || 0;
                const avgPrice = currentQty > 0 ? currentInvested / currentQty : 0;
                const sellQty = Math.min(tx.quantity, currentQty);
                
                holdings[tkr] = currentQty - sellQty;
                invested[tkr] = Math.max(0, currentInvested - (sellQty * avgPrice));
            }
        });

        // B. Calcular valor de mercado neste dia
        let totalInvested = 0;
        let totalMarket = 0;

        involvedTickers.forEach(tkr => {
            const qty = holdings[tkr] || 0;
            if (qty > 0) {
                totalInvested += invested[tkr] || 0;
                
                // Tenta pegar o preço do histórico para ESTA data
                const history = marketData[tkr]?.priceHistory || [];
                const pricePoint = history.find((h: any) => h.date === date);
                
                if (pricePoint) {
                    totalMarket += qty * pricePoint.price;
                } else {
                    // Se não tem preço neste dia exato (ex: feriado no meio do histórico, ou transação recente sem update),
                    // tenta pegar o último preço conhecido ANTES desta data.
                    // Isso é um fallback mais simples e seguro que a lógica complexa anterior.
                    const lastPrice = history
                        .filter((h: any) => h.date < date)
                        .sort((a: any, b: any) => b.date.localeCompare(a.date))[0];
                    
                    if (lastPrice) {
                        totalMarket += qty * lastPrice.price;
                    } else {
                        // Se não tem histórico nenhum anterior, usa o preço médio como estimativa (fallback final)
                        const avg = invested[tkr] / qty;
                        totalMarket += qty * avg;
                    }
                }
            }
        });

        if (totalInvested > 0 || totalMarket > 0) {
            const [y, m, d] = date.split('-');
            points.push({
                dateISO: date,
                month: `${d}/${m}`,
                invested: totalInvested,
                marketValue: totalMarket
            });
        }
    });

    return { all_types: points };
};
