
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

const simpleHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; 
    }
    return Math.abs(hash);
};

export const generateCalendarEvents = (assets: Asset[]): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    if (assets.length > 0) {
        assets.forEach(asset => {
             if (asset.nextPaymentDate) {
                 const paymentDate = fromISODate(asset.nextPaymentDate);
                 const pMonth = paymentDate.getMonth();
                 const pYear = paymentDate.getFullYear();
                 
                 // Lógica: Mostrar se for Mês Atual OU Próximo Mês.
                 // Aceita datas passadas se forem do Mês Atual (ex: hoje dia 20, pagou dia 15).
                 const isRelevantDate = (pYear === currentYear && (pMonth === currentMonth || pMonth === currentMonth + 1)) || 
                                        (pYear === currentYear + 1 && currentMonth === 11 && pMonth === 0);

                 if (!isNaN(paymentDate.getTime()) && isRelevantDate) {
                     const amountPerShare = asset.lastDividend || (asset.currentPrice * ((asset.dy || 0) / 100)) / 12;
                     const amount = amountPerShare * asset.quantity;
                     
                     const compareDate = new Date(paymentDate);
                     compareDate.setHours(0,0,0,0);
                     const isPaid = compareDate < today;

                     events.push({
                        ticker: asset.ticker,
                        eventType: isPaid ? 'Pago' : 'Confirmado',
                        date: asset.nextPaymentDate,
                        projectedAmount: amount
                    });
                 }
             }
        });
    }
    return events.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// ... Resto do arquivo mantido igual (generateNotifications, etc) ...
export const generateDividends = (assets: Asset[], forceRefresh = false): Dividend[] => {
    const cacheKey = 'portfolio_dividends_v2';
    if (!forceRefresh) {
        const cached = CacheManager.get<Dividend[]>(cacheKey, CACHE_TTL.DIVIDENDS);
        if (cached) return cached;
    }
    const dividends = assets
        .filter(a => (a.dy || 0) > 0)
        .map(asset => ({
            ticker: asset.ticker,
            amountPerShare: (asset.currentPrice * ((asset.dy || 0) / 100)) / 12, 
            quantity: asset.quantity,
            paymentDate: getFutureDate(15).toISOString(),
        }));
    CacheManager.set(cacheKey, dividends);
    return dividends;
};

export const generateNotifications = (assets: Asset[]): Notification[] => {
    const notifications: Notification[] = [];
    if (assets.length === 0) return [];

    assets.forEach(asset => {
        if (asset.dy && asset.dy > 0) {
            const dividend = (asset.currentPrice * (asset.dy / 100)) / 12;
            if (dividend > 0.01) {
                const title = `Provisão: ${asset.ticker}`;
                const desc = `Estimativa de R$ ${dividend.toFixed(2)}/cota com base no DY de ${asset.dy.toFixed(1)}%.`;
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
        if (asset.currentPrice > 0 && asset.avgPrice > 0) {
            if (asset.currentPrice < asset.avgPrice * 0.95) {
                const dropPercent = ((asset.avgPrice - asset.currentPrice) / asset.avgPrice) * 100;
                const title = `Oportunidade: ${asset.ticker}`;
                const id = simpleHash(title + new Date().getDate()); 
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
        if (asset.pvp && asset.pvp > 1.15) {
             const title = `Atenção: ${asset.ticker}`;
             const id = simpleHash(title + asset.pvp.toFixed(1)); 
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
