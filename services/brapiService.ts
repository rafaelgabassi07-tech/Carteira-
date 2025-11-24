
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

export async function fetchBrapiQuotes(prefs: AppPreferences, tickers: string[]): Promise<Record<string, { currentPrice: number; priceHistory: { date: string; price: number }[], dividendsHistory: DividendHistoryEvent[] }>> {
    if (tickers.length === 0) {
        return {};
    }

    const token = getBrapiToken(prefs);
    const allQuotes: Record<string, { currentPrice: number; priceHistory: { date: string; price: number }[], dividendsHistory: DividendHistoryEvent[] }> = {};
    const failedTickers: string[] = [];

    for (const ticker of tickers) {
        let success = false;
        let historyData: any[] = [];
        let dividendsHistory: DividendHistoryEvent[] = [];
        let currentPrice = 0;
        const urlBase = `https://brapi.dev/api/quote/${ticker}`;

        // Strategy: Try 1y (Premium/Full) -> 3mo (Intermediate) -> 5d (Free/Short) -> Current Price (Fallback)
        
        // 1. Try Long Range (1y)
        try {
            const response = await fetch(`${urlBase}?range=1y&dividends=true&token=${token}`);
            
            if (response.status === 403 || response.status === 401) {
                throw new Error("FORBIDDEN_TIER");
            }
            
            if (response.ok) {
                const data = await response.json();
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
                    success = true;
                }
            }
        } catch (e: any) {
            if (e.message !== "FORBIDDEN_TIER") {
                 console.warn(`Failed to fetch 1y for ${ticker} (Retrying with shorter range...):`, e.message);
            }
        }

        // 2. Try Intermediate Range (3mo) - Better than 5d if 1y fails
        if (!success) {
             try {
                await delay(200); 
                const response = await fetch(`${urlBase}?range=3mo&dividends=true&token=${token}`);
                
                if (response.ok) {
                    const data = await response.json();
                    const result = data.results?.[0];
                     if (result) {
                        currentPrice = result.regularMarketPrice;
                        historyData = result.historicalDataPrice || [];
                        // Dividends logic same as above
                        if (result.dividendData?.historicalDataPrice) {
                            dividendsHistory = result.dividendData.historicalDataPrice.map((item: any) => ({
                                exDate: new Date(item.date * 1000).toISOString().split('T')[0],
                                paymentDate: new Date(item.paymentDate * 1000).toISOString().split('T')[0],
                                value: item.dividends?.[0]?.value || 0
                            })).filter(d => d.value > 0);
                        }
                        success = true;
                    }
                }
            } catch (e) {
                console.warn(`Failed to fetch 3mo for ${ticker}`, e);
            }
        }

        // 3. Try Short Range (5d) - If others failed
        if (!success) {
             try {
                await delay(200); 
                const response = await fetch(`${urlBase}?range=5d&dividends=true&token=${token}`);
                
                if (response.ok) {
                    const data = await response.json();
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
                        success = true;
                    }
                }
            } catch (e) {
                console.warn(`Failed to fetch 5d for ${ticker}`, e);
            }
        }

        // 4. Current Price Only (Last Resort)
        if (!success) {
             try {
                await delay(200);
                const response = await fetch(`${urlBase}?token=${token}`);
                 if (response.ok) {
                    const data = await response.json();
                    const result = data.results?.[0];
                     if (result) {
                        currentPrice = result.regularMarketPrice;
                        historyData = []; // No history
                        success = true;
                    }
                }
            } catch (e) {
                console.error(`Failed fallback for ${ticker}`, e);
            }
        }

        if (success) {
             let finalHistory = historyData.map((item: any) => ({
                date: new Date(item.date * 1000).toISOString().split('T')[0],
                price: item.close,
            })).sort((a: any, b: any) => a.date.localeCompare(b.date));

            // CRITICAL FIX: Ensure history has at least the current price point if missing or outdated
            // This allows the 'Carry-Forward' logic in PortfolioContext to work even if history is empty
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

    return allQuotes;
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
