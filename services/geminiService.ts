
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

// Helper robusto para extrair JSON de respostas de LLMs
function extractJSON(text: string): any {
    if (!text) return null;
    
    // 1. Tenta remover blocos de código markdown
    let clean = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    
    // 2. Tenta parse direto
    try {
        return JSON.parse(clean);
    } catch (e) {
        // 3. Tenta encontrar limites de Array [...]
        const startArr = clean.indexOf('[');
        const endArr = clean.lastIndexOf(']');
        if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
            try {
                return JSON.parse(clean.substring(startArr, endArr + 1));
            } catch (e2) {}
        }
        
        // 4. Tenta encontrar limites de Objeto {...}
        const startObj = clean.indexOf('{');
        const endObj = clean.lastIndexOf('}');
        if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
             try {
                const obj = JSON.parse(clean.substring(startObj, endObj + 1));
                // Se esperava array mas veio objeto, encapsula
                return Array.isArray(obj) ? obj : [obj];
             } catch (e3) {}
        }
        
        console.warn("Falha ao extrair JSON da resposta:", text.substring(0, 100) + "...");
        return null;
    }
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
      ROLE: Financial News Aggregator & Analyst.
      TASK: Search for the latest and most relevant news ${searchContext}.
      
      REQUIREMENTS:
      1. Use 'googleSearch' to find REAL facts from the last 3 days.
      2. Focus on: Dividends, earnings, market moves, and economic indicators (Brazil).
      3. Language: Brazilian Portuguese (pt-BR).
      4. RETURN FORMAT: A Raw JSON Array. Do not wrap in markdown if possible.
      
      JSON SCHEMA per item:
      {
        "title": "Headline (max 80 chars)",
        "summary": "Concise summary (max 150 chars)",
        "source": "Publisher Name",
        "date": "YYYY-MM-DD",
        "imageUrl": "URL of a relevant image if available",
        "sentimentScore": 0.5, // Float from -1.0 (negative) to 1.0 (positive)
        "sentimentReason": "Brief reason for sentiment"
      }
      
      Return approximately 6 items.
    `;

    const bytesSent = new Blob([prompt]).size;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Flash is faster and stricter with JSON tasks
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.1, 
            }
        });

        const textResponse = response.text || "[]";
        const bytesReceived = new Blob([textResponse]).size;
        const stats = { bytesSent, bytesReceived };

        let articles: NewsArticle[] = extractJSON(textResponse) || [];

        if (!Array.isArray(articles)) return emptyReturn;

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const webChunks = groundingChunks.filter(c => c.web && c.web.uri);

        articles = articles.map((article, index) => {
            let url = `https://www.google.com/search?q=${encodeURIComponent(article.title + " " + article.source)}`;
            // Tentativa de vincular a fonte real do grounding
            if (index < webChunks.length) {
                url = webChunks[index].web!.uri;
                if ((!article.source || article.source === 'Fonte Desconhecida') && webChunks[index].web!.title) {
                    article.source = webChunks[index].web!.title;
                }
            }
            return {
                ...article,
                url,
                imageUrl: article.imageUrl || `https://source.unsplash.com/random/800x450/?${encodeURIComponent('finance,stock,market,'+ (article.title ? article.title.split(' ')[0] : ''))}`,
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
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { tools: [{ googleSearch: {} }], temperature: 0 }
        });
        
        const data = extractJSON(response.text || "{}");
        
        if (data && typeof data.price === 'number') {
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
        weaknesses?: string[];
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

    const prompt = `
      ROLE: Senior Real Estate Fund (FII) Analyst.
      TASK: Perform a deep fundamental analysis for these Brazilian FIIs: ${tickersString}.
      CURRENT_DATE: ${today}.
      
      RULES FOR SEARCH:
      1. Use 'googleSearch' to find exact data from official sources.
      2. 'businessDescription': Concise 1-sentence summary.
      3. 'riskAssessment': "Baixo", "Médio", "Alto" - reason.
      4. 'marketSentiment': "Bullish", "Bearish", "Neutral".
      5. 'strengths'/'weaknesses': Arrays of 3 short strings.
      
      OUTPUT: JSON Object ONLY (Keys = Ticker).
      
      Structure per Ticker:
      {
        "dy": number, "pvp": number, "assetType": "Tijolo"|"Papel"|...,
        "administrator": string, "vacancyRate": number, "lastDividend": number,
        "netWorth": string, "shareholders": number, "vpPerShare": number,
        "businessDescription": string, "riskAssessment": string, "marketSentiment": string,
        "strengths": [], "weaknesses": [], "dividendCAGR": number, "capRate": number, "managementFee": string,
        "dividendsHistory": [ { "exDate": "YYYY-MM-DD", "paymentDate": "YYYY-MM-DD", "value": number, "isProvisioned": boolean } ]
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

        const data = extractJSON(textResponse);
        if (!data) return emptyReturn;

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
                    weaknesses: Array.isArray(assetData.weaknesses) ? assetData.weaknesses : [],
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
