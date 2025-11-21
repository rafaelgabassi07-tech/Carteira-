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

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn(`Brapi Rate Limit (429) for ${ticker}. Pausing and retrying...`);
                    await delay(1500); // Wait 1.5s
                    response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`Limite de requisições excedido (429)`);
                    }
                } else {
                    throw new Error(`Falha: ${response.statusText}`);
                }
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
            console.error(`Erro ao buscar dados para ${ticker}:`, error.message);
            failedTickers.push(ticker);
        }
        
        // Proactively add a small delay between requests to avoid hitting rate limits.
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
        return response.ok;
    } catch (error) {
        console.error("Brapi token validation failed:", error);
        return false;
    }
}