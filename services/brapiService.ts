
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
    
    // Priority 2: Environment variable (Direct access)
    const envToken = (import.meta as any).env?.VITE_BRAPI_TOKEN;
    
    if (envToken && envToken.trim() !== '') {
        return envToken;
    }

    throw new Error("Token VITE_BRAPI_TOKEN não encontrado. Verifique Configurações ou Vercel.");
}

// Utility delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchBrapiQuotes(prefs: AppPreferences, tickers: string[]): Promise<Record<string, { currentPrice: number }>> {
    if (tickers.length === 0) {
        return {};
    }

    const token = getBrapiToken(prefs);
    const result: Record<string, { currentPrice: number }> = {};
    
    // Configuration
    const BATCH_SIZE = 10;
    let currentDelay = 300; // Começa rápido (300ms)

    let lastError: string | null = null;

    // Helper function to fetch a single batch
    const fetchBatch = async (batchTickers: string[], isRetry = false): Promise<boolean> => {
        const url = `https://brapi.dev/api/quote/${batchTickers.join(',')}?token=${token}`;
        
        const response = await fetch(url);

        if (response.status === 429) {
            if (!isRetry) {
                console.warn(`Brapi Rate Limit (429) for ${batchTickers[0]}... Pausing and retrying.`);
                // Se der Rate Limit, espera 2.5 segundos e aumenta o delay padrão para os próximos
                await delay(2500);
                currentDelay = 1000; // Reduz a velocidade global para evitar novos erros
                return fetchBatch(batchTickers, true); // Tenta novamente
            } else {
                throw new Error("Limite de requisições excedido (429).");
            }
        }

        if (!response.ok) {
            const status = response.status;
            if (status === 404) throw new Error(`Ativos não encontrados (404).`);
            throw new Error(`Erro ${status} na API.`);
        }

        const data: BrapiResponse = await response.json();

        if (data.error) {
            throw new Error(data.message || "Erro na resposta da API");
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
        return true;
    };

    // Process tickers in batches
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
        const batch = tickers.slice(i, i + BATCH_SIZE);
        
        try {
            // Apply delay between batches (but not before the first one)
            if (i > 0) {
                await delay(currentDelay);
            }

            await fetchBatch(batch);

        } catch (error: any) {
            console.error(`Brapi Batch Error (${batch.join(',')}):`, error.message);
            lastError = error.message;
            // Continue to next batch to get at least partial data
        }
    }

    // If result is empty but we had tickers, it means ALL batches failed.
    if (Object.keys(result).length === 0 && tickers.length > 0) {
         throw new Error(lastError || "Falha ao buscar cotações na Brapi API.");
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
