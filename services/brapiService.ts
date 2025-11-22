
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

    // Strategy: Try long history first, fallback to shorter if 403/Forbidden (common for new assets or free tier limits)
    const ranges = ['5y', '3mo', '1mo'];

    for (const ticker of tickers) {
        let success = false;
        let lastError: any = null;

        for (const range of ranges) {
            const url = `https://brapi.dev/api/quote/${ticker}?range=${range}&token=${token}`;
            try {
                let response = await fetch(url);

                // Handle invalid token immediately - fatal error
                if (response.status === 401) {
                    throw new Error("Token da API Brapi inválido ou expirado. Verifique as configurações.");
                }

                // If rate limited, wait and retry once
                if (response.status === 429) {
                    console.warn(`Rate limit hit for ${ticker}, waiting...`);
                    await delay(2000);
                    response = await fetch(url);
                }

                // Fallback logic for 403 (Forbidden)
                if (response.status === 403) {
                    console.warn(`Range ${range} forbidden for ${ticker}, trying shorter range...`);
                    lastError = new Error(`Acesso negado (403) para histórico de ${range}`);
                    continue; // Try next range
                }

                if (!response.ok) {
                    throw new Error(`Status: ${response.status}`);
                }

                const data: BrapiResponse = await response.json();
                
                if (data.error || !data.results || data.results.length === 0) {
                    throw new Error(data.message || `Nenhum resultado`);
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
                    success = true;
                    break; // Stop trying ranges, we got the data
                } else {
                     throw new Error(`Dados inválidos na resposta`);
                }

            } catch (error: any) {
                if (error.message.includes("Token da API Brapi inválido")) {
                    throw error; // Re-throw fatal
                }
                lastError = error;
                // Continue to next range loop if possible, otherwise it will exit loop
            }
        }

        if (!success) {
            console.error(`Falha definitiva ao buscar ${ticker}:`, lastError?.message);
            failedTickers.push(ticker);
        }
        
        // Proactive delay between asset requests
        await delay(300); 
    }

    if (failedTickers.length > 0) {
        // Only throw if ALL attempts for a ticker failed. 
        // If partial success happened (fallback), we don't throw.
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
