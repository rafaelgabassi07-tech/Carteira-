
import { GoogleGenAI } from '@google/genai';
import type { NewsArticle } from '../types';

// Helper to determine the API key to use. Checks Custom -> Vite -> Process Env safely.
function getApiKey(customApiKey?: string | null): string {
    // 1. Try Custom User Key
    if (customApiKey && customApiKey.trim() !== '') {
        return customApiKey.trim();
    }

    // 2. Try Vite Environment Variable (Browser Standard)
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
            // @ts-ignore
            return import.meta.env.VITE_API_KEY;
        }
    } catch (e) {
        // Ignore errors if import.meta is not available
    }

    // 3. Try Process Environment Variable (Node/Server Standard)
    try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            return process.env.API_KEY;
        }
    } catch (e) {
        // Ignore errors if process is not defined
    }

    throw new Error("Chave de API não encontrada. Configure VITE_API_KEY na Vercel ou insira manualmente em Configurações > Avançado.");
}

// Helper for exponential backoff retry
async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) throw error;
    
    const msg = error.toString().toLowerCase();
    // Don't retry on auth errors
    if (msg.includes('401') || msg.includes('key') || msg.includes('permission')) {
         throw error;
    }

    console.warn(`API Call failed, retrying in ${delay}ms...`, error);
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(fn, retries - 1, delay * 1.5);
  }
}

// Robust JSON cleaner
function cleanJsonString(text: string): string {
    if (!text) return "{}";
    
    // 1. Remove Markdown Code Blocks
    let clean = text.replace(/```json/g, '').replace(/```/g, '');
    
    // 2. Find the first '{' or '[' and the last '}' or ']'
    const firstOpenBrace = clean.indexOf('{');
    const firstOpenBracket = clean.indexOf('[');
    
    let startIndex = -1;
    if (firstOpenBrace !== -1 && firstOpenBracket !== -1) {
        startIndex = Math.min(firstOpenBrace, firstOpenBracket);
    } else {
        startIndex = Math.max(firstOpenBrace, firstOpenBracket);
    }

    if (startIndex === -1) return clean; // No JSON found, return original (will likely fail parse)

    const lastCloseBrace = clean.lastIndexOf('}');
    const lastCloseBracket = clean.lastIndexOf(']');
    const endIndex = Math.max(lastCloseBrace, lastCloseBracket);

    if (endIndex > startIndex) {
        return clean.substring(startIndex, endIndex + 1);
    }
    
    return clean;
}

export async function fetchMarketNews(tickers: string[] = [], customApiKey?: string | null): Promise<NewsArticle[]> {
  const executeFetch = async () => {
      const apiKey = getApiKey(customApiKey);
      const ai = new GoogleGenAI({ apiKey });

      // Limit tickers to prevent huge prompts
      const limitedTickers = tickers.slice(0, 10);
      
      const prompt = `Busque notícias recentes do mercado financeiro (últimas 24h).
      ${limitedTickers.length > 0 ? `Foco prioritário nestes ativos: ${limitedTickers.join(', ')}.` : 'Foco em Fundos Imobiliários (FIIs) e macroeconomia Brasil.'}
      
      Retorne APENAS um JSON array válido.
      Schema: Array<{ source: string, title: string, summary: string, date: string, url: string, sentiment: "Positive" | "Neutral" | "Negative" }>
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json", // Force JSON
          tools: [{ googleSearch: {} }],
        }
      });

      const jsonString = cleanJsonString(response.text || '');
      const data = JSON.parse(jsonString);
      return Array.isArray(data) ? data : (data.articles || []);
  };

  return fetchWithRetry(executeFetch);
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
    
    const executeFetch = async () => {
        const apiKey = getApiKey(customApiKey);
        const ai = new GoogleGenAI({ apiKey });
        
        // Batching logic could go here, but for simplicity we request all (assuming < 30)
        // Simplified prompt to reduce latency and token usage
        const prompt = `Dados atuais B3 para: ${tickers.join(', ')}.
        Retorne JSON objeto: { "TICKER": { "currentPrice": number, "dy": number (anual %), "pvp": number, "sector": string, "administrator": string } }
        Exemplo: { "XPLG11": { "currentPrice": 105.50, "dy": 8.5, "pvp": 0.98, "sector": "Logística", "administrator": "Vórtx" } }
        Use dados reais. Se falhar um, ignore-o.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json", // Force JSON output
                tools: [{ googleSearch: {} }],
            }
        });

        const jsonString = cleanJsonString(response.text || '');
        
        try {
            const data = JSON.parse(jsonString);
            const result: Record<string, RealTimeData> = {};
            
            // Handle Array response just in case
            const items = Array.isArray(data) ? data : (Object.values(data).some((v: any) => v.ticker) ? Object.values(data) : data);

            if (Array.isArray(items)) {
                 items.forEach((item: any) => {
                    const t = item.ticker || item.symbol;
                    if (t) {
                         result[t.toUpperCase()] = {
                            currentPrice: Number(item.currentPrice || 0),
                            dy: Number(item.dy || 0),
                            pvp: Number(item.pvp || 1),
                            sector: item.sector || 'Outros',
                            administrator: item.administrator || 'N/A'
                        };
                    }
                });
            } else {
                // Object format (preferred)
                Object.keys(items).forEach(key => {
                    const item = items[key];
                    if (item && typeof item === 'object') {
                         result[key.toUpperCase()] = {
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
        } catch (error) {
            console.error("JSON Parse Error in RealTimeData:", error);
            console.log("Raw String:", jsonString);
            return {}; 
        }
    };

    try {
        // Single attempt or low retry to fail fast and use cache if needed
        return await fetchWithRetry(executeFetch, 1);
    } catch (error) {
        console.error("Fatal error fetching market data:", error);
        throw error;
    }
}

export async function validateApiKey(customApiKey?: string | null): Promise<void> {
    const apiKey = getApiKey(customApiKey);
    const ai = new GoogleGenAI({ apiKey });
    // Simple lightweight call
    await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Hi",
    });
}
