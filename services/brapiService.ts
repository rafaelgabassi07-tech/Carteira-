
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

        // Estratégia de Fallback em Cascata
        
        // Nível 1: Dados Completos (Histórico 1 ano + Dividendos) 
        // Só tenta se não for forçado Lite e não estiver restrito
        if (!forceLite) {
            try {
                const response = await fetch(`${urlBase}?range=1y&dividends=true&token=${token}`);
                
                if (response.status === 403 || response.status === 401) {
                    setTokenRestricted();
                    throw new Error("FORBIDDEN_TIER");
                }

                if (response.ok) {
                    const text = await response.text();
                    totalBytesReceived += new Blob([text]).size;
                    const data = JSON.parse(text);
                    if (data.results?.[0]) {
                        resultData = data.results[0];
                        success = true;
                    }
                }
            } catch (e: any) {
                if (e.message !== "FORBIDDEN_TIER") console.warn(`Brapi Full fetch failed for ${ticker}`, e);
            }
        }

        // Nível 2: Apenas Dividendos + Cotação (Sem range histórico pesado)
        // Executa se Nível 1 falhou ou foi pulado, mas ainda não é 'lite' estrito
        if (!success && !lite) {
            try {
                // Tenta pegar dividendos sem especificar range (alguns planos free aceitam)
                const response = await fetch(`${urlBase}?dividends=true&token=${token}`);
                
                // Se der 403 aqui também, paciência
                if (response.status !== 403 && response.status !== 401 && response.ok) {
                    const text = await response.text();
                    totalBytesReceived += new Blob([text]).size;
                    const data = JSON.parse(text);
                    if (data.results?.[0]) {
                        resultData = data.results[0];
                        // Marca que não temos histórico de preço detalhado
                        resultData.historicalDataPrice = []; 
                        success = true;
                    }
                }
            } catch (e) {
                console.warn(`Brapi Dividends fetch failed for ${ticker}`, e);
            }
        }

        // Nível 3: Fallback Final - Cotação Básica (Quase sempre funciona)
        if (!success) {
            try {
                const response = await fetch(`${urlBase}?token=${token}`);
                if (response.ok) {
                    const text = await response.text();
                    totalBytesReceived += new Blob([text]).size;
                    const data = JSON.parse(text);
                    if (data.results?.[0]) {
                        resultData = data.results[0];
                        resultData.historicalDataPrice = [];
                        // Se falhou antes, provavelmente não temos dividendos aqui
                        success = true;
                    }
                }
            } catch (e) { console.error(`Brapi Basic fetch failed for ${ticker}`, e); }
        }

        if (success && resultData) {
            let dividendsHistory: DividendHistoryEvent[] = [];
            let finalHistory: { date: string; price: number }[] = [];

            // Processamento de Dividendos (Tenta extrair de onde estiver disponível)
            const cashDividends = resultData.dividendsData?.cashDividends;
            
            if (Array.isArray(cashDividends) && cashDividends.length > 0) {
                dividendsHistory = cashDividends.map((d: any) => ({
                    exDate: d.lastDatePrior ? new Date(d.lastDatePrior).toISOString().split('T')[0] : (d.approvedOn ? new Date(d.approvedOn).toISOString().split('T')[0] : ''),
                    paymentDate: d.paymentDate ? new Date(d.paymentDate).toISOString().split('T')[0] : '',
                    value: d.rate || 0
                })).filter((d: any) => d.value > 0 && d.exDate && d.paymentDate);
            } else if (resultData.dividendData?.historicalDataPrice) {
                // Formato legado/alternativo
                dividendsHistory = resultData.dividendData.historicalDataPrice.map((item: any) => ({
                    exDate: new Date(item.date * 1000).toISOString().split('T')[0],
                    paymentDate: new Date(item.paymentDate * 1000).toISOString().split('T')[0],
                    value: item.dividends?.[0]?.value || 0
                })).filter((d: any) => d.value > 0);
            }

            // Processamento de Histórico de Preço
            const rawHistory = resultData.historicalDataPrice || [];
            if (Array.isArray(rawHistory) && rawHistory.length > 0) {
                finalHistory = rawHistory.map((item: any) => ({
                    date: new Date(item.date * 1000).toISOString().split('T')[0],
                    price: item.close,
                })).sort((a: any, b: any) => a.date.localeCompare(b.date));
            }

            const currentPrice = resultData.regularMarketPrice || 0;

            // Update current day in history if needed
            if (!forceLite && currentPrice > 0 && finalHistory.length > 0) {
                const todayISO = new Date().toISOString().split('T')[0];
                const lastHistoryDate = finalHistory[finalHistory.length - 1].date;
                if (lastHistoryDate !== todayISO) {
                    finalHistory.push({ date: todayISO, price: currentPrice });
                }
            }

            allQuotes[ticker.toUpperCase()] = {
                currentPrice: currentPrice,
                priceHistory: finalHistory,
                dividendsHistory: dividendsHistory // Agora sempre retornamos o array, mesmo que vazio
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
    localStorage.removeItem('brapi_restricted'); // Reset ao testar novo token
    
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
