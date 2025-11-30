
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
            // A IA geralmente processa e retorna na ordem, mas não é garantido 1:1, é uma heurística.
            if (index < webChunks.length) {
                url = webChunks[index].web!.uri;
                // Se a fonte estiver vazia ou genérica, tenta pegar do chunk
                if ((!article.source || article.source === 'Fonte Desconhecida') && webChunks[index].web!.title) {
                    article.source = webChunks[index].web!.title;
                }
            }

            return {
                ...article,
                url,
                // Garante data válida se a IA falhar
                date: article.date || new Date().toISOString()
            };
        });

        return { data: articles, stats };

    } catch (error: any) {
        console.error("Gemini News Error:", error);
        return emptyReturn;
    }
}

// --- CRITICAL UPGRADE: Historical Prices ---
export async function fetchHistoricalPrices(prefs: AppPreferences, queries: { ticker: string; date: string }[]): Promise<{ data: Record<string, number>, stats: { bytesSent: number, bytesReceived: number } }> {
    const emptyReturn = { data: {}, stats: { bytesSent: 0, bytesReceived: 0 } };
    if (queries.length === 0) return emptyReturn;

    let apiKey: string;
    try {
        apiKey = getGeminiApiKey(prefs);
    } catch (error: any) {
        console.warn("Historical fetch skipped:", error.message);
        return emptyReturn;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Batch queries to save tokens
    const formattedQueries = queries.map(q => `{"ticker": "${q.ticker}", "date": "${q.date}"}`).join(', ');

    // PROMPT BLINDADO
    const prompt = `
      TASK: Find the EXACT closing price (Preço de Fechamento Ajustado) for Brazilian Assets on specific dates.
      INPUT: [${formattedQueries}]
      
      SOURCES: "Investidor10", "StatusInvest", "Google Finance".
      
      STRICT RULES:
      1. Return ONLY a JSON object. Keys = "TICKER_YYYY-MM-DD", Values = Number.
      2. IGNORE Dividends (Values like 0.10, 0.85 are mostly dividends, NOT prices).
      3. IGNORE Daily Variation (Values like 0.5%, -1.2%).
      4. If the price is found, it must be > 0. If not found or uncertain, do not include the key.
      5. If date is weekend/holiday, use previous business day close.
      
      EXAMPLE OUTPUT:
      {
        "MXRF11_2023-09-15": 10.95,
        "HGLG11_2023-05-10": 165.50
      }
    `;
    
    const bytesSent = new Blob([prompt]).size;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0, // Deterministic
            }
        });

        const textResponse = response.text || "{}";
        const bytesReceived = new Blob([textResponse]).size;
        const stats = { bytesSent, bytesReceived };

        // Robust JSON Parsing
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        
        const cleanData: Record<string, number> = {};
        
        if (data && typeof data === 'object') {
            Object.keys(data).forEach(key => {
                let val = data[key];
                if (typeof val === 'string') val = parseFloat(val.replace(',', '.'));
                
                // Sanity Check: Price vs Dividend Confusion
                // Most FIIs are > R$ 5.00. If we get 0.12, it's likely a dividend.
                // Exception: Penny stocks, but uncommon in FII main portfolio.
                if (typeof val === 'number' && !isNaN(val) && val > 2.0) {
                    cleanData[key] = val;
                }
            });
        }
        
        return { data: cleanData, stats };

    } catch (error) {
        console.error("Gemini Historical Error:", error);
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

    const prompt = `
      TASK: Financial indicators for Brazilian FIIs: ${tickersString}.
      SOURCES: "StatusInvest", "FundsExplorer".
      OUTPUT: JSON Object ONLY. Keys=Ticker. No markdown.
      
      Fields required per ticker:
      - "dy": Dividend Yield 12m (number)
      - "pvp": P/VP (number)
      - "assetType": "Tijolo"|"Papel"|"Fiagro"|"FOF"|"Infra"|"Híbrido"
      - "administrator": string
      
      Example: {"MXRF11": {"dy": 12.1, "pvp": 1.03, "assetType": "Papel", "administrator": "BTG"}}
    `;

    const bytesSent = new Blob([prompt]).size;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0,
            }
        });

        const textResponse = response.text || "{}";
        const bytesReceived = new Blob([textResponse]).size;

        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

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
