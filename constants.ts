import type { Asset, UserProfile, Transaction, Dividend, CalendarEvent, MonthlyIncome, DividendHistoryEvent, AppTheme, AppFont } from './types';

// --- Cache Time-To-Live (TTLs) em Milissegundos ---
const INFINITE_TTL = 100 * 365 * 24 * 60 * 60 * 1000;

export const CACHE_TTL = {
    PRICES: INFINITE_TTL,
    NEWS: INFINITE_TTL,
    DIVIDENDS: INFINITE_TTL,
    CALENDAR: INFINITE_TTL,
};

// --- FONTS ---
export const APP_FONTS: AppFont[] = [
    {
        id: 'inter',
        name: 'Inter',
        family: 'Inter, system-ui, sans-serif',
        description: 'font_inter_desc'
    },
    {
        id: 'poppins',
        name: 'Poppins',
        family: 'Poppins, sans-serif',
        description: 'font_poppins_desc'
    },
    {
        id: 'lato',
        name: 'Lato',
        family: 'Lato, sans-serif',
        description: 'font_lato_desc'
    },
    {
        id: 'lora',
        name: 'Lora',
        family: 'Lora, serif',
        description: 'font_lora_desc'
    },
    {
        id: 'roboto-mono',
        name: 'Roboto Mono',
        family: '"Roboto Mono", monospace',
        description: 'font_roboto_mono_desc'
    },
    {
        id: 'source-code-pro',
        name: 'Source Code Pro',
        family: '"Source Code Pro", monospace',
        description: 'font_source_code_pro_desc'
    }
];


