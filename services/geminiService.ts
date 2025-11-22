
import { GoogleGenAI } from '@google/genai';
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
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
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

// --- JSON Helper ---
function extractJSON(text: string): any {
    if (!text) throw new Error("Texto vazio");
    // Remove code blocks logic
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Try finding the array brackets
    const firstOpen = cleaned.indexOf('[');
    const lastClose = cleaned.lastIndexOf(']');
    
    if (firstOpen !== -1 && lastClose > firstOpen) {
        const jsonCandidate = cleaned.substring(firstOpen, lastClose + 1);
        try {
            return JSON.parse(jsonCandidate);
        } catch (e) {
            // If strict parse fails, try a loose correction (common trailing comma issue)
            try {
                return JSON.parse(jsonCandidate.replace(/,\s*]/g, "]"));
            } catch (e2) {
                throw new Error("Falha crítica no parsing do JSON");
            }
        }
    }
    throw new Error("Estrutura JSON não encontrada");
}

export async function fetchMarketNews(prefs: AppPreferences, filter: NewsFilter): Promise<NewsArticle[]> {
  let apiKey: string;
  try {
    apiKey = getGeminiApiKey(prefs);
  } catch (error: any) {
    console.warn("News fetch skipped:", error.message);
    return [];
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  // Context Optimization
  const contextTickers = filter.tickers && filter.tickers.length > 0 
    ? `Prioridade máxima para notícias sobre: ${filter.tickers.slice(0, 5).join(', ')}.` 
    : "Destaques gerais do IFIX e Ibovespa.";
  
  const timeMap = {
      'today': "nas últimas 24 horas",
      'week': "nos últimos 7 dias",
      'month': "neste mês"
  };
  const timePrompt = timeMap[filter.dateRange || 'week'] || "recentes";
  const userQuery = filter.query ? `Tópico específico: "${filter.query}".` : "";
  const sourcePrompt = filter.sources ? `Fontes preferidas: ${filter.sources}.` : "";

  const prompt = `
    Você é um agregador de notícias financeiras em tempo real.
    Tarefa: Busque e liste 8 notícias ${timePrompt} sobre o Mercado Financeiro Brasileiro (FIIs e Ações).
    
    CONTEXTO:
    ${contextTickers}
    ${userQuery}
    ${sourcePrompt}

    REQUISITOS TÉCNICOS (JSON ONLY):
    1. Retorne APENAS um Array JSON válido.
    2. Tente encontrar a URL da imagem de capa (og:image) no código da página.
    3. O link (url) DEVE funcionar.

    SCHEMA:
    [
      {
        "source": "Nome do Veículo (ex: InfoMoney)",
        "title": "Manchete (Máx 80 caracteres)",
        "summary": "Resumo direto (Máx 120 caracteres)",
        "impactAnalysis": "Uma frase curta sobre o impacto (ex: 'Positivo para dividendos' ou 'Risco de vacância')",
        "date": "YYYY-MM-DD",
        "sentiment": "Positive" | "Neutral" | "Negative",
        "category": "Dividendos" | "Macroeconomia" | "Resultados" | "Mercado" | "Imóveis",
        "impactLevel": "High" | "Medium" | "Low",
        "url": "https://link-real...",
        "imageUrl": "https://link-imagem..."
      }
    ]
  `;

  try {
      return await withRetry(async () => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}], // Grounding ativado
                temperature: 0.1, // Frio para precisão
                maxOutputTokens: 4000, 
            }
          });
          
          const responseText = response.text || '';
          const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          let articles: NewsArticle[] = [];

          try {
            // 1. Tenta extrair o JSON gerado pela IA
            articles = extractJSON(responseText);
          } catch (e) {
            console.warn("JSON Parsing failed. Switching to Grounding Fallback.");
            
            // 2. FALLBACK ROBUSTO: Constrói notícias usando apenas os metadados do Google Search
            if (groundingChunks.length > 0) {
                articles = groundingChunks
                    .filter(c => c.web?.title && c.web?.uri)
                    .map(c => ({
                        source: new URL(c.web!.uri!).hostname.replace('www.', '').split('.')[0].toUpperCase(),
                        title: c.web!.title!,
                        summary: "Notícia encontrada via busca. Clique para ler o conteúdo completo na fonte original.",
                        impactAnalysis: "Conteúdo da Web",
                        date: new Date().toISOString(),
                        sentiment: 'Neutral',
                        category: 'Mercado',
                        impactLevel: 'Medium',
                        url: c.web!.uri!
                    }));
            }
          }

          if (!Array.isArray(articles) || articles.length === 0) return [];

          // 3. Pós-Processamento e Validação de Links
          const webSources = groundingChunks
              .map(c => c.web)
              .filter(Boolean)
              .flatMap(w => ({ uri: w?.uri, title: w?.title }));

          return articles.map(article => {
                let finalUrl = article.url;
                
                // Validação de URL: Se parecer fake, tenta achar no Grounding
                const isInvalidUrl = !finalUrl || finalUrl.includes('example.com') || !finalUrl.startsWith('http');
                
                if (isInvalidUrl && webSources.length > 0) {
                    const match = webSources.find(src => 
                        src.title && article.title && 
                        (src.title.includes(article.title.substring(0, 10)) || article.title.includes(src.title.substring(0, 10)))
                    );
                    finalUrl = match?.uri || webSources[0].uri || `https://www.google.com/search?q=${encodeURIComponent(article.title)}`;
                }

                return {
                  ...article,
                  url: finalUrl,
                  category: ["Dividendos", "Macroeconomia", "Resultados", "Mercado", "Imóveis"].includes(article.category || '') ? article.category : 'Mercado' as any,
                  impactLevel: article.impactLevel || 'Medium',
                  // Validação simples de imagem
                  imageUrl: article.imageUrl && article.imageUrl.startsWith('http') && !article.imageUrl.includes('favicon') ? article.imageUrl : undefined 
                };
            }).slice(0, 12); // Limite de segurança
      });
  } catch (error) {
      console.warn("Erro na API de Notícias:", error);
      return []; 
  }
}

// --- Advanced Asset Data (Mantido igual, apenas re-exportado para garantir compatibilidade) ---
export async function fetchAdvancedAssetData(prefs: AppPreferences, tickers: string[]): Promise<Record<string, AdvancedAssetData>> {
    if (tickers.length === 0) return {};
    
    let apiKey: string;
    try { apiKey = getGeminiApiKey(prefs); } catch (error) { return {}; }

    const ai = new GoogleGenAI({ apiKey });
    const now = new Date().toISOString().split('T')[0];

    const prompt = `Data: ${now}. Aja como API financeira. JSON para: ${tickers.join(', ')}.
    Busque "Aviso aos Cotistas" recente.
    JSON: [{"ticker": "X", "dy": 0, "pvp": 0, "sector": "", "administrator": "", "vacancyRate": 0, "dailyLiquidity": 0, "shareholders": 0, "nextPaymentDate": "YYYY-MM-DD", "lastDividend": 0}]`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { temperature: 0, tools: [{googleSearch: {}}] }
        });
        
        try {
            const data = extractJSON(response.text || '[]');
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
        } catch (e) { return {}; }
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
