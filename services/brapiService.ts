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
        const url = `https://brapi.dev/api/quote/${ticker}?range=5y&token=${token}`;
        try {
            let response = await fetch(url);

            // Handle invalid token immediately, as it's a fatal error for the entire batch.
            if (response.status === 401) {
                throw new Error("Token da API Brapi inválido ou expirado. Verifique as configurações.");
            }

            // If we are rate-limited, wait and retry once.
            if (response.status === 429) {
                await delay(1500); 
                response = await fetch(url); // Re-fetch and overwrite the response variable
            }

            // After potential retry, check if the response is OK now.
            if (!response.ok) {
                throw new Error(`Falha ao obter dados para ${ticker} (status: ${response.status})`);
            }

            const data: BrapiResponse = await response.json();
            
            if (data.error || !data.results || data.results.length === 0) {
                throw new Error(data.message || `Nenhum resultado para ${ticker}`);
            }

            const quote = data.results[0];
            if (quote && quote.symbol && typeof quote.regularMarketPrice === 'number') {
                const upperCaseTicker = quote.symbol.toUpperCase();
                const priceHistory = (quote.historicalDataPrice || [])
                    .map(item => ({
                        date: new Date(item.date * 1000).toISOString().split('T')[0],
                        price: item.close,
                    }))
                    .sort((a, b) => a.date.localeCompare(b.date));

                allQuotes[upperCaseTicker] = {
                    currentPrice: quote.regularMarketPrice,
                    priceHistory,
                };
            } else {
                 throw new Error(`Resposta inválida para ${ticker}`);
            }

        } catch (error: any) {
            // If it's the fatal token error, re-throw it to stop the whole process.
            if (error.message.includes("Token da API Brapi inválido")) {
                throw error;
            }
            // For other errors, just collect the failed ticker and continue.
            console.error(`Erro ao buscar dados para ${ticker}:`, error.message);
            failedTickers.push(ticker);
        }
        
        // Proactive delay between requests to avoid rate limiting
        await delay(300); 
    }

    if (failedTickers.length > 0) {
        throw new Error(`Falha ao atualizar: ${failedTickers.join(', ')}.`);
    }

    return allQuotes;
}


export async function validateBrapiToken(token: string): Promise<boolean> {
    if (!token || token.trim() === '') return false;
    const url = `https://brapi.dev/api/quote/PETR4?token=${token}`;
    try {
        const response = await fetch(url);
        if(response.status === 401) return false;
        return response.ok;
    } catch (error) {
        console.error("Brapi token validation failed:", error);
        return false;
    }
}