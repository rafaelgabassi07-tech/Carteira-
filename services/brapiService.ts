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
    // Priority 1: User-provided token from settings
    if (prefs.brapiToken && prefs.brapiToken.trim() !== '') {
        return prefs.brapiToken;
    }
    
    // Priority 2: Environment variable (Vite's way)
    const envToken = (import.meta as any).env?.VITE_BRAPI_TOKEN;
    
    if (envToken && envToken.trim() !== '') {
        return envToken;
    }

    throw new Error("Token da API Brapi (VITE_BRAPI_TOKEN) não configurado. Verifique as Configurações no app ou as Variáveis de Ambiente na Vercel.");
}

// Utility delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchBrapiQuotes(prefs: AppPreferences, tickers: string[]): Promise<Record<string, { currentPrice: number; priceHistory: { date: string; price: number }[] }>> {
    if (tickers.length === 0) {
        return {};
    }

    const token = getBrapiToken(prefs);
    const result: Record<string, { currentPrice: number; priceHistory: { date: string; price: number }[] }> = {};
    const failedTickers: string[] = [];
    
    // Process tickers one by one with a delay to respect rate limits
    for (const ticker of tickers) {
        try {
            const url = `https://brapi.dev/api/quote/${ticker}?range=5y&token=${token}`;
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 429) {
                     console.warn(`Brapi Rate Limit (429) for ${ticker}. Pausing and retrying once...`);
                     await delay(2000); // Wait 2s on rate limit and retry
                     const retryResponse = await fetch(url);
                     if (!retryResponse.ok) {
                        throw new Error(`Limite de requisições excedido (429)`);
                     }
                     const retryData: BrapiResponse = await retryResponse.json();
                     if (retryData.results && retryData.results[0]) {
                        const quote = retryData.results[0];
                        const priceHistory = (quote.historicalDataPrice || [])
                            .map(item => ({
                                date: new Date(item.date * 1000).toISOString().split('T')[0],
                                price: item.close,
                            }))
                            .sort((a, b) => a.date.localeCompare(b.date));

                        result[quote.symbol.toUpperCase()] = { 
                            currentPrice: quote.regularMarketPrice,
                            priceHistory,
                        };
                        await delay(150);
                        continue;
                     }
                }
                throw new Error(`Falha ao buscar ${ticker}: ${response.statusText}`);
            }

            const data: BrapiResponse = await response.json();
            
            if (data.error || !data.results || data.results.length === 0) {
                throw new Error(data.message || `Sem resultados para ${ticker}`);
            }
            
            const quote = data.results[0];
            if (quote.symbol && typeof quote.regularMarketPrice === 'number') {
                const priceHistory = (quote.historicalDataPrice || [])
                    .map(item => ({
                        date: new Date(item.date * 1000).toISOString().split('T')[0],
                        price: item.close,
                    }))
                    .sort((a, b) => a.date.localeCompare(b.date));

                result[quote.symbol.toUpperCase()] = {
                    currentPrice: quote.regularMarketPrice,
                    priceHistory,
                };
            }

            // The crucial delay to be "polite" to the API
            await delay(150);

        } catch (error: any) {
            console.error(`Erro ao buscar dados para ${ticker}:`, error.message);
            failedTickers.push(ticker);
        }
    }

    // If all tickers failed, throw a comprehensive error.
    if (Object.keys(result).length === 0 && tickers.length > 0) {
        const failedList = failedTickers.join(', ');
        throw new Error(`Falha ao atualizar: ${failedList}. Verifique os tickers ou a API.`);
    }
    
    return result;
}

export async function validateBrapiToken(token: string): Promise<boolean> {
    if (!token || token.trim() === '') return false;
    const url = `https://brapi.dev/api/quote/PETR4?token=${token}`;
    try {
        const response = await fetch(url);
        return response.ok;
    } catch (error) {
        console.error("Brapi token validation failed:", error);
        return false;
    }
}
