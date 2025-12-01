
import type { Asset, UserProfile, Transaction, Dividend, CalendarEvent, DividendHistoryEvent, AppTheme, AppFont } from './types';

// --- Cache Time-To-Live (TTLs) em Milissegundos ---
// Cache Persistence (Quanto tempo fica no disco)
const INFINITE_TTL = 100 * 365 * 24 * 60 * 60 * 1000;

export const CACHE_TTL = {
    PRICES: INFINITE_TTL,
    NEWS: 24 * 60 * 60 * 1000, // 24 horas para notícias no disco
    DIVIDENDS: INFINITE_TTL,
    CALENDAR: INFINITE_TTL,
};

// Stale Time (Quanto tempo consideramos os dados "frescos" antes de pedir novos)
export const STALE_TIME = {
    PRICES: 5 * 60 * 1000, // 5 Minutos
    MARKET_DATA: 10 * 60 * 1000, // 10 Minutos para dados fundamentais
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
    }
];


// --- THEMES ---
export const APP_THEMES: AppTheme[] = [
    {
        id: 'default-dark',
        name: 'Padrão Dark',
        type: 'dark',
        description: 'Um visual sóbrio e focado, com tons de cinza escuro e o azul ciano clássico do Invest para destaque.',
        colors: {
            bgPrimary: '#09090b',
            bgSecondary: '#18181b',
            bgTertiary: '#27272a',
            textPrimary: '#fafafa',
            textSecondary: '#a1a1aa',
            borderColor: '#27272a',
            accentColor: '#38bdf8',
            accentText: '#09090b',
            greenText: '#4ade80',
            redText: '#f87171',
        },
        isPremium: false,
    },
    {
        id: 'carbon-red',
        name: 'Carbon GT',
        type: 'dark',
        description: 'Velocidade e precisão, com preto carbono fosco e detalhes em vermelho de alta performance.',
        colors: {
            bgPrimary: '#101010',
            bgSecondary: '#1c1c1c',
            bgTertiary: '#2a2a2a',
            textPrimary: '#ffffff',
            textSecondary: '#9ca3af',
            borderColor: '#333333',
            accentColor: '#ef4444', // Vermelho vivo
            accentText: '#ffffff',
            greenText: '#22c55e',
            redText: '#ef4444',
        },
        isPremium: true,
    },
    {
        id: 'royal-gold',
        name: 'Royal Gold',
        type: 'dark',
        description: 'Elegância atemporal. Um tema sofisticado com preto profundo e realces em ouro polido.',
        colors: {
            bgPrimary: '#0f0f11',
            bgSecondary: '#1a1a1d',
            bgTertiary: '#252529',
            textPrimary: '#fffaeb',
            textSecondary: '#a8a29e',
            borderColor: '#422006', // Marrom muito sutil
            accentColor: '#fbbf24', // Dourado
            accentText: '#451a03',
            greenText: '#fcd34d', // Dourado claro para positivo
            redText: '#f87171',
        },
        isPremium: true,
    },
    {
        id: 'midnight-oled',
        name: 'Midnight OLED',
        type: 'dark',
        description: 'Contraste máximo. Preto puro para telas OLED, ideal para focar nos dados e economizar bateria.',
        colors: {
            bgPrimary: '#000000',
            bgSecondary: '#0a0a0a',
            bgTertiary: '#171717',
            textPrimary: '#ffffff',
            textSecondary: '#888888',
            borderColor: '#1f1f1f',
            accentColor: '#ffffff',
            accentText: '#000000',
            greenText: '#22c55e',
            redText: '#ef4444',
        },
        isPremium: false,
    },
    {
        id: 'cyber-neon',
        name: 'Cyber Neon',
        type: 'dark',
        description: 'Uma viagem cyberpunk. Roxo profundo e magenta neon para uma interface vibrante e futurista.',
        colors: {
            bgPrimary: '#090014', // Roxo muito escuro
            bgSecondary: '#15002e',
            bgTertiary: '#2a0a4a',
            textPrimary: '#e0e7ff',
            textSecondary: '#a78bfa',
            borderColor: '#4c1d95',
            accentColor: '#d946ef', // Magenta Neon
            accentText: '#ffffff',
            greenText: '#22d3ee', // Ciano
            redText: '#fb7185',
        },
        isPremium: true,
    },
    {
        id: 'dracula',
        name: 'Dracula',
        type: 'dark',
        description: 'O lendário tema dos desenvolvedores. Tons de roxo, rosa e ciano com contraste confortável.',
        colors: {
            bgPrimary: '#282a36',
            bgSecondary: '#44475a',
            bgTertiary: '#6272a4',
            textPrimary: '#f8f8f2',
            textSecondary: '#bd93f9',
            borderColor: '#6272a4',
            accentColor: '#ff79c6',
            accentText: '#282a36',
            greenText: '#50fa7b',
            redText: '#ff5555',
        },
        isPremium: false,
    },
    {
        id: 'ocean-depths',
        name: 'Ocean Depths',
        type: 'dark',
        description: 'Mergulhe na tranquilidade. Azul marinho profundo e ciano, inspirado nas profundezas do oceano.',
        colors: {
            bgPrimary: '#0f172a',
            bgSecondary: '#1e293b',
            bgTertiary: '#334155',
            textPrimary: '#f1f5f9',
            textSecondary: '#94a3b8',
            borderColor: '#334155',
            accentColor: '#38bdf8',
            accentText: '#0f172a',
            greenText: '#34d399',
            redText: '#f87171',
        },
        isPremium: true,
    },
    {
        id: 'forest-dark',
        name: 'Deep Forest',
        type: 'dark',
        description: 'Calma e crescimento. Tons de verde escuro e menta, evocando a serenidade de uma floresta densa.',
        colors: {
            bgPrimary: '#022c22',
            bgSecondary: '#064e3b',
            bgTertiary: '#065f46',
            textPrimary: '#ecfdf5',
            textSecondary: '#6ee7b7',
            borderColor: '#047857',
            accentColor: '#34d399',
            accentText: '#022c22',
            greenText: '#6ee7b7',
            redText: '#fda4af',
        },
        isPremium: true,
    },
    {
        id: 'nordic-night',
        name: 'Nordic Night',
        type: 'dark',
        description: 'Minimalismo escandinavo. Paleta de cores frias e suaves para uma experiência calma e profissional.',
        colors: {
            bgPrimary: '#2E3440',
            bgSecondary: '#3B4252',
            bgTertiary: '#434C5E',
            textPrimary: '#ECEFF4',
            textSecondary: '#D8DEE9',
            borderColor: '#4C566A',
            accentColor: '#88C0D0',
            accentText: '#2E3440',
            greenText: '#A3BE8C',
            redText: '#BF616A',
        },
        isPremium: false,
    },
    {
        id: 'default-light',
        name: 'Padrão Light',
        type: 'light',
        description: 'Clareza e simplicidade. Um tema clean com excelente legibilidade para uso durante o dia.',
        colors: {
            bgPrimary: '#f8fafc',
            bgSecondary: '#ffffff',
            bgTertiary: '#f1f5f9',
            textPrimary: '#0f172a',
            textSecondary: '#64748b',
            borderColor: '#e2e8f0',
            accentColor: '#0284c7',
            accentText: '#ffffff',
            greenText: '#16a34a',
            redText: '#e11d48',
        },
        isPremium: false,
    },
    {
        id: 'arctic-ice',
        name: 'Arctic Ice',
        type: 'light',
        description: 'Refrescante e moderno. Tons de azul gelo e branco puro para uma interface nítida e arejada.',
        colors: {
            bgPrimary: '#f0f9ff',
            bgSecondary: '#ffffff',
            bgTertiary: '#e0f2fe',
            textPrimary: '#0c4a6e',
            textSecondary: '#548ca8',
            borderColor: '#bae6fd',
            accentColor: '#0ea5e9',
            accentText: '#ffffff',
            greenText: '#0284c7',
            redText: '#e11d48',
        },
        isPremium: true,
    },
    {
        id: 'sepia-comfort',
        name: 'Sepia Comfort',
        type: 'light',
        description: 'Conforto para os olhos. Tons de sépia quentes que reduzem o cansaço visual, ideal para longas leituras.',
        colors: {
            bgPrimary: '#fbf7f0',
            bgSecondary: '#fffefb',
            bgTertiary: '#f0e6d2',
            textPrimary: '#433422',
            textSecondary: '#8c7b67',
            borderColor: '#e6dbcc',
            accentColor: '#d97706',
            accentText: '#ffffff',
            greenText: '#059669',
            redText: '#dc2626',
        },
        isPremium: false,
    },
    {
        id: 'corporate-gray',
        name: 'Corporate',
        type: 'light',
        description: 'Foco e profissionalismo. Um tema minimalista em escala de cinza para um ambiente de trabalho sério.',
        colors: {
            bgPrimary: '#f3f4f6',
            bgSecondary: '#ffffff',
            bgTertiary: '#e5e7eb',
            textPrimary: '#111827',
            textSecondary: '#6b7280',
            borderColor: '#d1d5db',
            accentColor: '#4b5563',
            accentText: '#ffffff',
            greenText: '#059669',
            redText: '#b91c1c',
        },
        isPremium: false,
    },
    {
        id: 'minty-fresh',
        name: 'Minty Fresh',
        type: 'light',
        description: 'Energia e renovação. Verde menta vibrante e branco para uma sensação de frescor e modernidade.',
        colors: {
            bgPrimary: '#F5FFFA',
            bgSecondary: '#FFFFFF',
            bgTertiary: '#E6F8F0',
            textPrimary: '#025940',
            textSecondary: '#5C8C7E',
            borderColor: '#D1EAE2',
            accentColor: '#3DDDA0',
            accentText: '#025940',
            greenText: '#027C55',
            redText: '#D94D4D',
        },
        isPremium: false,
    },
    {
        id: 'sakura-pink',
        name: 'Sakura Pink',
        type: 'light',
        description: 'Delicadeza e harmonia. Tons suaves de rosa e branco, inspirados na beleza das flores de cerejeira.',
        colors: {
            bgPrimary: '#FFF5F7',
            bgSecondary: '#FFFFFF',
            bgTertiary: '#FFE3E9',
            textPrimary: '#5C3740',
            textSecondary: '#966F79',
            borderColor: '#FADADD',
            accentColor: '#FF8FAB',
            accentText: '#FFFFFF',
            greenText: '#50A684',
            redText: '#E5536C',
        },
        isPremium: false,
    },
    {
        id: 'slate-graphite',
        name: 'Slate Graphite',
        type: 'dark',
        description: 'Um tema frio e profissional, com tons de grafite e ardósia para máxima concentração.',
        colors: {
            bgPrimary: '#111827',
            bgSecondary: '#1f2937',
            bgTertiary: '#374151',
            textPrimary: '#f9fafb',
            textSecondary: '#9ca3af',
            borderColor: '#374151',
            accentColor: '#3b82f6',
            accentText: '#ffffff',
            greenText: '#22c55e',
            redText: '#ef4444',
        },
        isPremium: false,
    },
    {
        id: 'espresso-dark',
        name: 'Espresso',
        type: 'dark',
        description: 'Conforto e foco, com tons quentes de café para uma experiência acolhedora.',
        colors: {
            bgPrimary: '#281e19',
            bgSecondary: '#402f27',
            bgTertiary: '#574136',
            textPrimary: '#f5e9e0',
            textSecondary: '#b8a79d',
            borderColor: '#402f27',
            accentColor: '#d97706',
            accentText: '#f5e9e0',
            greenText: '#84cc16',
            redText: '#f472b6',
        },
        isPremium: true,
    },
    {
        id: 'linen-white',
        name: 'Linen White',
        type: 'light',
        description: 'Minimalismo e clareza, com branco suave e cinzas claros para uma leitura confortável.',
        colors: {
            bgPrimary: '#fdfcfb',
            bgSecondary: '#ffffff',
            bgTertiary: '#f1f5f9',
            textPrimary: '#1e293b',
            textSecondary: '#64748b',
            borderColor: '#e2e8f0',
            accentColor: '#475569',
            accentText: '#ffffff',
            greenText: '#166534',
            redText: '#b91c1c',
        },
        isPremium: false,
    },
    {
        id: 'sandstone-light',
        name: 'Sandstone',
        type: 'light',
        description: 'Natural e sereno, com tons de areia e bege para uma interface orgânica e profissional.',
        colors: {
            bgPrimary: '#f5f3ef',
            bgSecondary: '#fcfaf6',
            bgTertiary: '#edeae4',
            textPrimary: '#574136',
            textSecondary: '#8a786d',
            borderColor: '#e7e2d9',
            accentColor: '#c2410c',
            accentText: '#ffffff',
            greenText: '#57534e',
            redText: '#991b1b',
        },
        isPremium: true,
    },
    {
        id: 'oceanic-light',
        name: 'Oceanic Light',
        type: 'light',
        description: 'Uma brisa do oceano para sua interface. Azul claro e branco para clareza e calma.',
        colors: {
            bgPrimary: '#f0f9ff',
            bgSecondary: '#ffffff',
            bgTertiary: '#e0f2fe',
            textPrimary: '#0c4a6e',
            textSecondary: '#38bdf8',
            borderColor: '#bae6fd',
            accentColor: '#0ea5e9',
            accentText: '#ffffff',
            greenText: '#16a34a',
            redText: '#dc2626',
        },
        isPremium: true,
    },
    {
        id: 'mint-mojito',
        name: 'Mint Mojito',
        type: 'light',
        description: 'Refrescante e moderno. Verde menta suave para uma interface energizante e limpa.',
        colors: {
            bgPrimary: '#f0fdfa',
            bgSecondary: '#ffffff',
            bgTertiary: '#d1fae5',
            textPrimary: '#064e3b',
            textSecondary: '#34d399',
            borderColor: '#a7f3d0',
            accentColor: '#10b981',
            accentText: '#ffffff',
            greenText: '#16a34a',
            redText: '#ef4444',
        },
        isPremium: false,
    },
    {
        id: 'rose-quartz',
        name: 'Rose Quartz',
        type: 'light',
        description: 'Elegância sutil com tons de quartzo rosa. Uma aparência calma e sofisticada.',
        colors: {
            bgPrimary: '#fff1f2',
            bgSecondary: '#ffffff',
            bgTertiary: '#ffe4e6',
            textPrimary: '#881337',
            textSecondary: '#f472b6',
            borderColor: '#fecdd3',
            accentColor: '#ec4899',
            accentText: '#ffffff',
            greenText: '#16a34a',
            redText: '#be123c',
        },
        isPremium: false,
    },
    {
        id: 'autumn-gold',
        name: 'Autumn Gold',
        type: 'light',
        description: 'Tons quentes e terrosos de outono para uma interface acolhedora e orgânica.',
        colors: {
            bgPrimary: '#fffbeb',
            bgSecondary: '#ffffff',
            bgTertiary: '#fef3c7',
            textPrimary: '#78350f',
            textSecondary: '#fbbf24',
            borderColor: '#fde68a',
            accentColor: '#f59e0b',
            accentText: '#ffffff',
            greenText: '#16a34a',
            redText: '#b91c1c',
        },
        isPremium: true,
    },
    {
        id: 'botanical-garden',
        name: 'Botanical Garden',
        type: 'light',
        description: 'Verde sálvia e tons terrosos para uma interface orgânica e focada, com um toque de minimalismo.',
        colors: {
            bgPrimary: '#f7f6f3',
            bgSecondary: '#ffffff',
            bgTertiary: '#eef0eb',
            textPrimary: '#3e443a',
            textSecondary: '#7a8276',
            borderColor: '#e1e3de',
            accentColor: '#708265',
            accentText: '#ffffff',
            greenText: '#3B7A57',
            redText: '#B22222',
        },
        isPremium: false,
    },
    {
        id: 'soft-amethyst',
        name: 'Soft Amethyst',
        type: 'light',
        description: 'Tons suaves de lavanda e ametista para uma experiência calma e elegante, com um acabamento sofisticado.',
        colors: {
            bgPrimary: '#f5f3f7',
            bgSecondary: '#ffffff',
            bgTertiary: '#e9e6ed',
            textPrimary: '#4a3f55',
            textSecondary: '#82798c',
            borderColor: '#e1ddeb',
            accentColor: '#9370DB',
            accentText: '#ffffff',
            greenText: '#2E8B57',
            redText: '#C71585',
        },
        isPremium: true,
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
