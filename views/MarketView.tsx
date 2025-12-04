
import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { fetchBrapiQuotes } from '../services/brapiService';
import { fetchAdvancedAssetData } from '../services/geminiService';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate, usePersistentState } from '../utils';
import RefreshIcon from '../components/icons/RefreshIcon';
import PlusIcon from '../components/icons/PlusIcon';
import NewsIcon from '../components/icons/NewsIcon';
import GlobeIcon from '../components/icons/GlobeIcon';
import ClockIcon from '../components/icons/ClockIcon';
import TrashIcon from '../components/icons/TrashIcon';
import AnalysisIcon from '../components/icons/AnalysisIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import TransactionModal from '../components/modals/TransactionModal';
import NewsView from './NewsView';
import PortfolioLineChart from '../components/PortfolioLineChart';
import DividendChart from '../components/DividendChart';
import type { ToastMessage, Asset } from '../types';

interface MarketViewProps {
    addToast: (message: string, type?: ToastMessage['type']) => void;
}

interface MarketResult {
    ticker: string;
    price: number;
    change: number;
    history: number[];
    min: number;
    max: number;
    fundamentals?: Partial<Asset>; 
}

const MARKET_CATEGORIES = [
    { title: "Gigantes da Logística", color: "bg-orange-500", tickers: ["HGLG11", "BTLG11", "XPLG11", "VILG11"] },
    { title: "Shoppings Premium", color: "bg-blue-500", tickers: ["XPML11", "VISC11", "HGBS11", "MALL11"] },
    { title: "Papel & Recebíveis", color: "bg-emerald-500", tickers: ["MXRF11", "KNCR11", "CPTS11", "IRDM11"] },
    { title: "Fiagros (Agro)", color: "bg-lime-600", tickers: ["SNAG11", "VGIA11", "KNCA11", "RZAG11"] }
];

const InfoBlock: React.FC<{ label: string; value: React.ReactNode; sub?: string; highlight?: boolean; colorClass?: string }> = ({ label, value, sub, highlight, colorClass }) => (
    <div className={`flex flex-col p-3 rounded-xl border h-full justify-between ${highlight ? 'bg-[var(--bg-tertiary-hover)] border-[var(--accent-color)]/20' : 'bg-[var(--bg-primary)] border-[var(--border-color)]'}`}>
        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1 opacity-80">{label}</span>
        <div>
            <span className={`text-sm font-bold truncate block ${colorClass ? colorClass : (highlight ? 'text-[var(--accent-color)]' : 'text-[var(--text-primary)]')}`}>{value}</span>
            {sub && <span className="text-[9px] text-[var(--text-secondary)] mt-0.5 truncate block">{sub}</span>}
        </div>
    </div>
);

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${isActive ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary-hover)]'}`}
    >
        {label}
    </button>
);

const FundamentalSkeleton: React.FC = () => (
    <div className="animate-pulse space-y-4 px-4 pb-4">
        <div className="h-24 bg-[var(--bg-primary)] rounded-xl opacity-50"></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-16 bg-[var(--bg-primary)] rounded-xl opacity-50"></div>
            ))}
        </div>
    </div>
);

