
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

function getDomain(url: string): string {
    try {
        let cleanUrl = url;
        // Clean Google Redirect URLs
        if (url.includes('google.com/url?')) {
            const params = new URL(url).searchParams;
            cleanUrl = params.get('url') || params.get('q') || url;
        }
        
        const hostname = new URL(cleanUrl).hostname;
        let domain = hostname.replace('www.', '');
        
        // Map some common ugly domains to pretty names
        if (domain.includes('infomoney')) return 'InfoMoney';
        if (domain.includes('valor.globo')) return 'Valor Econômico';
        if (domain.includes('braziljournal')) return 'Brazil Journal';
        if (domain.includes('suno')) return 'Suno';
        if (domain.includes('fiis.com.br')) return 'FIIs.com.br';
        if (domain.includes('moneytimes')) return 'Money Times';
        if (domain.includes('finance.yahoo')) return 'Yahoo Finance';
        
        // Fix for Vertex AI / Google Grounding internal links
        if (domain.includes('vertexaisearch') || domain.includes('google.com')) return 'Google News';
        
        return domain;
    } catch {
        return 'news.google.com';
    }
}

function extractJSON(text: string): any[] | null {
    try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(text);
    } catch (e) {
        return null;
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
  
  let searchQuery = "";
  const baseTerm = "Fundos Imobiliários FIIs Brasil notícias";

  if (filter.query) {
      searchQuery = `${filter.query} ${baseTerm}`;
  } else if (filter.category && filter.category !== 'Destaques') {
      const catMap: Record<string, string> = {
          'Rendimentos': 'FIIs dividendos anúncios rendimentos',
          'Papel & CRI': 'FIIs Recebíveis CRI High Yield',
          'Logística': 'FIIs Galpões Logísticos',
          'Shoppings': 'FIIs Shopping Centers',
          'Fiagro': 'Fiagros agronegócio dividendos',
          'Lajes': 'FIIs Lajes Corporativas escritórios',
          'Geral': 'Mercado FIIs IFIX hoje'
      };
      searchQuery = `${catMap[filter.category] || filter.category} notícias recentes`;
  } else {
      searchQuery = `Destaques Mercado FIIs IFIX notícias hoje`;
  }

  // Prompt Refinado para Títulos e Resumos
  const prompt = `
    Você é um agregador de notícias de Fundos Imobiliários (FIIs).
    Pesquise no Google sobre: "${searchQuery}".
    
    Retorne um JSON Array com 10 notícias REAIS.
    NÃO INVENTE notícias. Use os dados do Grounding.
    
    [
      {
        "title": "Título exato da matéria",
        "source": "Nome do Site (ex: InfoMoney)",
        "date": "YYYY-MM-DD",
        "summary": "Resumo em 1 frase curta e impactante.",
        "url": "Link real",
        "sentiment": "Neutral"
      }
    ]
  `;

  try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: prompt,
        config: {
            tools: [{googleSearch: {}}],
            temperature: 0.1,
        }
      });
      
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const textResponse = response.text || "";
      
      let articles: NewsArticle[] = extractJSON(textResponse) || [];

      // --- PIPELINE DE RECUPERAÇÃO E CORREÇÃO (FAIL-SAFE) ---
      
      // 1. Se o JSON veio vazio mas tem chunks, reconstrua a partir dos chunks (Prioridade: Dados Reais)
      if (articles.length === 0 && groundingChunks.length > 0) {
          console.log("Usando Fallback de Grounding Chunks");
          const uniqueLinks = new Set();
          articles = groundingChunks
            .filter(c => c.web?.title && c.web?.uri)
            .map(c => {
                const url = c.web!.uri!;
                if (uniqueLinks.has(url)) return null;
                uniqueLinks.add(url);
                
                // Clean title (remove site name suffix like " - InfoMoney")
                let title = c.web!.title!;
                const separatorIndex = title.lastIndexOf(' - ');
                if (separatorIndex > 10) title = title.substring(0, separatorIndex);

                // Avoid using URL as title
                if (title.includes('http') || title.includes('.com')) {
                    return null; // Skip garbage titles
                }

                return {
                    title: title,
                    source: getDomain(url),
                    url: url,
                    date: new Date().toISOString(),
                    summary: "Toque para ler a matéria completa na fonte original.",
                    category: filter.category || 'FIIs',
                    sentiment: 'Neutral' as const,
                };
            })
            .filter((item): item is NewsArticle => item !== null);
      }
      // 2. Se o JSON veio preenchido, valide os links com o Grounding para evitar alucinação
      else if (articles.length > 0) {
          articles = articles.map(article => {
              // Tenta achar o link real que a IA usou
              const matchedChunk = groundingChunks.find(c => 
                  c.web?.uri === article.url || 
                  (c.web?.title && article.title && c.web.title.includes(article.title.substring(0, 15)))
              );

              const realUrl = matchedChunk?.web?.uri || article.url;
              const cleanSource = getDomain(realUrl || '');
              
              // If IA hallucinated a source/title that is just a domain, clean it
              if (article.title && (article.title.includes(cleanSource) || article.title.includes('.com'))) {
                  // Try to recover title from chunk if available
                  if (matchedChunk?.web?.title) {
                      article.title = matchedChunk.web.title;
                  }
              }

              return {
                  ...article,
                  url: realUrl,
                  source: article.source || cleanSource,
                  date: article.date || new Date().toISOString(),
                  sentiment: article.sentiment || 'Neutral',
                  // Fallback summary if empty
                  summary: article.summary || "Acesse para ler os detalhes."
              };
          });
      }

      return articles.slice(0, 15);

  } catch (error) {
      console.error("Erro busca notícias:", error);
      return [];
  }
}

export async function fetchAdvancedAssetData(prefs: AppPreferences, tickers: string[]): Promise<any> {
    return {};
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
