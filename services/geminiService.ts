import { GoogleGenAI } from '@google/genai';
import type { NewsArticle, AppPreferences, DividendHistoryEvent } from '../types';

function getGeminiApiKey(prefs: AppPreferences): string {
    if (prefs.geminiApiKey && prefs.geminiApiKey.trim() !== '') {
        return prefs.geminiApiKey;
    }
    const envApiKey = (import.meta as any).env.VITE_API_KEY;
    if (envApiKey && envApiKey.trim() !== '') {
        return envApiKey;
    }
    throw new Error("Chave de API do Gemini não configurada.");
}

export interface NewsFilter {
    tickers?: string[];
    dateRange?: 'today' | 'week' | 'month';
    sources?: string;
    query?: string;
    category?: string;
}

export async function fetchMarketNews(prefs: AppPreferences, filter: NewsFilter): Promise<{ data: NewsArticle[], stats: { bytesSent: number, bytesReceived: number } }> {
    const emptyReturn = { data: [], stats: { bytesSent: 0, bytesReceived: 0 } };
    
    let apiKey: string;
    try {
        apiKey = getGeminiApiKey(prefs);
    } catch (error) {
        console.warn("News fetch skipped (No Key):", error);
        return emptyReturn;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Contexto de busca
    let searchContext = "sobre o Mercado Financeiro e Fundos Imobiliários (FIIs) no Brasil";
    if (filter.tickers && filter.tickers.length > 0) {
        const tickers = filter.tickers.slice(0, 5).join(', ');
        searchContext = `focado nos ativos: ${tickers}, e no mercado geral de FIIs`;
    }
    if (filter.query) {
        searchContext += `. Tópico específico: ${filter.query}`;
    }

    const prompt = `
      ROLE: Senior Financial Journalist.
      TASK: Search for recent and impactful news ${searchContext}.
      RULES:
      1. Use googleSearch to find REAL facts from the last 3 days.
      2. For each item, find a relevant, high-quality, and royalty-free image URL. The image should be landscape-oriented. If no good image is found, return an empty string for imageUrl.
      3. Return EXACTLY 6 items.
      4. Summaries must be concise, under 150 characters, and written in Brazilian Portuguese.
      5. OUTPUT: JSON Array ONLY. No markdown.
      
      JSON Structure: [{"title":"","summary":"","source":"","date":"YYYY-MM-DD","sentiment":"Positive"|"Neutral"|"Negative","imageUrl":""}]
    `;

    const bytesSent = new Blob([prompt]).size;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.4, 
            }
        });

        const textResponse = response.text || "[]";
        const bytesReceived = new Blob([textResponse]).size;
        const stats = { bytesSent, bytesReceived };

        // Limpeza e Parsing do JSON
        let cleanJson = textResponse;
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        
        let articles: NewsArticle[] = [];
        try {
            articles = JSON.parse(cleanJson);
        } catch (e) {
            console.error("Erro ao fazer parse do JSON de notícias:", e, cleanJson);
            return emptyReturn;
        }

        if (!Array.isArray(articles)) return emptyReturn;

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const webChunks = groundingChunks.filter(c => c.web && c.web.uri);

        articles = articles.map((article, index) => {
            let url = `https://www.google.com/search?q=${encodeURIComponent(article.title + " " + article.source)}`;
            if (index < webChunks.length) {
                url = webChunks[index].web!.uri;
                if ((!article.source || article.source === 'Fonte Desconhecida') && webChunks[index].web!.title) {
                    article.source = webChunks[index].web!.title;
                }
            }
            return {
                ...article,
                url,
                imageUrl: article.imageUrl || `https://source.unsplash.com/random/800x450/?${encodeURIComponent('finance,stock,market,'+article.title.split(' ').slice(0,2).join(','))}`,
                date: article.date || new Date().toISOString()
            };
        });

        return { data: articles, stats };

    } catch (error: any) {
        console.error("Gemini News Error:", error);
        return emptyReturn;
    }
}

