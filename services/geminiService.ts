
import { GoogleGenAI } from '@google/genai';
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
        if (domain.includes('investidor10')) return 'Investidor 10';
        if (domain.includes('statusinvest')) return 'StatusInvest';
        
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

  // Prompt otimizado para garantir que o modelo use o Grounding
  const prompt = `
    Você é um agregador de notícias de Fundos Imobiliários (FIIs).
    Use a ferramenta Google Search para encontrar notícias REAIS sobre: "${searchQuery}".
    
    OBJETIVO: Retornar uma lista de notícias com URLs válidas encontradas na pesquisa.
    
    Formato de Resposta (JSON Array):
    [
      {
        "title": "Título da notícia",
        "source": "Fonte (ex: InfoMoney)",
        "date": "YYYY-MM-DD",
        "summary": "Resumo curto de 1 frase",
        "url": "A URL EXATA do resultado da pesquisa",
        "sentiment": "Positive" | "Neutral" | "Negative"
      }
    ]
    
    IMPORTANTE:
    1. Use APENAS links retornados pela ferramenta de busca. Não invente URLs.
    2. Se a notícia for muito antiga (mais de 30 dias), ignore.
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
      
      // Extração Crítica: Usar os metadados do Google Search Grounding
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const textResponse = response.text || "[]";
      const bytesReceived = new Blob([textResponse]).size;
      const stats = { bytesSent, bytesReceived };
      
      let articles: NewsArticle[] = [];
      
      // Tentar fazer o parse do JSON que o modelo gerou
      try {
        const jsonMatch = textResponse.match(/```(json)?([\s\S]*?)```/);
        const parsableText = jsonMatch ? jsonMatch[2] : textResponse;
        const parsed = JSON.parse(parsableText);
        if (Array.isArray(parsed)) articles = parsed;
      } catch (e) {
          console.warn("JSON parse failed, falling back to grounding chunks strategy.");
      }

      // --- ESTRATÉGIA HÍBRIDA DE VALIDAÇÃO DE LINKS ---
      // O modelo pode alucinar URLs no JSON. Vamos corrigir isso cruzando com os Grounding Chunks.
      
      const validatedArticles: NewsArticle[] = [];
      const usedUrls = new Set<string>();

      // 1. Prioridade: Artigos gerados pelo modelo que possuem correspondência nos Chunks
      if (articles.length > 0 && groundingChunks.length > 0) {
          articles.forEach(article => {
              // Tenta encontrar um chunk que tenha a mesma URL ou Título similar
              const match = groundingChunks.find(c => 
                  (c.web?.uri === article.url) || 
                  (c.web?.title && article.title && c.web.title.includes(article.title.substring(0, 15)))
              );

              if (match && match.web?.uri) {
                  if (!usedUrls.has(match.web.uri)) {
                      usedUrls.add(match.web.uri);
                      validatedArticles.push({
                          ...article,
                          url: match.web.uri, // Força o uso da URL real do Google
                          source: getDomain(match.web.uri),
                          title: match.web.title || article.title // Prefere o título real se disponível
                      });
                  }
              }
          });
      }

      // 2. Fallback: Se a validação falhou ou retornou poucos itens, preencher com os Chunks brutos
      // Isso garante que SEMPRE teremos links funcionais, mesmo se o modelo errar o JSON.
      if (validatedArticles.length < 5 && groundingChunks.length > 0) {
          groundingChunks.forEach(chunk => {
              if (chunk.web?.uri && chunk.web?.title && !usedUrls.has(chunk.web.uri)) {
                  // Filtra links irrelevantes ou genéricos
                  if (chunk.web.title.includes('http') || chunk.web.title.includes('.com')) return;
                  
                  usedUrls.add(chunk.web.uri);
                  validatedArticles.push({
                      title: chunk.web.title,
                      source: getDomain(chunk.web.uri),
                      url: chunk.web.uri,
                      date: new Date().toISOString(), // Data aproximada
                      summary: "Toque para ler a matéria completa na fonte original.",
                      category: filter.category || 'FIIs',
                      sentiment: 'Neutral',
                  });
              }
          });
      }

      // Se ainda assim não tivermos nada (mas o JSON inicial era válido), usa o JSON (risco de link quebrado, mas melhor que nada)
      if (validatedArticles.length === 0 && articles.length > 0) {
          return { data: articles.slice(0, 15), stats };
      }

      return { data: validatedArticles.slice(0, 15), stats };

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
      3. "recentDividends": Um array com os 3 ÚLTIMOS anúncios de proventos encontrados. Busque por "Histórico de dividendos [TICKER] StatusInvest" ou "Investidor10". Ex: [{ "exDate": "...", "paymentDate": "...", "value": 0.10 }].
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

    // Prompt aprimorado com regras estritas de fonte e validação de valor
    const prompt = `
      You are a precise financial data assistant.
      Task: Find the EXACT historical closing price (Cotação de Fechamento) for Brazilian FIIs/Stocks on specific dates.

      Input JSON List: [${formattedQueries}]

      SEARCH RULES:
      1. **MANDATORY SOURCE**: Search specifically on "investidor10.com.br" or "statusinvest.com.br".
      2. Search Query Example: "Cotação fechamento ${queries[0].ticker} dia ${queries[0].date} Investidor10".
      3. If the exact date is a weekend/holiday, use the previous business day's closing price.

      VALIDATION RULES (CRITICAL):
      - The returned value MUST be the SHARE PRICE (e.g., R$ 9.50, R$ 120.00).
      - **DO NOT return the dividend value** (e.g., 0.10, 0.85).
      - **DO NOT return the daily variation** (e.g., 0.50%, -1.20).
      - **Sanity Check**: If the found value is < 2.00 (and it's not a penny stock like OIBR3), it is likely a dividend or error. discard it or search again for "Price".
      
      OUTPUT FORMAT:
      - Return ONLY a single valid JSON object.
      - Keys: The composite string 'TICKER_YYYY-MM-DD' exactly as requested.
      - Values: Number (The closing price).
    `;
    const bytesSent = new Blob([prompt]).size;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0, // Temperature 0 for maximum determinism
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
                let val = data[key];
                if (typeof val === 'string') {
                    val = parseFloat(val.replace(',', '.'));
                }
                
                // Additional sanity check on client side
                if (typeof val === 'number' && !isNaN(val) && val > 0) {
                    // Basic filter for typical dividend confusion (most FIIs are > 5 BRL)
                    // If user has a split stock, this might be false positive, but safe for now to avoid 0.10 price
                    if (val > 0.5) { 
                        cleanData[key] = val;
                    }
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
