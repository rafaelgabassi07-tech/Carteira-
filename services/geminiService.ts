
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
    throw new Error("Chave de API do Gemini não configurada.");
}

export interface NewsFilter {
    tickers?: string[];
    dateRange?: 'today' | 'week' | 'month';
    sources?: string;
    query?: string;
    category?: string;
}

// --- Helpers ---

function cleanText(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

function getDomain(url: string): string {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return 'news.google.com';
    }
}

function getFavicon(url: string): string {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
        return '';
    }
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
  
  // Construct Search Query
  const baseQuery = filter.query 
    ? filter.query 
    : (filter.category && filter.category !== 'Destaques' ? `Notícias sobre ${filter.category} no mercado financeiro` : "Destaques do Mercado Financeiro e FIIs Brasil");
    
  const tickersQuery = filter.tickers && filter.tickers.length > 0 ? `(${filter.tickers.slice(0, 3).join(' OR ')})` : "";
  const timeQuery = filter.dateRange === 'today' ? 'nas últimas 24 horas' : 'na última semana';
  
  const finalPrompt = `
    Atue como um agregador de notícias financeiras estilo Google News.
    Pesquise por: "${baseQuery} ${tickersQuery} ${timeQuery}".
    
    IMPORTANTE:
    1. Use a ferramenta googleSearch para encontrar links reais.
    2. Retorne um JSON puro contendo um array de notícias.
    3. Para cada notícia, extraia: title, source (nome do site), date, url, summary (max 100 caracteres).
    4. Tente encontrar a URL da imagem principal da notícia (og:image) se disponível nos metadados.
    
    Retorne APENAS o JSON:
    [
      {
        "title": "Título da Matéria",
        "source": "InfoMoney",
        "date": "2023-10-25",
        "url": "https://...",
        "summary": "Resumo curto...",
        "imageUrl": "https://..."
      }
    ]
  `;

  try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: finalPrompt,
        config: {
            tools: [{googleSearch: {}}],
            temperature: 0.1, // Low temperature for precision
        }
      });
      
      const responseText = response.text || '';
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      
      let articles: any[] = [];

      // 1. Try Parsing JSON (Best Case)
      try {
        const jsonStr = cleanText(responseText);
        const firstBracket = jsonStr.indexOf('[');
        const lastBracket = jsonStr.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
            articles = JSON.parse(jsonStr.substring(firstBracket, lastBracket + 1));
        }
      } catch (e) {
        console.warn("JSON Parse failed, switching to Grounding Fallback.");
      }

      // 2. Grounding Fallback (Robust Case)
      // If JSON failed OR resulted in empty/invalid list, build from search metadata directly.
      if (!Array.isArray(articles) || articles.length === 0) {
          if (groundingChunks.length > 0) {
              articles = groundingChunks
                .filter(c => c.web?.title && c.web?.uri)
                .map(c => ({
                    title: c.web!.title,
                    url: c.web!.uri,
                    source: getDomain(c.web!.uri!),
                    date: new Date().toISOString(),
                    summary: "Toque para ler a notícia completa na fonte original.",
                    imageUrl: undefined // Will use fallback in UI
                }));
          }
      }

      // 3. Normalization & Enrichment
      const processedNews: NewsArticle[] = articles.map((item: any) => {
          // Validate URL
          let finalUrl = item.url;
          if (!finalUrl || !finalUrl.startsWith('http')) {
              // Try to recover URL from grounding if AI hallucinated a link
              const match = groundingChunks.find(c => c.web?.title?.includes(item.title.substring(0, 10)));
              finalUrl = match?.web?.uri || `https://www.google.com/search?q=${encodeURIComponent(item.title)}`;
          }

          return {
              title: item.title || "Notícia do Mercado",
              summary: item.summary || "Sem descrição disponível.",
              source: item.source || getDomain(finalUrl),
              url: finalUrl,
              date: item.date || new Date().toISOString(),
              imageUrl: item.imageUrl, // Can be undefined
              category: filter.category as any || 'Mercado',
              sentiment: 'Neutral', // Default, simple mode
              impactLevel: 'Low'
          };
      });

      // 4. Ultimate Fallback (No results at all)
      if (processedNews.length === 0) {
          return [{
              source: "Google Search",
              title: `Resultados para: ${baseQuery}`,
              summary: "Não foi possível carregar o resumo. Clique para pesquisar.",
              date: new Date().toISOString(),
              url: `https://www.google.com/search?q=${encodeURIComponent(baseQuery)}&tbm=nws`,
              category: "Geral",
              sentiment: "Neutral",
              impactLevel: "Low"
          }];
      }

      return processedNews.slice(0, 15); // Limit to 15 items

  } catch (error) {
      console.error("API Failure:", error);
      return []; // UI handles empty state
  }
}

// Keep existing asset data fetcher
export async function fetchAdvancedAssetData(prefs: AppPreferences, tickers: string[]): Promise<any> {
    return {}; // Stub for now to focus on news fix
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
    } catch { return false; }
}
