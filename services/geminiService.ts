
import { GoogleGenAI } from '@google/genai';
import type { NewsArticle, AppPreferences, DividendHistoryEvent } from '../types';

// --- Configuration & Helpers ---

// Helper para expor se a chave existe no ambiente (para a UI)
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
        // 1. Try to find JSON inside ```json ... ``` or just ``` ... ```
        const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        let jsonStr = match && match[1] ? match[1] : text;

        // 2. Locate the outermost brackets to discard surrounding text
        const firstOpen = jsonStr.indexOf('{');
        const firstArray = jsonStr.indexOf('[');
        let start = -1;
        
        if (firstOpen !== -1 && firstArray !== -1) start = Math.min(firstOpen, firstArray);
        else if (firstOpen !== -1) start = firstOpen;
        else if (firstArray !== -1) start = firstArray;

        const lastClose = jsonStr.lastIndexOf('}');
        const lastArray = jsonStr.lastIndexOf(']');
        let end = -1;

        if (lastClose !== -1 && lastArray !== -1) end = Math.max(lastClose, lastArray);
        else if (lastClose !== -1) end = lastClose;
        else if (lastArray !== -1) end = lastArray;

        if (start !== -1 && end !== -1 && end > start) {
            jsonStr = jsonStr.substring(start, end + 1);
        }

        // 3. Sanitization: Remove comments and trailing commas which break JSON.parse
        jsonStr = jsonStr.replace(/\/\/.*$/gm, ''); // Remove single-line comments
        jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1'); // Remove trailing commas before closing brackets

        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini response:", e);
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
            // Check for 429 (Resource Exhausted / Quota Exceeded)
            // Google GenAI SDK might wrap the error, check status or message
            const isQuotaError = error.status === 429 || 
                                 (error.message && error.message.includes('429')) ||
                                 (error.message && error.message.includes('quota'));

            if (isQuotaError && attempt < maxRetries) {
                attempt++;
                
                // Try to parse "Please retry in X s." from message
                let waitTime = 5000 * Math.pow(2, attempt); // Default exponential backoff: 10s, 20s, 40s
                
                if (error.message) {
                    const match = error.message.match(/retry in (\d+(\.\d+)?)s/);
                    if (match && match[1]) {
                        // Add 1s buffer to the suggested time
                        waitTime = (parseFloat(match[1]) + 1) * 1000;
                    }
                }

                console.warn(`Gemini Quota Exceeded (429). Waiting ${waitTime}ms before retry ${attempt}/${maxRetries}...`);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            
            // If not 429 or max retries reached, throw
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
        // Use the retry wrapper
        const response = await generateContentWithRetry(ai, {
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        const textData = response.text || "";
        const articles = extractAndParseJSON(textData);
        
        // Enhance with Grounding Metadata (URLs) if JSON url is empty
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const webChunks = groundingChunks.filter((c: any) => c.web && c.web.uri);

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

    // Consolidated prompt for batched requests
    const prompt = `Analise os dados fundamentalistas para os ativos: [${tickerStr}]. Data de hoje: ${today}.
    Use a ferramenta googleSearch para buscar dados RECENTES de DY, P/VP, Vacância e Histórico de Dividendos para CADA UM dos ativos listados.
    
    IMPORTANTE: Você deve processar TODOS os ativos da lista. Não pule nenhum. O output deve conter um objeto para cada ativo solicitado.
    
    Primeiro, colete os dados. DEPOIS, retorne um JSON seguindo EXATAMENTE este formato:
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
          "businessDescription": "Resumo curto...",
          "riskAssessment": "Baixo/Médio/Alto - Motivo",
          "strengths": ["Ponto forte 1"],
          "weaknesses": ["Ponto fraco 1"],
          "dividendCAGR": 5.2,
          "managementFee": "1.2% a.a.",
          "dividendsHistory": [
             { "exDate": "YYYY-MM-DD", "paymentDate": "YYYY-MM-DD", "value": 0.85, "isProvisioned": false }
          ]
        }
      ]
    }
    
    Se um dado numérico não for encontrado, use null (não use zero se não for zero).`;

    try {
        // Use the retry wrapper for heavy requests
        const response = await generateContentWithRetry(ai, {
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                // Removed responseSchema to prevent conflict with Google Search tool and allow text processing
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

    // Prepare context to grounding the AI
    const contextString = JSON.stringify(assetContext, null, 2);
    const today = new Date().toLocaleDateString('pt-BR');

    const prompt = `
    Atue como um Analista Financeiro Sênior (CFA) especializado em Fundos Imobiliários (FIIs) e Ações Brasileiras.
    O usuário está perguntando sobre o ativo: ${ticker}.
    
    DADOS FUNDAMENTAIS ATUAIS (Use estes dados como verdade absoluta):
    ${contextString}
    
    Data de hoje: ${today}
    
    PERGUNTA DO USUÁRIO: "${question}"
    
    DIRETRIZES:
    1. Seja direto, objetivo e profissional.
    2. Use os dados fornecidos acima para embasar sua resposta. Se o P/VP estiver alto, mencione. Se a vacância for risco, alerte.
    3. Se a pergunta for sobre "Vale a pena?", analise os prós e contras baseado nos indicadores (DY, P/VP, Liquidez), mas finalize com o disclaimer padrão.
    4. Use formatação Markdown (negrito para destaque, listas para tópicos).
    5. Se precisar de informações recentes que NÃO estão no JSON (ex: fatos relevantes de ontem), use a ferramenta googleSearch.
    
    Responda em português do Brasil.`;

    try {
        const response = await generateContentWithRetry(ai, {
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        const answer = response.text || "Não consegui analisar este cenário no momento.";
        
        return {
            answer,
            stats: { bytesSent: prompt.length, bytesReceived: answer.length }
        };

    } catch (error: any) {
        console.error("AI Analyst Error:", error);
        throw new Error(error.message || "Erro ao consultar o analista.");
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
