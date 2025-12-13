
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

// Helper robusto para limpar e extrair JSON de respostas da IA
function extractAndParseJSON(text: string): any {
    if (!text) return null;
    try {
        // 1. Tenta extrair de blocos de código markdown ```json ... ```
        const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        let jsonCandidate = markdownMatch ? markdownMatch[1] : text;

        // 2. Limpeza agressiva: encontrar o primeiro '[' ou '{' e o último ']' ou '}'
        const firstOpenBrace = jsonCandidate.indexOf('{');
        const firstOpenBracket = jsonCandidate.indexOf('[');
        
        let startIndex = -1;
        if (firstOpenBrace !== -1 && firstOpenBracket !== -1) {
            startIndex = Math.min(firstOpenBrace, firstOpenBracket);
        } else {
            startIndex = Math.max(firstOpenBrace, firstOpenBracket);
        }

        if (startIndex !== -1) {
            // Encontrar o fechamento correspondente
            const lastCloseBrace = jsonCandidate.lastIndexOf('}');
            const lastCloseBracket = jsonCandidate.lastIndexOf(']');
            const endIndex = Math.max(lastCloseBrace, lastCloseBracket);
            
            if (endIndex > startIndex) {
                jsonCandidate = jsonCandidate.substring(startIndex, endIndex + 1);
            }
        }

        // 3. Remove comentários JS (//) que a IA as vezes insere
        jsonCandidate = jsonCandidate.replace(/\/\/.*$/gm, ''); 
        
        // 4. Corrige vírgulas sobrando antes de fechar arrays/objetos
        jsonCandidate = jsonCandidate.replace(/,\s*([\]}])/g, '$1');

        return JSON.parse(jsonCandidate);
    } catch (e) {
        console.warn("Falha no parsing JSON da IA. Texto bruto:", text);
        return null;
    }
}

// Helper para retry automático em caso de erro 429 (Quota)
async function generateContentWithRetry(
    ai: GoogleGenAI, 
    params: any, 
    maxRetries = 2
): Promise<any> {
    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            const response = await ai.models.generateContent(params);
            return response;
        } catch (error: any) {
            const isQuota = error.status === 429 || (error.message && error.message.includes('429'));
            if (isQuota && attempt < maxRetries) {
                attempt++;
                await new Promise(r => setTimeout(r, 2000 * attempt)); // Backoff simples
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
    
    // Construção do contexto temporal para garantir notícias frescas
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    
    let searchTopic = "Fundos Imobiliários (FIIs) e Mercado Financeiro Brasil";
    if (filter.query && filter.query.trim().length > 0) {
        searchTopic = filter.query;
    } else if (filter.tickers && filter.tickers.length > 0) {
        // Foca nos primeiros 5 tickers para não poluir a busca
        searchTopic = `Notícias recentes sobre: ${filter.tickers.slice(0, 5).join(', ')}`;
    }

    const timeContext = filter.dateRange === 'today' ? 'nas últimas 24 horas' : 
                        filter.dateRange === 'month' ? 'no último mês' : 'nesta semana';

    const prompt = `
    Data atual: ${dateStr}.
    Tarefa: Atue como um agregador de notícias financeiras via API JSON.
    
    Use a ferramenta googleSearch para encontrar notícias REAIS e ATUAIS sobre: "${searchTopic}".
    Foco temporal: ${timeContext}.
    
    Regras estritas de saída:
    1. Retorne APENAS um array JSON válido.
    2. Não inclua texto introdutório como "Aqui estão as notícias".
    3. Se não encontrar notícias específicas, busque tendências gerais do IFIX.
    
    Schema do JSON:
    [
      {
        "title": "Título da manchete (max 80 caracteres)",
        "summary": "Resumo objetivo em português (max 150 caracteres)",
        "source": "Nome da Fonte (ex: InfoMoney, Valor)",
        "date": "YYYY-MM-DDTHH:mm:ssZ (ISO 8601 aproximado)",
        "sentimentScore": 0.5 (número entre -1.0 negativo e 1.0 positivo),
        "url": "URL da notícia se disponível, senão null"
      }
    ]
    `;

    try {
        const response = await generateContentWithRetry(ai, {
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                // Nota: responseMimeType 'application/json' conflita com googleSearch em algumas versões, 
                // então confiamos no prompt engineering e no parser robusto.
            }
        });

        const textData = response.text || "";
        const parsedData = extractAndParseJSON(textData);
        
        let articles: NewsArticle[] = [];

        if (Array.isArray(parsedData)) {
            // Tenta enriquecer URLs usando os chunks de aterramento (grounding) se o JSON não tiver links
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            const webChunks = groundingChunks.filter((c: any) => c.web?.uri);

            articles = parsedData.map((art: any, index: number) => {
                let finalUrl = art.url;
                
                // Se a URL for inválida ou genérica, tenta pegar do grounding
                if ((!finalUrl || finalUrl.includes('null') || finalUrl.length < 10) && index < webChunks.length) {
                    finalUrl = webChunks[index].web.uri;
                }
                
                // Fallback final para busca no Google
                if (!finalUrl || finalUrl.length < 5) {
                    finalUrl = `https://www.google.com/search?q=${encodeURIComponent(art.title + " " + art.source)}`;
                }

                return {
                    title: art.title || "Notícia do Mercado",
                    summary: art.summary || "Sem resumo disponível.",
                    source: art.source || "Invest App",
                    date: art.date || new Date().toISOString(),
                    sentimentScore: typeof art.sentimentScore === 'number' ? art.sentimentScore : 0,
                    url: finalUrl
                };
            });
        }

        return {
            data: articles,
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
    Data de hoje: ${new Date().toLocaleDateString('pt-BR')}.
    Qual o preço atual (BRL) e variação (%) do ativo ${ticker}?
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
        
        if (data && (typeof data.price === 'number' || typeof data.price === 'string')) {
            return { 
                price: typeof data.price === 'string' ? parseFloat(data.price.replace(',','.')) : data.price,
                change: typeof data.changePercent === 'string' ? parseFloat(data.changePercent.replace(',','.')) : (data.changePercent || 0)
            };
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

    const prompt = `
    Analise os dados fundamentalistas para: [${tickerStr}]. 
    Data de referência: ${today}.
    Use googleSearch para buscar DY, P/VP, Vacância e Dividendos recentes.
    
    RETORNE APENAS JSON (sem markdown):
    {
      "assets": [
        {
          "ticker": "XXXX11",
          "dy": 10.5 (anual),
          "pvp": 0.98,
          "assetType": "Tijolo|Papel|Fiagro|Infra|FOF",
          "administrator": "Nome Admin",
          "vacancyRate": 5.0,
          "lastDividend": 0.85,
          "netWorth": "R$ 1.5B",
          "shareholders": 250000,
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
                            value: typeof d.value === 'string' ? parseFloat(d.value.replace(',','.')) : d.value,
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
