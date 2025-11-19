
import { GoogleGenAI } from '@google/genai';
import type { NewsArticle } from '../types';

// Helper to determine the API key to use. Prefers custom key, falls back to environment variable.
function getApiKey(customApiKey?: string | null): string {
    // FIX: Property 'env' does not exist on type 'ImportMeta'. The API key must be obtained from `process.env.API_KEY` as per the coding guidelines.
    const key = customApiKey || process.env.API_KEY;
    if (!key) {
        throw new Error("Chave de API do Gemini não configurada.");
    }
    return key;
}

// Helper for exponential backoff retry
async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) throw error;
    
    // Don't retry on critical client-side errors (Auth, Bad Request, missing key)
    if (error.toString().includes('401') || error.toString().includes('400') || /API.*key/i.test(error.toString())) {
         throw error;
    }

    console.warn(`API Call failed, retrying in ${delay}ms... (${retries} left)`, error);
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(fn, retries - 1, delay * 2);
  }
}

// Função auxiliar para limpar JSON retornado em markdown
function cleanJsonString(text: string): string {
    // Attempt to extract JSON from a markdown block first
    const match = text.match(/```(json)?\s*([\s\S]*?)\s*```/);
    if (match && match[2]) {
        return match[2].trim();
    }

    // If no markdown block, find the first occurrence of '{' or '['
    const jsonStartIndex = text.search(/[{\[]/);
    if (jsonStartIndex !== -1) {
        // Find the last occurrence of '}' or ']'
        const jsonEndIndex = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
        if (jsonEndIndex > jsonStartIndex) {
             return text.substring(jsonStartIndex, jsonEndIndex + 1).trim();
        }
    }
    
    // Fallback to original text if no JSON structure is found
    return text.trim();
}

export async function fetchMarketNews(tickers: string[] = [], customApiKey?: string | null): Promise<NewsArticle[]> {
  const executeFetch = async () => {
      const apiKey = getApiKey(customApiKey);
      const ai = new GoogleGenAI({ apiKey });

      const tickerPromptPart = tickers.length > 0
          ? `Foque estritamente em notícias recentes (últimas 48h) sobre: ${tickers.join(', ')}.`
          : 'Foque em notícias gerais quentes sobre o mercado de FIIs (Fundos Imobiliários) e economia brasileira.';

      const prompt = `Você é um jornalista financeiro. Use o Google Search para encontrar notícias atuais.
      ${tickerPromptPart}
      Responda o mais rápido possível.
      
      Retorne um ARRAY JSON com 5 notícias. 
      Formato esperado:
      [
        {
          "source": "Fonte",
          "title": "Título",
          "summary": "Resumo breve",
          "date": "Data (DD/MM/AAAA)",
          "url": "Link original",
          "sentiment": "Positive" | "Neutral" | "Negative"
        }
      ]
      
      IMPORTANTE: Retorne APENAS o JSON válido, sem texto adicional.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "Sua única função é retornar dados em formato JSON. Não inclua markdown, explicações ou qualquer texto fora do JSON solicitado.",
          tools: [{ googleSearch: {} }], // Ativa busca na web
        }
      });

      const jsonString = cleanJsonString(response.text || '');

      try {
          const data = JSON.parse(jsonString);
          return Array.isArray(data) ? data : (data.articles || []);
      } catch (parseError) {
          console.error("Failed to parse Gemini news response:", jsonString);
          return [];
      }
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
        
        const prompt = `Pesquise os dados ATUAIS de mercado (B3/Bovespa) para estes FIIs: ${tickers.join(', ')}.
        Responda o mais rápido possível.
        
        Para CADA ativo, preciso de:
        1. Preço atual da cota (currentPrice)
        2. Dividend Yield anual (dy)
        3. P/VP (pvp)
        4. Setor (sector)
        5. Administradora (administrator)

        Retorne um Objeto JSON onde a chave é o Ticker. Exemplo:
        {
            "KNRI11": { "currentPrice": 150.50, "dy": 8.5, "pvp": 1.01, "sector": "Híbrido", "administrator": "Kinea" }
        }

        IMPORTANTE: 
        - Use dados reais encontrados na busca.
        - Retorne APENAS o JSON válido.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: "Sua única função é retornar dados em formato JSON. Não inclua markdown, explicações ou qualquer texto fora do JSON solicitado.",
                tools: [{ googleSearch: {} }], // Essencial para dados reais
            }
        });

        const jsonString = cleanJsonString(response.text || '');
        
        try {
            const data = JSON.parse(jsonString);
            const result: Record<string, RealTimeData> = {};
            
            // Normalizar dados caso a IA retorne estrutura diferente
            const items = Array.isArray(data) ? data : Object.values(data); // Tenta tratar se vier array
            
            // Se for objeto com chaves de ticker (formato solicitado)
            if (!Array.isArray(data) && Object.keys(data).length > 0) {
                Object.keys(data).forEach(tickerKey => {
                    const item = data[tickerKey];
                    // Normaliza ticker para maiúsculo
                    const cleanTicker = tickerKey.toUpperCase();
                    if (item && typeof item.currentPrice === 'number') {
                        result[cleanTicker] = {
                            currentPrice: Number(item.currentPrice),
                            dy: Number(item.dy || 0),
                            pvp: Number(item.pvp || 1),
                            sector: item.sector || 'Outros',
                            administrator: item.administrator || 'N/A'
                        };
                    }
                });
            } else if (Array.isArray(items)) {
                // Fallback se a IA retornar lista
                items.forEach((item: any) => {
                    if (item.ticker && typeof item.currentPrice === 'number') {
                         result[item.ticker.toUpperCase()] = {
                            currentPrice: Number(item.currentPrice),
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
            console.error("Error parsing real-time data:", error);
            return {}; 
        }
    };

    try {
        return await fetchWithRetry(executeFetch);
    } catch (error) {
        console.error("Error fetching real-time data:", error);
        return {};
    }
}

export async function validateApiKey(customApiKey?: string | null): Promise<void> {
    try {
        const apiKey = getApiKey(customApiKey);
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Ping",
        });
    } catch (e) {
        console.error("API Key validation failed:", e);
        throw e;
    }
}
