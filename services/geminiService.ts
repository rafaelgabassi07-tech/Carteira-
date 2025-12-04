
import { GoogleGenAI } from '@google/genai';
import type { NewsArticle, AppPreferences, DividendHistoryEvent } from '../types';

function getGeminiApiKey(): string {
    // Strictly follow guidelines: Use process.env.API_KEY exclusively.
    const key = process.env.API_KEY;
    if (key && key.trim() !== '') {
        return key;
    }
    // Fallback to import.meta.env for Vite environments if process.env isn't populated
    const viteKey = (import.meta as any).env?.VITE_API_KEY;
    if (viteKey && viteKey.trim() !== '') {
        return viteKey;
    }
    throw new Error("Chave de API do Gemini (process.env.API_KEY) não configurada.");
}

// Helper robusto para limpar JSON vindo de LLMs
function cleanAndParseJSON(text: string): any {
    if (!text) return [];
    
    // 1. Remove Markdown code blocks
    let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // 2. Encontrar o início e fim do JSON válido (Outermost brackets)
    const firstBrace = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');
    
    if (firstBrace === -1 && firstBracket === -1) throw new Error("JSON invalid format: No brackets found");
    
    const start = (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) ? firstBrace : firstBracket;
    
    const lastBrace = clean.lastIndexOf('}');
    const lastBracket = clean.lastIndexOf(']');
    const end = Math.max(lastBrace, lastBracket);
    
    if (end === -1) throw new Error("JSON invalid format: No closing brackets");

    clean = clean.substring(start, end + 1);

    // 3. Tentar parsear
    try {
        return JSON.parse(clean);
    } catch (e) {
        console.warn("JSON Parse failed, attempting relaxed cleanup...", e);
        // Fallback: Tentar remover trailing commas (comum em LLMs)
        // NOTE: Do NOT remove comments with // regex as it breaks URLs (https://)
        try {
            // Remove trailing commas before } or ]
            let relaxed = clean.replace(/,\s*([\]}])/g, '$1');
            return JSON.parse(relaxed);
        } catch (e2) {
            console.error("Fatal JSON parse error", clean);
            throw new Error("Falha fatal no parsing do JSON.");
        }
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
        apiKey = getGeminiApiKey();
    } catch (error) {
        console.warn("News fetch skipped (No Key):", error);
        return emptyReturn;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    let searchContext = "sobre o Mercado Financeiro e Fundos Imobiliários (FIIs) no Brasil";
    if (filter.tickers && filter.tickers.length > 0) {
        const tickers = filter.tickers.slice(0, 5).join(', ');
        searchContext = `focado nos ativos: ${tickers}, e no mercado geral de FIIs`;
    }
    if (filter.query) {
        // Sanitize query to prevent prompt injection
        const safeQuery = filter.query.replace(/[^\w\sà-úÀ-Ú.,-]/g, '').trim();
        searchContext += `. Tópico específico: "${safeQuery}"`;
    }

    const prompt = `
      ROLE: Senior Financial Journalist.
      TASK: Search for recent and impactful news ${searchContext}.
      RULES:
      1. Use googleSearch to find REAL facts from the last 3 days.
      2. Return EXACTLY 6 items.
      3. OUTPUT: JSON Array ONLY. No markdown.
      
      JSON Structure: [{"title":"","summary":"","source":"","date":"YYYY-MM-DD","sentiment":"Positive"|"Neutral"|"Negative"}]
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

        let articles: NewsArticle[] = [];
        try {
            articles = cleanAndParseJSON(textResponse);
        } catch (e) {
            console.error("Erro ao fazer parse do JSON de notícias:", e);
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
                date: article.date || new Date().toISOString()
            };
        });

        return { data: articles, stats };

    } catch (error: any) {
        console.error("Gemini News Error:", error);
        return emptyReturn;
    }
}

export async function fetchLiveAssetQuote(prefs: AppPreferences, ticker: string): Promise<{ price: number, change: number, sources: string[] } | null> {
    let apiKey: string;
    try {
        apiKey = getGeminiApiKey();
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
        
        const data = cleanAndParseJSON(response.text || "{}");
        
        // Extract grounding sources for compliance
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = (groundingChunks as any[])
            .map((c: any) => c.web?.uri)
            .filter((uri: any): uri is string => typeof uri === 'string' && uri.trim() !== '');
        
        if (typeof data.price === 'number') {
            return { 
                price: data.price, 
                change: data.changePercent || 0,
                sources: [...new Set(sources)] // Unique sources
            };
        }
        return null;
    } catch (e) {
        console.error("Gemini Quote Fallback Failed:", e);
        return null;
    }
}

// Batching Helper
async function processBatchInChunks(items: string[], batchSize: number, processor: (chunk: string[]) => Promise<any>): Promise<{ mergedData: any, totalStats: { bytesSent: number, bytesReceived: number } }> {
    let mergedData = {};
    let totalStats = { bytesSent: 0, bytesReceived: 0 };

    for (let i = 0; i < items.length; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        try {
            const result = await processor(chunk);
            mergedData = { ...mergedData, ...result.data };
            totalStats.bytesSent += result.stats.bytesSent;
            totalStats.bytesReceived += result.stats.bytesReceived;
        } catch (e) {
            console.error(`Error processing chunk ${i}:`, e);
        }
    }
    return { mergedData, totalStats };
}

export async function fetchAdvancedAssetData(prefs: AppPreferences, tickers: string[]): Promise<{ 
    data: Record<string, any>, 
    stats: { bytesSent: number, bytesReceived: number } 
}> {
    const emptyReturn = { data: {}, stats: { bytesSent: 0, bytesReceived: 0 } };
    if (tickers.length === 0) return emptyReturn;

    let apiKey: string;
    try {
        apiKey = getGeminiApiKey();
    } catch (error: any) {
        console.warn("Advanced data fetch skipped:", error.message);
        return emptyReturn;
    }

    const ai = new GoogleGenAI({ apiKey });
    const today = new Date().toISOString().split('T')[0];

    // Processor function for a single chunk
    const processChunk = async (chunkTickers: string[]) => {
        const tickersString = chunkTickers.join(', ');
        
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
        
        // Extract Grounding Source URLs
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sourceUrls = (groundingChunks as any[])
            .map((c: any) => c.web?.uri)
            .filter((uri: any): uri is string => typeof uri === 'string' && uri.trim() !== '');
        // Remove duplicates
        const uniqueSources = [...new Set(sourceUrls)];

        let data: Record<string, any> = {};
        try {
            data = cleanAndParseJSON(textResponse);
            // Attach sources to each asset data object for this chunk
            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    data[key].sources = uniqueSources;
                }
            }
        } catch (e) {
            console.error("Failed to parse Gemini chunk:", e);
        }

        return { data, stats: { bytesSent, bytesReceived } };
    };

    // Process in chunks of 3 to avoid context limits and reduce latency per request
    const { mergedData, totalStats } = await processBatchInChunks(tickers, 3, processChunk);

    // Sanitize and Validate Data
    const sanitizedData: Record<string, any> = {};
    for (const ticker in mergedData) {
        if (Object.prototype.hasOwnProperty.call(mergedData, ticker)) {
            const assetData = mergedData[ticker];
            
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
                dividendsHistory: cleanDividends.length > 0 ? cleanDividends : undefined,
                sources: Array.isArray(assetData.sources) ? assetData.sources : []
            };
        }
    }

    return { data: sanitizedData, stats: totalStats };
}

export async function validateGeminiKey(key: string): Promise<boolean> {
    if (!key) return false;
    try {
        const ai = new GoogleGenAI({ apiKey: key });
        await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "Hi" });
        return true;
    } catch { return false; }
}
