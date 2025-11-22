
import { GoogleGenAI, Type, Schema } from '@google/genai';
import type { NewsArticle, AppPreferences } from '../types';

function getGeminiApiKey(prefs: AppPreferences): string {
    if (prefs.geminiApiKey && prefs.geminiApiKey.trim() !== '') {
        return prefs.geminiApiKey;
    }
    const envApiKey = (import.meta as any).env.VITE_API_KEY;
    if (envApiKey && envApiKey.trim() !== '') {
        return envApiKey;
    }
    throw new Error("Chave de API do Gemini (VITE_API_KEY) não configurada.");
}

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
        throw error; 
      }
    }
  }
  throw new Error("Serviço de IA indisponível no momento.");
}

const newsArticleSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        source: { type: Type.STRING, description: "Nome da fonte (ex: Valor, InfoMoney)." },
        title: { type: Type.STRING, description: "Manchete original." },
        summary: { type: Type.STRING, description: "Resumo conciso do fato (max 30 palavras)." },
        impactAnalysis: { type: Type.STRING, description: "Análise crítica: Por que isso move o preço ou afeta dividendos?" },
        date: { type: Type.STRING, description: "Data YYYY-MM-DD." },
        sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative"] },
        category: { type: Type.STRING, enum: ["Dividendos", "Macroeconomia", "Resultados", "Mercado", "Imóveis", "Geral"] },
        impactLevel: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
        imageUrl: { type: Type.STRING, description: "Tente encontrar a URL da imagem de capa da notícia original nos resultados da busca. Se não encontrar, deixe em branco." }
    },
    required: ["source", "title", "summary", "impactAnalysis", "date", "sentiment", "category", "impactLevel"]
};

const newsListSchema: Schema = {
    type: Type.ARRAY,
    items: newsArticleSchema,
};

// ... (AdvancedAssetData types remain the same) ...
export interface AdvancedAssetData {
    dy: number;
    pvp: number;
    sector: string;
    administrator: string;
    vacancyRate: number;
    dailyLiquidity: number;
    shareholders: number;
    nextPaymentDate?: string;
    lastDividend?: number;
}

const advancedAssetDataSchema: Schema = {
    type: Type.ARRAY,
    description: "Lista de dados fundamentalistas para ativos financeiros.",
    items: {
        type: Type.OBJECT,
        properties: {
            ticker: { type: Type.STRING },
            dy: { type: Type.NUMBER },
            pvp: { type: Type.NUMBER },
            sector: { type: Type.STRING },
            administrator: { type: Type.STRING },
            vacancyRate: { type: Type.NUMBER },
            dailyLiquidity: { type: Type.NUMBER },
            shareholders: { type: Type.NUMBER },
            nextPaymentDate: { type: Type.STRING },
            lastDividend: { type: Type.NUMBER }
        },
        required: ["ticker", "dy", "pvp", "sector", "administrator", "vacancyRate", "dailyLiquidity", "shareholders"]
    }
};

function findBestUrl(articleTitle: string, sources: Array<{ title?: string; uri?: string }>): string | undefined {
    if (!articleTitle || typeof articleTitle !== 'string') return undefined;
    
    const normalize = (str: any) => {
        if (typeof str !== 'string') return '';
        return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    };

    const normalizedArticleTitle = normalize(articleTitle);
    if (!normalizedArticleTitle) return undefined;

    let bestMatch: { uri: string; score: number } | null = null;

    for (const source of sources) {
        if (!source || !source.title || !source.uri) continue;
        const normalizedSourceTitle = normalize(source.title);

        if (!normalizedSourceTitle) continue;

        const articleWords = new Set(normalizedArticleTitle.split(' ').filter((w: string) => w.length > 2));
        const sourceWords = new Set(normalizedSourceTitle.split(' '));
        const intersection = new Set([...articleWords].filter(x => sourceWords.has(x)));
        const union = new Set([...articleWords, ...sourceWords]);
        
        const score = union.size === 0 ? 0 : intersection.size / union.size;

        if (!bestMatch || score > bestMatch.score) {
            bestMatch = { uri: source.uri, score };
        }
    }

    return (bestMatch && bestMatch.score > 0.1) ? bestMatch.uri : undefined;
}

export interface NewsFilter {
    query?: string;
    tickers?: string[];
    dateRange?: 'today' | 'week' | 'month';
    sources?: string;
}

