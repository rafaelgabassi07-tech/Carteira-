
import type { Asset, UserProfile, Transaction, Dividend, CalendarEvent, MonthlyIncome } from './types';

// --- Cache Time-To-Live (TTLs) em Milissegundos ---
export const CACHE_TTL = {
    PRICES: 15 * 60 * 1000,       // 15 Minutos
    NEWS: 60 * 60 * 1000,         // 1 Hora
    DIVIDENDS: 24 * 60 * 60 * 1000, // 24 Horas
    CALENDAR: 24 * 60 * 60 * 1000,  // 24 Horas
};

export const MOCK_ASSETS: Omit<Asset, 'quantity' | 'avgPrice' | 'yieldOnCost'>[] = [];

export const MOCK_ASSET_METADATA: Record<string, { segment: string; administrator: string; vacancyRate: number; liquidity: number; shareholders: number }> = {};

export const MOCK_IFIX_DATA: number[] = [];
export const MOCK_PORTFOLIO_PERFORMANCE: number[] = [];

export const MOCK_USER_PROFILE: UserProfile = {
  name: 'Investidor',
  email: 'usuario@email.com',
  avatarUrl: 'https://ui-avatars.com/api/?name=Investidor&background=0D8ABC&color=fff',
};

export const MOCK_TRANSACTIONS: Transaction[] = [];

export const MOCK_DIVIDENDS: Dividend[] = [];

export const MOCK_MONTHLY_INCOME: MonthlyIncome[] = [];

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [];

// --- DEMO MODE DATA ---
export const DEMO_TRANSACTIONS: Transaction[] = [
    { id: 'demo1', ticker: 'MXRF11', type: 'Compra', quantity: 100, price: 10.50, date: '2023-01-15', costs: 0, notes: 'Demo' },
    { id: 'demo2', ticker: 'HGLG11', type: 'Compra', quantity: 10, price: 160.00, date: '2023-02-10', costs: 0, notes: 'Demo' },
    { id: 'demo3', ticker: 'VISC11', type: 'Compra', quantity: 15, price: 115.00, date: '2023-03-05', costs: 0, notes: 'Demo' },
    { id: 'demo4', ticker: 'KNRI11', type: 'Compra', quantity: 5, price: 155.00, date: '2023-04-20', costs: 0, notes: 'Demo' },
    { id: 'demo5', ticker: 'MXRF11', type: 'Compra', quantity: 50, price: 10.80, date: '2023-05-15', costs: 0, notes: 'Demo' },
];

export const DEMO_MARKET_DATA = {
    'MXRF11': { currentPrice: 10.95, dy: 12.5, pvp: 1.05, sector: 'Papel', administrator: 'BTG Pactual', priceHistory: [10.2, 10.3, 10.5, 10.4, 10.6, 10.8, 10.95] },
    'HGLG11': { currentPrice: 165.50, dy: 8.2, pvp: 1.02, sector: 'Logística', administrator: 'Credit Suisse', priceHistory: [158, 160, 162, 161, 163, 164, 165.5] },
    'VISC11': { currentPrice: 120.10, dy: 9.1, pvp: 0.98, sector: 'Shoppings', administrator: 'Vinci', priceHistory: [112, 115, 118, 117, 119, 120, 120.1] },
    'KNRI11': { currentPrice: 158.30, dy: 7.8, pvp: 1.00, sector: 'Híbrido', administrator: 'Kinea', priceHistory: [150, 152, 155, 154, 156, 158, 158.3] },
};
