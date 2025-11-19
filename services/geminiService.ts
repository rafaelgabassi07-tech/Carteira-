
import { GoogleGenAI, Type } from '@google/genai';
import type { NewsArticle } from '../types';

// Helper for exponential backoff retry
async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) throw error;
    
    // Don't retry on 401 (Auth) or 400 (Bad Request)
    if (error.toString().includes('401') || error.toString().includes('400') || error.toString().includes('API_KEY')) {
         throw error;
    }

    console.warn(`API Call failed, retrying in ${delay}ms... (${retries} left)`, error);
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(fn, retries - 1, delay * 2);
  }
}

export async function fetchMarketNews(tickers: string[] = [], apiKey?: string): Promise<NewsArticle[]> {
  const executeFetch = async () => {
      const key = apiKey || process.env.API_KEY;

      if (!key) {
        throw new Error("Chave de API não configurada. Adicione sua chave nas Configurações > Avançado.");
      }
      const ai = new GoogleGenAI({ apiKey: key });

      const tickerPromptPart = tickers.length > 0
          ? `Foque estritamente em notícias, fatos relevantes e relatórios gerenciais sobre os seguintes FIIs: ${tickers.join(', ')}.`
          : 'Foque em notícias gerais sobre o mercado de FIIs (Fundos Imobiliários), Selic e Ibovespa.';

      const prompt = `Você é um assistente financeiro especializado em FIIs. Gere 5 notícias recentes e relevantes sobre o mercado. ${tickerPromptPart} 
      
      IMPORTANTE:
      - Retorne APENAS o JSON puro. Não use blocos de código markdown (\`\`\`json).
      - A análise de sentimento deve ser estritamente: 'Positive', 'Neutral' ou 'Negative'.
      - Para cada notícia, forneça fonte, título, um breve resumo, a data, uma URL de exemplo (se não tiver real, use uma genérica de site financeiro) e o sentimento.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              articles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    source: { type: Type.STRING, description: "A fonte da notícia, ex: 'Valor Econômico', 'Suno', 'Funds Explorer'" },
                    title: { type: Type.STRING, description: "O título da notícia" },
                    summary: { type: Type.STRING, description: "Um resumo da notícia com 2-3 frases." },
                    date: { type: Type.STRING, description: "A data da publicação, ex: '21/06/2024, 14:30'" },
                    url: { type: Type.STRING, description: "A URL completa para a notícia original." },
                    sentiment: { type: Type.STRING, description: "O sentimento da notícia: 'Positive', 'Neutral', or 'Negative'" }
                  },
                  required: ["source", "title", "summary", "date", "url", "sentiment"]
                }
              }
            },
            required: ["articles"]
          }
        }
      });

      let jsonString = response.text ? response.text.trim() : '';

      // Sanitize: Remove markdown code blocks if present
      if (jsonString.startsWith('```json')) {
          jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonString.startsWith('```')) {
          jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      try {
          const data = JSON.parse(jsonString);
          return data.articles;
      } catch (parseError) {
          console.error("Failed to parse Gemini response:", jsonString);
          throw new Error("Falha ao processar resposta da IA. Tente novamente.");
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

export async function fetchRealTimeData(tickers: string[], apiKey?: string): Promise<Record<string, RealTimeData>> {
    if (tickers.length === 0) return {};
    
    const executeFetch = async () => {
        const key = apiKey || process.env.API_KEY;
        if (!key) throw new Error("Chave API ausente");
        
        const ai = new GoogleGenAI({ apiKey: key });
        
        const prompt = `Retorne os dados de mercado MAIS RECENTES possíveis para os seguintes FIIs brasileiros: ${tickers.join(', ')}.
        
        Preciso de:
        1. Preço atual da cota (R$)
        2. Dividend Yield (DY) anualizado estimado (%)
        3. P/VP (Preço sobre Valor Patrimonial)
        4. Setor de atuação (ex: Logística, Papel, Shoppings)
        5. Administradora (Nome curto)

        Retorne APENAS JSON.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        assets: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    ticker: { type: Type.STRING },
                                    currentPrice: { type: Type.NUMBER },
                                    dy: { type: Type.NUMBER },
                                    pvp: { type: Type.NUMBER },
                                    sector: { type: Type.STRING },
                                    administrator: { type: Type.STRING }
                                },
                                required: ["ticker", "currentPrice", "dy", "pvp", "sector"]
                            }
                        }
                    }
                }
            }
        });

        let jsonString = response.text ? response.text.trim() : '';
         // Sanitize
        if (jsonString.startsWith('```json')) {
            jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonString.startsWith('```')) {
            jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const data = JSON.parse(jsonString);
        const result: Record<string, RealTimeData> = {};
        
        if (data.assets) {
            data.assets.forEach((item: any) => {
                // Basic validation to ensure we don't save garbage
                if (item.ticker && typeof item.currentPrice === 'number') {
                    result[item.ticker] = {
                        currentPrice: item.currentPrice,
                        dy: item.dy || 0,
                        pvp: item.pvp || 1,
                        sector: item.sector || 'Outros',
                        administrator: item.administrator || 'N/A'
                    };
                }
            });
        }
        
        return result;
    };

    // Use retry for robustness
    try {
        return await fetchWithRetry(executeFetch);
    } catch (error) {
        console.error("Error fetching real-time data:", error);
        return {}; // Return empty on error to preserve old data
    }
}

// NEW: Function to validate API connectivity
export async function validateApiKey(apiKey?: string): Promise<boolean> {
    try {
        const key = apiKey || process.env.API_KEY;
        if (!key) return false;
        
        const ai = new GoogleGenAI({ apiKey: key });
        // Simple lightweight prompt
        await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Ping",
            config: { maxOutputTokens: 1 }
        });
        return true;
    } catch (e) {
        return false;
    }
}
