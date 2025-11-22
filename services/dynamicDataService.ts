
import type { Asset, Dividend, CalendarEvent } from '../types';
import { NotificationType } from '../types';
import { CacheManager } from '../utils';
import { CACHE_TTL } from '../constants';

export interface Notification {
    id: number;
    type: NotificationType;
    title: string;
    description: string;
    date: string;
    read: boolean;
    relatedTicker?: string;
}

const getFutureDate = (days: number): Date => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
};

// Generates estimated dividend data based on current portfolio YIELD (not random)
export const generateDividends = (assets: Asset[], forceRefresh = false): Dividend[] => {
    const cacheKey = 'portfolio_dividends_v2';
    
    if (!forceRefresh) {
        const cached = CacheManager.get<Dividend[]>(cacheKey, CACHE_TTL.DIVIDENDS);
        if (cached) return cached;
    }

    // If we have no market data (dy=0), we can't project dividends
    const dividends = assets
        .filter(a => (a.dy || 0) > 0)
        .map(asset => ({
            ticker: asset.ticker,
            // Estimate monthly div: (Price * DY%) / 12
            amountPerShare: (asset.currentPrice * ((asset.dy || 0) / 100)) / 12, 
            quantity: asset.quantity,
            // Estimate payment date as 15th of next month for calculation purposes
            paymentDate: getFutureDate(15).toISOString(),
        }));

    CacheManager.set(cacheKey, dividends);
    return dividends;
};

// Generates calendar events
// MODIFIED: Only shows CONFIRMED payments based on real market data
export const generateCalendarEvents = (assets: Asset[]): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    
    // Only generate if we have assets
    if (assets.length > 0) {
        assets.forEach(asset => {
             // STRICT CHECK: Only process if a confirmed date exists
             if (asset.nextPaymentDate) {
                 const paymentDate = new Date(asset.nextPaymentDate);
                 paymentDate.setHours(0,0,0,0);
                 
                 // Logic: Show if it's in the current month OR in the future
                 // This allows showing "Paid" events for recent days in current month
                 // or "Future" events for later.
                 const isSameMonth = paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === today.getFullYear();
                 const isFuture = paymentDate >= today;

                 if (!isNaN(paymentDate.getTime()) && (isSameMonth || isFuture)) {
                     
                     // Use last dividend amount if available for calculation
                     // If lastDividend is missing but we have a date, we try to estimate with DY, 
                     // but ideally we want the real amount.
                     const amountPerShare = asset.lastDividend || (asset.currentPrice * ((asset.dy || 0) / 100)) / 12;
                     const amount = amountPerShare * asset.quantity;
                     
                     const isPaid = paymentDate < today;

                     events.push({
                        ticker: asset.ticker,
                        eventType: isPaid ? 'Pago' : 'Confirmado',
                        date: paymentDate.toISOString(),
                        projectedAmount: amount
                    });
                 }
             }
        });
    }
    
    // Sort by date
    return events.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// Generates notifications based on real asset data
export const generateNotifications = (assets: Asset[]): Notification[] => {
    const notifications: Notification[] = [];
    let id = 1;
    
    if (assets.length === 0) return [];

    assets.forEach(asset => {
        // 1. Dividend Projections
        if (asset.dy && asset.dy > 0) {
            const dividend = (asset.currentPrice * (asset.dy / 100)) / 12;
            // Only verify significant amounts
            if (dividend > 0.01) {
                notifications.push({
                    id: id++,
                    type: 'dividend',
                    title: `Provisão: ${asset.ticker}`,
                    description: `Estimativa de R$ ${dividend.toFixed(2)}/cota com base no DY de ${asset.dy.toFixed(1)}%.`,
                    date: new Date().toISOString(),
                    read: false,
                    relatedTicker: asset.ticker
                });
            }
        }

        // 2. Opportunity Alert (Price Drop)
        // If current price is 5% below average price
        if (asset.currentPrice > 0 && asset.avgPrice > 0) {
            if (asset.currentPrice < asset.avgPrice * 0.95) {
                const dropPercent = ((asset.avgPrice - asset.currentPrice) / asset.avgPrice) * 100;
                notifications.push({
                    id: id++,
                    type: 'price',
                    title: `Oportunidade: ${asset.ticker}`,
                    description: `Preço atual está ${dropPercent.toFixed(1)}% abaixo do seu preço médio.`,
                    date: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                    read: false,
                    relatedTicker: asset.ticker
                });
            }
            
            // 3. Gain Alert (Price Up)
            // If current price is 10% above average price
            if (asset.currentPrice > asset.avgPrice * 1.10) {
                const gainPercent = ((asset.currentPrice - asset.avgPrice) / asset.avgPrice) * 100;
                notifications.push({
                    id: id++,
                    type: 'price',
                    title: `Valorização: ${asset.ticker}`,
                    description: `Seu ativo valorizou ${gainPercent.toFixed(1)}% em relação ao custo.`,
                    date: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
                    read: false,
                    relatedTicker: asset.ticker
                });
            }
        }

        // 4. High P/VP Warning (Paper Funds usually)
        if (asset.pvp && asset.pvp > 1.15) {
             notifications.push({
                id: id++,
                type: 'news', // Categorized as news/insight
                title: `Atenção: ${asset.ticker}`,
                description: `O P/VP está em ${asset.pvp.toFixed(2)}, indicando que o ativo pode estar caro.`,
                date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
                read: false,
                relatedTicker: asset.ticker
            });
        }
    });

    return notifications.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
