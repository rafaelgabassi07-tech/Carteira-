
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

async function withRetry<T>(apiCall: () => Promise<T>, maxRetries = 2, initialDelay = 1000): Promise<T> {
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
  
  // Otimização: Limitar contexto para os 5 principais ativos para não poluir o prompt
  const contextTickers = filter.tickers?.slice(0, 5).join(', ');
  
  let timePrompt = "";
  switch (filter.dateRange) {
      case 'today': timePrompt = "nas últimas 24 horas"; break;
      case 'week': timePrompt = "nos últimos 7 dias"; break;
      case 'month': timePrompt = "neste mês"; break;
      default: timePrompt = "recente";
  }

  const userQuery = filter.query ? `Assunto específico: "${filter.query}".` : "";
  const sourcePrompt = filter.sources ? `Fontes prioritárias: ${filter.sources}.` : "";

  // Prompt OTIMIZADO para velocidade e estrutura
  const prompt = `
    Atue como um analista financeiro sênior. Busque as 6 notícias mais impactantes sobre o Mercado Financeiro Brasileiro e Fundos Imobiliários (FIIs) ${timePrompt}.
    
    FOCO: ${contextTickers ? `Prioridade total para notícias sobre: ${contextTickers}.` : "Destaques do IFIX e Ibovespa."}
    ${userQuery}
    ${sourcePrompt}

    OBJETIVO:
    Retorne um JSON Array estritamente válido.
    
    PARA CADA NOTÍCIA:
    1. Encontre o LINK REAL (url) funcional.
    2. Tente extrair a URL da IMAGEM de capa (thumbnail/og:image). Se não achar, deixe em branco.
    3. Analise o IMPACTO para o investidor (positivo/negativo/neutro e porquê).

    FORMATO JSON (Array):
    [
      {
        "source": "Nome da Fonte",
        "title": "Manchete Curta e Chamativa",
        "summary": "Resumo em 1 frase direta.",
        "impactAnalysis": "Ex: 'Alta na Selic prejudica FIIs de tijolo'.",
        "date": "YYYY-MM-DD",
        "sentiment": "Positive" | "Neutral" | "Negative",
        "category": "Dividendos" | "Macroeconomia" | "Resultados" | "Mercado" | "Imóveis",
        "impactLevel": "High" | "Medium" | "Low",
        "url": "https://...",
        "imageUrl": "https://..."
      }
    ]
  `;

  try {
      return await withRetry(async () => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Modelo mais rápido e eficiente
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
                temperature: 0.3, // Baixa temperatura para respostas mais objetivas e rápidas
                maxOutputTokens: 2000, // Limita o tamanho para garantir velocidade
            }
          });
          
          const responseText = response.text?.trim() || '';
          if (!responseText) return [];

          // Limpeza robusta de JSON (remove blocos de código e texto extra)
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          const jsonText = jsonMatch ? jsonMatch[0] : responseText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

          try {
            let articles: NewsArticle[] = JSON.parse(jsonText);
            if (!Array.isArray(articles)) return [];

            // GROUNDING & LINK RECOVERY (A Mágica da Correção)
            // O Gemini retorna 'groundingChunks' com os links reais que ele usou para pesquisar.
            // Vamos usar isso para corrigir links quebrados ou alucinações.
            const webSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
                ?.map(c => c.web)
                .filter(Boolean)
                .flatMap(w => ({ uri: w?.uri, title: w?.title })) || [];
  
            return articles.map(article => {
                  let finalUrl = article.url;
                  
                  // Validação de URL: Se for curta demais, 'example', ou vazia, buscamos no Grounding
                  const isSuspiciousUrl = !finalUrl || finalUrl.length < 12 || finalUrl.includes('example') || finalUrl.includes('google.com/search');
                  
                  if (isSuspiciousUrl && webSources.length > 0) {
                      // Tenta encontrar um link que tenha palavras do título da notícia
                      const titleWords = article.title.toLowerCase().split(' ').filter(w => w.length > 4);
                      
                      const match = webSources.find(src => 
                          src.title && titleWords.some(word => src.title?.toLowerCase().includes(word))
                      );
                      
                      if (match?.uri) {
                          finalUrl = match.uri;
                      } else {
                          // Fallback para o primeiro link de fonte confiável encontrado
                          finalUrl = webSources[0].uri || `https://www.google.com/search?q=${encodeURIComponent(article.title)}`;
                      }
                  }

                  // Garante categorias válidas para o sistema de ícones/cores
                  const validCategories = ["Dividendos", "Macroeconomia", "Resultados", "Mercado", "Imóveis", "Geral"];
                  const category = validCategories.includes(article.category || '') ? article.category : 'Mercado';

                  return {
                    ...article,
                    url: finalUrl,
                    category: category as any,
                    impactLevel: article.impactLevel || 'Medium',
                    // Se a imagem vier vazia ou quebrada, o front-end usará o fallback determinístico
                    imageUrl: article.imageUrl && article.imageUrl.startsWith('http') ? article.imageUrl : undefined 
                  };
              });

          } catch(e) {
            console.error("Erro ao processar JSON de notícias:", e);
            return [];
          }
      });
  } catch (error) {
      console.warn("Erro na API de Notícias:", error);
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

    const prompt = `Hoje é ${currentDate}. Aja como um terminal financeiro. Retorne dados fundamentalistas REAIS e ATUALIZADOS para: ${tickers.join(', ')}.
    
    CRÍTICO:
    1. Busque "Aviso aos Cotistas" ou "Fato Relevante" deste mês ou mês passado para achar a Data de Pagamento.
    2. Se já pagou este mês, retorne essa data. Se anunciou para o próximo, retorne a próxima.
    
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