export async function fetchLiveAssetQuote(prefs: AppPreferences, ticker: string): Promise<{ price: number, change: number } | null> {
    let apiKey: string;
    try {
        apiKey = getGeminiApiKey(prefs);
    } catch { return null; }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
        TASK: Find the CURRENT real-time price and today's percentage change for the asset "${ticker}" (B3/Brazil).
        USE TOOL: googleSearch.
        OUTPUT: JSON only: { "price": number, "changePercent": number }.
        Example: { "price": 10.50, "changePercent": 0.45 }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { tools: [{ googleSearch: {} }], temperature: 0 }
        });
        
        const cleanJson = response.text?.replace(/^```json\s*/, '').replace(/```$/, '').trim() || "{}";
        const data = JSON.parse(cleanJson);
        
        if (typeof data.price === 'number') {
            return { price: data.price, change: data.changePercent || 0 };
        }
        return null;
    } catch (e) {
        console.error("Gemini Quote Fallback Failed:", e);
        return null;
    }
}

export async function fetchAdvancedAssetData(prefs: AppPreferences, tickers: string[]): Promise<{ 
    data: Record<string, { 
        dy?: number; 
        pvp?: number; 
        assetType?: string; 
        administrator?: string; 
        vacancyRate?: number; 
        lastDividend?: number; 
        netWorth?: string; 
        shareholders?: number; 
        vpPerShare?: number; 
        businessDescription?: string; 
        riskAssessment?: string;
        marketSentiment?: 'Bullish' | 'Bearish' | 'Neutral';
        strengths?: string[];
        dividendCAGR?: number;
        capRate?: number;
        managementFee?: string;
        dividendsHistory?: DividendHistoryEvent[] 
    }>, 
    stats: { bytesSent: number, bytesReceived: number } 
}> {
    const emptyReturn = { data: {}, stats: { bytesSent: 0, bytesReceived: 0 } };
    if (tickers.length === 0) return emptyReturn;

    let apiKey: string;
    try {
        apiKey = getGeminiApiKey(prefs);
    } catch (error: any) {
        console.warn("Advanced data fetch skipped:", error.message);
        return emptyReturn;
    }

    const ai = new GoogleGenAI({ apiKey });

    const tickersString = tickers.join(', ');
    const today = new Date().toISOString().split('T')[0];

    // Prompt Aprimorado para Análise Fundamentalista Completa
    const prompt = `
      ROLE: Senior Real Estate Fund (FII) Analyst.
      TASK: Perform a deep fundamental analysis for these Brazilian FIIs: ${tickersString}.
      CURRENT_DATE: ${today}.
      
      RULES FOR SEARCH:
      1. Use 'googleSearch' to find exact data from official sources (B3, RI, StatusInvest, ClubeFII).
      2. 'businessDescription': Concise 1-sentence summary of the investment thesis.
      3. 'riskAssessment': A string starting with "Baixo", "Médio" or "Alto" followed by a dash and a 3-5 word reason.
      4. 'marketSentiment': Infer based on recent news/price action: "Bullish", "Bearish" or "Neutral".
      5. 'strengths': JSON Array of 3 short bullet points highlighting key strengths.
      6. 'dividendCAGR': 3-Year Compound Annual Growth Rate of dividends (approximate % float).
      7. 'capRate': Estimated Capitalization Rate (%) for Brick funds.
      
      RULES FOR DIVIDENDS:
      1. Fetch the last 6 dividends.
      2. If Payment Date > Current Date, set "isProvisioned": true.
      3. Dates MUST be 'YYYY-MM-DD'.
      4. Value is "R$ per share".
      
      OUTPUT: JSON Object ONLY. Keys = Ticker.
      
      Structure per Ticker:
      {
        "dy": number (12m yield % value only, e.g. 12.5),
        "pvp": number (e.g. 1.03),
        "assetType": "Tijolo" | "Papel" | "Fiagro" | "FOF" | "Infra" | "Híbrido",
        "administrator": string,
        "vacancyRate": number (physical vacancy %),
        "lastDividend": number,
        "netWorth": string,
        "shareholders": number,
        "vpPerShare": number,
        "businessDescription": string,
        "riskAssessment": string,
        "marketSentiment": "Bullish" | "Bearish" | "Neutral",
        "strengths": string[],
        "dividendCAGR": number,
        "capRate": number,
        "managementFee": string,
        "dividendsHistory": [
           { "exDate": "YYYY-MM-DD", "paymentDate": "YYYY-MM-DD", "value": number, "isProvisioned": boolean }
        ]
      }
    `;

    const bytesSent = new Blob([prompt]).size;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }], 
                temperature: 0, 
            }
        });

        const textResponse = response.text || "{}";
        const bytesReceived = new Blob([textResponse]).size;

        let cleanJson = textResponse.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        let data;
        try {
            data = JSON.parse(cleanJson);
        } catch (e) {
            console.error("Failed to parse Gemini asset data JSON:", e);
            return emptyReturn;
        }

        const sanitizedData: Record<string, any> = {};
        for (const ticker in data) {
            if (Object.prototype.hasOwnProperty.call(data, ticker)) {
                const assetData = data[ticker];
                
                let cleanDividends: DividendHistoryEvent[] = [];
                if (Array.isArray(assetData.dividendsHistory)) {
                    cleanDividends = assetData.dividendsHistory.filter((d: any) => {
                        return d.exDate && d.paymentDate && typeof d.value === 'number' && !isNaN(d.value);
                    }).map((d: any) => ({
                        exDate: d.exDate,
                        paymentDate: d.paymentDate,
                        value: d.value,
                        isProvisioned: !!d.isProvisioned
                    }));
                }

                sanitizedData[ticker] = {
                    dy: typeof assetData.dy === 'number' ? assetData.dy : undefined,
                    pvp: typeof assetData.pvp === 'number' ? assetData.pvp : undefined,
                    assetType: typeof assetData.assetType === 'string' ? assetData.assetType : undefined,
                    administrator: typeof assetData.administrator === 'string' ? assetData.administrator : undefined,
                    vacancyRate: typeof assetData.vacancyRate === 'number' ? assetData.vacancyRate : undefined,
                    lastDividend: typeof assetData.lastDividend === 'number' ? assetData.lastDividend : undefined,
                    netWorth: typeof assetData.netWorth === 'string' ? assetData.netWorth : undefined,
                    shareholders: typeof assetData.shareholders === 'number' ? assetData.shareholders : undefined,
                    vpPerShare: typeof assetData.vpPerShare === 'number' ? assetData.vpPerShare : undefined,
                    businessDescription: typeof assetData.businessDescription === 'string' ? assetData.businessDescription : undefined,
                    riskAssessment: typeof assetData.riskAssessment === 'string' ? assetData.riskAssessment : undefined,
                    marketSentiment: typeof assetData.marketSentiment === 'string' ? assetData.marketSentiment : undefined,
                    strengths: Array.isArray(assetData.strengths) ? assetData.strengths : [],
                    dividendCAGR: typeof assetData.dividendCAGR === 'number' ? assetData.dividendCAGR : undefined,
                    capRate: typeof assetData.capRate === 'number' ? assetData.capRate : undefined,
                    managementFee: typeof assetData.managementFee === 'string' ? assetData.managementFee : undefined,
                    dividendsHistory: cleanDividends.length > 0 ? cleanDividends : undefined
                };
            }
        }

        return { data: sanitizedData, stats: { bytesSent, bytesReceived } };

    } catch (error) {
        console.error("Gemini Advanced Data Error:", error);
        return emptyReturn;
    }
}

export async function validateGeminiKey(key: string): Promise<boolean> {
    if (!key) return false;
    try {
        const ai = new GoogleGenAI({ apiKey: key });
        await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "Hi" });
        return true;
    } catch { return false; }
}