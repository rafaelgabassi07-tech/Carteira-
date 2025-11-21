

import { GoogleGenAI, Type } from '@google/genai';
import type { NewsArticle, AppPreferences } from '../types';

function getGeminiApiKey(prefs: AppPreferences): string {
    // Priority 1: User-provided key from settings
    if (prefs.geminiApiKey && prefs.geminiApiKey.trim() !== '') {
        return prefs.geminiApiKey;
    }
    
    // Priority 2: Environment variable (Vite's way)
    const envApiKey = (import.meta as any).env.VITE_API_KEY;
    if (envApiKey && envApiKey.trim() !== '') {
        return envApiKey;
    }

    throw new Error("Chave de API do Gemini (VITE_API_KEY) não configurada.");
}


// --- API Call Resiliency ---
async function withRetry<T>(apiCall: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await apiCall();
    } catch (error: any) {
      attempt++;
      const isServerError = error?.status >= 500 && error?.status < 600;
      const isOverloaded = error?.status === 503 || error?.message?.includes("overloaded");

      if ((isServerError || isOverloaded) && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.warn(`AI API busy. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error("AI API Critical Failure:", error);
        // Propagate the real error
        throw error; 
      }
    }
  }
  throw new Error("Serviço de IA indisponível no momento.");
}

// --- SCHEMAS (Structured Outputs for Speed) ---

const newsSchema = {
    type: Type.ARRAY,
    description: "List of financial news articles summarized from search results.",
    items: {
        type: Type.OBJECT,
        properties: {
            source: { type: Type.STRING, description: "Name of the news source/website (e.g., 'InfoMoney', 'Suno Notícias')." },
            title: { type: Type.STRING, description: "The original, exact headline of the news article." },
            summary: { type: Type.STRING, description: "Concise summary in Portuguese (max 30 words)." },
            date: { type: Type.STRING, description: "Publication date in YYYY-MM-DD format." },
            sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative"] }
        },
        required: ["source", "title", "summary", "date", "sentiment"]
    }
};

const advancedAssetDataSchema = {
    type: Type.ARRAY,
    description: "Lista de dados fundamentalistas para ativos financeiros da B3. A precisão é crítica.",
    items: {
        type: Type.OBJECT,
        properties: {
            ticker: { type: Type.STRING, description: "Símbolo do ativo (ticker), em maiúsculas. Exemplo: MXRF11" },
            dy: { type: Type.NUMBER, description: "Dividend Yield percentual dos últimos 12 meses, conforme StatusInvest. Exemplo: 12.5" },
            pvp: { type: Type.NUMBER, description: "Relação Preço/Valor Patrimonial (P/VP) exata do StatusInvest. Exemplo: 1.05" },
            sector: { type: Type.STRING, description: "Segmento PRINCIPAL do FII, conforme classificação do StatusInvest. Use uma das seguintes categorias padronizadas: 'Tijolo - Shoppings', 'Tijolo - Lajes Corporativas', 'Tijolo - Logística', 'Tijolo - Híbrido', 'Papel', 'Fundo de Fundos (FOF)', 'Agro (Fiagro)'. Se não se encaixar claramente em nenhuma, use 'Outros'." },
            administrator: { type: Type.STRING, description: "Nome completo da administradora/gestora OFICIAL do fundo, conforme consta no StatusInvest. Exemplo para SNAG11: Suno Asset. NÃO confunda com o escriturador (ex: BTG Pactual)." },
            vacancyRate: { type: Type.NUMBER, description: "Taxa de vacância física do fundo em porcentagem. Se o indicador não for aplicável (ex: FII de papel), retorne -1. Para os demais, busque o valor real. Exemplo: 5.5" },
            dailyLiquidity: { type: Type.NUMBER, description: "Liquidez média diária (2M) em BRL. Busque o valor numérico EXATO no StatusInvest. Sem abreviações. Exemplo: 1543210.12" },
            shareholders: { type: Type.NUMBER, description: "Número total de cotistas mais recente. Busque o número inteiro EXATO no StatusInvest. Exemplo: 95432" }
        },
        required: ["ticker", "dy", "pvp", "sector", "administrator", "vacancyRate", "dailyLiquidity", "shareholders"]
    }
};

// --- SERVICES ---

/**
 * Finds the most likely URL for a summarized article by comparing its title to the titles of grounded search results.
 * @param articleTitle The title of the AI-summarized article.
 * @param sources An array of web sources from Gemini's grounding metadata.
 * @returns The best-matching URL or undefined.
 */
function findBestUrl(articleTitle: string, sources: Array<{ title?: string; uri?: string }>): string | undefined {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const normalizedArticleTitle = normalize(articleTitle);
    if (!normalizedArticleTitle) return undefined;

    let bestMatch: { uri: string; score: number } | null = null;

    for (const source of sources) {
        if (!source || !source.title || !source.uri) continue;
        const normalizedSourceTitle = normalize(source.title);

        const articleWords = new Set(normalizedArticleTitle.split(' ').filter(w => w.length > 2));
        const sourceWords = new Set(normalizedSourceTitle.split(' '));
        const intersection = new Set([...articleWords].filter(x => sourceWords.has(x)));
        
        const score = intersection.size;

        if (!bestMatch || score > bestMatch.score) {
            bestMatch = { uri: source.uri, score };
        }
    }

    return (bestMatch && bestMatch.score > 0) ? bestMatch.uri : undefined;
}

/**
 * Extracts a JSON array from a string, even if it's embedded in markdown.
 * @param text The string to parse.
 * @returns An array of objects, or an empty array if parsing fails.
 */
function extractJson(text: string): any[] {
    const jsonRegex = /(?:```json\s*)?(\[.*\])/s;
    const match = text.match(jsonRegex);
    
    if (match && match[1]) {
        try {
            return JSON.parse(match[1]);
        } catch (e) {
            console.error("Failed to parse extracted JSON:", e);
            return [];
        }
    }
    
    console.warn("Could not find a JSON array in the AI response.");
    return [];
}

export async function fetchMarketNews(prefs: AppPreferences, tickers: string[] = [], searchQuery: string = ''): Promise<NewsArticle[]> {
  let apiKey: string;
  try {
    apiKey = getGeminiApiKey(prefs);
  } catch (error: any) {
    console.warn("Skipping news fetch (No API Key):", error.message);
    return [];
  }
  
  const ai = new GoogleGenAI({ apiKey });

  const contextTickers = tickers.slice(0, 5).join(', ');
  
  let prompt: string;
  if (searchQuery.trim()) {
      prompt = `Usando a busca do Google, encontre notícias financeiras sobre "${searchQuery}" publicadas na semana atual. Foque em FIIs se for relevante. Responda ESTRITAMENTE com um array JSON contendo um resumo para cada notícia encontrada. Não adicione nenhum texto ou explicação fora do array JSON.`;
  } else {
      prompt = `Usando a busca do Google, encontre as 5 notícias mais importantes sobre o mercado de Fundos Imobiliários (FIIs) do Brasil, publicadas na semana atual. Tickers para contexto: ${contextTickers || 'Geral'}. Responda ESTRITAMENTE com um array JSON contendo um resumo para cada notícia encontrada. Não adicione nenhum texto ou explicação fora do array JSON.`;
  }

  try {
      return await withRetry(async () => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
            }
          });
          
          const rawText = response.text || '';
          const parsedArticles: NewsArticle[] = extractJson(rawText);

          const webSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web).filter(Boolean) || [];

          if (webSources.length > 0 && Array.isArray(parsedArticles)) {
              return parsedArticles.map(article => ({
                  ...article,
                  url: findBestUrl(article.title, webSources),
              }));
          }

          return Array.isArray(parsedArticles) ? parsedArticles : [];
      });
  } catch (error) {
      console.warn("News fetch failed:", error);
      return []; 
  }
}

