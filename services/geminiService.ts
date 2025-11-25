

import { GoogleGenAI, Type } from '@google/genai';
import type { NewsArticle, AppPreferences, DividendHistoryEvent } from '../types';

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

export async function fetchMarketNews(prefs: AppPreferences, filter: NewsFilter): Promise<{ data: NewsArticle[], stats: { bytesSent: number, bytesReceived: number } }> {
  const emptyReturn = { data: [], stats: { bytesSent: 0, bytesReceived: 0 } };
  let apiKey: string;
  try {
    apiKey = getGeminiApiKey(prefs);
  } catch (error: any) {
    console.warn("News fetch skipped:", error.message);
    return emptyReturn;
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  let timeTerm = "recentes";
  if (filter.dateRange === 'today') timeTerm = "hoje";
  else if (filter.dateRange === 'week') timeTerm = "desta semana";
  else if (filter.dateRange === 'month') timeTerm = "deste mês";
  
  let searchQuery = "";
  const baseTerm = "Fundos Imobiliários FIIs Brasil notícias";

  if (filter.query) {
      searchQuery = `${filter.query} ${baseTerm} ${timeTerm}`;
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
      searchQuery = `${catMap[filter.category] || filter.category} notícias ${timeTerm}`;
  } else {
      searchQuery = `Destaques Mercado FIIs IFIX notícias ${timeTerm}`;
  }

  const prompt = `
    Você é um agregador de notícias de Fundos Imobiliários (FIIs).
    Pesquise no Google sobre: "${searchQuery}".
    Retorne 10 notícias REAIS e RECENTES (${timeTerm}).
    NÃO INVENTE notícias. Use os dados do Grounding.
    Retorne um array de objetos JSON com as seguintes chaves: "title", "source", "date" (YYYY-MM-DD), "summary" (1 frase), "url", "sentiment" ("Positive", "Neutral", "Negative").
  `;
  const bytesSent = new Blob([prompt]).size;

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
      const textResponse = response.text || "[]";
      const bytesReceived = new Blob([textResponse]).size;
      const stats = { bytesSent, bytesReceived };
      
      let articles: NewsArticle[] = [];
      try {
        const jsonMatch = textResponse.match(/```(json)?([\s\S]*?)```/);
        const parsableText = jsonMatch ? jsonMatch[2] : textResponse;
        articles = JSON.parse(parsableText);
      } catch (e) {
          console.error("Failed to parse JSON from Gemini:", textResponse, e);
          articles = [];
      }

      // --- PIPELINE DE RECUPERAÇÃO E CORREÇÃO (FAIL-SAFE) ---
      if (articles.length === 0 && groundingChunks.length > 0) {
          console.log("Usando Fallback de Grounding Chunks");
          const uniqueLinks = new Set();
          articles = groundingChunks
            .filter(c => c.web?.title && c.web?.uri)
            .map(c => {
                const url = c.web!.uri!;
                if (uniqueLinks.has(url)) return null;
                uniqueLinks.add(url);
                
                let title = c.web!.title!;
                const separatorIndex = title.lastIndexOf(' - ');
                if (separatorIndex > 10) title = title.substring(0, separatorIndex);

                if (title.includes('http') || title.includes('.com')) return null;

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
      else if (articles.length > 0) {
          articles = articles.map(article => {
              const matchedChunk = groundingChunks.find(c => 
                  c.web?.uri === article.url || 
                  (c.web?.title && article.title && c.web.title.includes(article.title.substring(0, 15)))
              );

              const realUrl = matchedChunk?.web?.uri || article.url;
              const cleanSource = getDomain(realUrl || '');
              
              if (article.title && (article.title.includes(cleanSource) || article.title.includes('.com'))) {
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
                  summary: article.summary || "Acesse para ler os detalhes."
              };
          });
      }

      return { data: articles.slice(0, 15), stats };

  } catch (error) {
      console.error("Erro busca notícias:", error);
      return emptyReturn;
  }
}

export async function fetchAdvancedAssetData(prefs: AppPreferences, tickers: string[]): Promise<{ data: Record<string, { nextPaymentDate?: string; lastDividend?: number; recentDividends?: DividendHistoryEvent[]; assetType?: string }>, stats: { bytesSent: number, bytesReceived: number } }> {
    const emptyReturn = { data: {}, stats: { bytesSent: 0, bytesReceived: 0 } };
    if (tickers.length === 0) {
        return emptyReturn;
    }

    let apiKey: string;
    try {
        apiKey = getGeminiApiKey(prefs);
    } catch (error: any) {
        console.warn("Advanced asset data fetch skipped:", error.message);
        return emptyReturn;
    }

    const ai = new GoogleGenAI({ apiKey });
    const tickersString = tickers.join(', ');

    const prompt = `
      Você é um analista de dados financeiros especializado em Fundos Imobiliários (FIIs) do Brasil.
      Sua tarefa é buscar informações detalhadas e categorizar os ativos: ${tickersString}.
      
      Para cada ticker, busque e retorne:
      1. "nextPaymentDate": A data de pagamento do PRÓXIMO dividendo (formato "YYYY-MM-DD"). Use null se não anunciado.
      2. "lastDividend": O valor do ÚLTIMO dividendo PAGO por cota. Use null se não encontrar.
      3. "recentDividends": Um array com os 3 ÚLTIMOS anúncios de proventos. Ex: [{ "exDate": "...", "paymentDate": "...", "value": 0.10 }].
      4. "assetType": A CLASSIFICAÇÃO MACRO do ativo. 
         - Regras de Classificação RIGOROSAS:
         - Se for um FII de Galpões, Shoppings, Lajes, Renda Urbana, Híbrido de Imóveis ou Varejo -> Classifique como "Tijolo". (Ex: GARE11, HGLG11, VISC11, HGRU11, ALZR11 são "Tijolo").
         - Se investir em CRIs, Recebíveis Imobiliários -> Classifique como "Papel". (Ex: MXRF11, KNCR11, CPTS11).
         - Se investir majoritariamente em cotas de outros FIIs -> Classifique como "FOF". (Ex: BCFF11).
         - Se for do agronegócio (Fiagro) -> Classifique como "Fiagro". (Ex: SNAG11, VGIA11).
         - Se for de Infraestrutura -> Classifique como "Infra".
         - Caso contrário -> "Outros".

      Retorne um único objeto JSON onde cada chave é o ticker em maiúsculas.
      
      IMPORTANTE: GARE11 é um fundo de TIJOLO (Híbrido/Renda Urbana), NÃO é FOF. Seja preciso.
    `;
    const bytesSent = new Blob([prompt]).size;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.1,
            }
        });

        const textResponse = response.text || "{}";
        const bytesReceived = new Blob([textResponse]).size;
        const stats = { bytesSent, bytesReceived };
        
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const parsedData = JSON.parse(jsonMatch[0]);
            const sanitizedData: Record<string, { nextPaymentDate?: string; lastDividend?: number; recentDividends?: DividendHistoryEvent[]; assetType?: string }> = {};
            for (const ticker of tickers) {
                const data = parsedData[ticker.toUpperCase()];
                if (data) {
                    sanitizedData[ticker.toUpperCase()] = {
                        nextPaymentDate: typeof data.nextPaymentDate === 'string' && data.nextPaymentDate.match(/^\d{4}-\d{2}-\d{2}$/) ? data.nextPaymentDate : undefined,
                        lastDividend: typeof data.lastDividend === 'number' ? data.lastDividend : undefined,
                        recentDividends: Array.isArray(data.recentDividends) ? data.recentDividends.filter((d: any): d is DividendHistoryEvent => 
                            d && typeof d.exDate === 'string' && typeof d.paymentDate === 'string' && typeof d.value === 'number'
                        ) : undefined,
                        assetType: ['Tijolo', 'Papel', 'FOF', 'Fiagro', 'Infra'].includes(data.assetType) ? data.assetType : 'Outros'
                    };
                }
            }
            return { data: sanitizedData, stats };
        }

        return { data: {}, stats };

    } catch (error) {
        console.error("Erro ao buscar dados avançados de ativos com Gemini:", error);
        return emptyReturn;
    }
}

