
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

// Utility delay function to respect rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchBrapiQuotes(prefs: AppPreferences, tickers: string[]): Promise<Record<string, { currentPrice: number }>> {
    if (tickers.length === 0) {
        return {};
    }

    const token = getBrapiToken(prefs);
    const result: Record<string, { currentPrice: number }> = {};
    
    // Configuration for batching
    const BATCH_SIZE = 10; // Safer chunk size for URL length and API limits
    const DELAY_MS = 350;  // Delay between requests to avoid rate limiting

    // Process tickers in batches
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
        const batch = tickers.slice(i, i + BATCH_SIZE);
        const url = `https://brapi.dev/api/quote/${batch.join(',')}?token=${token}`;

        try {
            // If not the first batch, wait a bit to respect API rate limits
            if (i > 0) {
                await delay(DELAY_MS);
            }

            const response = await fetch(url);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.warn(`Brapi Batch Error (${batch.join(',')}):`, errorData);
                // We continue to the next batch instead of throwing immediately, 
                // so partial data is better than no data.
                continue; 
            }
            
            const data: BrapiResponse = await response.json();

            if (data && Array.isArray(data.results)) {
                data.results.forEach(quote => {
                    if (quote.symbol && typeof quote.regularMarketPrice === 'number') {
                        result[quote.symbol.toUpperCase()] = {
                            currentPrice: quote.regularMarketPrice
                        };
                    }
                });
            }

        } catch (error: any) {
            console.error(`Brapi Connection Error on batch ${batch.join(',')}:`, error);
            // Continue to next batch to attempt partial recovery
        }
    }

    // Check if we got any data back. If result is empty but we had tickers, 
    // it means ALL batches failed, so we throw the last error or a generic one.
    if (Object.keys(result).length === 0 && tickers.length > 0) {
         throw new Error("Falha ao buscar cotações na Brapi API. Verifique sua conexão ou limite de requisições.");
    }
    
    return result;
}

export async function validateBrapiToken(token: string): Promise<boolean> {
    if (!token || token.trim() === '') return false;
    // Test with a single, highly liquid asset
    const url = `https://brapi.dev/api/quote/PETR4?token=${token}`;
    try {
        const response = await fetch(url);
        return response.ok;
    } catch (error) {
        console.error("Brapi token validation failed:", error);
        return false;
    }
}