export interface AdvancedAssetData {
    dy: number;
    pvp: number;
    sector: string;
    administrator: string;
    vacancyRate: number;
    dailyLiquidity: number;
    shareholders: number;
}

export async function fetchAdvancedAssetData(prefs: AppPreferences, tickers: string[]): Promise<Record<string, AdvancedAssetData>> {
    if (tickers.length === 0) return {};
    
    let apiKey: string;
    try {
        apiKey = getGeminiApiKey(prefs);
    } catch (error) {
        // Silently fail if no key is configured, as this is an enhancement feature.
        return {};
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `ATENÇÃO: Busque dados fundamentalistas exclusivamente do site StatusInvest para os seguintes ativos da B3: ${tickers.join(', ')}. A precisão é crítica. Para o campo 'sector', utilize OBRIGATORIAMENTE uma das categorias definidas no schema. Preencha todos os campos com os valores exatos encontrados, sem aproximações.`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: advancedAssetDataSchema,
                temperature: 0,
            }
        });
        
        const jsonText = response.text;
        const data = JSON.parse(jsonText || '[]');
        const result: Record<string, AdvancedAssetData> = {};

        if (Array.isArray(data)) {
            data.forEach((item: any) => {
                if (item.ticker) {
                    result[item.ticker.toUpperCase()] = {
                        dy: Number(item.dy || 0),
                        pvp: Number(item.pvp || 1),
                        sector: item.sector || 'Outros',
                        administrator: item.administrator || 'N/A',
                        vacancyRate: Number(item.vacancyRate),
                        dailyLiquidity: Number(item.dailyLiquidity || 0),
                        shareholders: Number(item.shareholders || 0),
                    };
                }
            });
        }
        
        return result;
    });
}

export async function validateGeminiKey(key: string): Promise<boolean> {
    if (!key || key.trim() === '') return false;
    try {
        const ai = new GoogleGenAI({ apiKey: key });
        // Use a simple, non-streaming, low-cost model and prompt
        await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "test",
        });
        return true;
    } catch (error) {
        console.error("Gemini key validation failed:", error);
        return false;
    }
}