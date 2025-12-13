
import { GoogleGenAI } from '@google/genai';
import type { NewsArticle, AppPreferences, DividendHistoryEvent } from '../types';

// --- Configuration & Helpers ---

export function getEnvGeminiApiKey(): string | undefined {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
}

function getGeminiApiKey(prefs: AppPreferences): string {
    if (prefs.geminiApiKey && prefs.geminiApiKey.trim() !== '') {
        return prefs.geminiApiKey;
    }
    const envApiKey = getEnvGeminiApiKey();
    if (envApiKey && envApiKey.trim() !== '') {
        return envApiKey;
    }
    throw new Error("Chave de API do Gemini não configurada.");
}

const createClient = (apiKey: string) => new GoogleGenAI({ apiKey });

// Enhanced Helper to extract JSON from potentially messy text
function extractAndParseJSON(text: string): any {
    if (!text) return null;
    try {
        // 1. Try to find JSON inside markdown code blocks
        const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        let jsonStr = match && match[1] ? match[1] : text;

        // 2. Aggressive Cleanup: Find the first '[' or '{' and the last ']' or '}'
        const firstOpen = jsonStr.search(/[\{\[]/);
        const lastClose = jsonStr.search(/[\]\}][^\]\}]*$/);

        if (firstOpen !== -1 && lastClose !== -1) {
            jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
        } else if (firstOpen !== -1) {
             // Try to recover if only start found (rare)
             jsonStr = jsonStr.substring(firstOpen);
        }

        // 3. Remove typical JS comments if any leaked
        jsonStr = jsonStr.replace(/\/\/.*$/gm, ''); 
        
        // 4. Clean trailing commas (common LLM error)
        jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');

        return JSON.parse(jsonStr);
    } catch (e) {
        console.warn("Failed to parse JSON from Gemini response. Raw text:", text);
        return null;
    }
}