// --- THEMES ---
export const APP_THEMES: AppTheme[] = [
    // Dark Themes
    {
        id: 'default-dark', name: 'Padrão Dark', type: 'dark', description: 'O tema clássico e elegante do Invest.',
        colors: { bgPrimary: '#09090b', bgSecondary: '#18181b', bgTertiary: '#27272a', textPrimary: '#fafafa', textSecondary: '#a1a1aa', borderColor: '#27272a', accentColor: '#38bdf8', accentText: '#09090b', greenText: '#4ade80', redText: '#f87171' }
    },
    {
        id: 'midnight-oled', name: 'Midnight OLED', type: 'dark', description: 'Preto absoluto para economia de bateria.',
        colors: { bgPrimary: '#000000', bgSecondary: '#0a0a0a', bgTertiary: '#171717', textPrimary: '#ffffff', textSecondary: '#888888', borderColor: '#1f1f1f', accentColor: '#ffffff', accentText: '#000000', greenText: '#22c55e', redText: '#ef4444' }
    },
    {
        id: 'nord', name: 'Nord', type: 'dark', description: 'Paleta de cores fria e azulada, popular entre desenvolvedores.',
        colors: { bgPrimary: '#2E3440', bgSecondary: '#3B4252', bgTertiary: '#434C5E', textPrimary: '#ECEFF4', textSecondary: '#D8DEE9', borderColor: '#4C566A', accentColor: '#88C0D0', accentText: '#2E3440', greenText: '#A3BE8C', redText: '#BF616A' }
    },
    {
        id: 'dracula', name: 'Dracula', type: 'dark', description: 'Famoso tema com tons de roxo e contraste suave.',
        colors: { bgPrimary: '#282a36', bgSecondary: '#44475a', bgTertiary: '#6272a4', textPrimary: '#f8f8f2', textSecondary: '#bd93f9', borderColor: '#6272a4', accentColor: '#ff79c6', accentText: '#282a36', greenText: '#50fa7b', redText: '#ff5555' }
    },
    {
        id: 'carbon-red', name: 'Carbon GT', type: 'dark', description: 'Inspirado em superesportivos. Preto fosco e vermelho.',
        colors: { bgPrimary: '#101010', bgSecondary: '#1c1c1c', bgTertiary: '#2a2a2a', textPrimary: '#ffffff', textSecondary: '#9ca3af', borderColor: '#333333', accentColor: '#ef4444', accentText: '#ffffff', greenText: '#22c55e', redText: '#ef4444' }
    },
    {
        id: 'cyber-neon', name: 'Cyber Neon', type: 'dark', description: 'Futurista, vibrante e com alto contraste.',
        colors: { bgPrimary: '#090014', bgSecondary: '#15002e', bgTertiary: '#2a0a4a', textPrimary: '#e0e7ff', textSecondary: '#a78bfa', borderColor: '#4c1d95', accentColor: '#d946ef', accentText: '#ffffff', greenText: '#22d3ee', redText: '#fb7185' }
    },
    {
        id: 'matrix', name: 'Matrix', type: 'dark', description: 'O clássico verde sobre preto, para um visual "hacker".',
        colors: { bgPrimary: '#000000', bgSecondary: '#0D0D0D', bgTertiary: '#1A1A1A', textPrimary: '#00FF41', textSecondary: '#008F11', borderColor: '#003B00', accentColor: '#00FF41', accentText: '#000000', greenText: '#39FF14', redText: '#CFFF04' }
    },
    {
        id: 'sunset', name: 'Sunset', type: 'dark', description: 'Tons quentes de laranja e roxo, inspirados no pôr do sol.',
        colors: { bgPrimary: '#1a1a2e', bgSecondary: '#16213e', bgTertiary: '#0f3460', textPrimary: '#e94560', textSecondary: '#f6a7c1', borderColor: '#533483', accentColor: '#ff9a00', accentText: '#1a1a2e', greenText: '#e94560', redText: '#f6a7c1' }
    },
    
    // Light Themes
    {
        id: 'default-light', name: 'Padrão Light', type: 'light', description: 'Claro, limpo e profissional.',
        colors: { bgPrimary: '#f8fafc', bgSecondary: '#ffffff', bgTertiary: '#f1f5f9', textPrimary: '#0f172a', textSecondary: '#64748b', borderColor: '#e2e8f0', accentColor: '#0284c7', accentText: '#ffffff', greenText: '#16a34a', redText: '#e11d48' }
    },
    {
        id: 'mint', name: 'Mint', type: 'light', description: 'Um tema leve e refrescante com toques de verde menta.',
        colors: { bgPrimary: '#F0FFF4', bgSecondary: '#FFFFFF', bgTertiary: '#D4F4DD', textPrimary: '#064E3B', textSecondary: '#059669', borderColor: '#A7F3D0', accentColor: '#10B981', accentText: '#FFFFFF', greenText: '#047857', redText: '#DC2626' }
    },
    {
        id: 'rose-quartz', name: 'Rose Quartz', type: 'light', description: 'Suave e elegante, com tons de rosa e cinza claro.',
        colors: { bgPrimary: '#FFF7F7', bgSecondary: '#FFFFFF', bgTertiary: '#FDE2E4', textPrimary: '#5C2751', textSecondary: '#8D5B71', borderColor: '#FAD2E1', accentColor: '#E17084', accentText: '#FFFFFF', greenText: '#5C2751', redText: '#B91C1C' }
    },
    {
        id: 'sepia-comfort', name: 'Sepia Comfort', type: 'light', description: 'Fundo amarelado suave para leitura.',
        colors: { bgPrimary: '#fbf7f0', bgSecondary: '#fffefb', bgTertiary: '#f0e6d2', textPrimary: '#433422', textSecondary: '#8c7b67', borderColor: '#e6dbcc', accentColor: '#d97706', accentText: '#ffffff', greenText: '#059669', redText: '#dc2626' }
    },
    {
        id: 'corporate-gray', name: 'Corporate', type: 'light', description: 'Monocromático e sério.',
        colors: { bgPrimary: '#f3f4f6', bgSecondary: '#ffffff', bgTertiary: '#e5e7eb', textPrimary: '#111827', textSecondary: '#6b7280', borderColor: '#d1d5db', accentColor: '#4b5563', accentText: '#ffffff', greenText: '#059669', redText: '#b91c1c' }
    }
];

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
    { id: 'demo1', ticker: 'MXRF11', type: 'Compra', quantity: 100, price: 10.50, date: '2023-01-15', costs: 0 },
    { id: 'demo2', ticker: 'HGLG11', type: 'Compra', quantity: 10, price: 160.00, date: '2023-02-10', costs: 0 },
    { id: 'demo3', ticker: 'VISC11', type: 'Compra', quantity: 15, price: 115.00, date: '2023-03-05', costs: 0 },
    { id: 'demo4', ticker: 'KNRI11', type: 'Compra', quantity: 5, price: 155.00, date: '2023-04-20', costs: 0 },
    { id: 'demo5', ticker: 'MXRF11', type: 'Compra', quantity: 50, price: 10.80, date: '2023-05-15', costs: 0 },
];

