
import { GoogleGenAI, Type, Schema } from '@google/genai';
import type { NewsArticle, AppPreferences, DividendHistoryEvent } from '../types';

// --- Configuration & Helpers ---

function getGeminiApiKey(prefs: AppPreferences): string {
    if (prefs.geminiApiKey && prefs.geminiApiKey.trim() !== '') {
        return prefs.geminiApiKey;
    }
    // @ts-ignore
    const envApiKey = import.meta.env.VITE_API_KEY;
    if (envApiKey && envApiKey.trim() !== '') {
        return envApiKey;
    }
    throw new Error("Chave de API do Gemini não configurada.");
}

const createClient = (apiKey: string) => new GoogleGenAI({ apiKey });

// --- Schemas (Structured Output) ---

const NewsResponseSchema: Schema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            source: { type: Type.STRING },
            date: { type: Type.STRING },
            sentimentScore: { type: Type.NUMBER },
            sentimentReason: { type: Type.STRING },
            imageUrl: { type: Type.STRING, nullable: true },
            url: { type: Type.STRING, nullable: true }
        },
        required: ["title", "summary", "source", "sentimentScore"]
    }
};

const QuoteResponseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        price: { type: Type.NUMBER },
        changePercent: { type: Type.NUMBER }
    },
    required: ["price", "changePercent"]
};

// Advanced Asset Schema
const AssetFundamentalSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        assets: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    ticker: { type: Type.STRING },
                    dy: { type: Type.NUMBER, nullable: true },
                    pvp: { type: Type.NUMBER, nullable: true },
                    assetType: { type: Type.STRING, nullable: true },
                    administrator: { type: Type.STRING, nullable: true },
                    vacancyRate: { type: Type.NUMBER, nullable: true },
                    lastDividend: { type: Type.NUMBER, nullable: true },
                    netWorth: { type: Type.STRING, nullable: true },
                    shareholders: { type: Type.NUMBER, nullable: true },
                    vpPerShare: { type: Type.NUMBER, nullable: true },
                    businessDescription: { type: Type.STRING, nullable: true },
                    riskAssessment: { type: Type.STRING, nullable: true },
                    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                    dividendCAGR: { type: Type.NUMBER, nullable: true },
                    managementFee: { type: Type.STRING, nullable: true },
                    dividendsHistory: {
                        type: Type.ARRAY,
                        nullable: true,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                exDate: { type: Type.STRING },
                                paymentDate: { type: Type.STRING },
                                value: { type: Type.NUMBER },
                                isProvisioned: { type: Type.BOOLEAN }
                            }
                        }
                    }
                },
                required: ["ticker"]
            }
        }
    }
};

export interface NewsFilter {
    query?: string;
    tickers?: string[];
    dateRange?: 'today' | 'week' | 'month';
    sources?: string;
}

// --- API Functions ---

export async function fetchMarketNews(prefs: AppPreferences, filter: NewsFilter): Promise<{ data: NewsArticle[], stats: { bytesSent: number, bytesReceived: number } }> {
    const apiKey = getGeminiApiKey(prefs);
    const ai = createClient(apiKey);
    
    let context = "Mercado Financeiro Brasileiro e FIIs";
    if (filter.tickers && filter.tickers.length > 0) {
        context += `. Foco: ${filter.tickers.join(', ')}`;
    }
    if (filter.query) context += `. Tópico: ${filter.query}`;

    // Prompt optimized for Structured Output
    const prompt = `Analista financeiro. Busque notícias recentes sobre: ${context}. Use googleSearch para encontrar fatos reais.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: NewsResponseSchema,
            }
        });

        // SDK handles JSON parsing for us when responseSchema is used
        const articles = response.parsed as any[]; // Safe cast due to Schema
        const textData = response.text || "";
        
        // Enhance with Grounding Metadata (URLs)
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const webChunks = groundingChunks.filter(c => c.web && c.web.uri);

        const enhancedArticles = Array.isArray(articles) ? articles.map((art: any, idx: number) => {
            let realUrl = art.url;
            if (!realUrl && idx < webChunks.length) realUrl = webChunks[idx].web?.uri;
            if (!realUrl) realUrl = `https://www.google.com/search?q=${encodeURIComponent(art.title)}`;

            return {
                title: art.title,
                summary: art.summary,
                source: art.source || "Gemini News",
                date: art.date || new Date().toISOString(),
                sentimentScore: art.sentimentScore || 0,
                sentimentReason: art.sentimentReason,
                url: realUrl,
                imageUrl: art.imageUrl
            };
        }) : [];

        return {
            data: enhancedArticles,
            stats: { bytesSent: prompt.length, bytesReceived: textData.length }
        };

    } catch (error) {
        console.error("Gemini News Error:", error);
        // Ensure error bubbles up to context
        throw error;
    }
}

