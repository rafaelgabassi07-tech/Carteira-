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

export async function fetchBrapiQuotes(prefs: AppPreferences, tickers: string[]): Promise<{
    quotes: Record<string, { currentPrice: number; priceHistory: { date: string; price: number }[], dividendsHistory: DividendHistoryEvent[] }>,
    stats: { bytesReceived: number }
}> {
    const emptyReturn = { quotes: {}, stats: { bytesReceived: 0 } };
    if (tickers.length === 0) {
        return emptyReturn;
    }

    const token = getBrapiToken(prefs);
    const allQuotes: Record<string, { currentPrice: number; priceHistory: { date: string; price: number }[], dividendsHistory: DividendHistoryEvent[] }> = {};
    const failedTickers: string[] = [];
    let totalBytesReceived = 0;

    for (const ticker of tickers) {
        let success = false;
        let historyData: any[] = [];
        let dividendsHistory: DividendHistoryEvent[] = [];
        let currentPrice = 0;
        const urlBase = `https://brapi.dev/api/quote/${ticker}`;
        
        const fetchData = async (range: string): Promise<boolean> => {
            try {
                const response = await fetch(`${urlBase}?range=${range}&dividends=true&token=${token}`);
                const text = await response.text();
                totalBytesReceived += new Blob([text]).size;

                if (response.status === 403 || response.status === 401) throw new Error("FORBIDDEN_TIER");
                if (!response.ok) return false;
                
                const data = JSON.parse(text);
                const result = data.results?.[0];

                if (result) {
                    currentPrice = result.regularMarketPrice;
                    historyData = result.historicalDataPrice || [];
                    if (result.dividendData?.historicalDataPrice) {
                        dividendsHistory = result.dividendData.historicalDataPrice.map((item: any) => ({
                            exDate: new Date(item.date * 1000).toISOString().split('T')[0],
                            paymentDate: new Date(item.paymentDate * 1000).toISOString().split('T')[0],
                            value: item.dividends?.[0]?.value || 0
                        })).filter(d => d.value > 0);
                    }
                    return true;
                }
                return false;
            } catch (e: any) {
                if (e.message !== "FORBIDDEN_TIER") {
                    console.warn(`Failed to fetch ${range} for ${ticker}:`, e.message);
                }
                return false;
            }
        };
        
        success = await fetchData('1y');
        if (!success) { await delay(200); success = await fetchData('3mo'); }
        if (!success) { await delay(200); success = await fetchData('5d'); }
        
        // Fallback for current price only
        if (!success) {
            try {
                await delay(200);
                const response = await fetch(`${urlBase}?token=${token}`);
                const text = await response.text();
                totalBytesReceived += new Blob([text]).size;
                if (response.ok) {
                    const data = JSON.parse(text);
                    const result = data.results?.[0];
                    if (result) {
                        currentPrice = result.regularMarketPrice;
                        historyData = [];
                        success = true;
                    }
                }
            } catch (e) { console.error(`Failed fallback for ${ticker}`, e); }
        }

        if (success) {
             let finalHistory = historyData.map((item: any) => ({
                date: new Date(item.date * 1000).toISOString().split('T')[0],
                price: item.close,
            })).sort((a: any, b: any) => a.date.localeCompare(b.date));

            if (currentPrice > 0) {
                const todayISO = new Date().toISOString().split('T')[0];
                const lastHistoryDate = finalHistory.length > 0 ? finalHistory[finalHistory.length - 1].date : '';
                if (lastHistoryDate !== todayISO) {
                    finalHistory.push({ date: todayISO, price: currentPrice });
                }
            }

             allQuotes[ticker.toUpperCase()] = {
                currentPrice: currentPrice || 0,
                priceHistory: finalHistory,
                dividendsHistory
            };
        } else {
             failedTickers.push(ticker);
        }
    }

    if (failedTickers.length === tickers.length && failedTickers.length > 0) {
        throw new Error(`Falha ao atualizar ativos: ${failedTickers.slice(0,3).join(', ')}... Verifique conexão.`);
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