const MarketView: React.FC<MarketViewProps> = ({ addToast }) => {
    const { t, formatCurrency } = useI18n();
    const { preferences, addTransaction } = usePortfolio();
    
    const [viewMode, setViewMode] = useState<'quotes' | 'news'>('quotes');
    const [detailTab, setDetailTab] = useState<'general' | 'dividends' | 'portfolio' | 'risks'>('general');
    
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingFundamentals, setLoadingFundamentals] = useState(false);
    const [result, setResult] = useState<MarketResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    
    const [recentSearches, setRecentSearches] = usePersistentState<string[]>('market_recent_searches', []);

    const handleSearch = async (term: string) => {
        const cleanTerm = term.trim().toUpperCase();
        if (!cleanTerm || cleanTerm.length < 4) return;
        
        vibrate();
        setLoading(true);
        setLoadingFundamentals(true);
        setError(null);
        setResult(null);
        setSearchTerm(cleanTerm);
        setDetailTab('general');

        try {
            const { quotes } = await fetchBrapiQuotes(preferences, [cleanTerm], false);
            const data = quotes[cleanTerm];
            
            if (data && data.currentPrice > 0) {
                const historyPrices = data.priceHistory?.map(p => p.price) || [];
                
                let change = 0;
                if (historyPrices.length >= 2) {
                    const lastClose = historyPrices[historyPrices.length - 2];
                    change = ((data.currentPrice - lastClose) / lastClose) * 100;
                }

                const min = historyPrices.length > 0 ? Math.min(...historyPrices) : data.currentPrice;
                const max = historyPrices.length > 0 ? Math.max(...historyPrices) : data.currentPrice;

                const baseResult: MarketResult = {
                    ticker: cleanTerm,
                    price: data.currentPrice,
                    change: change,
                    history: historyPrices,
                    min,
                    max,
                    fundamentals: undefined
                };
                
                setResult(baseResult);
                setLoading(false);

                setRecentSearches(prev => {
                    const filtered = prev.filter(item => item !== cleanTerm);
                    return [cleanTerm, ...filtered].slice(0, 5);
                });

                try {
                    const advData = await fetchAdvancedAssetData(preferences, [cleanTerm]);
                    const fund = advData.data[cleanTerm];
                    
                    if (fund) {
                        setResult(prev => prev ? ({
                            ...prev,
                            fundamentals: {
                                dy: fund.dy,
                                pvp: fund.pvp,
                                segment: fund.assetType,
                                vacancyRate: fund.vacancyRate,
                                administrator: fund.administrator,
                                lastDividend: fund.lastDividend,
                                netWorth: fund.netWorth,
                                shareholders: fund.shareholders,
                                vpPerShare: fund.vpPerShare,
                                businessDescription: fund.businessDescription,
                                riskAssessment: fund.riskAssessment,
                                strengths: fund.strengths,
                                dividendCAGR: fund.dividendCAGR,
                                capRate: fund.capRate,
                                managementFee: fund.managementFee,
                                dividendsHistory: fund.dividendsHistory
                            }
                        }) : null);
                    }
                } catch (err) {
                    console.warn("Failed to fetch fundamentals", err);
                } finally {
                    setLoadingFundamentals(false);
                }

            } else {
                setError('Ativo não encontrado ou sem liquidez.');
                setLoading(false);
                setLoadingFundamentals(false);
            }
        } catch (e) {
            setError('Erro de conexão. Tente novamente.');
            setLoading(false);
            setLoadingFundamentals(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch(searchTerm);
    };

    const handleAddTransaction = (tx: any) => {
        addTransaction({ ...tx, id: String(Date.now()) });
        addToast(t('toast_transaction_added'), 'success');
        setShowAddModal(false);
    };

    const clearRecent = () => {
        vibrate();
        setRecentSearches([]);
    }

    return (
        <div className="p-4 pb-24 md:pb-6 h-full overflow-y-auto custom-scrollbar landscape-pb-6">
            <div className="max-w-2xl mx-auto h-full flex flex-col">
                <h1 className="text-2xl font-bold mb-4">{t('nav_market')}</h1>

                <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl mb-6 border border-[var(--border-color)] shrink-0 shadow-sm">
                    <button 
                        onClick={() => { setViewMode('quotes'); vibrate(); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide ${viewMode === 'quotes' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <GlobeIcon className="w-4 h-4" /> Cotações
                    </button>
                    <button 
                        onClick={() => { setViewMode('news'); vibrate(); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide ${viewMode === 'news' ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <NewsIcon className="w-4 h-4" /> Notícias
                    </button>
                </div>

                {viewMode === 'quotes' ? (
                    <div className="animate-fade-in space-y-6">
                        
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                                onKeyDown={handleKeyDown}
                                placeholder="Pesquisar FII (ex: MXRF11)"
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl py-4 pl-5 pr-14 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all uppercase shadow-sm placeholder:text-[var(--text-secondary)]/50"
                            />
                            <button
                                onClick={() => handleSearch(searchTerm)}
                                disabled={loading}
                                className="absolute right-2 top-2 bottom-2 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--accent-color)] p-3 rounded-xl transition-colors disabled:opacity-50"
                            >
                                <RefreshIcon className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {result && (
                            <div className="bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] shadow-lg animate-fade-in-up overflow-hidden">
                                <div className="p-6 pb-2">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">{result.ticker}</h2>
                                                {result.fundamentals?.segment && (
                                                    <span className="text-[10px] font-bold bg-[var(--bg-primary)] border border-[var(--border-color)] px-2 py-0.5 rounded-full text-[var(--text-secondary)] uppercase">
                                                        {result.fundamentals.segment}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1">
                                                {loadingFundamentals ? <span className="flex items-center gap-1 animate-pulse"><SparklesIcon className="w-3 h-3"/> Analisando...</span> : 'Análise Completa'}
                                            </p>
                                        </div>
                                        <div className={`flex flex-col items-end`}>
                                            <span className="text-2xl font-bold text-[var(--text-primary)]">{formatCurrency(result.price)}</span>
                                            <span className={`text-sm font-bold ${result.change >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                                                {result.change >= 0 ? '▲' : '▼'} {Math.abs(result.change).toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-28 w-full px-2 mb-4">
                                    {result.history.length >= 2 ? (
                                        <PortfolioLineChart data={result.history} isPositive={result.change >= 0} simpleMode={true} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] text-xs">Gráfico indisponível</div>
                                    )}
                                </div>

                                {loadingFundamentals ? (
                                    <FundamentalSkeleton />
                                ) : (
                                    <>
                                        <div className="px-4 mb-4">
                                            <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)] overflow-x-auto no-scrollbar">
                                                <TabButton label="Geral" isActive={detailTab === 'general'} onClick={() => setDetailTab('general')} />
                                                <TabButton label="Dividendos" isActive={detailTab === 'dividends'} onClick={() => setDetailTab('dividends')} />
                                                <TabButton label="Portfólio" isActive={detailTab === 'portfolio'} onClick={() => setDetailTab('portfolio')} />
                                                <TabButton label="Riscos" isActive={detailTab === 'risks'} onClick={() => setDetailTab('risks')} />
                                            </div>
                                        </div>

                                        <div className="px-4 pb-4 animate-fade-in">
                                            
                                            {/* TAB: GENERAL */}
                                            {detailTab === 'general' && (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    <InfoBlock label="P/VP" value={result.fundamentals?.pvp?.toFixed(2) ?? '-'} sub={result.fundamentals?.vpPerShare ? `VP: ${formatCurrency(result.fundamentals.vpPerShare)}` : ''} colorClass={result.fundamentals?.pvp && result.fundamentals.pvp < 1 ? 'text-[var(--green-text)]' : ''}/>
                                                    <InfoBlock label="Dividend Yield" value={result.fundamentals?.dy ? `${result.fundamentals.dy.toFixed(2)}%` : '-'} highlight={result.fundamentals?.dy && result.fundamentals.dy > 10 ? true : false} />
                                                    <InfoBlock label="Patrimônio Líq." value={result.fundamentals?.netWorth ?? '-'} />
                                                    <InfoBlock label="Liquidez Diária" value="Analise na Corretora" sub="Dados em tempo real" />
                                                    <InfoBlock label="Nº Cotistas" value={result.fundamentals?.shareholders ? `${(result.fundamentals.shareholders/1000).toFixed(1)}k` : '-'} />
                                                    <InfoBlock label="Gestão" value={result.fundamentals?.administrator ?? '-'} />
                                                </div>
                                            )}

                                            {/* TAB: DIVIDENDS */}
                                            {detailTab === 'dividends' && (
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <InfoBlock label="Último Rendimento" value={result.fundamentals?.lastDividend ? formatCurrency(result.fundamentals.lastDividend) : '-'} highlight />
                                                        <InfoBlock label="Cresc. 3 Anos (CAGR)" value={result.fundamentals?.dividendCAGR ? `${result.fundamentals.dividendCAGR > 0 ? '+' : ''}${result.fundamentals.dividendCAGR}%` : '-'} colorClass={result.fundamentals?.dividendCAGR && result.fundamentals.dividendCAGR > 0 ? 'text-[var(--green-text)]' : 'text-[var(--text-secondary)]'} />
                                                    </div>
                                                    {result.fundamentals?.dividendsHistory && result.fundamentals.dividendsHistory.length > 0 ? (
                                                        <div className="bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-color)]">
                                                            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-2">Histórico Recente</p>
                                                            <div className="h-32"><DividendChart data={result.fundamentals.dividendsHistory} /></div>
                                                        </div>
                                                    ) : <p className="text-center text-xs text-[var(--text-secondary)] py-4">Histórico indisponível</p>}
                                                </div>
                                            )}

                                            {/* TAB: PORTFOLIO */}
                                            {detailTab === 'portfolio' && (
                                                <div className="space-y-3">
                                                    {result.fundamentals?.businessDescription && (
                                                        <div className="bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-color)]">
                                                            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">Tese de Investimento</p>
                                                            <p className="text-xs leading-relaxed opacity-90">{result.fundamentals.businessDescription}</p>
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <InfoBlock label="Vacância Física" value={result.fundamentals?.vacancyRate !== undefined ? `${result.fundamentals.vacancyRate}%` : '-'} colorClass={result.fundamentals?.vacancyRate && result.fundamentals.vacancyRate > 10 ? 'text-[var(--red-text)]' : ''} />
                                                        <InfoBlock label="Cap Rate (Est.)" value={result.fundamentals?.capRate ? `${result.fundamentals.capRate}%` : '-'} sub="Rentabilidade Imóvel" />
                                                        <InfoBlock label="Taxa de Adm." value={result.fundamentals?.managementFee ?? '-'} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* TAB: RISKS */}
                                            {detailTab === 'risks' && (
                                                <div className="space-y-3">
                                                    {result.fundamentals?.riskAssessment && (
                                                        <div className={`p-3 rounded-xl border flex gap-3 ${result.fundamentals.riskAssessment.includes('High') || result.fundamentals.riskAssessment.includes('Alto') ? 'bg-red-500/10 border-red-500/20' : (result.fundamentals.riskAssessment.includes('Medium') || result.fundamentals.riskAssessment.includes('Médio') ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20')}`}>
                                                            <div className="shrink-0 pt-0.5"><AnalysisIcon className="w-4 h-4 opacity-70"/></div>
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">Avaliação de Risco (IA)</p>
                                                                <p className="text-xs font-bold">{result.fundamentals.riskAssessment}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {result.fundamentals?.strengths && result.fundamentals.strengths.length > 0 && (
                                                        <div className="bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-color)]">
                                                            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-2 flex items-center gap-1"><TrendingUpIcon className="w-3 h-3"/> Pontos Fortes</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {result.fundamentals.strengths.map((s, i) => (
                                                                    <span key={i} className="text-[10px] bg-[var(--bg-secondary)] border border-[var(--border-color)] px-2 py-1 rounded-md font-medium">{s}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                <div className="p-4 bg-[var(--bg-primary)]/50 border-t border-[var(--border-color)]">
                                    <button 
                                        onClick={() => setShowAddModal(true)}
                                        className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--accent-color)]/20"
                                    >
                                        <PlusIcon className="w-5 h-5" />
                                        Adicionar à Carteira
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center text-sm font-bold animate-fade-in">
                                {error}
                            </div>
                        )}

                        {!result && (
                            <div className="animate-fade-in space-y-6 mt-4">
                                {recentSearches.length > 0 && (
                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-3 px-1">
                                            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                                                <ClockIcon className="w-3.5 h-3.5"/> Recentes
                                            </h3>
                                            <button onClick={clearRecent} className="text-[var(--text-secondary)] hover:text-red-400 p-1">
                                                <TrashIcon className="w-3.5 h-3.5"/>
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {recentSearches.map(term => (
                                                <button key={term} onClick={() => handleSearch(term)} className="bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] px-4 py-2 rounded-xl font-bold text-sm text-[var(--text-primary)] transition-colors active:scale-95 flex items-center gap-2 group">
                                                    {term} <span className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1">Descubra Oportunidades</h3>
                                {MARKET_CATEGORIES.map((cat, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className={`w-2 h-2 rounded-full ${cat.color}`}></div>
                                            <span className="text-sm font-bold text-[var(--text-primary)]">{cat.title}</span>
                                        </div>
                                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
                                            {cat.tickers.map(t => (
                                                <button key={t} onClick={() => { setSearchTerm(t); handleSearch(t); }} className="flex-shrink-0 w-28 bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3 rounded-xl hover:bg-[var(--bg-tertiary-hover)] hover:border-[var(--accent-color)]/30 transition-all active:scale-95 text-left group">
                                                    <span className="block font-bold text-sm text-[var(--text-primary)] mb-1">{t}</span>
                                                    <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors">Ver detalhes →</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 animate-fade-in">
                        <NewsView addToast={addToast} />
                    </div>
                )}
            </div>

            {showAddModal && result && (
                <TransactionModal 
                    onClose={() => setShowAddModal(false)}
                    onSave={handleAddTransaction}
                    initialTicker={result.ticker}
                    addToast={addToast}
                />
            )}
        </div>
    );
};

export default MarketView;
