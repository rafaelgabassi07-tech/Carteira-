
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

export async function fetchMarketNews(tickers: string[] = [], customApiKey?: string | null): Promise<NewsArticle[]> {
  const apiKey = getApiKey(customApiKey);
  const ai = new GoogleGenAI({ apiKey });

  const limitedTickers = tickers.slice(0, 3); // Reduce to 3 to save tokens and speed up
  
  const prompt = `Liste 3 notícias recentes (24h) sobre: ${limitedTickers.length > 0 ? limitedTickers.join(', ') : 'Fundos Imobiliários'}.
  Formato JSON estrito: [{"source": "Fonte", "title": "Titulo", "summary": "Resumo curto", "date": "YYYY-MM-DD", "url": "link", "sentiment": "Neutral"}]`;

  try {
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
  } catch (error) {
      console.warn("News fetch failed", error);
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
    
    // Prompt extremamente direto e econômico para evitar timeouts e erros de parse
    const prompt = `JSON com dados atuais B3 para: ${tickers.join(',')}.
    Chaves: currentPrice (number), dy (number), pvp (number), sector (string), administrator (string).
    Use chave do objeto = TICKER.
    Exemplo: {"MXRF11": {"currentPrice": 10.55, "dy": 12.0, "pvp": 1.0, "sector": "Papel", "administrator": "X"}}`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.1, // Baixa temperatura para respostas mais determinísticas
            }
        });

        const rawText = response.text || '';
        const jsonString = cleanJsonString(rawText);
        
        const data = JSON.parse(jsonString);
        const result: Record<string, RealTimeData> = {};
        
        // Normalização flexível
        const entries = Array.isArray(data) ? data : Object.entries(data);

        entries.forEach((entry: any) => {
            // Se for array, entry é o objeto. Se for objeto, entry é [key, value]
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

    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new Error("Falha na conexão com API.");
    }
}

export async function validateApiKey(customApiKey?: string | null): Promise<boolean> {
    try {
        const apiKey = getApiKey(customApiKey);
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "JSON vazio {}",
        });
        return true;
    } catch (e) {
        console.error(e);
        throw e;
    }
}
