
export type AppColor = 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'red' | 'cyan' | 'yellow';

export interface AppPreferences {
  // Appearance
  currentThemeId: string;
  currentFontId: string;
  accentColor: AppColor;
  systemTheme: 'system' | 'light' | 'dark';
  visualStyle: 'simple' | 'premium';
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  showCurrencySymbol: boolean;
  reduceMotion: boolean;
  animationSpeed: 'slow' | 'normal' | 'fast' | 'instant';

  // General
  startScreen: 'carteira' | 'mercado'; 
  hapticFeedback: boolean;
  vibrationIntensity: 'light' | 'medium' | 'heavy';
  hideCents: boolean;

  // Security
  appPin: string | null;

  // Data & Transactions
  defaultBrokerage: number;
  csvSeparator: ',' | ';';
  decimalPrecision: number;
  defaultSort: SortOption;
  dateFormat: string;

  // Goals & Alerts
  priceAlertThreshold: number;
  globalIncomeGoal: number;
  segmentGoals: Record<string, number>;
  dndEnabled: boolean;
  dndStart: string;
  dndEnd: string;
  notificationChannels: { push: boolean; email: boolean };

  // API Keys
  geminiApiKey: string | null;
  brapiToken: string | null;

  // System
  autoBackup: boolean;
  betaFeatures: boolean;
  devMode: boolean;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: {
      label: string;
      onClick: () => void;
  };
  duration?: number;
}

export interface Transaction {
    id: string;
    ticker: string;
    type: TransactionType;
    quantity: number;
    price: number;
    date: string;
    costs?: number;
}

export type TransactionType = 'Compra' | 'Venda';

export interface Asset {
    ticker: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    priceHistory: { date: string; price: number }[];
    dividendsHistory: DividendHistoryEvent[];
    dy?: number;
    pvp?: number;
    segment?: string;
    administrator?: string;
    vacancyRate?: number;
    liquidity?: number;
    shareholders?: number;
    yieldOnCost?: number;
    nextPaymentDate?: string;
    lastDividend?: number;
    lastUpdated?: number;
    lastFundamentalUpdate?: number;
    netWorth?: string;
    vpPerShare?: number;
    businessDescription?: string;
    riskAssessment?: string;
    strengths?: string[];
    weaknesses?: string[];
    dividendCAGR?: number;
    capRate?: number;
    managementFee?: string;
    sector?: string;
    assetType?: string;
}

export interface DividendHistoryEvent {
    exDate: string;
    paymentDate: string;
    value: number;
    isProvisioned: boolean;
}

export interface NewsArticle {
    title: string;
    summary: string;
    source: string;
    date: string;
    sentimentScore?: number;
    sentimentReason?: string;
    url?: string;
    imageUrl?: string;
}

export interface AppNotification {
    id: number;
    type: NotificationType;
    title: string;
    description: string;
    date: string;
    read: boolean;
    relatedTicker?: string;
}

export type NotificationType = 'dividend_confirmed' | 'price_alert' | 'milestone' | 'news';

export interface MonthlyIncome {
    month: string;
    total: number;
}

export interface PortfolioEvolutionPoint {
    dateISO: string;
    marketValue: number;
    invested: number;
}

export type SortOption = 'valueDesc' | 'valueAsc' | 'tickerAsc' | 'performanceDesc';

export type Locale = 'pt-BR' | 'en-US' | 'es-ES';

export interface AppTheme {
    id: string;
    name: string;
    type: 'light' | 'dark';
    isPremium: boolean;
    description?: string;
    colors: {
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
    };
}
