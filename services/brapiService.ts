
import type { AppPreferences } from '../types';

interface BrapiQuote {
    symbol: string;
    regularMarketPrice: number;
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

    let lastError: string | null = null;

    // Process tickers in batches
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
        const batch = tickers.slice(i, i + BATCH_SIZE);
        // Brapi accepts comma-separated tickers
        const url = `https://brapi.dev/api/quote/${batch.join(',')}?token=${token}`;

        try {
            // If not the first batch, wait a bit to respect API rate limits
            if (i > 0) {
                await delay(DELAY_MS);
            }

            const response = await fetch(url);
            
            if (!response.ok) {
                const status = response.status;
                const errorText = await response.text();
                let errorMessage = `Erro ${status}`;
                
                if (status === 429) errorMessage = "Limite de requisições excedido (429).";
                if (status === 404) errorMessage = "Ativos não encontrados (404).";
                
                console.warn(`Brapi Batch Error (${batch.join(',')}): ${errorMessage}`, errorText);
                lastError = errorMessage;
                // Continue to next batch to attempt partial recovery
                continue; 
            }
            
            const data: BrapiResponse = await response.json();

            if (data.error) {
                 lastError = data.message || "Erro na resposta da API";
                 continue;
            }

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
            lastError = error.message || "Erro de conexão";
        }
    }

    // Check if we got any data back. 
    // If result is empty but we had tickers, it means ALL batches failed.
    if (Object.keys(result).length === 0 && tickers.length > 0) {
         // Throw the specific error encountered, not a generic one
         throw new Error(lastError || "Falha desconhecida ao buscar cotações na Brapi API.");
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
