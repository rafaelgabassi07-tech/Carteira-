
export interface DividendHistoryEvent {
  exDate: string;
  paymentDate: string;
  value: number;
  isProvisioned?: boolean; // Novo: Indica se é um dividendo futuro/anunciado
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
  lastUpdated?: number; // Timestamp da última atualização bem sucedida (Preço)
  lastFundamentalUpdate?: number; // Timestamp da última atualização de dados fundamentais (Gemini)
  
  // Novos campos de Análise Avançada
  netWorth?: string;
  vpPerShare?: number;
  businessDescription?: string;
  riskAssessment?: string; // "Baixo", "Médio", "Alto" com breve explicação
  strengths?: string[]; // Pontos fortes
  weaknesses?: string[]; // Pontos de atenção
  dividendCAGR?: number; // Crescimento anual composto de dividendos (3 anos)
  capRate?: number; // Cap Rate estimado (para tijolo)
  managementFee?: string; // Taxa de administração
  
  // Grounding
  sources?: string[];
}

export interface NewsArticle {
  source: string;
  title: string;
  summary: string;
  impactAnalysis?: string; 
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
    notes?: string;
}

export interface Dividend {
    ticker: string;
    amountPerShare: number;
    quantity: number;
    paymentDate: string;
}

export interface CalendarEvent {
    ticker: string;
    eventType: 'Confirmado' | 'Previsão' | 'Pago';
    date: string;
    projectedAmount?: number;
}

export interface PortfolioEvolutionPoint {
    dateISO: string;
    month: string;
    invested: number;
    marketValue: number;
}

export interface MonthlyIncome {
    month: string;
    total: number;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: {
      label: string;
      onClick: () => void;
  };
  duration?: number; // 0 = infinite
}

export type NotificationType = 'milestone' | 'dividend_confirmed' | 'price_alert' | 'generic';

export interface AppNotification {
    id: number;
    type: NotificationType;
    title: string;
    description: string;
    date: string;
    read: boolean;
    relatedTicker?: string;
}


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

export interface AppFont {
    id: string;
    name: string;
    family: string;
    description: string;
}

export interface ApiStats {
    requests: number;
    bytesSent: number;
    bytesReceived: number;
}

export interface AppStats {
    gemini: ApiStats;
    brapi: ApiStats;
}

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
  startScreen: 'dashboard' | 'analysis' | 'noticias';
  hapticFeedback: boolean;
  vibrationIntensity: 'light' | 'medium' | 'heavy';
  hideCents: boolean;

  // Security
  privacyOnStart: boolean;
  appPin: string | null;

  // Data & Transactions
  defaultBrokerage: number;
  csvSeparator: ',' | ';';
  decimalPrecision: 2 | 3 | 4;
  defaultSort: SortOption;
  dateFormat: 'dd/mm/yyyy' | 'mm/dd/yyyy';

  // Notifications & Goals
  priceAlertThreshold: number; // %
  globalIncomeGoal: number;
  segmentGoals: Record<string, number>;
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