
import { GoogleGenAI, Type, Schema } from '@google/genai';
import type { NewsArticle } from '../types';

// Helper to determine the API key to use safely in Browser environment
function getApiKey(customApiKey?: string | null): string {
    // 1. Priority: Custom User Key (Manual)
    if (customApiKey && typeof customApiKey === 'string' && customApiKey.trim().length > 10) {
        return customApiKey.trim();
    }

    // 2. Vite Environment Variable (Browser Standard)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
        // @ts-ignore
        return import.meta.env.VITE_API_KEY;
    }

    // 3. Fallback: Process Environment (Node/Server)
    try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            return process.env.API_KEY;
        }
    } catch (e) {
        // Ignore
    }

    throw new Error("Chave de API não encontrada. Insira manualmente em Configurações > Avançado.");
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
        console.warn(`Gemini API busy. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error("Gemini API Critical Failure:", error);
        if (error?.status === 400 || error?.message?.includes("API key")) {
            throw new Error("Chave de API inválida.");
        }
        throw error; // Re-throw to be handled by the caller
      }
    }
  }
  throw new Error("Serviço indisponível no momento.");
}

// --- SCHEMAS (Structured Outputs for Speed) ---

const newsSchema: Schema = {
    type: Type.ARRAY,
    description: "List of financial news articles",
    items: {
        type: Type.OBJECT,
        properties: {
            source: { type: Type.STRING, description: "Name of the news source/website" },
            title: { type: Type.STRING, description: "Headline of the news" },
            summary: { type: Type.STRING, description: "Concise summary in Portuguese (max 20 words)" },
            date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
            sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative"] }
        },
        required: ["source", "title", "summary", "date", "sentiment"]
    }
};

const marketDataSchema: Schema = {
    type: Type.ARRAY,
    description: "List of market data for assets",
    items: {
        type: Type.OBJECT,
        properties: {
            ticker: { type: Type.STRING, description: "Asset ticker symbol (uppercase)" },
            currentPrice: { type: Type.NUMBER, description: "Current market price (BRL)" },
            dy: { type: Type.NUMBER, description: "Dividend Yield 12 months % (e.g. 10.5)" },
            pvp: { type: Type.NUMBER, description: "P/VP Ratio" },
            sector: { type: Type.STRING, description: "Asset sector (e.g. Logística, Papel)" },
            administrator: { type: Type.STRING, description: "Fund administrator name" }
        },
        required: ["ticker", "currentPrice", "dy", "pvp", "sector"]
    }
};

// --- SERVICES ---

export async function fetchMarketNews(tickers: string[] = [], customApiKey?: string | null): Promise<NewsArticle[]> {
  const apiKey = getApiKey(customApiKey);
  const ai = new GoogleGenAI({ apiKey });

  // Optimization: Limit tickers context to reduce input tokens
  const contextTickers = tickers.slice(0, 5).join(', ');
  const prompt = `Notícias recentes do mercado financeiro brasileiro (FIIs). Foco: ${contextTickers || 'Geral'}.`;

  try {
      return await withRetry(async () => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: newsSchema,
              temperature: 0.1, // Low temperature for factual data
            }
          });

          const data = JSON.parse(response.text || '[]');
          return Array.isArray(data) ? data : [];
      });
  } catch (error) {
      console.warn("News fetch failed:", error);
      return []; // Fail silently for news to not block UI
  }
}

export interface RealTimeData {
    currentPrice: number;
    dy: number;
    pvp: number;
    sector: string;
    administrator: string;
}

export async function fetchRealTimeData(tickers: string[], customApiKey?: string | null): Promise<Record<string, RealTimeData>> {
    if (tickers.length === 0) return {};
    
    const apiKey = getApiKey(customApiKey);
    const ai = new GoogleGenAI({ apiKey });
    
    // Optimization: Extremely concise prompt. The Schema does the heavy lifting.
    const prompt = `Dados atualizados B3: ${tickers.join(', ')}`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: marketDataSchema,
                temperature: 0, // Zero temperature for maximum speed and consistency
            }
        });

        const data = JSON.parse(response.text || '[]');
        const result: Record<string, RealTimeData> = {};

        if (Array.isArray(data)) {
            data.forEach((item: any) => {
                if (item.ticker) {
                    result[item.ticker.toUpperCase()] = {
                        currentPrice: Number(item.currentPrice || 0),
                        dy: Number(item.dy || 0),
                        pvp: Number(item.pvp || 1),
                        sector: item.sector || 'Outros',
                        administrator: item.administrator || 'N/A'
                    };
                }
            });
        }
        
        return result;
    });
}

export async function validateApiKey(customApiKey?: string | null): Promise<boolean> {
     return withRetry(async () => {
        const apiKey = getApiKey(customApiKey);
        const ai = new GoogleGenAI({ apiKey });
        // Minimal token usage for validation
        await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Hi",
            config: { maxOutputTokens: 1 } 
        });
        return true;
    }, 1, 500);
}
