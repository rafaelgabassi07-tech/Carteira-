
import { GoogleGenAI } from '@google/genai';
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

// Helper to extract JSON from Markdown code blocks or raw text
function extractAndParseJSON(text: string): any {
    if (!text) return null;
    try {
        // 1. Try to find JSON inside ```json ... ``` or just ``` ... ```
        const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
            return JSON.parse(match[1]);
        }
        
        // 2. Try to find the first '{' or '[' and the last '}' or ']'
        const firstOpen = text.indexOf('{');
        const firstArray = text.indexOf('[');
        let start = -1;
        
        if (firstOpen !== -1 && firstArray !== -1) start = Math.min(firstOpen, firstArray);
        else if (firstOpen !== -1) start = firstOpen;
        else if (firstArray !== -1) start = firstArray;

        const lastClose = text.lastIndexOf('}');
        const lastArray = text.lastIndexOf(']');
        let end = -1;

        if (lastClose !== -1 && lastArray !== -1) end = Math.max(lastClose, lastArray);
        else if (lastClose !== -1) end = lastClose;
        else if (lastArray !== -1) end = lastArray;

        if (start !== -1 && end !== -1 && end > start) {
            const jsonStr = text.substring(start, end + 1);
            return JSON.parse(jsonStr);
        }

        // 3. Last resort: Try parsing the whole text
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini response:", e);
        console.debug("Raw text:", text);
        return null;
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
    
    let context = "Mercado Financeiro Brasileiro e FIIs";
    if (filter.tickers && filter.tickers.length > 0) {
        context += `. Foco: ${filter.tickers.join(', ')}`;
    }
    if (filter.query) context += `. Tópico: ${filter.query}`;

    // Prompt engineered to force JSON output without Schema validation (incompatible with Search)
    const prompt = `Atue como um jornalista financeiro sênior. Busque notícias recentes e relevantes sobre: ${context}.
    Use a ferramenta googleSearch para encontrar fatos reais e atualizados.
    
    IMPORTANTE: Retorne a resposta ESTRITAMENTE como um array JSON cru. Não use Markdown. Não inclua explicações antes ou depois.
    O formato deve ser exatamente:
    [
      {
        "title": "Título da notícia",
        "summary": "Resumo curto",
        "source": "Fonte",
        "date": "YYYY-MM-DD",
        "sentimentScore": 0.5 (número entre -1 negativo e 1 positivo),
        "sentimentReason": "Motivo do sentimento",
        "url": "Link original se disponível"
      }
    ]`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                // Note: responseSchema and responseMimeType are removed to support googleSearch
            }
        });

        const textData = response.text || "";
        const articles = extractAndParseJSON(textData);
        
        // Enhance with Grounding Metadata (URLs) if JSON url is empty
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const webChunks = groundingChunks.filter(c => c.web && c.web.uri);

        const enhancedArticles = Array.isArray(articles) ? articles.map((art: any, idx: number) => {
            let realUrl = art.url;
            if ((!realUrl || realUrl === 'null') && idx < webChunks.length) realUrl = webChunks[idx].web?.uri;
            if (!realUrl) realUrl = `https://www.google.com/search?q=${encodeURIComponent(art.title)}`;

            return {
                title: art.title || "Sem título",
                summary: art.summary || "...",
                source: art.source || "Gemini News",
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

    const prompt = `Qual é o preço exato (current price) e a variação % hoje do ativo ${ticker} na B3?
    Use googleSearch para buscar o valor em tempo real.
    
    Retorne APENAS um JSON cru no formato:
    { "price": 10.50, "changePercent": 0.5 }
    
    Se não encontrar, retorne null. Não use markdown.`;

    try {
        const response = await ai.models.generateContent({
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

    const prompt = `Realize uma análise fundamentalista precisa para os ativos: [${tickerStr}]. Data de referência: ${today}.
    Use a ferramenta googleSearch obrigatoriamente para buscar dados RECENTES de DY, P/VP, Vacância, Último Provento e Histórico de Dividendos.
    
    Retorne a resposta ESTRITAMENTE como um JSON cru (sem markdown) seguindo esta estrutura exata:
    {
      "assets": [
        {
          "ticker": "AAAA11",
          "dy": 10.5,
          "pvp": 0.98,
          "assetType": "Tijolo|Papel|Fiagro|Infra|FOF",
          "administrator": "Nome Admin",
          "vacancyRate": 5.0,
          "lastDividend": 0.85,
          "netWorth": "R$ 1.5B",
          "shareholders": 250000,
          "vpPerShare": 100.50,
          "businessDescription": "Resumo curto...",
          "riskAssessment": "Baixo/Médio/Alto - Motivo",
          "strengths": ["Ponto forte 1", "Ponto forte 2"],
          "weaknesses": ["Ponto fraco 1"],
          "dividendCAGR": 5.2,
          "managementFee": "1.2% a.a.",
          "dividendsHistory": [
             { "exDate": "YYYY-MM-DD", "paymentDate": "YYYY-MM-DD", "value": 0.85, "isProvisioned": false }
          ]
        }
      ]
    }
    Se um dado não for encontrado, use null.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                // Removed responseSchema to prevent conflict with Google Search tool
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

export async function validateGeminiKey(key: string): Promise<boolean> {
    if (!key) return false;
    try {
        const ai = createClient(key);
        // Simple test call without tools to verify key validity
        await ai.models.generateContent({ 
            model: "gemini-2.5-flash", 
            contents: "Hi" 
        });
        return true;
    } catch (e) {
        return false;
    }
}
