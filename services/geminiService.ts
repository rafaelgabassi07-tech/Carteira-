
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
        source: { type: Type.STRING, description: "Nome do veículo (ex: Brazil Journal, InfoMoney)." },
        title: { type: Type.STRING, description: "Manchete exata." },
        summary: { type: Type.STRING, description: "Resumo do fato em 1 frase." },
        impactAnalysis: { type: Type.STRING, description: "Breve análise: Como isso afeta o investidor?" },
        date: { type: Type.STRING, description: "Data ISO YYYY-MM-DD." },
        sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative"] },
        category: { type: Type.STRING, enum: ["Dividendos", "Macroeconomia", "Resultados", "Mercado", "Imóveis", "Geral"] },
        impactLevel: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
        imageUrl: { type: Type.STRING, description: "URL da imagem de capa encontrada na busca." },
        url: { type: Type.STRING, description: "Link direto para a notícia." }
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

export interface NewsFilter {
    tickers?: string[];
    dateRange?: 'today' | 'week' | 'month';
    sources?: string;
    query?: string;
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
      case 'today': dateConstraint = "publicadas HOJE"; break;
      case 'week': dateConstraint = "publicadas nesta semana"; break;
      case 'month': dateConstraint = "deste mês"; break;
      default: dateConstraint = "recentes";
  }

  let sourceConstraint = "";
  if (filter.sources && filter.sources.trim().length > 0) {
      sourceConstraint = `Fontes preferenciais: ${filter.sources}.`;
  }

  // Prompt Refinado
  const prompt = `
    Você é um API de notícias financeiras. Busque as 8 notícias mais importantes sobre Fundos Imobiliários (FIIs) e Mercado Financeiro Brasileiro ${dateConstraint}.
    
    Foco nos ativos: ${contextTickers || 'Geral do mercado'}.
    ${sourceConstraint}

    REGRAS CRÍTICAS PARA LINKS E IMAGENS:
    1. Use a ferramenta de busca para encontrar URLs REAIS das notícias.
    2. Extraia o link direto (href) e a imagem de capa (og:image) de cada resultado.
    3. Se não encontrar imagem, deixe o campo 'imageUrl' em branco (não invente).
    4. O campo 'url' DEVE ser um link válido para clicar.

    REGRAS DE FORMATO:
    - Retorne APENAS um JSON Array puro.
    - Não use blocos de código markdown (\`\`\`json).
    
    SCHEMA JSON:
    [
      {
        "source": "Nome da Fonte",
        "title": "Título da Matéria",
        "summary": "Resumo curto",
        "impactAnalysis": "Por que isso mexe com o bolso?",
        "date": "YYYY-MM-DD",
        "sentiment": "Positive/Neutral/Negative",
        "category": "Dividendos/Macroeconomia/Resultados/Mercado/Imóveis",
        "impactLevel": "High/Medium/Low",
        "url": "https://link-real-da-noticia.com",
        "imageUrl": "https://link-da-imagem.jpg"
      }
    ]
  `;

  try {
      return await withRetry(async () => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
                temperature: 0.1, 
            }
          });
          
          const responseText = response.text?.trim() || '';
          if (!responseText) return [];

          // Limpeza agressiva de Markdown e JSON inválido
          let jsonText = responseText
            .replace(/^```json\s*/, '') // Remove início de bloco code
            .replace(/^```\s*/, '') 
            .replace(/\s*```$/, ''); // Remove fim de bloco code

          try {
            let parsedData = JSON.parse(jsonText);
            let articles: NewsArticle[] = [];

            if (Array.isArray(parsedData)) {
                articles = parsedData;
            } else if (typeof parsedData === 'object' && parsedData !== null) {
                // Fallback: Tenta encontrar array dentro de alguma propriedade
                const possibleArray = Object.values(parsedData).find(val => Array.isArray(val));
                if (possibleArray) articles = possibleArray as NewsArticle[];
            }
            
            if (articles.length === 0) return [];

            // Grounding Check Refinado (Correção de Links)
            // A API do Gemini retorna 'groundingChunks' que contém os links reais usados para gerar a resposta.
            // Vamos tentar casar o título da notícia com o título do chunk para garantir o link certo.
            const webSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web).filter(Boolean) || [];
  
            return articles.map(article => {
                  let finalUrl = article.url;
                  let finalImage = article.imageUrl;

                  // Se a URL parece falsa ou vazia, tenta encontrar no grounding
                  const isInvalidUrl = !finalUrl || finalUrl.includes('example.com') || finalUrl.length < 10;
                  
                  if (isInvalidUrl && webSources.length > 0) {
                      // Tenta encontrar um source que contenha palavras chave do título
                      const keywords = article.title.split(' ').filter(w => w.length > 4).slice(0, 3);
                      const match = webSources.find(src => 
                          src?.title && keywords.some(k => src.title?.toLowerCase().includes(k.toLowerCase()))
                      );
                      
                      if (match?.uri) {
                          finalUrl = match.uri;
                      } else {
                          // Fallback para o primeiro link relacionado se não houver match preciso
                          // Melhor um link real do assunto do que nada
                          finalUrl = webSources[0]?.uri || `https://www.google.com/search?q=${encodeURIComponent(article.title)}`;
                      }
                  }

                  return {
                    ...article,
                    url: finalUrl,
                    imageUrl: finalImage, // Mantém a imagem se a IA achou, senão o front usa fallback
                    category: article.category || 'Mercado',
                    impactLevel: article.impactLevel || 'Medium'
                  };
              });

          } catch(e) {
            console.error("Falha no parsing JSON da IA:", e);
            return [];
          }
      });
  } catch (error) {
      console.warn("Falha na requisição de notícias:", error);
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

    const prompt = `Hoje é ${currentDate}. Busque dados fundamentalistas ATUALIZADOS para: ${tickers.join(', ')}.
    
    IMPORTANTE: Busque o "Último Rendimento Anunciado" e a "Data de Pagamento" (Next Payment Date) deste ciclo atual (Mês corrente ou próximo).
    
    Retorne JSON Array puro:
    [{"ticker": "X", "dy": 0, "pvp": 0, "sector": "", "administrator": "", "vacancyRate": 0, "dailyLiquidity": 0, "shareholders": 0, "nextPaymentDate": "YYYY-MM-DD", "lastDividend": 0}]
    `;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0,
                tools: [{googleSearch: {}}] 
            }
        });
        
        let jsonText = response.text || '[]';
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

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
                            nextPaymentDate: item.nextPaymentDate, // Mantém string ISO
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
