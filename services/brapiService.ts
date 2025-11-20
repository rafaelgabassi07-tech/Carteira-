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
    if (prefs.brapiToken && prefs.brapiToken.trim() !== '') {
        return prefs.brapiToken;
    }
    
    // Priority 2: Environment variable (Direct access, no complex checks)
    // Using 'as any' to bypass potential strict TS config issues with import.meta
    const envToken = (import.meta as any).env?.VITE_BRAPI_TOKEN;
    
    if (envToken && envToken.trim() !== '') {
        return envToken;
    }

    // If neither is found, throw a clear error
    throw new Error("Token VITE_BRAPI_TOKEN não encontrado. Verifique Configurações ou Vercel.");
}


export async function fetchBrapiQuotes(prefs: AppPreferences, tickers: string[]): Promise<Record<string, { currentPrice: number }>> {
    if (tickers.length === 0) {
        return {};
    }

    // Allow error to bubble up if token is missing
    const token = getBrapiToken(prefs);
    const url = `https://brapi.dev/api/quote/${tickers.join(',')}?token=${token}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || `Brapi Error: ${response.status} ${response.statusText}`);
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
        // CRITICAL FIX: Throw the REAL error message, not a generic one.
        throw new Error(error.message || "Erro desconhecido ao conectar com Brapi API");
    }
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