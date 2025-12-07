
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
    throw new Error("Chave de API do Gemini não configurada. Vá em Configurações > Conexões API.");
}

// Inicializa o cliente com configurações otimizadas
const createClient = (apiKey: string) => new GoogleGenAI({ apiKey });

// Helper genérico para parsear JSON caso o responseMimeType falhe (fallback)
function safeParseJSON(text: string): any {
    try {
        return JSON.parse(text);
    } catch (e) {
        // Tenta limpar blocos de código markdown
        const clean = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(clean);
        } catch (e2) {
            console.error("Falha crítica no parse JSON:", text);
            return null;
        }
    }
}

// --- Interfaces & Schemas ---

export interface NewsFilter {
    tickers?: string[];
    dateRange?: 'today' | 'week' | 'month';
    sources?: string;
    query?: string;
}

// Schema para Notícias
const NewsSchema: Schema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            source: { type: Type.STRING },
            date: { type: Type.STRING, description: "ISO 8601 Date YYYY-MM-DD" },
            sentimentScore: { type: Type.NUMBER, description: "Float from -1.0 (negative) to 1.0 (positive)" },
            sentimentReason: { type: Type.STRING },
            imageUrl: { type: Type.STRING, nullable: true },
            url: { type: Type.STRING, nullable: true }
        },
        required: ["title", "summary", "source", "sentimentScore"]
    }
};

// Schema para Cotação
const QuoteSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        price: { type: Type.NUMBER },
        changePercent: { type: Type.NUMBER }
    },
    required: ["price", "changePercent"]
};

// Schema para Análise Fundamentalista
const FundamentalSchema: Schema = {
    type: Type.OBJECT,
    description: "Map of Ticker to Asset Data. Keys MUST be Uppercase Tickers.",
    properties: {
        // O Gemini retorna um objeto onde as chaves são dinâmicas (os tickers), 
        // mas o Schema rígido exige propriedades definidas.
        // Workaround: Pedir uma lista e transformar em objeto no código, 
        // ou usar um prompt muito forte para structure.
        // Vamos usar Lista para garantir a estrutura e depois converter.
        assets: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    ticker: { type: Type.STRING, description: "Ticker symbol e.g., HGLG11" },
                    dy: { type: Type.NUMBER, nullable: true },
                    pvp: { type: Type.NUMBER, nullable: true },
                    assetType: { type: Type.STRING, nullable: true, description: "Tijolo, Papel, Fiagro, Infra, FOF" },
                    administrator: { type: Type.STRING, nullable: true },
                    vacancyRate: { type: Type.NUMBER, nullable: true },
                    lastDividend: { type: Type.NUMBER, nullable: true },
                    netWorth: { type: Type.STRING, nullable: true },
                    shareholders: { type: Type.NUMBER, nullable: true },
                    vpPerShare: { type: Type.NUMBER, nullable: true },
                    businessDescription: { type: Type.STRING, nullable: true },
                    riskAssessment: { type: Type.STRING, nullable: true },
                    marketSentiment: { type: Type.STRING, nullable: true },
                    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                    dividendCAGR: { type: Type.NUMBER, nullable: true },
                    capRate: { type: Type.NUMBER, nullable: true },
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

// --- API Functions ---

export async function fetchMarketNews(prefs: AppPreferences, filter: NewsFilter): Promise<{ data: NewsArticle[], stats: { bytesSent: number, bytesReceived: number } }> {
    const apiKey = getGeminiApiKey(prefs);
    const ai = createClient(apiKey);
    
    let context = "Mercado Financeiro Brasileiro e FIIs";
    if (filter.tickers && filter.tickers.length > 0) {
        context += `. Foco específico nos ativos: ${filter.tickers.join(', ')}`;
    }
    if (filter.query) {
        context += `. Tópico: ${filter.query}`;
    }

    const prompt = `
        Atue como um analista financeiro sênior. Busque as notícias mais recentes e impactantes sobre: ${context}.
        Requisitos:
        1. Use a ferramenta 'googleSearch' para encontrar fatos REAIS e RECENTES (últimos 3 dias).
        2. Retorne um JSON array estrito seguindo o schema.
        3. Identifique o sentimento da notícia (-1.0 negativo a 1.0 positivo).
        4. Idioma: Português do Brasil (pt-BR).
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: NewsSchema,
                temperature: 0.1 // Baixa temperatura para fatos
            }
        });

        const textData = response.text || "[]";
        const articles = safeParseJSON(textData);
        
        // Grounding Metadata para obter links reais
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const webChunks = groundingChunks.filter(c => c.web && c.web.uri);

        const enhancedArticles = Array.isArray(articles) ? articles.map((art: any, idx: number) => {
            // Tentar enriquecer com URL do grounding se disponível
            let realUrl = art.url;
            if (!realUrl && idx < webChunks.length) {
                realUrl = webChunks[idx].web?.uri;
            }
            // Fallback de URL
            if (!realUrl) {
                realUrl = `https://www.google.com/search?q=${encodeURIComponent(art.title)}`;
            }

            return {
                title: art.title,
                summary: art.summary,
                source: art.source || "Gemini News",
                date: art.date || new Date().toISOString(),
                sentimentScore: art.sentimentScore || 0,
                sentimentReason: art.sentimentReason,
                url: realUrl,
                imageUrl: art.imageUrl // O modelo pode alucinar URLs de imagem, o frontend deve tratar erro de load
            };
        }) : [];

        return {
            data: enhancedArticles,
            stats: { 
                bytesSent: new Blob([prompt]).size, 
                bytesReceived: new Blob([textData]).size 
            }
        };

    } catch (error) {
        console.error("Erro ao buscar notícias Gemini:", error);
        return { data: [], stats: { bytesSent: 0, bytesReceived: 0 } };
    }
}

