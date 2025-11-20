interface BrapiQuote {
    symbol: string;
    regularMarketPrice: number;
}

interface BrapiResponse {
    results: BrapiQuote[];
}

export async function fetchBrapiQuotes(tickers: string[]): Promise<Record<string, { currentPrice: number }>> {
    if (tickers.length === 0) {
        return {};
    }

    // Diagnostic Check for Vite environment
    // FIX: Cast `import.meta` to `any` to access the Vite-specific `env` property.
    if (typeof (import.meta as any)?.env === 'undefined') {
        const errorMsg = "Erro de Configuração: O ambiente Vite (import.meta.env) não foi detectado. Verifique se o projeto está configurado como 'Vite' na Vercel.";
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    const token = (import.meta as any).env.VITE_BRAPI_TOKEN;
    if (!token) {
        throw new Error("Token da API Brapi (VITE_BRAPI_TOKEN) não configurado no ambiente. Verifique o nome e valor da variável na Vercel.");
    }
    
    const url = `https://brapi.dev/api/quote/${tickers.join(',')}?token=${token}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Brapi API returned status ${response.status}`);
        }
        
        const data: BrapiResponse = await response.json();
        const result: Record<string, { currentPrice: number }> = {};

        if (data && Array.isArray(data.results)) {
            data.results.forEach(quote => {
                if (quote.symbol && quote.regularMarketPrice) {
                    result[quote.symbol.toUpperCase()] = {
                        currentPrice: quote.regularMarketPrice
                    };
                }
            });
        }
        
        return result;

    } catch (error: any) {
        console.error("Brapi API fetch error:", error);
        throw new Error("Falha ao buscar cotações na Brapi API.");
    }
}