// --- Helper for 429 Retries ---
async function generateContentWithRetry(
    ai: GoogleGenAI, 
    params: any, 
    maxRetries = 3
): Promise<any> {
    let attempt = 0;
    
    while (attempt <= maxRetries) {
        try {
            const response = await ai.models.generateContent(params);
            return response;
        } catch (error: any) {
            const isQuotaError = error.status === 429 || 
                                 (error.message && error.message.includes('429')) ||
                                 (error.message && error.message.includes('quota'));

            if (isQuotaError && attempt < maxRetries) {
                attempt++;
                let waitTime = 5000 * Math.pow(2, attempt);
                if (error.message) {
                    const match = error.message.match(/retry in (\d+(\.\d+)?)s/);
                    if (match && match[1]) waitTime = (parseFloat(match[1]) + 1) * 1000;
                }
                console.warn(`Gemini Quota 429. Retry ${attempt}/${maxRetries} in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            throw error;
        }
    }
}

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
    
    let context = "";
    if (filter.query && filter.query.trim().length > 0) {
        context = `TEMA: "${filter.query}". Notícias recentes.`;
    } else {
        context = "Resumo do Mercado Financeiro Brasileiro";
        if (filter.tickers && filter.tickers.length > 0) {
            // Limit tickers to prevent context overflow
            context += ` com foco: ${filter.tickers.slice(0, 10).join(', ')}`;
        }
    }

    const prompt = `
    ${context}
    Busque notícias reais e recentes (últimas 48h) usando o Google Search.
    
    RETORNE APENAS UM ARRAY JSON. SEM MARKDOWN. SEM TEXTO EXTRA.
    Formato obrigatório:
    [
      {
        "title": "Título (PT-BR)",
        "summary": "Resumo curto",
        "source": "Fonte",
        "date": "YYYY-MM-DD",
        "sentimentScore": 0.5,
        "url": "link"
      }
    ]
    `;

    try {
        const response = await generateContentWithRetry(ai, {
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        const textData = response.text || "";
        const articles = extractAndParseJSON(textData);
        
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const webChunks = groundingChunks.filter((c: any) => c.web && c.web.uri);

        const enhancedArticles = Array.isArray(articles) ? articles.map((art: any, idx: number) => {
            let realUrl = art.url;
            // Use grounding data if URL is missing or placeholder
            if ((!realUrl || realUrl === 'link' || realUrl.length < 5) && idx < webChunks.length) {
                realUrl = webChunks[idx].web?.uri;
            }
            if (!realUrl) realUrl = `https://www.google.com/search?q=${encodeURIComponent(art.title)}`;

            return {
                title: art.title || "Notícia de Mercado",
                summary: art.summary || "...",
                source: art.source || "Invest News",
                date: art.date || new Date().toISOString(),
                sentimentScore: typeof art.sentimentScore === 'number' ? art.sentimentScore : 0,
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
        throw error;
    }
}

export async function fetchLiveAssetQuote(prefs: AppPreferences, ticker: string): Promise<{ price: number, change: number } | null> {
    const apiKey = getGeminiApiKey(prefs);
    const ai = createClient(apiKey);

    const prompt = `
    Qual o preço atual (BRL) e variação (%) de ${ticker}?
    Use googleSearch.
    Retorne JSON puro: { "price": 10.50, "changePercent": 0.5 }
    `;

    try {
        const response = await generateContentWithRetry(ai, {
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        const data = extractAndParseJSON(response.text || "");
        
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

    const prompt = `Analise os dados fundamentalistas: [${tickerStr}]. Data: ${today}.
    Use googleSearch para buscar DY, P/VP, Vacância e Dividendos recentes.
    
    RETORNE APENAS UM JSON (SEM MARKDOWN):
    {
      "assets": [
        {
          "ticker": "XXXX11",
          "dy": 10.5,
          "pvp": 0.98,
          "assetType": "Tijolo|Papel|Fiagro|Infra|FOF",
          "administrator": "Nome Admin",
          "vacancyRate": 5.0,
          "lastDividend": 0.85,
          "netWorth": "R$ 1.5B",
          "shareholders": 250000,
          "vpPerShare": 100.50,
          "liquidity": 2000000,
          "dividendsHistory": [
             { "exDate": "YYYY-MM-DD", "paymentDate": "YYYY-MM-DD", "value": 0.85, "isProvisioned": false }
          ]
        }
      ]
    }`;

    try {
        const response = await generateContentWithRetry(ai, {
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        const textData = response.text || "";
        const parsed = extractAndParseJSON(textData);
        
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

export async function askAssetAnalyst(
    prefs: AppPreferences, 
    ticker: string, 
    question: string, 
    assetContext: any
): Promise<{ answer: string; stats: { bytesSent: number; bytesReceived: number } }> {
    const apiKey = getGeminiApiKey(prefs);
    const ai = createClient(apiKey);

    const contextString = JSON.stringify(assetContext, null, 2);
    
    const prompt = `
    Contexto do Ativo ${ticker}: ${contextString}
    Pergunta: "${question}"
    
    Como analista financeiro sênior, responda em Português do Brasil. Use dados do contexto.
    Se faltar informação recente, use googleSearch.
    Seja conciso.
    `;

    try {
        const response = await generateContentWithRetry(ai, {
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        const answer = response.text || "Sem resposta.";
        
        return {
            answer,
            stats: { bytesSent: prompt.length, bytesReceived: answer.length }
        };

    } catch (error: any) {
        console.error("AI Analyst Error:", error);
        throw new Error("Erro ao consultar o analista.");
    }
}

export async function validateGeminiKey(key: string): Promise<boolean> {
    if (!key) return false;
    try {
        const ai = createClient(key);
        await ai.models.generateContent({ 
            model: "gemini-2.5-flash", 
            contents: "Teste" 
        });
        return true;
    } catch (e) {
        return false;
    }
}