export async function fetchLiveAssetQuote(prefs: AppPreferences, ticker: string): Promise<{ price: number, change: number } | null> {
    const apiKey = getGeminiApiKey(prefs);
    const ai = createClient(apiKey);

    const prompt = `Preço exato (current price) e variação % hoje de ${ticker} na B3. Use googleSearch.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: QuoteResponseSchema
            }
        });

        const data = response.parsed as any;
        if (data && typeof data.price === 'number') {
            return { price: data.price, change: data.changePercent || 0 };
        }
        return null;
    } catch (e) {
        console.error(`Gemini Quote Error (${ticker}):`, e);
        return null;
    }
}

export async function fetchAdvancedAssetData(prefs: AppPreferences, tickers: string[]): Promise<{ 
    data: Record<string, any>, 
    stats: { bytesSent: number, bytesReceived: number } 
}> {
    if (tickers.length === 0) return { data: {}, stats: { bytesSent: 0, bytesReceived: 0 } };

    const apiKey = getGeminiApiKey(prefs);
    const ai = createClient(apiKey);
    const tickerStr = tickers.join(", ");
    const today = new Date().toISOString().split('T')[0];

    const prompt = `Analise fundamentalista para: [${tickerStr}]. Data ref: ${today}.
    Use googleSearch para buscar dados atualizados de DY, P/VP, Vacância, Último Provento e Histórico de Dividendos.
    REGRA CRÍTICA: Se não encontrar informação para algum campo ou ativo, retorne null ou array vazio. NÃO pare a execução, NÃO retorne erro.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: AssetFundamentalSchema,
                temperature: 0.1
            }
        });

        const parsed = response.parsed as any;
        const textData = response.text || "";
        const resultMap: Record<string, any> = {};
        
        if (parsed && Array.isArray(parsed.assets)) {
            parsed.assets.forEach((asset: any) => {
                if (asset.ticker) {
                    const cleanTicker = asset.ticker.toUpperCase().trim();
                    let cleanDividends: DividendHistoryEvent[] = [];
                    
                    if (Array.isArray(asset.dividendsHistory)) {
                        cleanDividends = asset.dividendsHistory.filter((d: any) => d.exDate && d.value).map((d: any) => ({
                            exDate: d.exDate,
                            paymentDate: d.paymentDate || d.exDate,
                            value: Number(d.value),
                            isProvisioned: !!d.isProvisioned
                        }));
                    }

                    resultMap[cleanTicker] = {
                        ...asset,
                        dividendsHistory: cleanDividends
                    };
                }
            });
        }

        return {
            data: resultMap,
            stats: { bytesSent: prompt.length, bytesReceived: textData.length }
        };

    } catch (e) {
        console.error("Gemini Fundamentals Error:", e);
        throw e;
    }
}

export async function validateGeminiKey(key: string): Promise<boolean> {
    if (!key) return false;
    try {
        const ai = createClient(key);
        // Simple test call
        await ai.models.generateContent({ 
            model: "gemini-2.5-flash", 
            contents: "Hi" 
        });
        return true;
    } catch (e) {
        return false;
    }
}
