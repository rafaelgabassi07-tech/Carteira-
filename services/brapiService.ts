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
            const response = await fetch(url);

            if (response.status === 401) {
                throw new Error("Token da API Brapi inválido ou expirado. Verifique as configurações.");
            }

            if (!response.ok) {
                if (response.status === 429) { // Rate limit
                    await delay(1500);
                    const retryResponse = await fetch(url);
                    if (!retryResponse.ok) throw new Error(`Limite de requisições excedido para ${ticker}.`);
                    const data: BrapiResponse = await retryResponse.json();
                    if (data.error || !data.results || data.results.length === 0) throw new Error(data.message || `Nenhum resultado para ${ticker}`);
                } else {
                    throw new Error(`Falha na rede: ${response.statusText}`);
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
