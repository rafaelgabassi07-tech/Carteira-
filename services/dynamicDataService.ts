import type { Asset, AppNotification, NotificationType } from '../types';
import { fromISODate, toISODate } from '../utils';

const simpleHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; 
    }
    return Math.abs(hash);
};

// --- New Smart Notification Generator ---

export const generateNotifications = (assets: Asset[], currentPatrimony: number): AppNotification[] => {
    const newNotifications: AppNotification[] = [];
    if (assets.length === 0) return [];

    const now = new Date();
    const todayStr = toISODate(now);

    // 1. Patrimony Milestone Notification
    const milestones = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
    const lastMilestone = parseInt(localStorage.getItem('last-milestone') || '0', 10);
    const nextMilestone = milestones.find(m => m > lastMilestone);

    if (nextMilestone && currentPatrimony >= nextMilestone) {
        newNotifications.push({
            id: simpleHash(`milestone-${nextMilestone}`),
            type: 'milestone',
            title: `Parabéns! Patrimônio de R$ ${nextMilestone.toLocaleString('pt-BR')} alcançado!`,
            description: 'Sua disciplina está gerando resultados. Continue investindo com foco.',
            date: now.toISOString(),
            read: false,
        });
        localStorage.setItem('last-milestone', String(nextMilestone));
    }

    // 2. Confirmed Dividend & Price Alerts per Asset
    assets.forEach(asset => {
        // Confirmed Dividend Notification
        if (asset.dividendsHistory && asset.dividendsHistory.length > 0) {
            const latestDividend = asset.dividendsHistory[0];
            const exDate = fromISODate(latestDividend.exDate);
            const daysSinceEx = (now.getTime() - exDate.getTime()) / (1000 * 3600 * 60 * 24);

            // Notify if ex-date was in the last 2 days
            if (daysSinceEx >= 0 && daysSinceEx < 2) {
                newNotifications.push({
                    id: simpleHash(`div-${asset.ticker}-${latestDividend.exDate}`),
                    type: 'dividend_confirmed',
                    title: `Dividendo de ${asset.ticker} confirmado!`,
                    description: `Valor de R$ ${latestDividend.value.toFixed(2)} por cota. Pagamento em ${fromISODate(latestDividend.paymentDate).toLocaleDateString('pt-BR')}.`,
                    date: now.toISOString(),
                    read: false,
                    relatedTicker: asset.ticker
                });
            }
        }
        
        // Price Alert Notification
        const priceChange = (asset.currentPrice - asset.avgPrice) / asset.avgPrice;
        const lastPriceAlertKey = `price-alert-${asset.ticker}`;
        const lastAlertDate = localStorage.getItem(lastPriceAlertKey);

        if (lastAlertDate !== todayStr) {
            if (priceChange > 0.1) { // +10% Gain
                newNotifications.push({
                    id: simpleHash(`price-up-${asset.ticker}-${todayStr}`),
                    type: 'price_alert',
                    title: `Valorização: ${asset.ticker}`,
                    description: `Ativo valorizou ${(priceChange * 100).toFixed(1)}% acima do seu preço médio.`,
                    date: now.toISOString(),
                    read: false,
                    relatedTicker: asset.ticker,
                });
                localStorage.setItem(lastPriceAlertKey, todayStr);
            } else if (priceChange < -0.05) { // -5% Drop
                 newNotifications.push({
                    id: simpleHash(`price-down-${asset.ticker}-${todayStr}`),
                    type: 'price_alert',
                    title: `Alerta de Preço: ${asset.ticker}`,
                    description: `Cotação está ${(Math.abs(priceChange) * 100).toFixed(1)}% abaixo do seu preço médio.`,
                    date: now.toISOString(),
                    read: false,
                    relatedTicker: asset.ticker,
                });
                localStorage.setItem(lastPriceAlertKey, todayStr);
            }
        }
    });

    return newNotifications;
};