export const DEMO_DIVIDENDS: Dividend[] = [
    { ticker: 'MXRF11', paymentDate: '2023-05-14', amountPerShare: 0.11, quantity: 100 },
    { ticker: 'HGLG11', paymentDate: '2023-05-14', amountPerShare: 1.10, quantity: 10 },
    { ticker: 'VISC11', paymentDate: '2023-05-14', amountPerShare: 0.85, quantity: 15 },
    { ticker: 'MXRF11', paymentDate: '2023-04-14', amountPerShare: 0.12, quantity: 100 },
    { ticker: 'KNRI11', paymentDate: '2023-04-14', amountPerShare: 0.95, quantity: 5 },
];

const generateDemoHistory = (prices: number[]) => {
    const today = new Date();
    return prices.map((price, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (prices.length - 1 - i));
        return {
            date: date.toISOString().split('T')[0],
            price,
        };
    });
};

const DEMO_DIVIDEND_HISTORY_MXRF11: DividendHistoryEvent[] = [
    { exDate: '2023-01-31', paymentDate: '2023-02-14', value: 0.10 },
    { exDate: '2023-02-28', paymentDate: '2023-03-14', value: 0.12 },
    { exDate: '2023-03-31', paymentDate: '2023-04-14', value: 0.12 },
    { exDate: '2023-04-28', paymentDate: '2023-05-14', value: 0.11 },
    { exDate: '2023-05-31', paymentDate: '2023-06-14', value: 0.11 },
];

const DEMO_DIVIDEND_HISTORY_HGLG11: DividendHistoryEvent[] = [
    { exDate: '2023-02-28', paymentDate: '2023-03-14', value: 1.10 },
    { exDate: '2023-03-31', paymentDate: '2023-04-14', value: 1.10 },
    { exDate: '2023-04-28', paymentDate: '2023-05-14', value: 1.10 },
    { exDate: '2023-05-31', paymentDate: '2023-06-14', value: 1.20 },
];

export const DEMO_MARKET_DATA = {
    'MXRF11': { currentPrice: 10.95, dy: 12.5, pvp: 1.05, sector: 'Papel', administrator: 'BTG Pactual', priceHistory: generateDemoHistory([10.2, 10.3, 10.5, 10.4, 10.6, 10.8, 10.95]), dividendsHistory: DEMO_DIVIDEND_HISTORY_MXRF11 },
    'HGLG11': { currentPrice: 165.50, dy: 8.2, pvp: 1.02, sector: 'Logística', administrator: 'Credit Suisse', priceHistory: generateDemoHistory([158, 160, 162, 161, 163, 164, 165.5]), dividendsHistory: DEMO_DIVIDEND_HISTORY_HGLG11 },
    'VISC11': { currentPrice: 120.10, dy: 9.1, pvp: 0.98, sector: 'Shoppings', administrator: 'Vinci', priceHistory: generateDemoHistory([112, 115, 118, 117, 119, 120, 120.1]), dividendsHistory: [] },
    'KNRI11': { currentPrice: 158.30, dy: 7.8, pvp: 1.00, sector: 'Híbrido', administrator: 'Kinea', priceHistory: generateDemoHistory([150, 152, 155, 154, 156, 158, 158.3]), dividendsHistory: [] },
};