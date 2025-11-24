
export interface DividendHistoryEvent {
  exDate: string;
  paymentDate: string;
  value: number;
}

export interface Asset {
  ticker: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  priceHistory: { date: string, price: number }[];
  dividendsHistory?: DividendHistoryEvent[];
  dy?: number; // Dividend Yield 12M
  pvp?: number; // Price / Book Value
  segment?: string;
  administrator?: string;
  vacancyRate?: number;
  liquidity?: number;
  shareholders?: number;
  yieldOnCost?: number;
  nextPaymentDate?: string; // Data real de pagamento (YYYY-MM-DD)
  lastDividend?: number; // Último valor pago
}

export interface NewsArticle {
  source: string;
  title: string;
  summary: string;
  impactAnalysis?: string; // Por que isso importa?
  date: string;
  url?: string;
  imageUrl?: string;
  sentiment?: 'Positive' | 'Neutral' | 'Negative';
  category?: string;
  impactLevel?: 'High' | 'Medium' | 'Low';
}

export interface UserProfile {
  name: string;
  email:string;
  avatarUrl: string;
  profession?: string;
  location?: string;
  bio?: string;
  joinedDate?: string;
}

export type TransactionType = 'Compra' | 'Venda';

export interface Transaction {
    id: string;
    ticker: string;
    type: TransactionType;
    quantity: number;
    price: number;
    date: string;
    costs?: number;
    // FIX: Add optional 'notes' property to Transaction interface
    notes?: string;
}

export interface Dividend {
    ticker: string;
    amountPerShare: number;
    quantity: number;
    paymentDate: string;
}

export interface MonthlyIncome {
    month: string;
    total: number;
}

export interface CalendarEvent {
    ticker: string;
    eventType: 'Confirmado' | 'Previsão' | 'Pago';
    date: string;
    projectedAmount?: number;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type NotificationType = 'dividend' | 'price' | 'news';

export type Locale = 'pt-BR';

export type SortOption = 'valueDesc' | 'valueAsc' | 'tickerAsc' | 'performanceDesc';

export type AppColor = 'blue' | 'green' | 'purple' | 'orange' | 'rose';

export interface ThemeColors {
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    textPrimary: string;
    textSecondary: string;
    borderColor: string;
    accentColor: string;
    accentText: string;
    greenText: string;
    redText: string;
}

export interface AppTheme {
    id: string;
    name: string;
    type: 'dark' | 'light';
    description: string;
    colors: ThemeColors;
    isPremium?: boolean;
}

export interface AppPreferences {
  // Appearance
  currentThemeId: string; // Replaces simple accentColor/systemTheme for full themes
  accentColor: AppColor; // Kept for backward compatibility or simple overrides
  systemTheme: 'system' | 'light' | 'dark'; // Kept for backward compatibility
  visualStyle: 'simple' | 'premium'; // New Visual Style Preference
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  showCurrencySymbol: boolean;
  reduceMotion: boolean;
  animationSpeed: 'slow' | 'normal' | 'fast' | 'instant';

  // General
  startScreen: 'carteira' | 'analise' | 'noticias';
  hapticFeedback: boolean;
  vibrationIntensity: 'light' | 'medium' | 'heavy';
  hideCents: boolean;
  restartTutorial: boolean;

  // Security
  privacyOnStart: boolean;
  appPin: string | null; // 4 digit pin or null

  // Data & Transactions
  defaultBrokerage: number;
  csvSeparator: ',' | ';';
  decimalPrecision: 2 | 3 | 4;
  defaultSort: SortOption;
  dateFormat: 'dd/mm/yyyy' | 'mm/dd/yyyy';

  // Notifications & Goals
  priceAlertThreshold: number; // %
  globalIncomeGoal: number;
  segmentGoals: Record<string, number>; // New: Goals per segment
  dndEnabled: boolean;
  dndStart: string;
  dndEnd: string;
  notificationChannels: {
      push: boolean;
      email: boolean;
  };

  // Advanced & API
  geminiApiKey: string | null;
  brapiToken: string | null;
  autoBackup: boolean;
  betaFeatures: boolean;
  devMode: boolean;
}

export interface PortfolioEvolutionPoint {
    month: string;
    invested: number;
    marketValue: number;
}

export type SegmentEvolutionData = Record<string, PortfolioEvolutionPoint[]>;
