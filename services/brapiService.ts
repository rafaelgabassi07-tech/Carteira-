
import type { AppPreferences, DividendHistoryEvent } from '../types';

interface BrapiHistoricalData {
    date: number; // Unix timestamp
    close: number;
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

// Helpers para gerenciar restrições da API localmente e evitar spam de 403
const isTokenRestricted = () => {
    try {
        return localStorage.getItem('brapi_restricted') === 'true';
    } catch { return false; }
};

const setTokenRestricted = () => {
    try {
        localStorage.setItem('brapi_restricted', 'true');
        console.warn("Brapi API: Token identificado como restrito/gratuito. Ativando modo Lite para evitar erros 403.");
    } catch {}
};

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

    // Se já sabemos que o token é restrito, forçamos o modo Lite
    const forceLite = lite || isTokenRestricted();

    // Function to process a single ticker
    const processTicker = async (ticker: string) => {
        const urlBase = `https://brapi.dev/api/quote/${ticker}`;
        let success = false;
        let resultData: any = null;

        // Se forçado Lite, pulamos tentativas complexas e vamos direto pro fallback/basic
        const ranges = forceLite ? [] : ['1y', '3mo'];
        
        for (const range of ranges) {
            try {
                // If lite, we don't need dividend data, saving processing time and bandwidth
                const dividendsParam = 'true';
                const response = await fetch(`${urlBase}?range=${range}&dividends=${dividendsParam}&token=${token}`);
                
                // Se recebermos 403, marcamos como restrito para o futuro e paramos de tentar endpoints complexos
                if (response.status === 403 || response.status === 401) {
                    setTokenRestricted();
                    throw new Error("FORBIDDEN_TIER");
                }

                const text = await response.text();
                totalBytesReceived += new Blob([text]).size;

                if (!response.ok) continue; // Try next range
                
                const data = JSON.parse(text);
                const result = data.results?.[0];

                if (result) {
                    resultData = result;
                    success = true;
                    break; // Exit range loop
                }
            } catch (e: any) {
                if (e.message === "FORBIDDEN_TIER") break; // Stop trying ranges immediately
            }
        }

        // Fallback for current price only (Basic Quote - geralmente funciona no Free Tier)
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
                        // No basic quote não temos histórico longo garantido
                        resultData.historicalDataPrice = [];
                        success = true;
                    }
                }
            } catch (e) { console.error(`Failed fallback for ${ticker}`, e); }
        }

        if (success && resultData) {
            let dividendsHistory: DividendHistoryEvent[] = [];
            let finalHistory: { date: string; price: number }[] = [];

            // Only process history and dividends if NOT forced lite
            if (!forceLite) {
                // Strategy 1: 'dividendsData.cashDividends' (Standard Modern Brapi)
                const cashDividends = resultData.dividendsData?.cashDividends;
                
                if (Array.isArray(cashDividends) && cashDividends.length > 0) {
                    dividendsHistory = cashDividends.map((d: any) => ({
                        exDate: d.lastDatePrior ? new Date(d.lastDatePrior).toISOString().split('T')[0] : (d.approvedOn ? new Date(d.approvedOn).toISOString().split('T')[0] : ''),
                        paymentDate: d.paymentDate ? new Date(d.paymentDate).toISOString().split('T')[0] : '',
                        value: d.rate || 0
                    })).filter((d: any) => d.value > 0 && d.exDate && d.paymentDate);
                } 
                // Strategy 2: Legacy 'dividendData.historicalDataPrice'
                else if (resultData.dividendData?.historicalDataPrice) {
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
            if (!forceLite && currentPrice > 0) {
                const todayISO = new Date().toISOString().split('T')[0];
                const lastHistoryDate = finalHistory.length > 0 ? finalHistory[finalHistory.length - 1].date : '';
                if (lastHistoryDate !== todayISO) {
                    finalHistory.push({ date: todayISO, price: currentPrice });
                }
            }

            allQuotes[ticker.toUpperCase()] = {
                currentPrice: currentPrice,
                // Only return complex arrays if not lite
                ...(forceLite ? {} : { priceHistory: finalHistory, dividendsHistory })
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
    // Reset restricted state when testing a new token
    localStorage.removeItem('brapi_restricted');
    
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
