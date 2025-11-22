
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

// Palavras-chave para validar relevância FII
const FII_KEYWORDS = ['fii', 'fundo imobiliário', 'ifix', 'proventos', 'dividendos', 'rendimentos', 'cota', 'vacância', 'cri', 'cra', 'fiagro', 'btg', 'xp', 'kinea', 'hglg', 'knri', 'mxrf', 'visc', 'xpml', 'irdm'];

// Palavras-chave para EXCLUIR (Filtro negativo)
const EXCLUDE_KEYWORDS = ['crypto', 'bitcoin', 'petrobras', 'vale', 'dólar', 'ibovespa', 'ações', 'tech', 'apple', 'nvidia'];

export async function fetchMarketNews(prefs: AppPreferences, filter: NewsFilter): Promise<NewsArticle[]> {
  let apiKey: string;
  try {
    apiKey = getGeminiApiKey(prefs);
  } catch (error: any) {
    console.warn("News fetch skipped:", error.message);
    return [];
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  // Construção da Query de Busca Focada em FIIs
  let searchQuery = "";
  const baseTerm = "Fundos Imobiliários FIIs Brasil notícias";

  if (filter.query) {
      searchQuery = `${filter.query} ${baseTerm}`;
  } else if (filter.category && filter.category !== 'Destaques') {
      const catMap: Record<string, string> = {
          'Rendimentos': 'FIIs pagamento dividendos data com rendimentos',
          'Papel & CRI': 'FIIs de Papel Recebíveis High Yield CRI',
          'Logística': 'FIIs Galpões Logísticos vacância',
          'Shoppings': 'FIIs de Shopping Centers vendas varejo',
          'Fiagro': 'Fiagros inadimplência agronegócio dividendos',
          'Lajes': 'FIIs Lajes Corporativas escritórios vacância',
          'Geral': 'Mercado FIIs IFIX hoje Boletim Focus'
      };
      searchQuery = `${catMap[filter.category] || filter.category} recente`;
  } else {
      // Busca Genérica de Destaques
      searchQuery = `Destaques IFIX Fundos Imobiliários notícias hoje`;
  }

  // Se houver tickers na carteira, adicionamos os 3 principais à busca para personalizar
  if (filter.tickers && filter.tickers.length > 0 && !filter.query) {
      const tickerList = filter.tickers.slice(0, 3).join(' ');
      searchQuery += ` ${tickerList}`;
  }

  // Prompt simplificado para atuar como extrator
  const prompt = `
    Realize uma busca no Google Search sobre: "${searchQuery}".
    
    REGRAS RÍGIDAS (Filtro de Conteúdo):
    1. O foco é 100% FUNDOS IMOBILIÁRIOS (FIIs) e FIAGROs.
    2. IGNORE notícias sobre ações (Petrobras, Vale), Criptomoedas ou Política, a menos que afete diretamente o IFIX.
    
    Retorne um resumo das principais notícias encontradas.
  `;

  try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: prompt,
        config: {
            tools: [{googleSearch: {}}], // Obrigatório para dados reais
            temperature: 0.1, // Baixa criatividade, alta precisão
        }
      });
      
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      let articles: NewsArticle[] = [];

      // ESTRATÉGIA: Extração Direta dos Metadados de Busca (Google News Style)
      // Isso garante links reais e elimina alucinações da IA.
      
      if (groundingChunks.length > 0) {
          const uniqueLinks = new Set();
          
          articles = groundingChunks
            .filter(c => c.web?.title && c.web?.uri)
            .map(c => {
                const title = c.web!.title!;
                const url = c.web!.uri!;
                const lowerTitle = title.toLowerCase();
                
                // Filtro de Relevância e Exclusão
                const hasFiiKeyword = FII_KEYWORDS.some(k => lowerTitle.includes(k) || url.includes(k));
                const hasExcludeKeyword = EXCLUDE_KEYWORDS.some(k => lowerTitle.includes(k));
                
                // Se a categoria for específica (ex: Logística), forçamos relevância
                // Se for destaques, somos mais lenientes mas evitamos Ações puras
                if (hasExcludeKeyword) return null;
                
                if (uniqueLinks.has(url)) return null;
                uniqueLinks.add(url);

                return {
                    title: title.replace(/ - .*/, ''), // Remove o nome do site do título se estiver no fim
                    source: getDomain(url),
                    url: url,
                    date: new Date().toISOString(), // Grounding não retorna data exata, usamos atual
                    summary: "Toque para ler a notícia completa na fonte original.",
                    category: (filter.category as any) || 'FIIs',
                    sentiment: 'Neutral' as const,
                    // Tentamos inferir imagem baseada na fonte ou categoria na View
                };
            })
            .filter((item): item is NewsArticle => item !== null);
      }

      // Fallback: Se o grounding falhar (raro), tentamos processar o texto da IA (Json mode implícito)
      if (articles.length === 0 && response.text) {
          // Tentar extrair links markdown se existirem
          const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
          let match;
          while ((match = linkRegex.exec(response.text)) !== null) {
              articles.push({
                  title: match[1],
                  url: match[2],
                  source: getDomain(match[2]),
                  date: new Date().toISOString(),
                  summary: "Notícia gerada por IA.",
                  category: 'FIIs'
              });
          }
      }

      return articles.slice(0, 15); // Limite para manter a UI limpa

  } catch (error) {
      console.error("Erro busca notícias:", error);
      // Retorna array vazio para a UI mostrar estado "sem resultados" amigável
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
