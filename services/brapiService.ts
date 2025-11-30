
import type { AppPreferences, DividendHistoryEvent } from '../types';

interface BrapiHistoricalData {
    date: number; // Unix timestamp
    close: number;
}

interface BrapiQuote {
    symbol: string;
    regularMarketPrice: number;
    historicalDataPrice?: BrapiHistoricalData[];
    dividendData?: {
        historicalDataPrice?: {
            date: number; // exDate timestamp
            paymentDate: number; // paymentDate timestamp
            dividends: { value: number }[];
        }[];
    };
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

export async function fetchBrapiQuotes(prefs: AppPreferences, tickers: string[], lite = false): Promise<{
    quotes: Record<string, { currentPrice: number; priceHistory?: { date: string; price: number }[], dividendsHistory?: DividendHistoryEvent[] }>,
    stats: { bytesReceived: number }
}> {
    const emptyReturn = { quotes: {}, stats: { bytesReceived: 0 } };
    if (tickers.length === 0) {
        return emptyReturn;
    }

    const token = getBrapiToken(prefs);
    const allQuotes: Record<string, { currentPrice: number; priceHistory?: { date: string; price: number }[], dividendsHistory?: DividendHistoryEvent[] }> = {};
    const failedTickers: string[] = [];
    let totalBytesReceived = 0;

    // Function to process a single ticker
    const processTicker = async (ticker: string) => {
        const urlBase = `https://brapi.dev/api/quote/${ticker}`;
        let success = false;
        let resultData: any = null;

        // Optimized ranges: If lite, just get 1d. If full, try deep history.
        const ranges = lite ? ['1d'] : ['5y', '1y', '3mo'];
        
        for (const range of ranges) {
            try {
                // If lite, we don't need dividend data, saving processing time and bandwidth
                const dividendsParam = lite ? 'false' : 'true';
                const response = await fetch(`${urlBase}?range=${range}&dividends=${dividendsParam}&token=${token}`);
                const text = await response.text();
                totalBytesReceived += new Blob([text]).size;

                if (response.status === 403 || response.status === 401) throw new Error("FORBIDDEN_TIER");
                if (!response.ok) continue; // Try next range
                
                const data = JSON.parse(text);
                const result = data.results?.[0];

                if (result) {
                    resultData = result;
                    success = true;
                    break; // Exit range loop
                }
            } catch (e: any) {
                if (e.message === "FORBIDDEN_TIER") break; // Stop trying ranges
            }
        }

        // Fallback for current price only
        if (!success) {
            try {
                const response = await fetch(`${urlBase}?token=${token}`);
                const text = await response.text();
                totalBytesReceived += new Blob([text]).size;
                if (response.ok) {
                    const data = JSON.parse(text);
                    const result = data.results?.[0];
                    if (result) {
                        resultData = result;
                        resultData.historicalDataPrice = [];
                        success = true;
                    }
                }
            } catch (e) { console.error(`Failed fallback for ${ticker}`, e); }
        }

        if (success && resultData) {
            let dividendsHistory: DividendHistoryEvent[] = [];
            let finalHistory: { date: string; price: number }[] = [];

            // Only process history and dividends if NOT in lite mode
            if (!lite) {
                if (resultData.dividendData?.historicalDataPrice) {
                    dividendsHistory = resultData.dividendData.historicalDataPrice.map((item: any) => ({
                        exDate: new Date(item.date * 1000).toISOString().split('T')[0],
                        paymentDate: new Date(item.paymentDate * 1000).toISOString().split('T')[0],
                        value: item.dividends?.[0]?.value || 0
                    })).filter((d: any) => d.value > 0);
                }

                const rawHistory = resultData.historicalDataPrice || [];
                finalHistory = rawHistory.map((item: any) => ({
                    date: new Date(item.date * 1000).toISOString().split('T')[0],
                    price: item.close,
                })).sort((a: any, b: any) => a.date.localeCompare(b.date));
            }

            const currentPrice = resultData.regularMarketPrice || 0;

            // Update current day in history if needed (only for full mode)
            if (!lite && currentPrice > 0) {
                const todayISO = new Date().toISOString().split('T')[0];
                const lastHistoryDate = finalHistory.length > 0 ? finalHistory[finalHistory.length - 1].date : '';
                if (lastHistoryDate !== todayISO) {
                    finalHistory.push({ date: todayISO, price: currentPrice });
                }
            }

            allQuotes[ticker.toUpperCase()] = {
                currentPrice: currentPrice,
                // Only return complex arrays if not lite, otherwise undefined to merge carefully in context
                ...(lite ? {} : { priceHistory: finalHistory, dividendsHistory })
            };
        } else {
            failedTickers.push(ticker);
        }
    };

    // Execute all requests in parallel
    await Promise.all(tickers.map(ticker => processTicker(ticker)));

    if (failedTickers.length === tickers.length && failedTickers.length > 0) {
        throw new Error(`Falha ao atualizar ativos. Verifique conexão.`);
    }

    return { quotes: allQuotes, stats: { bytesReceived: totalBytesReceived } };
}

export async function validateBrapiToken(token: string): Promise<boolean> {
    if (!token || token.trim() === '') return false;
    const url = `https://brapi.dev/api/quote/PETR4?token=${token}`;
    try {
        const response = await fetch(url);
        if(response.status === 401 || response.status === 403) return false;
        return response.ok;
    } catch (error) {
        console.error("Brapi token validation failed:", error);
        return false;
    }
}
