
import type { Asset, Dividend, CalendarEvent } from '../types';
import { NotificationType } from '../types';
import { CacheManager, fromISODate } from '../utils';
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

// Helper for deterministic IDs based on string content
const simpleHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
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
// Robust logic to handle Timezones and current/next month payments
export const generateCalendarEvents = (assets: Asset[]): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Only generate if we have assets
    if (assets.length > 0) {
        assets.forEach(asset => {
             // STRICT CHECK: Only process if a confirmed date exists
             if (asset.nextPaymentDate) {
                 // Use fromISODate to set time to 12:00 PM to avoid timezone rollover issues
                 const paymentDate = fromISODate(asset.nextPaymentDate);
                 const pMonth = paymentDate.getMonth();
                 const pYear = paymentDate.getFullYear();
                 
                 // Logic: Show if it's in the current month OR next month
                 // We want to see upcoming payments even if they are next month (e.g. announced on 30th for 5th)
                 const isRelevantDate = (pYear === currentYear && (pMonth === currentMonth || pMonth === currentMonth + 1)) || 
                                        (pYear === currentYear + 1 && currentMonth === 11 && pMonth === 0); // Dec -> Jan transition

                 if (!isNaN(paymentDate.getTime()) && isRelevantDate) {
                     
                     // Use last dividend amount if available for calculation
                     const amountPerShare = asset.lastDividend || (asset.currentPrice * ((asset.dy || 0) / 100)) / 12;
                     const amount = amountPerShare * asset.quantity;
                     
                     // Check if "Paid" (Past date) or "Scheduled" (Today or Future)
                     // We reset paymentDate to midnight for accurate day comparison
                     const compareDate = new Date(paymentDate);
                     compareDate.setHours(0,0,0,0);
                     const isPaid = compareDate < today;

                     events.push({
                        ticker: asset.ticker,
                        eventType: isPaid ? 'Pago' : 'Confirmado',
                        date: asset.nextPaymentDate, // Keep ISO string for display consistency
                        projectedAmount: amount
                    });
                 }
             }
        });
    }
    
    // Sort by date
    return events.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// Generates notifications based on real asset data with deterministic IDs
export const generateNotifications = (assets: Asset[]): Notification[] => {
    const notifications: Notification[] = [];
    
    if (assets.length === 0) return [];

    assets.forEach(asset => {
        // 1. Dividend Projections
        if (asset.dy && asset.dy > 0) {
            const dividend = (asset.currentPrice * (asset.dy / 100)) / 12;
            if (dividend > 0.01) {
                const title = `Provisão: ${asset.ticker}`;
                const desc = `Estimativa de R$ ${dividend.toFixed(2)}/cota com base no DY de ${asset.dy.toFixed(1)}%.`;
                // Create ID based on title and month to avoid duplicates but persist across re-renders
                const id = simpleHash(title + new Date().getMonth()); 
                
                notifications.push({
                    id: id,
                    type: 'dividend',
                    title: title,
                    description: desc,
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
                const title = `Oportunidade: ${asset.ticker}`;
                const id = simpleHash(title + new Date().getDate()); // Daily alert

                notifications.push({
                    id: id,
                    type: 'price',
                    title: title,
                    description: `Preço atual está ${dropPercent.toFixed(1)}% abaixo do seu preço médio.`,
                    date: new Date(Date.now() - 3600000).toISOString(),
                    read: false,
                    relatedTicker: asset.ticker
                });
            }
            
            // 3. Gain Alert (Price Up)
            if (asset.currentPrice > asset.avgPrice * 1.10) {
                const gainPercent = ((asset.currentPrice - asset.avgPrice) / asset.avgPrice) * 100;
                const title = `Valorização: ${asset.ticker}`;
                const id = simpleHash(title + new Date().getDate());

                notifications.push({
                    id: id,
                    type: 'price',
                    title: title,
                    description: `Seu ativo valorizou ${gainPercent.toFixed(1)}% em relação ao custo.`,
                    date: new Date(Date.now() - 7200000).toISOString(),
                    read: false,
                    relatedTicker: asset.ticker
                });
            }
        }

        // 4. High P/VP Warning
        if (asset.pvp && asset.pvp > 1.15) {
             const title = `Atenção: ${asset.ticker}`;
             const id = simpleHash(title + asset.pvp.toFixed(1)); // Based on PVP value range

             notifications.push({
                id: id,
                type: 'news',
                title: title,
                description: `O P/VP está em ${asset.pvp.toFixed(2)}, indicando que o ativo pode estar caro.`,
                date: new Date(Date.now() - 86400000).toISOString(),
                read: false,
                relatedTicker: asset.ticker
            });
        }
    });

    return notifications.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
