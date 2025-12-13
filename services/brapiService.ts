
import type { AppPreferences } from '../types';

export function getEnvBrapiToken(): string | undefined {
    // @ts-ignore
    return import.meta.env.VITE_BRAPI_TOKEN;
}

function getBrapiToken(prefs: AppPreferences): string {
    if (prefs.brapiToken && prefs.brapiToken.trim() !== '') {
        return prefs.brapiToken;
    }
    const envToken = getEnvBrapiToken();
    if (envToken && envToken.trim() !== '') {
        return envToken;
    }
    // Don't throw here, return empty to trigger fallback gracefully in caller
    return ""; 
}

const isTokenRestricted = () => {
    try {
        return localStorage.getItem('brapi_restricted') === 'true';
    } catch { return false; }
};

const setTokenRestricted = () => {
    try {
        localStorage.setItem('brapi_restricted', 'true');
    } catch {}
};

export async function fetchBrapiQuotes(prefs: AppPreferences, tickers: string[], lite = false): Promise<{
    quotes: Record<string, { currentPrice: number; changePercent?: number; priceHistory?: { date: string; price: number }[] }>,
    stats: { bytesReceived: number }
}> {
    const emptyReturn = { quotes: {}, stats: { bytesReceived: 0 } };
    if (tickers.length === 0) return emptyReturn;

    const token = getBrapiToken(prefs);
    if (!token) {
        console.warn("Brapi Token missing, skipping to fallback.");
        return emptyReturn;
    }

    const allQuotes: Record<string, any> = {};
    let totalBytesReceived = 0;
    const forceLite = lite || isTokenRestricted();

    const processTicker = async (ticker: string) => {
        const urlBase = `https://brapi.dev/api/quote/${ticker}`;
        let success = false;
        let resultData: any = null;

        // Try Full Data (Range)
        if (!forceLite) {
            try {
                const response = await fetch(`${urlBase}?range=3mo&token=${token}`);
                if (response.status === 403 || response.status === 401) {
                    setTokenRestricted(); // Downgrade for future
                    throw new Error("FORBIDDEN");
                }
                if (response.ok) {
                    const text = await response.text();
                    totalBytesReceived += text.length;
                    const data = JSON.parse(text);
                    if (data.results?.[0]) {
                        resultData = data.results[0];
                        success = true;
                    }
                }
            } catch (e) { /* Fallback to basic */ }
        }

        // Try Basic Data (Current Quote)
        if (!success) {
            try {
                const response = await fetch(`${urlBase}?token=${token}`);
                if (response.ok) {
                    const text = await response.text();
                    totalBytesReceived += text.length;
                    const data = JSON.parse(text);
                    if (data.results?.[0]) {
                        resultData = data.results[0];
                        resultData.historicalDataPrice = []; // No history in basic
                        success = true;
                    }
                }
            } catch (e) { 
                console.warn(`Brapi fetch failed for ${ticker}`, e); 
            }
        }

        if (success && resultData) {
            let finalHistory: { date: string; price: number }[] = [];
            const rawHistory = resultData.historicalDataPrice || [];
            
            if (Array.isArray(rawHistory) && rawHistory.length > 0) {
                finalHistory = rawHistory.map((item: any) => ({
                    date: new Date(item.date * 1000).toISOString().split('T')[0],
                    price: item.close,
                })).sort((a: any, b: any) => a.date.localeCompare(b.date));
            }

            allQuotes[ticker.toUpperCase()] = {
                currentPrice: resultData.regularMarketPrice || 0,
                changePercent: resultData.regularMarketChangePercent || 0,
                priceHistory: finalHistory,
            };
        }
    };

    await Promise.all(tickers.map(ticker => processTicker(ticker)));

    return { quotes: allQuotes, stats: { bytesReceived: totalBytesReceived } };
}

export async function validateBrapiToken(token: string): Promise<boolean> {
    if (!token || token.trim() === '') return false;
    localStorage.removeItem('brapi_restricted');
    try {
        const response = await fetch(`https://brapi.dev/api/quote/PETR4?token=${token}`);
        return response.ok;
    } catch { return false; }
}
