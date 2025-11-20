import { GoogleGenAI, Type } from '@google/genai';
import type { NewsArticle } from '../types';

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
        if (error?.message?.includes("API key not valid") || error?.message?.includes("API key must be set")) {
            throw new Error("Chave de API do Gemini (VITE_API_KEY) inválida ou não configurada no ambiente.");
        }
        throw error; // Re-throw to be handled by the caller
      }
    }
  }
  throw new Error("Serviço de IA indisponível no momento.");
}

// --- SCHEMAS (Structured Outputs for Speed) ---

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

const advancedAssetDataSchema = {
    type: Type.ARRAY,
    description: "Lista de dados fundamentalistas para ativos financeiros da B3. A precisão é crítica.",
    items: {
        type: Type.OBJECT,
        properties: {
            ticker: { type: Type.STRING, description: "Símbolo do ativo (ticker), em maiúsculas. Exemplo: MXRF11" },
            dy: { type: Type.NUMBER, description: "Dividend Yield percentual dos últimos 12 meses, conforme StatusInvest. Exemplo: 12.5" },
            pvp: { type: Type.NUMBER, description: "Relação Preço/Valor Patrimonial (P/VP) exata do StatusInvest. Exemplo: 1.05" },
            sector: { type: Type.STRING, description: "Setor do ativo. Exemplo: Logística, Papel, Shoppings" },
            administrator: { type: Type.STRING, description: "Nome completo da administradora/gestora OFICIAL do fundo, conforme consta no StatusInvest. Exemplo para SNAG11: Suno Asset. NÃO confunda com o escriturador (ex: BTG Pactual)." },
            vacancyRate: { type: Type.NUMBER, description: "Taxa de vacância física do fundo em porcentagem. Se o indicador não for aplicável (ex: FII de papel), retorne -1. Para os demais, busque o valor real. Exemplo: 5.5" },
            dailyLiquidity: { type: Type.NUMBER, description: "Liquidez média diária (2M) em BRL. Busque o valor numérico EXATO no StatusInvest. Sem abreviações. Exemplo: 1543210.12" },
            shareholders: { type: Type.NUMBER, description: "Número total de cotistas mais recente. Busque o número inteiro EXATO no StatusInvest. Exemplo: 95432" }
        },
        required: ["ticker", "dy", "pvp", "sector", "administrator", "vacancyRate", "dailyLiquidity", "shareholders"]
    }
};

// --- SERVICES ---

export async function fetchMarketNews(tickers: string[] = []): Promise<NewsArticle[]> {
  // FIX: Cast import.meta to any to access env property, resolving TypeScript error.
  const apiKey = (import.meta as any).env.VITE_API_KEY;
  if (!apiKey) {
      console.warn("Gemini API key (VITE_API_KEY) not found.");
      return []; // Return empty instead of throwing to not break the UI
  }
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

export interface AdvancedAssetData {
    dy: number;
    pvp: number;
    sector: string;
    administrator: string;
    vacancyRate: number;
    dailyLiquidity: number;
    shareholders: number;
}

export async function fetchAdvancedAssetData(tickers: string[]): Promise<Record<string, AdvancedAssetData>> {
    if (tickers.length === 0) return {};
    
    // FIX: Cast import.meta to any to access env property, resolving TypeScript error.
    const apiKey = (import.meta as any).env.VITE_API_KEY;
    if (!apiKey) {
      throw new Error("Chave de API do Gemini (VITE_API_KEY) não configurada no ambiente.");
    }
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `ATENÇÃO: Busque dados fundamentalistas exclusivamente do site StatusInvest para os seguintes ativos da B3: ${tickers.join(', ')}. A precisão é crítica. Preencha todos os campos do schema com os valores exatos encontrados no StatusInvest, sem aproximações.`;

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