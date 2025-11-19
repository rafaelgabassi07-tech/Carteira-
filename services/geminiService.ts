
import { GoogleGenAI } from '@google/genai';
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

// Robust JSON cleaner that finds the outermost JSON object or array
function cleanJsonString(text: string): string {
    if (!text) return "{}";
    
    // Remove markdown code blocks first
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Find the first '{' or '['
    const firstOpenBrace = clean.indexOf('{');
    const firstOpenBracket = clean.indexOf('[');

    // Determine if it starts as an object or array
    let startIndex = -1;
    let endIndex = -1;

    if (firstOpenBrace !== -1 && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)) {
        startIndex = firstOpenBrace;
        endIndex = clean.lastIndexOf('}');
    } else if (firstOpenBracket !== -1) {
        startIndex = firstOpenBracket;
        endIndex = clean.lastIndexOf(']');
    }

    if (startIndex !== -1 && endIndex !== -1) {
        return clean.substring(startIndex, endIndex + 1);
    }

    return clean;
}

// --- API Call Resiliency ---
async function withRetry<T>(apiCall: () => Promise<T>, maxRetries = 4, initialDelay = 1500): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await apiCall();
    } catch (error: any) {
      attempt++;
      // Check if it's a retryable server error (5xx)
      const isServerError = error?.error?.code >= 500 && error?.error?.code < 600;

      if (isServerError && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.warn(`Gemini API server error. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error("Gemini API Error (non-retryable or max retries exceeded):", error);
        if (error?.error?.message?.includes("overloaded")) {
             throw new Error("O modelo de IA está sobrecarregado. Por favor, tente novamente mais tarde.");
        }
        if (error?.error?.code === 400) {
            throw new Error("Chave de API inválida ou mal formatada.");
        }
        throw new Error("Falha na conexão com a API do Gemini.");
      }
    }
  }
  throw new Error("Falha na chamada da API após múltiplas tentativas.");
}


export async function fetchMarketNews(tickers: string[] = [], customApiKey?: string | null): Promise<NewsArticle[]> {
  const apiKey = getApiKey(customApiKey);
  const ai = new GoogleGenAI({ apiKey });

  const limitedTickers = tickers.slice(0, 3); // Reduce to 3 to save tokens and speed up
  
  const prompt = `Liste 3 notícias recentes (24h) sobre: ${limitedTickers.length > 0 ? limitedTickers.join(', ') : 'Fundos Imobiliários'}.
  Formato JSON estrito: [{"source": "Fonte", "title": "Titulo", "summary": "Resumo curto", "date": "YYYY-MM-DD", "url": "link", "sentiment": "Neutral"}]`;

  try {
      return await withRetry(async () => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
            }
          });

          const jsonString = cleanJsonString(response.text || '');
          const data = JSON.parse(jsonString);
          
          if (Array.isArray(data)) return data;
          if (data.news && Array.isArray(data.news)) return data.news;
          
          return [];
      });
  } catch (error) {
      console.warn("News fetch failed after retries", error);
      return []; // Fail silently for news
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
    
    const prompt = `JSON com dados atuais B3 para: ${tickers.join(',')}.
    Chaves: currentPrice (number), dy (number), pvp (number), sector (string), administrator (string).
    Use chave do objeto = TICKER.
    Exemplo: {"MXRF11": {"currentPrice": 10.55, "dy": 12.0, "pvp": 1.0, "sector": "Papel", "administrator": "X"}}`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.1,
            }
        });

        const rawText = response.text || '';
        const jsonString = cleanJsonString(rawText);
        
        const data = JSON.parse(jsonString);
        const result: Record<string, RealTimeData> = {};
        
        const entries = Array.isArray(data) ? data : Object.entries(data);

        entries.forEach((entry: any) => {
            const val = Array.isArray(data) ? entry : entry[1];
            let key = Array.isArray(data) ? (val.ticker || val.symbol) : entry[0];

            if (key && val && typeof val === 'object') {
                 result[key.toUpperCase()] = {
                    currentPrice: Number(val.currentPrice || val.price || 0),
                    dy: Number(val.dy || val.dividendYield || 0),
                    pvp: Number(val.pvp || 1),
                    sector: val.sector || 'Outros',
                    administrator: val.administrator || 'N/A'
                 };
            }
        });
        
        return result;
    });
}

export async function validateApiKey(customApiKey?: string | null): Promise<boolean> {
     return withRetry(async () => {
        const apiKey = getApiKey(customApiKey);
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "JSON vazio {}",
        });
        return true;
    }, 2, 500); // Less aggressive retry for validation
}