export async function fetchMarketNews(prefs: AppPreferences, filter: NewsFilter): Promise<NewsArticle[]> {
  let apiKey: string;
  try {
    apiKey = getGeminiApiKey(prefs);
  } catch (error: any) {
    console.warn("Skipping news fetch (No API Key):", error.message);
    return [];
  }
  
  const ai = new GoogleGenAI({ apiKey });
  const contextTickers = filter.tickers?.slice(0, 8).join(', ');
  
  let dateConstraint = "";
  switch (filter.dateRange) {
      case 'today': dateConstraint = "publicadas nas últimas 24 horas"; break;
      case 'week': dateConstraint = "publicadas na última semana"; break;
      case 'month': dateConstraint = "publicadas no último mês"; break;
      default: dateConstraint = "recentes";
  }

  let sourceConstraint = "";
  if (filter.sources && filter.sources.trim().length > 0) {
      sourceConstraint = `Priorize fontes: ${filter.sources}.`;
  }

  // Prompt Refinado para Imagens e Links
  const prompt = `
    Atue como analista financeiro sênior. Busque as 6 notícias mais relevantes do mercado de FIIs (Fundos Imobiliários) e Macroeconomia do Brasil ${dateConstraint}.
    
    Contexto (Tickers do usuário): ${contextTickers || 'Geral do mercado'}.
    
    ${sourceConstraint}

    INSTRUÇÕES CRÍTICAS:
    1. Retorne ESTRITAMENTE um JSON Array válido com o schema abaixo. NADA MAIS.
    2. Para cada notícia, analise o impacto real no bolso do investidor.
    3. Tente extrair a URL da IMAGEM da notícia (thumbnail) se disponível nos metadados da busca.
    
    SCHEMA JSON ESPERADO:
    ${JSON.stringify(newsListSchema)}
  `;

  try {
      return await withRetry(async () => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
                temperature: 0.1, // Reduz alucinações
            }
          });
          
          const responseText = response.text?.trim() || '';
          if (!responseText) return [];

          // Extração robusta de JSON
          let jsonText = responseText;
          const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            jsonText = jsonMatch[1];
          }

          try {
            let parsedData = JSON.parse(jsonText);
            let articles: NewsArticle[] = [];

            if (Array.isArray(parsedData)) {
                articles = parsedData;
            } else if (typeof parsedData === 'object' && parsedData !== null) {
                // Tenta encontrar array dentro do objeto
                const possibleArray = Object.values(parsedData).find(val => Array.isArray(val));
                if (possibleArray) articles = possibleArray as NewsArticle[];
            }
            
            if (articles.length === 0) return [];

            const webSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web).filter(Boolean) || [];
  
            return articles
              .filter(article => article && article.title)
              .map(article => {
                  // Tenta encontrar a URL da fonte original
                  const foundUrl = findBestUrl(article.title, webSources);
                  return {
                    ...article,
                    url: foundUrl || article.url, // Prioriza URL encontrada no grounding
                    category: article.category || 'Mercado',
                    impactLevel: article.impactLevel || 'Medium'
                  };
              });

          } catch(e) {
            console.error("Erro ao processar JSON do Gemini:", e);
            return [];
          }
      });
  } catch (error) {
      console.warn("Falha ao buscar notícias:", error);
      return []; 
  }
}

export async function fetchAdvancedAssetData(prefs: AppPreferences, tickers: string[]): Promise<Record<string, AdvancedAssetData>> {
    if (tickers.length === 0) return {};
    
    let apiKey: string;
    try {
        apiKey = getGeminiApiKey(prefs);
    } catch (error) {
        return {};
    }

    const ai = new GoogleGenAI({ apiKey });
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];

    const prompt = `Data de hoje: ${currentDate}.
    Busque dados fundamentalistas para: ${tickers.join(', ')}. 
    Retorne um JSON array válido (sem markdown) com: dy, pvp, sector, administrator, vacancyRate, dailyLiquidity, shareholders, nextPaymentDate (YYYY-MM-DD, pagamento real), lastDividend.
    Use Tools para buscar dados reais.`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0,
                tools: [{googleSearch: {}}] 
            }
        });
        
        const responseText = response.text || '[]';
        let jsonText = responseText;
        const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) jsonText = jsonMatch[1];

        try {
            const data = JSON.parse(jsonText);
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
                            nextPaymentDate: item.nextPaymentDate,
                            lastDividend: Number(item.lastDividend || 0)
                        };
                    }
                });
            }
            return result;
        } catch (e) {
            return {};
        }
    });
}

export async function validateGeminiKey(key: string): Promise<boolean> {
    if (!key || key.trim() === '') return false;
    try {
        const ai = new GoogleGenAI({ apiKey: key });
        await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "test",
        });
        return true;
    } catch (error) {
        return false;
    }
}
