
import type { AppPreferences, AppTheme } from './types';

export const CACHE_TTL = {
    NEWS: 1000 * 60 * 60, // 1 hour
    MARKET: 1000 * 60 * 5, // 5 minutes
    ASSET: 1000 * 60 * 15, // 15 minutes
};

export const KNOWN_TICKERS = [
    'MXRF11', 'HGLG11', 'XPML11', 'KNCR11', 'VISC11', 'BTLG11', 'XPLG11', 'IRDM11',
    'CPTS11', 'HGBS11', 'VILG11', 'MALL11', 'SNAG11', 'VGIA11', 'KNCA11', 'RZAG11',
    'KNIP11', 'KNRI11', 'HGRU11', 'TGAR11', 'BCFF11', 'BRCO11', 'HFOF11', 'KNSC11'
];

export const STATIC_FII_SECTORS: Record<string, string> = {
    'HGLG11': 'Tijolo', 'BTLG11': 'Tijolo', 'XPLG11': 'Tijolo', 'VILG11': 'Tijolo', 'BRCO11': 'Tijolo',
    'XPML11': 'Tijolo', 'VISC11': 'Tijolo', 'HGBS11': 'Tijolo', 'MALL11': 'Tijolo', 'HGRU11': 'Tijolo',
    'KNRI11': 'Tijolo',
    'MXRF11': 'Papel', 'KNCR11': 'Papel', 'CPTS11': 'Papel', 'IRDM11': 'Papel', 'KNIP11': 'Papel',
    'KNSC11': 'Papel', 'CVBI11': 'Papel', 'RECR11': 'Papel',
    'SNAG11': 'Fiagro', 'VGIA11': 'Fiagro', 'KNCA11': 'Fiagro', 'RZAG11': 'Fiagro',
    'BCFF11': 'FOF', 'HFOF11': 'FOF', 'KFOF11': 'FOF',
    'TGAR11': 'Outros'
};

export const APP_THEMES: AppTheme[] = [
    {
        id: 'default-dark',
        name: 'Dark Padrão',
        type: 'dark',
        isPremium: false,
        description: 'Tema escuro clássico',
        colors: {
            bgPrimary: '#09090b',
            bgSecondary: '#18181b',
            bgTertiary: '#27272a',
            textPrimary: '#f4f4f5',
            textSecondary: '#a1a1aa',
            borderColor: '#27272a',
            accentColor: '#3b82f6',
            accentText: '#ffffff',
            greenText: '#22c55e',
            redText: '#ef4444'
        }
    },
    {
        id: 'default-light',
        name: 'Light Padrão',
        type: 'light',
        isPremium: false,
        description: 'Tema claro limpo',
        colors: {
            bgPrimary: '#ffffff',
            bgSecondary: '#f4f4f5',
            bgTertiary: '#e4e4e7',
            textPrimary: '#18181b',
            textSecondary: '#71717a',
            borderColor: '#e4e4e7',
            accentColor: '#3b82f6',
            accentText: '#ffffff',
            greenText: '#16a34a',
            redText: '#dc2626'
        }
    },
    {
        id: 'midnight',
        name: 'Midnight',
        type: 'dark',
        isPremium: true,
        description: 'Tons profundos de azul',
        colors: {
            bgPrimary: '#020617',
            bgSecondary: '#0f172a',
            bgTertiary: '#1e293b',
            textPrimary: '#f8fafc',
            textSecondary: '#94a3b8',
            borderColor: '#1e293b',
            accentColor: '#6366f1',
            accentText: '#ffffff',
            greenText: '#4ade80',
            redText: '#f87171'
        }
    }
];

export const APP_FONTS = [
    { id: 'inter', name: 'Inter', family: 'Inter, sans-serif', description: 'font_inter_desc' },
    { id: 'lora', name: 'Lora', family: 'Lora, serif', description: 'font_lora_desc' },
    { id: 'roboto-mono', name: 'Roboto Mono', family: 'Roboto Mono, monospace', description: 'font_roboto_mono_desc' }
];

export const DEFAULT_PREFERENCES: AppPreferences = {
    accentColor: 'blue', systemTheme: 'system', visualStyle: 'premium', fontSize: 'medium', compactMode: false,
    currentThemeId: 'default-dark', currentFontId: 'inter', showCurrencySymbol: true, reduceMotion: false, animationSpeed: 'normal',
    startScreen: 'carteira',
    hapticFeedback: true, vibrationIntensity: 'medium', hideCents: false, appPin: null,
    defaultBrokerage: 0, csvSeparator: ',', decimalPrecision: 2, defaultSort: 'valueDesc', dateFormat: 'dd/mm/yyyy',
    priceAlertThreshold: 5, globalIncomeGoal: 1000, segmentGoals: {}, dndEnabled: false, dndStart: '22:00', dndEnd: '07:00',
    notificationChannels: { push: true, email: false }, geminiApiKey: null, brapiToken: null, autoBackup: false, betaFeatures: false, devMode: false
};
