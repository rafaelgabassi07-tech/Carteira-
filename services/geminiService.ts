
import { GoogleGenAI, Type, Schema } from '@google/genai';
import type { NewsArticle, AppPreferences } from '../types';

function getGeminiApiKey(prefs: AppPreferences): string {
    // Priority 1: User-provided key from settings
    if (prefs.geminiApiKey && prefs.geminiApiKey.trim() !== '') {
        return prefs.geminiApiKey;
    }
    
    // Priority 2: Environment variable (Vite's way)
    const envApiKey = (import.meta as any).env.VITE_API_KEY;
    if (envApiKey && envApiKey.trim() !== '') {
        return envApiKey;
    }

    throw new Error("Chave de API do Gemini (VITE_API_KEY) não configurada.");
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

// --- SCHEMAS (Structured Outputs) ---

const newsArticleSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        source: { type: Type.STRING, description: "Nome da fonte (ex: Valor, InfoMoney)." },
        title: { type: Type.STRING, description: "Manchete original." },
        summary: { type: Type.STRING, description: "Resumo conciso do fato (max 30 palavras)." },
        impactAnalysis: { type: Type.STRING, description: "Análise crítica em 1 frase: Por que isso importa para o investidor de FIIs?" },
        date: { type: Type.STRING, description: "Data YYYY-MM-DD." },
        sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative"] },
        category: { type: Type.STRING, enum: ["Dividendos", "Macroeconomia", "Resultados", "Mercado", "Imóveis", "Geral"], description: "Categoria principal da notícia." },
        impactLevel: { type: Type.STRING, enum: ["High", "Medium", "Low"], description: "Nível de impacto potencial nos preços ou dividendos." },
        imageUrl: { type: Type.STRING, description: "URL da imagem principal da notícia (thumbnail/og:image) encontrada na busca. Tente ao máximo encontrar uma imagem real." }
    },
    required: ["source", "title", "summary", "impactAnalysis", "date", "sentiment", "category", "impactLevel"]
};

const newsListSchema: Schema = {
    type: Type.ARRAY,
    items: newsArticleSchema,
    description: "Lista de notícias financeiras analisadas."
};

const advancedAssetDataSchema: Schema = {
    type: Type.ARRAY,
    description: "Lista de dados fundamentalistas para ativos financeiros.",
    items: {
        type: Type.OBJECT,
        properties: {
            ticker: { type: Type.STRING, description: "Símbolo do ativo (ticker)." },
            dy: { type: Type.NUMBER, description: "Dividend Yield 12M (%)" },
            pvp: { type: Type.NUMBER, description: "P/VP" },
            sector: { type: Type.STRING, description: "Segmento padronizado." },
            administrator: { type: Type.STRING, description: "Administradora." },
            vacancyRate: { type: Type.NUMBER, description: "Vacância (%)" },
            dailyLiquidity: { type: Type.NUMBER, description: "Liquidez diária." },
            shareholders: { type: Type.NUMBER, description: "Número de cotistas." },
            nextPaymentDate: { type: Type.STRING, description: "Próxima data de pagamento de proventos confirmada (YYYY-MM-DD) ou null se não houver." },
            lastDividend: { type: Type.NUMBER, description: "Valor do último rendimento pago/anunciado." }
        },
        required: ["ticker", "dy", "pvp", "sector", "administrator", "vacancyRate", "dailyLiquidity", "shareholders"]
    }
};

// --- SERVICES ---

/**
 * Finds the most likely URL for a summarized article by comparing its title to the titles of grounded search results.
 */
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
    sources?: string; // Comma separated string
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
  const contextTickers = filter.tickers?.slice(0, 8).join(', '); // Increased context
  
  let dateConstraint = "";
  switch (filter.dateRange) {
      case 'today': dateConstraint = "publicadas nas últimas 24 horas"; break;
      case 'week': dateConstraint = "publicadas na última semana"; break;
      case 'month': dateConstraint = "publicadas no último mês"; break;
      default: dateConstraint = "recentes";
  }

  let sourceConstraint = "";
  if (filter.sources && filter.sources.trim().length > 0) {
      sourceConstraint = `Priorize notícias das seguintes fontes: ${filter.sources}.`;
  }

  const jsonInstruction = ` Responda ESTRITAMENTE com um array JSON correspondente ao schema: ${JSON.stringify(newsListSchema)}. Analise cada notícia como um especialista em Fundos Imobiliários. IMPORTANTE: Tente encontrar a URL da imagem real da notícia (thumbnail) no contexto da busca.`;
  
  let prompt: string;
  if (filter.query && filter.query.trim()) {
      prompt = `Encontre notícias financeiras ${dateConstraint} sobre "${filter.query}". ${sourceConstraint} Foque no impacto para investidores de FIIs.` + jsonInstruction;
  } else {
      // Prompt otimizado para gerar insights mais valiosos
      prompt = `Atue como um analista sênior de FIIs. Busque as 6 notícias mais críticas do mercado brasileiro de Fundos Imobiliários (FIIs) e Macroeconomia ${dateConstraint}. 
      Contexto da carteira do usuário (Tickers): ${contextTickers || 'Geral'}.
      Se houver notícias específicas sobre esses ativos, priorize-as. Caso contrário, foque em notícias macro (Selic, inflação, legislação) que impactam o setor imobiliário.
      ${sourceConstraint}` + jsonInstruction;
  }

  try {
      return await withRetry(async () => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
            }
          });
          
          const responseText = response.text?.trim() || '';
          if (!responseText) {
              console.warn("Gemini returned an empty response for news.");
              return [];
          }

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
            } 
            else if (typeof parsedData === 'object' && parsedData !== null) {
                const arrayKey = Object.keys(parsedData).find(key => Array.isArray((parsedData as any)[key]));
                if (arrayKey) {
                    articles = (parsedData as any)[arrayKey];
                }
            }
            
            if (articles.length === 0) {
                 console.warn("Could not find a valid news array in the Gemini response.", parsedData);
                 return [];
            }

            const webSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web).filter(Boolean) || [];
  
            return articles
              .filter(article => article && typeof article.title === 'string' && article.title.trim() !== '')
              .map(article => ({
                ...article,
                url: findBestUrl(article.title, webSources),
            }));

          } catch(e) {
            console.error("Failed to parse JSON response from Gemini:", e);
            return [];
          }
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
    nextPaymentDate?: string;
    lastDividend?: number;
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
    
    const prompt = `Busque dados fundamentalistas do StatusInvest para: ${tickers.join(', ')}. 
    
    Para cada ativo, busque também a próxima data de pagamento de proventos (Data Pagamento) CONFIRMADA e o valor do último dividendo. Se não houver data futura confirmada, retorne null para a data.
    
    Use EXATAMENTE as categorias: 'Tijolo - Shoppings', 'Tijolo - Lajes Corporativas', 'Tijolo - Logística', 'Tijolo - Híbrido', 'Papel', 'Fundo de Fundos (FOF)', 'Agro (Fiagro)' ou 'Outros'.`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: advancedAssetDataSchema,
                temperature: 0,
                tools: [{googleSearch: {}}] // Enable search to find latest dividend dates
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
                        nextPaymentDate: item.nextPaymentDate || undefined,
                        lastDividend: Number(item.lastDividend || 0)
                    };
                }
            });
        }
        
        return result;
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
        console.error("Gemini key validation failed:", error);
        return false;
    }
}