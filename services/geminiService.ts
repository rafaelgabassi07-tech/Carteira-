
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
        const hostname = new URL(url).hostname;
        return hostname.replace('www.', '');
    } catch {
        return 'news.google.com';
    }
}

// Função auxiliar para extrair JSON de texto markdown
function extractJSON(text: string): any[] | null {
    try {
        // Tenta encontrar array JSON explícito
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        // Tenta parsear o texto todo se não achou array
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

  // Prompt focado em JSON estruturado para garantir RESUMOS
  const prompt = `
    Atue como um analista financeiro especializado em Fundos Imobiliários (FIIs).
    Pesquise no Google sobre: "${searchQuery}".
    
    Retorne um JSON Array estrito com as 10 notícias mais relevantes encontradas.
    Formato do JSON:
    [
      {
        "title": "Título da notícia",
        "source": "Fonte (ex: InfoMoney)",
        "date": "YYYY-MM-DDTHH:mm:ssZ",
        "summary": "Resumo curto e direto (máx 2 frases) explicando o impacto para o investidor.",
        "url": "URL da notícia",
        "sentiment": "Positive" | "Neutral" | "Negative"
      }
    ]

    REGRAS:
    1. Priorize FIIs (Fundos Imobiliários) e Fiagros.
    2. O resumo DEVE existir e ser explicativo.
    3. Se não encontrar notícias específicas, traga destaques gerais do mercado financeiro (IFIX, Taxa Selic).
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
      
      // Tenta extrair as notícias ricas (com resumo da IA)
      let articles: NewsArticle[] = extractJSON(textResponse) || [];

      // Validação e Correção de Links usando Grounding Metadata (Dados Reais)
      // A IA pode "alucinar" links ou não saber a URL exata. O Grounding tem a verdade.
      if (articles.length > 0) {
          articles = articles.map(article => {
              // Tenta encontrar um link real nos metadados que corresponda ao título ou fonte
              const matchedChunk = groundingChunks.find(c => 
                  c.web?.title?.toLowerCase().includes(article.title.substring(0, 10).toLowerCase()) ||
                  c.web?.uri === article.url
              );

              return {
                  ...article,
                  // Se achou link real no grounding, usa ele. Se não, mantém o da IA (risco de quebrado, mas tentamos)
                  url: matchedChunk?.web?.uri || article.url, 
                  // Garante campos obrigatórios
                  source: article.source || getDomain(article.url || ''),
                  date: article.date || new Date().toISOString(),
                  sentiment: article.sentiment || 'Neutral'
              };
          });
      } 
      // FALLBACK: Se a IA falhou em gerar JSON (articles vazio), usamos puramente o Grounding
      else if (groundingChunks.length > 0) {
          console.warn("JSON parsing failed, falling back to raw Grounding Metadata");
          const uniqueLinks = new Set();
          
          articles = groundingChunks
            .filter(c => c.web?.title && c.web?.uri)
            .map(c => {
                const url = c.web!.uri!;
                if (uniqueLinks.has(url)) return null;
                uniqueLinks.add(url);

                return {
                    title: c.web!.title!,
                    source: getDomain(url),
                    url: url,
                    date: new Date().toISOString(),
                    summary: "Toque para ler a matéria completa.", // Fallback text
                    category: (filter.category as any) || 'FIIs',
                    sentiment: 'Neutral' as const,
                };
            })
            .filter((item): item is NewsArticle => item !== null);
      }

      return articles.slice(0, 15);

  } catch (error) {
      console.error("Erro busca notícias:", error);
      // Se tudo falhar, retorna array vazio para UI tratar
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
