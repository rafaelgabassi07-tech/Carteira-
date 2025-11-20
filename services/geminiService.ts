
import { GoogleGenAI, Type } from '@google/genai';
import type { NewsArticle } from '../types';

function getApiKey(): string {
    // This function assumes the environment polyfills process.env or it's running in Node.
    // The strict guideline is to use process.env.API_KEY.
    try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            return process.env.API_KEY;
        }
    } catch (e) {
      // process is not defined in browser, this is expected
    }
    // As per user's setup, VITE_API_KEY is the way for browser deployment
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_API_KEY;
    }

    throw new Error("Chave de API do Gemini não configurada no ambiente.");
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

// Fix: The 'Schema' type is not exported from '@google/genai'. The type will be inferred.
const newsSchema = {
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

// Fix: The 'Schema' type is not exported from '@google/genai'. The type will be inferred.
const marketDataSchema = {
    type: Type.ARRAY,
    description: "Lista de dados de mercado para ativos financeiros listados na B3.",
    items: {
        type: Type.OBJECT,
        properties: {
            ticker: { type: Type.STRING, description: "Símbolo do ativo (ticker), em maiúsculas. Exemplo: MXRF11" },
            currentPrice: { type: Type.NUMBER, description: "Preço atual de mercado em BRL, como um número float. Exemplo: 10.55 para dez reais e cinquenta e cinco centavos." },
            dy: { type: Type.NUMBER, description: "Dividend Yield percentual dos últimos 12 meses. Exemplo: 12.5 para 12.5%" },
            pvp: { type: Type.NUMBER, description: "Relação Preço/Valor Patrimonial (P/VP). Exemplo: 1.05" },
            sector: { type: Type.STRING, description: "Setor do ativo. Exemplo: Logística, Papel, Shoppings" },
            administrator: { type: Type.STRING, description: "Nome da administradora do fundo." },
            vacancyRate: { type: Type.NUMBER, description: "Taxa de vacância do fundo em porcentagem. Exemplo: 5.5 para 5.5%. Se não aplicável, retorne 0." },
            dailyLiquidity: { type: Type.NUMBER, description: "Volume financeiro médio negociado por dia em BRL. Exemplo: 1500000. Se não houver dados, retorne 0." },
            shareholders: { type: Type.NUMBER, description: "Número total de cotistas do fundo. Exemplo: 850000. Se não houver dados, retorne 0." }
        },
        required: ["ticker", "currentPrice", "dy", "pvp", "sector", "administrator", "vacancyRate", "dailyLiquidity", "shareholders"]
    }
};

// --- SERVICES ---

export async function fetchMarketNews(tickers: string[] = []): Promise<NewsArticle[]> {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });

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
              temperature: 0.1,
            }
          });

          const data = JSON.parse(response.text || '[]');
          return Array.isArray(data) ? data : [];
      });
  } catch (error) {
      console.warn("News fetch failed:", error);
      return []; 
  }
}

export interface RealTimeData {
    currentPrice: number;
    dy: number;
    pvp: number;
    sector: string;
    administrator: string;
    vacancyRate: number;
    dailyLiquidity: number;
    shareholders: number;
}

export async function fetchRealTimeData(tickers: string[]): Promise<Record<string, RealTimeData>> {
    if (tickers.length === 0) return {};
    
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Cotação e indicadores fundamentalistas completos para os ativos da B3: ${tickers.join(', ')}.`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: marketDataSchema,
                temperature: 0,
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
                        administrator: item.administrator || 'N/A',
                        vacancyRate: Number(item.vacancyRate || 0),
                        dailyLiquidity: Number(item.dailyLiquidity || 0),
                        shareholders: Number(item.shareholders || 0),
                    };
                }
            });
        }
        
        return result;
    });
}

export async function validateApiKey(): Promise<boolean> {
     return withRetry(async () => {
        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Hi",
            config: { maxOutputTokens: 1 } 
        });
        return true;
    }, 1, 500);
}
