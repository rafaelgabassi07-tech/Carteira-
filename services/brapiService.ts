
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

    // Ranges to try. Start with longer ranges. 
    // '5d' is included because Brapi Free Tier often allows 5 days history but blocks longer ones.
    // We will attempt to downgrade gracefully if a 403 occurs.
    const ranges = ['1y', '6mo', '1mo', '5d']; 

    for (const ticker of tickers) {
        let success = false;
        let lastError: any = null;

        // 1. Attempt to fetch Historical Data
        for (const range of ranges) {
            const url = `https://brapi.dev/api/quote/${ticker}?range=${range}&token=${token}`;
            try {
                let response = await fetch(url);

                // Handle 429 (Rate Limit)
                if (response.status === 429) {
                    console.warn(`Rate limit hit for ${ticker} (${range}), waiting...`);
                    await delay(2000);
                    response = await fetch(url);
                }

                // If 403 (Forbidden), it usually means the range is too long for the plan (Free Tier).
                // We throw a specific error to catch it below and continue to the next (shorter) range.
                if (response.status === 403) {
                    throw new Error("RANGE_FORBIDDEN");
                }

                if (response.status === 404) {
                    throw new Error("NOT_FOUND");
                }

                if (!response.ok) {
                    throw new Error(`Status: ${response.status}`);
                }

                const data: BrapiResponse = await response.json();
                
                if (data.error || !data.results || data.results.length === 0) {
                    throw new Error(data.message || `Nenhum resultado`);
                }

                const quote = data.results[0];
                if (quote && quote.symbol) {
                    const upperCaseTicker = quote.symbol.toUpperCase();
                    const priceHistory = (quote.historicalDataPrice || [])
                        .map(item => ({
                            date: new Date(item.date * 1000).toISOString().split('T')[0],
                            price: item.close,
                        }))
                        .sort((a, b) => a.date.localeCompare(b.date));

                    allQuotes[upperCaseTicker] = {
                        currentPrice: quote.regularMarketPrice || priceHistory[priceHistory.length - 1]?.price || 0,
                        priceHistory,
                    };
                    success = true;
                    break; // Got data, stop range loop
                }

            } catch (error: any) {
                lastError = error;
                
                if (error.message === "NOT_FOUND") {
                    break; // Asset doesn't exist, don't retry other ranges
                }
                
                if (error.message === "RANGE_FORBIDDEN") {
                     // Continue to next shorter range
                     // console.warn(`Range ${range} forbidden for ${ticker}, trying shorter range...`);
                     continue;
                }
                
                // For other errors (timeouts, 500), we also continue to try simpler queries
            }
        }

        // 2. Fallback: Current Price Only (If ALL history ranges failed)
        if (!success && lastError?.message !== "NOT_FOUND") {
            try {
                // Request without 'range' parameter usually works for free tokens to get just the quote (1d default)
                const fallbackUrl = `https://brapi.dev/api/quote/${ticker}?token=${token}`;
                const response = await fetch(fallbackUrl);
                
                if (response.ok) {
                    const data: BrapiResponse = await response.json();
                    const quote = data.results?.[0];
                    
                    if (quote) {
                        console.warn(`History failed for ${ticker}, used current price fallback.`);
                        allQuotes[ticker.toUpperCase()] = {
                            currentPrice: quote.regularMarketPrice,
                            priceHistory: [] // Empty history
                        };
                        success = true;
                    }
                }
            } catch (fallbackError) {
                console.error(`Fallback fetch failed for ${ticker}`, fallbackError);
            }
        }

        if (!success) {
            // Only log as definitive failure if absolutely no data could be retrieved
            console.error(`Falha definitiva ao buscar ${ticker}:`, lastError?.message);
            failedTickers.push(ticker);
        }
        
        await delay(200); 
    }

    // Don't throw global error if some assets worked. Only if ALL failed.
    if (Object.keys(allQuotes).length === 0 && failedTickers.length > 0) {
        throw new Error(`Falha ao atualizar ativos: ${failedTickers.slice(0,3).join(', ')}... Verifique sua conexão ou token.`);
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
