
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

function getDomain(url: string): string {
    try {
        const hostname = new URL(url).hostname;
        return hostname.replace('www.', '');
    } catch {
        return 'news.google.com';
    }
}

// --- Core Logic ---

export async function fetchMarketNews(prefs: AppPreferences, filter: NewsFilter): Promise<NewsArticle[]> {
  let apiKey: string;
  try {
    apiKey = getGeminiApiKey(prefs);
  } catch (error: any) {
    console.warn("News fetch skipped:", error.message);
    return [];
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  // Construção da Query Otimizada para Busca
  const baseContext = "Mercado Financeiro Brasil";
  let searchQuery = "";

  if (filter.query) {
      searchQuery = `${filter.query} notícias recentes`;
  } else if (filter.category && filter.category !== 'Destaques') {
      searchQuery = `Notícias sobre ${filter.category} ${baseContext}`;
  } else {
      searchQuery = `Principais notícias ${baseContext} hoje`;
  }

  if (filter.tickers && filter.tickers.length > 0) {
      const tickerList = filter.tickers.slice(0, 3).join(' OR ');
      searchQuery += ` (${tickerList})`;
  }

  // Prompt focado em estruturação de dados
  // Instruímos a IA a agir como um parser de JSON para os resultados da ferramenta de busca
  const prompt = `
    Você é um backend de API de notícias financeiras (Google News style).
    Sua tarefa é pesquisar e retornar um JSON array estruturado.
    
    PESQUISA: "${searchQuery}"
    
    REGRAS RÍGIDAS:
    1. Use a ferramenta [googleSearch] OBRIGATORIAMENTE.
    2. Analise os resultados da pesquisa.
    3. Retorne APENAS um JSON Array válido. Sem markdown, sem explicações.
    4. Extraia o máximo de notícias recentes e relevantes possível (mínimo 5).
    
    ESTRUTURA DO JSON:
    [
      {
        "title": "Título exato da manchete",
        "source": "Nome do Site (ex: InfoMoney, Brazil Journal)",
        "date": "YYYY-MM-DDTHH:mm:ssZ (ou data relativa convertida)",
        "url": "URL completa e válida da notícia",
        "imageUrl": "URL da imagem da notícia (se disponível nos metadados)",
        "summary": "Resumo muito breve (max 120 caracteres) sobre o impacto no mercado."
      }
    ]
  `;

  try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: prompt,
        config: {
            tools: [{googleSearch: {}}],
            temperature: 0.1, // Baixa temperatura para garantir formato JSON
        }
      });
      
      const responseText = response.text || '';
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      
      let articles: NewsArticle[] = [];
      let parsedJson: any[] = [];

      // 1. Tentativa de Parse do JSON da IA
      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            parsedJson = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn("IA falhou em gerar JSON válido. Usando fallback de Grounding puro.");
      }

      // 2. Validação e Cruzamento com Grounding (Google News Mechanism)
      // Se o JSON falhou OU se queremos garantir a veracidade dos links,
      // cruzamos com os metadados reais da busca.
      
      if (parsedJson.length > 0) {
          // Modo IA + Validação
          articles = parsedJson.map((item: any) => {
              // Tenta validar a URL com o grounding para evitar alucinações
              const groundMatch = groundingChunks.find(c => 
                  c.web?.uri === item.url || 
                  c.web?.title?.includes(item.title.substring(0, 15))
              );
              
              return {
                  title: item.title || groundMatch?.web?.title || "Notícia do Mercado",
                  source: item.source || getDomain(item.url || groundMatch?.web?.uri || ''),
                  url: item.url || groundMatch?.web?.uri || `https://www.google.com/search?q=${encodeURIComponent(item.title)}`,
                  date: item.date || new Date().toISOString(),
                  summary: item.summary || "Toque para ler a matéria completa.",
                  imageUrl: item.imageUrl,
                  category: filter.category as any || 'Mercado',
                  sentiment: 'Neutral'
              };
          });
      } 
      
      // 3. Fallback Robusto (Modo "Search Engine")
      // Se a IA não retornou nada útil, construímos as notícias DIRETAMENTE dos resultados da busca.
      if (articles.length === 0 && groundingChunks.length > 0) {
          const uniqueLinks = new Set();
          
          articles = groundingChunks
            .filter(c => c.web?.title && c.web?.uri)
            .filter(c => {
                if (uniqueLinks.has(c.web!.uri)) return false;
                uniqueLinks.add(c.web!.uri);
                return true;
            })
            .map(c => ({
                title: c.web!.title!,
                url: c.web!.uri!,
                source: getDomain(c.web!.uri!),
                date: new Date().toISOString(),
                summary: "Notícia encontrada via busca Google. Clique para ler.",
                category: filter.category as any || 'Mercado',
                sentiment: 'Neutral'
            }));
      }

      // 4. Fallback Final (Sem resultados)
      if (articles.length === 0) {
          return [{
              source: "Google Search",
              title: `Resultados para: ${searchQuery}`,
              summary: "Não foi possível processar o resumo. Clique para ver no Google.",
              date: new Date().toISOString(),
              url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=nws`,
              category: "Geral",
              sentiment: "Neutral"
          }];
      }

      return articles.slice(0, 20); // Limita a 20 resultados

  } catch (error) {
      console.error("Erro crítico no serviço de notícias:", error);
      return []; // UI trata lista vazia
  }
}

// Mantém compatibilidade com outras funções
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
