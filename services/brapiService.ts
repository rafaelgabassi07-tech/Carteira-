
import type { AppPreferences } from '../types';

interface BrapiHistoricalData {
    date: number; // Unix timestamp
    close: number;
}

interface BrapiQuote {
    symbol: string;
    regularMarketPrice: number;
    historicalDataPrice?: BrapiHistoricalData[];
}

interface BrapiResponse {
    results: BrapiQuote[];
    error?: boolean;
    message?: string;
}

function getBrapiToken(prefs: AppPreferences): string {
    if (prefs.brapiToken && prefs.brapiToken.trim() !== '') {
        return prefs.brapiToken;
    }
    const envToken = (import.meta as any).env?.VITE_BRAPI_TOKEN;
    if (envToken && envToken.trim() !== '') {
        return envToken;
    }
    throw new Error("Token da API Brapi (VITE_BRAPI_TOKEN) não configurado.");
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchBrapiQuotes(prefs: AppPreferences, tickers: string[]): Promise<Record<string, { currentPrice: number; priceHistory: { date: string; price: number }[] }>> {
    if (tickers.length === 0) {
        return {};
    }

    const token = getBrapiToken(prefs);
    const allQuotes: Record<string, { currentPrice: number; priceHistory: { date: string; price: number }[] }> = {};
    const failedTickers: string[] = [];

    for (const ticker of tickers) {
        let success = false;
        let historyData: any[] = [];
        let currentPrice = 0;
        const urlBase = `https://brapi.dev/api/quote/${ticker}`;

        // Strategy: Try 1y (Premium/Full) -> 5d (Free/Short) -> Current Price (Fallback)
        
        // 1. Try Long Range (1y)
        try {
            const response = await fetch(`${urlBase}?range=1y&token=${token}`);
            
            if (response.status === 403 || response.status === 401) {
                throw new Error("FORBIDDEN_TIER");
            }
            
            if (response.ok) {
                const data = await response.json();
                const result = data.results?.[0];
                if (result) {
                    currentPrice = result.regularMarketPrice;
                    historyData = result.historicalDataPrice || [];
                    success = true;
                }
            }
        } catch (e: any) {
            if (e.message !== "FORBIDDEN_TIER") {
                 console.warn(`Failed to fetch 1y for ${ticker} (Retrying with shorter range...):`, e.message);
            }
        }

        // 2. Try Short Range (5d) - If 1y failed or was forbidden
        if (!success) {
             try {
                await delay(200); // Small delay to be nice to API
                const response = await fetch(`${urlBase}?range=5d&token=${token}`);
                
                if (response.ok) {
                    const data = await response.json();
                    const result = data.results?.[0];
                     if (result) {
                        currentPrice = result.regularMarketPrice;
                        historyData = result.historicalDataPrice || [];
                        success = true;
                    }
                }
            } catch (e) {
                console.warn(`Failed to fetch 5d for ${ticker}`, e);
            }
        }

        // 3. Current Price Only (Last Resort)
        if (!success) {
             try {
                await delay(200);
                const response = await fetch(`${urlBase}?token=${token}`);
                 if (response.ok) {
                    const data = await response.json();
                    const result = data.results?.[0];
                     if (result) {
                        currentPrice = result.regularMarketPrice;
                        historyData = []; // No history
                        success = true;
                    }
                }
            } catch (e) {
                console.error(`Failed fallback for ${ticker}`, e);
            }
        }

        if (success) {
             allQuotes[ticker.toUpperCase()] = {
                currentPrice: currentPrice || 0,
                priceHistory: historyData.map((item: any) => ({
                    date: new Date(item.date * 1000).toISOString().split('T')[0],
                    price: item.close,
                })).sort((a: any, b: any) => a.date.localeCompare(b.date))
            };
        } else {
             failedTickers.push(ticker);
        }
    }

    if (failedTickers.length === tickers.length && failedTickers.length > 0) {
        throw new Error(`Falha ao atualizar ativos: ${failedTickers.slice(0,3).join(', ')}... Verifique conexão.`);
    }

    return allQuotes;
}

export async function validateBrapiToken(token: string): Promise<boolean> {
    if (!token || token.trim() === '') return false;
    const url = `https://brapi.dev/api/quote/PETR4?token=${token}`;
    try {
        const response = await fetch(url);
        if(response.status === 401 || response.status === 403) return false;
        return response.ok;
    } catch (error) {
        console.error("Brapi token validation failed:", error);
        return false;
    }
}
