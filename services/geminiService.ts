
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
  
  // --- CONTEXTO ESTRITAMENTE FII ---
  const fiiContext = "Fundos Imobiliários (FIIs) Brasil IFIX Fiagro";
  
  let searchQuery = "";

  if (filter.query) {
      // Se o usuário digitou algo, adicionamos o contexto FII para garantir relevância
      searchQuery = `${filter.query} mercado imobiliário FII`;
  } else if (filter.category && filter.category !== 'Destaques') {
      // Mapeamento de categorias para termos de busca específicos de FII
      const catMap: Record<string, string> = {
          'Dividendos': 'Pagamento dividendos FIIs rendimentos data com',
          'Papel': 'FIIs de Papel CRI Recebíveis High Yield',
          'Tijolo': 'FIIs de Tijolo imóveis vacância',
          'Logística': 'FIIs Galpões Logísticos vacância aluguel',
          'Shoppings': 'FIIs de Shopping Centers vendas',
          'Fiagro': 'Fiagros agronegócio calote dividendos',
          'Lajes': 'FIIs Lajes Corporativas escritórios',
          'Mercado': 'Boletim Focus IFIX Selic impacto FIIs'
      };
      const term = catMap[filter.category] || filter.category;
      searchQuery = `${term} notícias recentes Brasil`;
  } else {
      searchQuery = `Destaques Fundos Imobiliários IFIX hoje`;
  }

  if (filter.tickers && filter.tickers.length > 0) {
      const tickerList = filter.tickers.slice(0, 3).join(' OR ');
      searchQuery += ` (${tickerList})`;
  }

  // Prompt Especializado em FIIs
  const prompt = `
    Você é um motor de busca especializado EXCLUSIVAMENTE em Fundos de Investimento Imobiliário (FIIs) e Fiagros do Brasil.
    
    OBJETIVO: Usar a ferramenta de busca para encontrar as últimas notícias sobre: "${searchQuery}".
    
    REGRAS DE OURO (FILTRO RÍGIDO):
    1. IGNORAR completamente notícias sobre: Ações (Petrobras, Vale, etc), Criptomoedas, Política genérica ou Tech, A MENOS que afete diretamente o IFIX.
    2. O foco deve ser: Dividendos, Vacância, Emissões, Relatórios Gerenciais, IFIX, Taxa Selic (impacto nos FIIs).
    3. Se a busca retornar lixo, FILTRE.
    
    RETORNO:
    Retorne APENAS um JSON Array válido. Sem markdown.
    Tente extrair URLs de imagens reais (og:image) dos resultados se possível.
    
    ESTRUTURA JSON:
    [
      {
        "title": "Título da manchete (focado em FIIs)",
        "source": "Fonte (ex: Clube FII, Funds Explorer, InfoMoney)",
        "date": "YYYY-MM-DDTHH:mm:ssZ",
        "url": "URL da notícia",
        "imageUrl": "URL da imagem (opcional)",
        "summary": "Resumo de 1 linha focado no cotista."
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
      
      const responseText = response.text || '';
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      
      let articles: NewsArticle[] = [];
      let parsedJson: any[] = [];

      // 1. Parse JSON da IA
      try {
        // Regex mais agressivo para pegar apenas o array JSON, ignorando texto ao redor
        const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
            parsedJson = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // Falha silenciosa, fallback entra em ação
      }

      // 2. Pipeline Híbrido (IA + Grounding Validation)
      if (parsedJson.length > 0) {
          articles = parsedJson.map((item: any) => {
              // Tenta encontrar o link real nos metadados para garantir que funciona
              const groundMatch = groundingChunks.find(c => 
                  c.web?.uri === item.url || 
                  (c.web?.title && item.title && c.web.title.includes(item.title.substring(0, 10)))
              );
              
              return {
                  title: item.title || groundMatch?.web?.title || "Notícia FII",
                  source: item.source || getDomain(item.url || groundMatch?.web?.uri || ''),
                  url: item.url || groundMatch?.web?.uri || `https://www.google.com/search?q=${encodeURIComponent(item.title + ' FII')}`,
                  date: item.date || new Date().toISOString(),
                  summary: item.summary || "Toque para ler detalhes.",
                  imageUrl: item.imageUrl, // IA tenta extrair, View faz o fallback
                  category: filter.category as any || 'FIIs',
                  sentiment: 'Neutral'
              };
          });
      } 
      
      // 3. Fallback de Segurança (Grounding Puro)
      // Se a IA falhou no JSON, usamos os dados brutos do Google Search, mas filtramos por termos FII
      if (articles.length === 0 && groundingChunks.length > 0) {
          const uniqueLinks = new Set();
          const keywordsFII = ['fii', 'fundo', 'imobiliário', 'ifix', 'dividendo', 'cota', 'rendimento', 'aluguel', 'cap rate', 'vacância', 'fiagro'];
          
          articles = groundingChunks
            .filter(c => c.web?.title && c.web?.uri)
            .filter(c => {
                // Filtro simples para garantir relevância FII no fallback
                const text = (c.web!.title! + c.web!.uri!).toLowerCase();
                const isRelevant = keywordsFII.some(k => text.includes(k));
                
                if (!isRelevant) return false;
                if (uniqueLinks.has(c.web!.uri)) return false;
                uniqueLinks.add(c.web!.uri);
                return true;
            })
            .map(c => ({
                title: c.web!.title!,
                url: c.web!.uri!,
                source: getDomain(c.web!.uri!),
                date: new Date().toISOString(),
                summary: "Notícia do mercado de Fundos Imobiliários.",
                category: filter.category as any || 'Mercado',
                sentiment: 'Neutral'
            }));
      }

      return articles.slice(0, 20);

  } catch (error) {
      console.error("Erro serviço notícias:", error);
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
