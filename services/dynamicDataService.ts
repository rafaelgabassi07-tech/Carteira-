
import type { Asset, Dividend, CalendarEvent } from '../types';
import { NotificationType } from '../types';
import { CacheManager } from '../utils';
import { CACHE_TTL } from '../constants';

interface Notification {
    id: number;
    type: NotificationType;
    title: string;
    description: string;
    date: string;
    read: boolean;
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
// Cache removed to ensure reactivity when portfolio changes
export const generateCalendarEvents = (assets: Asset[]): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    
    // Only generate if we have assets
    if (assets.length > 0) {
        assets.forEach(asset => {
             // Prediction logic: usually FIIs pay on 15th
             const nextPayment = new Date();
             nextPayment.setDate(15);
             
             // If today is past the 15th, assume next month
             if (new Date().getDate() > 15) {
                 nextPayment.setMonth(nextPayment.getMonth() + 1);
             }

             const dy = asset.dy || 0;
             let projectedAmount = 0;
             
             // Calculate projected amount based on monthly yield estimate
             // Formula: (Current Price * (DY Annual / 100)) / 12 * Quantity
             if (dy > 0 && asset.currentPrice > 0) {
                 const monthlyPerShare = (asset.currentPrice * (dy / 100)) / 12;
                 projectedAmount = monthlyPerShare * asset.quantity;
             }

            events.push({
                ticker: asset.ticker,
                eventType: 'Pagamento',
                date: nextPayment.toISOString(),
                projectedAmount: projectedAmount
            });
        });
    }
    
    // Sort by date
    return events.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// Generates notifications
export const generateNotifications = (assets: Asset[]): Notification[] => {
    const notifications: Notification[] = [];
    let id = 1;
    
    if (assets.length === 0) return [];

    // Generate specific notifications only if we have assets
    assets.slice(0, 2).forEach(asset => {
        if (asset.dy && asset.dy > 0) {
            const dividend = (asset.currentPrice * (asset.dy / 100)) / 12;
            notifications.push({
                id: id++,
                type: 'dividend',
                title: `Provisão: ${asset.ticker}`,
                description: `Estimativa de R$ ${dividend.toFixed(2)}/cota com base no DY atual.`,
                date: new Date().toISOString(),
                read: false,
            });
        }
    });

    return notifications.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
