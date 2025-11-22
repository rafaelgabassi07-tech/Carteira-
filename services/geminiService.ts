
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
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const firstOpen = cleaned.indexOf('[');
    const lastClose = cleaned.lastIndexOf(']');
    
    if (firstOpen !== -1 && lastClose > firstOpen) {
        const jsonCandidate = cleaned.substring(firstOpen, lastClose + 1);
        try {
            return JSON.parse(jsonCandidate);
        } catch (e) {
            try {
                // Attempt to fix common trailing comma issues
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
  
  const contextTickers = filter.tickers && filter.tickers.length > 0 
    ? `Tickers de interesse: ${filter.tickers.slice(0, 5).join(', ')}.` 
    : "Destaques do IFIX e Ibovespa.";
  
  const timeMap = { 'today': "últimas 24h", 'week': "última semana", 'month': "último mês" };
  const timePrompt = timeMap[filter.dateRange || 'week'];
  const userQuery = filter.query ? `Foco no tema: "${filter.query}".` : "";
  const sourcePrompt = filter.sources ? `Fontes: ${filter.sources}.` : "";

  const prompt = `
    [SYSTEM INSTRUCTION]
    Você é uma API de notícias financeiras.
    OBRIGATÓRIO: Use a ferramenta 'googleSearch' para encontrar notícias reais e recentes.
    NÃO invente notícias. NÃO use dados antigos do seu conhecimento prévio.
    
    [CONTEXTO]
    ${contextTickers}
    ${userQuery}
    ${sourcePrompt}
    Período: ${timePrompt}

    [FORMATO DE SAÍDA]
    Retorne APENAS um Array JSON.
    Campos Obrigatórios: source, title, summary, date (YYYY-MM-DD), url, category, sentiment, impactLevel.
    Tente extrair a 'imageUrl' real se disponível nos metadados.

    Exemplo:
    [{"source":"InfoMoney","title":"...","summary":"...","url":"https://...","category":"Dividendos","sentiment":"Positive","impactLevel":"High"}]
  `;

  try {
      return await withRetry(async () => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
                temperature: 0.2, // Low temperature for factual consistency
                maxOutputTokens: 4000, 
            }
          });
          
          const responseText = response.text || '';
          const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          let articles: NewsArticle[] = [];

          try {
            articles = extractJSON(responseText);
          } catch (e) {
            console.warn("JSON Parse failed. Fallback to Grounding Metadata.");
          }

          // --- HYBRID FALLBACK STRATEGY ---
          
          // 1. If JSON failed or empty, construct from Grounding Metadata
          if (!Array.isArray(articles) || articles.length === 0) {
             if (groundingChunks.length > 0) {
                articles = groundingChunks
                    .filter(c => c.web?.title && c.web?.uri)
                    .map(c => ({
                        source: new URL(c.web!.uri!).hostname.replace('www.', '').split('.')[0].toUpperCase(),
                        title: c.web!.title!,
                        summary: "Clique para ler a notícia completa na fonte original.",
                        impactAnalysis: "Conteúdo da Web",
                        date: new Date().toISOString(),
                        sentiment: 'Neutral',
                        category: 'Mercado',
                        impactLevel: 'Medium',
                        url: c.web!.uri!
                    })).slice(0, 10);
             }
          }

          // 2. Link Validation & Correction
          // Map AI-generated links to real Google Search links if they look suspicious
          const webSources = groundingChunks
              .map(c => c.web)
              .filter(Boolean)
              .flatMap(w => ({ uri: w?.uri, title: w?.title }));

          const validatedArticles = articles.map(article => {
                let finalUrl = article.url;
                // If URL is missing or looks fake (example.com), try to find a match in grounding data
                if (!finalUrl || finalUrl.includes('example.com') || !finalUrl.startsWith('http')) {
                    // Fuzzy match title
                    const match = webSources.find(src => 
                        src.title && article.title && 
                        (src.title.toLowerCase().includes(article.title.toLowerCase().substring(0, 15)))
                    );
                    finalUrl = match?.uri || `https://www.google.com/search?q=${encodeURIComponent(article.title)}`;
                }
                
                return {
                  ...article,
                  url: finalUrl,
                  // Sanitize Image URL
                  imageUrl: article.imageUrl && article.imageUrl.startsWith('http') && !article.imageUrl.includes('favicon') ? article.imageUrl : undefined
                };
            }).slice(0, 12);

          // 3. ULTIMATE FALLBACK: If absolutely nothing found (API returned empty JSON and no grounding)
          // Create a "Search Card" so the user doesn't see an error screen.
          if (validatedArticles.length === 0) {
              const searchTerm = filter.query || filter.tickers?.[0] || "Mercado Financeiro";
              return [{
                  source: "Google News",
                  title: `Pesquisar notícias sobre: ${searchTerm}`,
                  summary: "Não foi possível carregar o resumo automático. Toque para ver os resultados no Google.",
                  date: new Date().toISOString(),
                  url: `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}&tbm=nws`,
                  category: "Mercado",
                  sentiment: "Neutral",
                  impactLevel: "Low"
              }];
          }

          return validatedArticles;
      });
  } catch (error) {
      console.warn("Erro na API de Notícias:", error);
      // Return empty array to let UI handle it, or could return a static error card here too.
      // Let's return a static card to prevent UI crash.
      return [{
          source: "Sistema",
          title: "Serviço Indisponível Temporariamente",
          summary: "Verifique sua conexão ou tente novamente mais tarde. Toque para pesquisar manualmente.",
          date: new Date().toISOString(),
          url: `https://www.google.com/search?q=${encodeURIComponent(filter.query || "Investimentos")}`,
          category: "Geral",
          sentiment: "Neutral",
          impactLevel: "Low"
      }]; 
  }
}

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
