
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

        // Limpeza e Parsing do JSON
        let cleanJson = textResponse;
        // Remove code blocks markdown se existirem
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        
        let articles: NewsArticle[] = [];
        try {
            articles = JSON.parse(cleanJson);
        } catch (e) {
            console.error("Erro ao fazer parse do JSON de notícias:", e, cleanJson);
            return emptyReturn;
        }

        if (!Array.isArray(articles)) return emptyReturn;

        // GROUNDING: Vincular URLs reais dos metadados de busca
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        // Filtra apenas chunks que são do tipo WEB e possuem URI
        const webChunks = groundingChunks.filter(c => c.web && c.web.uri);

        articles = articles.map((article, index) => {
            let url = `https://www.google.com/search?q=${encodeURIComponent(article.title + " " + article.source)}`;
            
            // Tenta pegar URL do grounding se disponível na mesma posição aproximada
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

export async function fetchAdvancedAssetData(prefs: AppPreferences, tickers: string[]): Promise<{ data: Record<string, { dy?: number; pvp?: number; assetType?: string; administrator?: string; }>, stats: { bytesSent: number, bytesReceived: number } }> {
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

    // Prompt Otimizado para Setorização Precisa
    const prompt = `
      TASK: Retrieve current financial indicators for these Brazilian FIIs: ${tickersString}.
      
      CRITICAL RULES:
      1. Use 'googleSearch' to find real-time values from reliable sources (StatusInvest, ClubeFII, FundsExplorer).
      2. For 'assetType' (Sector), you MUST map the result to EXACTLY one of these categories:
         [ "Tijolo", "Papel", "Fiagro", "FOF", "Infra", "Híbrido", "Outros" ]
         - Example: "Logística", "Lajes", "Shoppings" -> "Tijolo".
         - Example: "Recebíveis", "CRI" -> "Papel".
      3. OUTPUT: JSON Object ONLY. Keys = Ticker (e.g., "MXRF11").
      
      Required Fields per Ticker:
      - "dy": Dividend Yield 12m (number, e.g. 12.5)
      - "pvp": P/VP (number, e.g. 1.03)
      - "assetType": One of the strictly allowed categories above.
      - "administrator": Name of administrator (string)
    `;

    const bytesSent = new Blob([prompt]).size;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }], // ENABLED SEARCH FOR REAL DATA
                temperature: 0, // Deterministic output
            }
        });

        const textResponse = response.text || "{}";
        const bytesReceived = new Blob([textResponse]).size;

        // Clean Parsing
        let cleanJson = textResponse.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        const data = JSON.parse(cleanJson);

        // Sanitize data
        const sanitizedData: Record<string, any> = {};
        for (const ticker in data) {
            if (Object.prototype.hasOwnProperty.call(data, ticker)) {
                const assetData = data[ticker];
                sanitizedData[ticker] = {
                    dy: typeof assetData.dy === 'number' ? assetData.dy : undefined,
                    pvp: typeof assetData.pvp === 'number' ? assetData.pvp : undefined,
                    assetType: typeof assetData.assetType === 'string' ? assetData.assetType : undefined,
                    administrator: typeof assetData.administrator === 'string' ? assetData.administrator : undefined,
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
