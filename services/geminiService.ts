import { GoogleGenAI } from '@google/genai';
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

// Função auxiliar para limpar JSON retornado em markdown
function cleanJsonString(text: string): string {
    let clean = text.trim();
    // Remove markdown formatting ```json ... ```
    if (clean.startsWith('```json')) {
        clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return clean;
}

export async function fetchMarketNews(tickers: string[] = []): Promise<NewsArticle[]> {
  const executeFetch = async () => {
      // FIX: Use `process.env.API_KEY` as per coding guidelines.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const tickerPromptPart = tickers.length > 0
          ? `Foque estritamente em notícias recentes (últimas 48h) sobre: ${tickers.join(', ')}.`
          : 'Foque em notícias gerais quentes sobre o mercado de FIIs (Fundos Imobiliários) e economia brasileira.';

      const prompt = `Você é um jornalista financeiro. Use o Google Search para encontrar notícias atuais.
      ${tickerPromptPart}
      
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
          systemInstruction: "Você é uma API de dados financeiros. Sua resposta deve ser apenas um JSON válido, sem nenhum texto, formatação markdown ou explicação adicional.",
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

export async function fetchRealTimeData(tickers: string[]): Promise<Record<string, RealTimeData>> {
    if (tickers.length === 0) return {};
    
    const executeFetch = async () => {
        // FIX: Use `process.env.API_KEY` as per coding guidelines.
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const prompt = `Pesquise os dados ATUAIS de mercado (B3/Bovespa) para estes FIIs: ${tickers.join(', ')}.
        
        Para CADA ativo, preciso de:
        1. Preço atual da cota (R$)
        2. Dividend Yield (DY) anual (em %)
        3. P/VP
        4. Setor
        5. Administradora

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
                systemInstruction: "Você é uma API de dados financeiros. Sua resposta deve ser apenas um JSON válido, sem nenhum texto, formatação markdown ou explicação adicional.",
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

export async function validateApiKey(): Promise<void> {
    try {
        // FIX: Use `process.env.API_KEY` as per coding guidelines.
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Ping",
        });
    } catch (e) {
        console.error("API Key validation failed:", e);
        throw e;
    }
}
