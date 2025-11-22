
import { GoogleGenAI, Type, Schema } from '@google/genai';
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
        throw error; 
      }
    }
  }
  throw new Error("Serviço de IA indisponível no momento.");
}

// --- SCHEMAS (Structured Outputs) ---

const newsArticleSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        source: { type: Type.STRING, description: "Name of the news source." },
        title: { type: Type.STRING, description: "The original headline." },
        summary: { type: Type.STRING, description: "Concise summary in Portuguese (max 30 words)." },
        date: { type: Type.STRING, description: "Publication date in YYYY-MM-DD format." },
        sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative"] }
    },
    required: ["source", "title", "summary", "date", "sentiment"]
};

const newsListSchema: Schema = {
    type: Type.ARRAY,
    items: newsArticleSchema,
    description: "List of financial news articles."
};

const advancedAssetDataSchema: Schema = {
    type: Type.ARRAY,
    description: "Lista de dados fundamentalistas para ativos financeiros.",
    items: {
        type: Type.OBJECT,
        properties: {
            ticker: { type: Type.STRING, description: "Símbolo do ativo (ticker)." },
            dy: { type: Type.NUMBER, description: "Dividend Yield 12M (%)" },
            pvp: { type: Type.NUMBER, description: "P/VP" },
            sector: { type: Type.STRING, description: "Segmento padronizado." },
            administrator: { type: Type.STRING, description: "Administradora." },
            vacancyRate: { type: Type.NUMBER, description: "Vacância (%)" },
            dailyLiquidity: { type: Type.NUMBER, description: "Liquidez diária." },
            shareholders: { type: Type.NUMBER, description: "Número de cotistas." }
        },
        required: ["ticker", "dy", "pvp", "sector", "administrator", "vacancyRate", "dailyLiquidity", "shareholders"]
    }
};

// --- SERVICES ---

/**
 * Finds the most likely URL for a summarized article by comparing its title to the titles of grounded search results.
 */
function findBestUrl(articleTitle: string, sources: Array<{ title?: string; uri?: string }>): string | undefined {
    if (!articleTitle || typeof articleTitle !== 'string') return undefined;
    
    const normalize = (str: any) => {
        if (typeof str !== 'string') return '';
        return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    };

    const normalizedArticleTitle = normalize(articleTitle);
    if (!normalizedArticleTitle) return undefined;

    let bestMatch: { uri: string; score: number } | null = null;

    for (const source of sources) {
        if (!source || !source.title || !source.uri) continue;
        const normalizedSourceTitle = normalize(source.title);

        if (!normalizedSourceTitle) continue;

        const articleWords = new Set(normalizedArticleTitle.split(' ').filter((w: string) => w.length > 2));
        const sourceWords = new Set(normalizedSourceTitle.split(' '));
        const intersection = new Set([...articleWords].filter(x => sourceWords.has(x)));
        
        const score = intersection.size;

        if (!bestMatch || score > bestMatch.score) {
            bestMatch = { uri: source.uri, score };
        }
    }

    return (bestMatch && bestMatch.score > 0) ? bestMatch.uri : undefined;
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
      prompt = `Encontre notícias financeiras sobre "${searchQuery}" publicadas na semana atual. Foque em FIIs.`;
  } else {
      prompt = `Encontre as 5 notícias mais importantes sobre o mercado de Fundos Imobiliários (FIIs) do Brasil publicadas recentemente. Tickers de interesse: ${contextTickers || 'Geral'}.`;
  }

  try {
      return await withRetry(async () => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
                responseMimeType: "application/json",
                responseSchema: newsListSchema,
            }
          });
          
          // With responseSchema, response.text is guaranteed to be valid JSON conforming to the schema
          const parsedArticles: NewsArticle[] = JSON.parse(response.text || '[]');
          const webSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web).filter(Boolean) || [];

          if (Array.isArray(parsedArticles)) {
              return parsedArticles
                .filter(article => article && typeof article.title === 'string' && article.title.trim() !== '')
                .map(article => ({
                  ...article,
                  url: findBestUrl(article.title, webSources),
              }));
          }

          return [];
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
        return {};
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Busque dados fundamentalistas do StatusInvest para: ${tickers.join(', ')}. Use EXATAMENTE as categorias: 'Tijolo - Shoppings', 'Tijolo - Lajes Corporativas', 'Tijolo - Logística', 'Tijolo - Híbrido', 'Papel', 'Fundo de Fundos (FOF)', 'Agro (Fiagro)' ou 'Outros'.`;

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
        
        const data = JSON.parse(response.text || '[]');
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