export async function fetchLiveAssetQuote(prefs: AppPreferences, ticker: string): Promise<{ price: number, change: number } | null> {
    const apiKey = getGeminiApiKey(prefs);
    const ai = createClient(apiKey);

    const prompt = `
        Qual o preço exato (current price) e a variação percentual hoje (change percent) do ativo: ${ticker} na B3 (Brasil)?
        Use o Google Search para pegar o dado de AGORA.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: QuoteSchema
            }
        });

        const data = safeParseJSON(response.text || "{}");
        if (data && typeof data.price === 'number') {
            return { price: data.price, change: data.changePercent || 0 };
        }
        return null;
    } catch (e) {
        console.error(`Erro cotação Gemini (${ticker}):`, e);
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

    const prompt = `
        Analise fundamentalista para os FIIs/Ações: [${tickerStr}]. Data ref: ${today}.
        Use o Google Search para encontrar dados RECENTES de:
        - Dividend Yield 12m, P/VP, Vacância (se FII), Último Provento.
        - Segmento (Tijolo, Papel, Fiagro, Infra, FOF, Shoppings, Logística).
        - Pontos fortes e fracos (breve).
        - Histórico recente de dividendos (Data Com, Pagamento, Valor).
        
        Retorne APENAS um JSON válido.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Modelo mais capaz para raciocínio e busca
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: FundamentalSchema,
                temperature: 0.1
            }
        });

        const textData = response.text || "{}";
        const parsed = safeParseJSON(textData);
        
        // Transformar o array de volta em um mapa Record<string, data>
        const resultMap: Record<string, any> = {};
        
        if (parsed && Array.isArray(parsed.assets)) {
            parsed.assets.forEach((asset: any) => {
                if (asset.ticker) {
                    const cleanTicker = asset.ticker.toUpperCase().trim();
                    
                    // Tratamento de Dividendos
                    let cleanDividends: DividendHistoryEvent[] = [];
                    if (Array.isArray(asset.dividendsHistory)) {
                        cleanDividends = asset.dividendsHistory.filter((d: any) => d.exDate && d.value).map((d: any) => ({
                            exDate: d.exDate,
                            paymentDate: d.paymentDate || d.exDate, // Fallback se faltar pagamento
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
            stats: { 
                bytesSent: new Blob([prompt]).size, 
                bytesReceived: new Blob([textData]).size 
            }
        };

    } catch (e) {
        console.error("Erro análise fundamentalista Gemini:", e);
        throw e;
    }
}

export async function validateGeminiKey(key: string): Promise<boolean> {
    if (!key) return false;
    try {
        const ai = createClient(key);
        // Teste simples sem tools para ser rápido
        await ai.models.generateContent({ 
            model: "gemini-2.5-flash", 
            contents: "Teste conexão. Responda OK." 
        });
        return true;
    } catch (e) {
        console.error("Chave Gemini inválida:", e);
        return false;
    }
}
