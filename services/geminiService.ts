
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

    // 3. Fallback: Process Environment (Node/Server) - Wrapped in try-catch to prevent "process is not defined" crash
    try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            return process.env.API_KEY;
        }
    } catch (e) {
        // Ignore
    }

    throw new Error("Chave de API não encontrada. Insira manualmente em Configurações > Avançado.");
}

// Helper for exponential backoff retry
async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 1, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) throw error;
    
    const msg = error?.toString()?.toLowerCase() || '';
    // Don't retry on auth errors
    if (msg.includes('401') || msg.includes('key') || msg.includes('permission') || msg.includes('invalid')) {
         throw error;
    }

    console.warn(`API Call failed, retrying in ${delay}ms...`, error);
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(fn, retries - 1, delay * 1.5);
  }
}

// Robust JSON cleaner using Regex to find the first JSON object or array
function cleanJsonString(text: string): string {
    if (!text) return "{}";
    
    // Attempt to find a JSON array [...] or object {...} pattern
    const jsonPattern = /({[\s\S]*?}|\[[\s\S]*?\])/;
    const match = text.match(jsonPattern);

    if (match && match[0]) {
        return match[0];
    }
    
    // Fallback cleanup if regex fails but basic structure exists
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

export async function fetchMarketNews(tickers: string[] = [], customApiKey?: string | null): Promise<NewsArticle[]> {
  const executeFetch = async () => {
      const apiKey = getApiKey(customApiKey);
      const ai = new GoogleGenAI({ apiKey });

      const limitedTickers = tickers.slice(0, 5); // Reduce context window
      
      const prompt = `Você é uma API de notícias financeiras.
      Busque notícias RECENTES (últimas 24h) sobre: ${limitedTickers.length > 0 ? limitedTickers.join(', ') : 'FIIs e Mercado Financeiro Brasil'}.
      
      REGRAS:
      1. Retorne APENAS um JSON válido.
      2. NÃO use Markdown (sem \`\`\`).
      3. Responda em Português do Brasil.
      
      Schema: Array<{ source: string, title: string, summary: string, date: string, url: string, sentiment: "Positive" | "Neutral" | "Negative" }>
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }],
        }
      });

      const jsonString = cleanJsonString(response.text || '');
      const data = JSON.parse(jsonString);
      
      // Normalize output
      if (Array.isArray(data)) return data;
      if (data.articles && Array.isArray(data.articles)) return data.articles;
      if (data.news && Array.isArray(data.news)) return data.news;
      
      return [];
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
        
        // Prompt otimizado para estabilidade
        const prompt = `ATUE COMO UMA API FINANCEIRA.
        Busque dados atuais da B3 para os tickers: ${tickers.join(', ')}.
        
        REGRAS RIGIDAS:
        1. Retorne APENAS JSON cru. Nada de Markdown. Nada de texto introdutório.
        2. Se não achar dados de um ativo, ignore-o.
        3. Use ponto para decimais.
        
        SCHEMA ESPERADO:
        {
          "TICKER11": { "currentPrice": 10.50, "dy": 12.5, "pvp": 1.01, "sector": "Papel", "administrator": "Nome" },
          "TICKER22": { ... }
        }`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                tools: [{ googleSearch: {} }],
            }
        });

        const rawText = response.text || '';
        const jsonString = cleanJsonString(rawText);
        
        try {
            const data = JSON.parse(jsonString);
            const result: Record<string, RealTimeData> = {};
            
            // Normalização de dados (Array ou Objeto)
            const items = Array.isArray(data) ? data : Object.values(data);

            items.forEach((item: any) => {
                // Tenta encontrar a chave do ticker no objeto ou assume que o valor é o objeto
                let tickerKey = item.ticker || item.symbol;
                
                // Se for um objeto chave-valor direto (Ex: {"MXRF11": {...}})
                if (!tickerKey && !Array.isArray(data)) {
                   // Logica complexa de parse reverso se necessário, mas o prompt deve garantir
                }

                // Fallback para processar objetos onde a chave é o ticker
                if (!Array.isArray(data)) {
                     Object.keys(data).forEach(key => {
                         const val = data[key];
                         if (val && typeof val === 'object') {
                             result[key.toUpperCase()] = {
                                currentPrice: Number(val.currentPrice || val.price || 0),
                                dy: Number(val.dy || val.dividendYield || 0),
                                pvp: Number(val.pvp || 1),
                                sector: val.sector || 'Outros',
                                administrator: val.administrator || 'N/A'
                             };
                         }
                     });
                     return;
                }

                if (tickerKey) {
                     result[tickerKey.toUpperCase()] = {
                        currentPrice: Number(item.currentPrice || item.price || 0),
                        dy: Number(item.dy || item.dividendYield || 0),
                        pvp: Number(item.pvp || 1),
                        sector: item.sector || 'Outros',
                        administrator: item.administrator || 'N/A'
                    };
                }
            });
            
            return result;
        } catch (error) {
            console.error("Erro critico no parser JSON:", error);
            console.log("Texto recebido da IA:", rawText); // Para debug
            throw new Error("Falha ao interpretar resposta da IA."); 
        }
    };

    return await fetchWithRetry(executeFetch, 0); // Sem retries automáticos pesados para não travar a UI
}

export async function validateApiKey(customApiKey?: string | null): Promise<boolean> {
    try {
        const apiKey = getApiKey(customApiKey);
        const ai = new GoogleGenAI({ apiKey });
        // Teste real de busca para garantir permissões
        await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Retorne um JSON vazio: {}",
        });
        return true;
    } catch (e) {
        console.error(e);
        throw e;
    }
}