export async function fetchHistoricalPrices(prefs: AppPreferences, queries: { ticker: string; date: string }[]): Promise<{ data: Record<string, number>, stats: { bytesSent: number, bytesReceived: number } }> {
    const emptyReturn = { data: {}, stats: { bytesSent: 0, bytesReceived: 0 } };
    if (queries.length === 0) {
        return emptyReturn;
    }

    let apiKey: string;
    try {
        apiKey = getGeminiApiKey(prefs);
    } catch (error: any) {
        console.warn("Historical price fetch skipped:", error.message);
        return emptyReturn;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const formattedQueries = queries.map(q => `{"ticker": "${q.ticker}", "date": "${q.date}"}`).join(', ');

    const prompt = `
      You are a financial data API. For each ticker and date object in this JSON list: [${formattedQueries}], find the **closing price (cotação de fechamento)** on that specific date. 
      
      IMPORTANT:
      1. Use Google Search to find the exact historical close price.
      2. If the date was a weekend or holiday, find the closing price of the **nearest previous trading day**.
      3. Return ONLY a single valid JSON object.
      4. The keys of the JSON object MUST be the composite string 'TICKER_YYYY-MM-DD' exactly as requested.
      5. The value MUST be a number.
    `;
    const bytesSent = new Blob([prompt]).size;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0,
            }
        });

        const textResponse = response.text || "{}";
        const bytesReceived = new Blob([textResponse]).size;
        const stats = { bytesSent, bytesReceived };

        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            const cleanData: Record<string, number> = {};
            Object.keys(data).forEach(key => {
                if (typeof data[key] === 'number') {
                    if (data[key] > 0) cleanData[key] = data[key];
                } else if (typeof data[key] === 'string') {
                    const num = parseFloat(data[key].replace(',', '.'));
                    if (!isNaN(num) && num > 0) cleanData[key] = num;
                }
            });
            return { data: cleanData, stats };
        }
        return { data: {}, stats };
    } catch (error) {
        console.error("Error fetching historical prices with Gemini:", error);
        return emptyReturn;
    }
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
