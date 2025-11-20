import type { AppPreferences } from '../types';

interface BrapiQuote {
    symbol: string;
    regularMarketPrice: number;
}

interface BrapiResponse {
    results: BrapiQuote[];
}

function getBrapiToken(prefs: AppPreferences): string {
    // Priority 1: User-provided token from settings
    if (prefs.brapiToken) {
        return prefs.brapiToken;
    }
    // Priority 2: Environment variable
    const envToken = (import.meta as any).env?.VITE_BRAPI_TOKEN;
    if (envToken) {
        return envToken;
    }
    // If neither is found, throw an error
    throw new Error("Token da API Brapi (VITE_BRAPI_TOKEN) não configurado no ambiente ou nas configurações do app.");
}

export async function fetchBrapiQuotes(prefs: AppPreferences, tickers: string[]): Promise<Record<string, { currentPrice: number }>> {
    if (tickers.length === 0) {
        return {};
    }

    const token = getBrapiToken(prefs);
    const url = `https://brapi.dev/api/quote/${tickers.join(',')}?token=${token}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Brapi API returned status ${response.status}`);
        }
        
        const data: BrapiResponse = await response.json();
        const result: Record<string, { currentPrice: number }> = {};

        if (data && Array.isArray(data.results)) {
            data.results.forEach(quote => {
                if (quote.symbol && quote.regularMarketPrice) {
                    result[quote.symbol.toUpperCase()] = {
                        currentPrice: quote.regularMarketPrice
                    };
                }
            });
        }
        
        return result;

    } catch (error: any) {
        console.error("Brapi API fetch error:", error);
        throw new Error("Falha ao buscar cotações na Brapi API.");
    }
}

export async function validateBrapiToken(token: string): Promise<boolean> {
    if (!token) return false;
    // Brapi's validation is usually just making a successful call. We'll test with a common ticker.
    const url = `https://brapi.dev/api/quote/PETR4?token=${token}`;
    try {
        const response = await fetch(url);
        return response.ok;
    } catch (error) {
        console.error("Brapi token validation failed:", error);
        return false;
    }
}