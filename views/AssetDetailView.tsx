
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import RefreshIcon from '../components/icons/RefreshIcon';
import AnalysisIcon from '../components/icons/AnalysisIcon';
import DividendChart from '../components/DividendChart';
import { vibrate } from '../utils';

interface AssetDetailViewProps {
    ticker: string;
    onBack: () => void;
    onViewTransactions: (ticker: string) => void;
}

// Skeleton for loading state
const IndicatorSkeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse">
        {[1, 2].map((group) => (
            <div key={group}>
                <div className="h-4 bg-[var(--bg-tertiary-hover)] rounded w-1/3 mb-3"></div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="h-20 bg-[var(--bg-tertiary-hover)] rounded-xl"></div>
                    <div className="h-20 bg-[var(--bg-tertiary-hover)] rounded-xl"></div>
                    <div className="h-20 bg-[var(--bg-tertiary-hover)] rounded-xl"></div>
                </div>
            </div>
        ))}
    </div>
);

const MetricItem: React.FC<{ label: string; value: string | number; subValue?: string; highlight?: 'green' | 'red' | 'neutral'; className?: string; style?: React.CSSProperties; }> = ({ label, value, subValue, highlight, className, style }) => {
    let valueColor = 'text-[var(--text-primary)]';
    if (highlight === 'green') valueColor = 'text-[var(--green-text)]';
    if (highlight === 'red') valueColor = 'text-[var(--red-text)]';

    return (
        <div style={style} className={`p-3.5 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] flex flex-col justify-center shadow-sm hover:border-[var(--accent-color)]/30 transition-colors ${className}`}>
             <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold mb-1.5">{label}</span>
             <div className="flex items-baseline gap-1">
                <span className={`text-lg font-extrabold leading-none tracking-tight ${valueColor}`}>{value}</span>
                {subValue && <span className="text-xs font-medium text-[var(--text-secondary)] translate-y-[1px]">{subValue}</span>}
             </div>
        </div>
    );
};

const AssetDetailView: React.FC<AssetDetailViewProps> = ({ ticker, onBack, onViewTransactions }) => {
    const { t, formatCurrency, locale } = useI18n();
    const { getAssetByTicker, transactions, refreshSingleAsset } = usePortfolio();
    const [activeTab, setActiveTab] = useState('summary');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<string | null>(null);
    
    // Obter ativo do contexto
    const asset = getAssetByTicker(ticker);

    // Efeito para buscar dados se estiverem faltando ou desatualizados ao entrar
    useEffect(() => {
        const checkAndLoad = async () => {
            // Força a busca se não tiver histórico, pois a API pode ter mudado
            if (!asset || !asset.dividendsHistory || asset.dividendsHistory.length === 0) {
                setIsRefreshing(true);
                try {
                    await refreshSingleAsset(ticker, true);
                } catch (e) {
                    console.error("Erro ao atualizar ativo:", e);
                } finally {
                    setIsRefreshing(false);
                }
            }
        };
        checkAndLoad();
    }, [ticker, refreshSingleAsset, asset]); 

    const handleRefresh = useCallback(async () => {
        if (isRefreshing) return;
        vibrate();
        setIsRefreshing(true);
        try {
            await refreshSingleAsset(ticker, true); // Force refresh
        } catch (error) {
            console.error("Failed to refresh asset details:", error);
        } finally {
            setIsRefreshing(false);
        }
    }, [ticker, refreshSingleAsset, isRefreshing]);

    const assetTransactions = useMemo(() => {
        return transactions.filter(tx => tx.ticker === ticker).sort((a, b) => b.date.localeCompare(a.date));
    }, [transactions, ticker]);

    // Lógica principal: Calcular histórico com base na posse do ativo
    const fullDividendHistory = useMemo(() => {
        const history = asset?.dividendsHistory || [];
        if (history.length === 0) return [];
        
        // 1. Obter transações em ordem cronológica (antiga -> nova)
        const sortedTransactions = transactions
            .filter(t => t.ticker === ticker)
            .sort((a,b) => a.date.localeCompare(b.date));
            
        // Se nunca comprou, não mostra nada (filtro "desde a compra")
        if (sortedTransactions.length === 0) return [];

        const firstPurchaseDate = sortedTransactions[0].date;

        // 2. Ordenar dividendos por Data de Pagamento (mais recente -> mais antiga) para exibição
        const dividendsSorted = [...history].sort((a,b) => b.paymentDate.localeCompare(a.paymentDate));

        // 3. Processar e Filtrar
        // Filtra APENAS eventos que aconteceram DEPOIS (ou no dia) da primeira compra
        const processed = dividendsSorted
            .filter(div => div.exDate >= firstPurchaseDate) 
            .map(div => {
                let qty = 0;
                // Replay das transações até a Data Com (inclusive)
                for(const tx of sortedTransactions) {
                    if (tx.date > div.exDate) break; // Transação posterior à data de corte, para.
                    
                    if (tx.type === 'Compra') qty += tx.quantity;
                    else qty -= tx.quantity;
                }
                
                const userQty = Math.max(0, qty);
                
                return {
                    ...div,
                    userQuantity: userQty,
                    totalReceived: userQty * div.value,
                    isReceived: userQty > 0
                };
            });

        return processed;
    }, [asset?.dividendsHistory, transactions, ticker]);

    const displayedDividends = useMemo(() => {
        return showAllHistory ? fullDividendHistory : fullDividendHistory.slice(0, 5);
    }, [fullDividendHistory, showAllHistory]);

    // --- Metrics Calculation ---
    const today = new Date();
    const currentYear = today.getFullYear();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(currentYear - 1);

    const totalDividendsReceived = useMemo(() => {
        return fullDividendHistory.reduce((acc, div) => acc + div.totalReceived, 0);
    }, [fullDividendHistory]);

    const totalYTD = useMemo(() => {
        return fullDividendHistory
            .filter(d => new Date(d.paymentDate).getFullYear() === currentYear)
            .reduce((acc, div) => acc + div.totalReceived, 0);
    }, [fullDividendHistory, currentYear]);

    const averageMonthly = useMemo(() => {
        const last12m = fullDividendHistory.filter(d => new Date(d.paymentDate) >= oneYearAgo);
        const total = last12m.reduce((acc, div) => acc + div.totalReceived, 0);
        return last12m.length > 0 ? total / 12 : 0;
    }, [fullDividendHistory, oneYearAgo]);

    if (!asset && !isRefreshing) {
        return (
            <div className="p-4">
                <div className="flex items-center mb-6">
                     <button onClick={onBack} className="p-2 -ml-2 mr-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary-hover)]"><ChevronLeftIcon className="w-6 h-6" /></button>
                     <h2 className="text-2xl font-bold">{t('error')}</h2>
                </div>
                <p>{t('asset_not_found')}</p>
            </div>
        );
    }
    
    // Dados para o Summary Tab
    const currentValue = asset ? asset.quantity * asset.currentPrice : 0;
    const totalInvested = asset ? asset.quantity * asset.avgPrice : 0;
    const variation = currentValue - totalInvested;
    const variationPercent = totalInvested > 0 ? (variation / totalInvested) * 100 : 0;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'summary':
                return (
                    <div className="space-y-4">
                        <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('current_position')}</p>
                                    <p className="text-3xl font-bold text-[var(--text-primary)]">{formatCurrency(currentValue)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('result')}</p>
                                    <div className={`text-lg font-bold flex items-center justify-end gap-1 ${variation >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                                        {variation >= 0 ? '+' : ''}{formatCurrency(variation)}
                                    </div>
                                    <span className={`text-xs font-semibold ${variation >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                                        ({variationPercent.toFixed(2)}%)
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm">
                             <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-[var(--accent-color)]/10 rounded-lg text-[var(--accent-color)]">
                                    <AnalysisIcon className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-lg">{t('key_indicators')}</h3>
                             </div>
                             
                             {!asset ? <IndicatorSkeleton /> : (
                                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <MetricItem label={t('quantity')} value={asset.quantity} />
                                    <MetricItem label={t('avg_price')} value={formatCurrency(asset.avgPrice)} />
                                    <MetricItem label={t('current_price')} value={formatCurrency(asset.currentPrice)} />
                                    <MetricItem label="Total Investido" value={formatCurrency(asset.quantity * asset.avgPrice)} className="sm:col-span-1" />
                                    <MetricItem label="Saldo Atual" value={formatCurrency(asset.quantity * asset.currentPrice)} highlight={variation >= 0 ? 'green' : 'red'} />
                                    <MetricItem label={t('result')} value={formatCurrency(variation)} subValue={`(${variationPercent.toFixed(2)}%)`} highlight={variation >= 0 ? 'green' : 'red'} />
                                    <div className="col-span-2 sm:col-span-3 mt-4 mb-1 flex items-center gap-2">
                                        <div className="h-px flex-1 bg-[var(--border-color)] opacity-50"></div>
                                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('nav_analysis')} & {t('data')}</span>
                                        <div className="h-px flex-1 bg-[var(--border-color)] opacity-50"></div>
                                    </div>
                                    <MetricItem label={t('dy_12m')} value={asset.dy?.toFixed(2) ?? '-'} subValue="%" highlight={asset.dy && asset.dy > 10 ? 'green' : undefined} />
                                    <MetricItem label={t('yield_on_cost')} value={asset.yieldOnCost?.toFixed(2) ?? '-'} subValue="%" highlight={asset.yieldOnCost && asset.yieldOnCost > 8 ? 'green' : undefined} />
                                    <MetricItem label={t('pvp')} value={asset.pvp?.toFixed(2) ?? '-'} highlight={asset.pvp && asset.pvp < 1.0 ? 'green' : (asset.pvp && asset.pvp > 1.2 ? 'red' : 'neutral')} />
                                    <MetricItem label={t('vacancy')} value={asset.vacancyRate?.toFixed(1) ?? '0'} subValue="%" />
                                    <MetricItem label={t('shareholders')} value={asset.shareholders ? (asset.shareholders/1000).toFixed(1) + 'k' : '-'} />
                                    <MetricItem label={t('daily_liquidity')} value={asset.liquidity ? (asset.liquidity/1000000).toFixed(1) + 'M' : '-'} />
                                </div>
                             )}
                        </div>
                        <button onClick={() => asset && onViewTransactions(asset.ticker)} className="w-full bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-3.5 rounded-xl shadow-lg shadow-[var(--accent-color)]/20 hover:shadow-[var(--accent-color)]/40 active:scale-[0.98] transition-all">
                            {t('view_transactions')}
                        </button>
                    </div>
                );
            case 'history':
                return (
                    <div className="space-y-3 pb-4">
                        {assetTransactions.length > 0 ? assetTransactions.map((tx, index) => (
                            <div key={tx.id} className="bg-[var(--bg-secondary)] p-4 rounded-xl text-sm border border-[var(--border-color)] shadow-sm animate-fade-in-up" style={{ animationDelay: `${index * 50}ms`}}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className={`font-bold text-base mb-0.5 ${tx.type === 'Compra' ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>{t(tx.type === 'Compra' ? 'buy' : 'sell')}</p>
                                        <p className="text-xs text-[var(--text-secondary)] font-medium">{new Date(tx.date).toLocaleDateString(locale, { timeZone: 'UTC' })}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-[var(--text-primary)]">{formatCurrency(tx.quantity * tx.price)}</p>
                                        <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">{`${tx.quantity} × ${formatCurrency(tx.price)}`}</p>
                                    </div>
                                </div>
                            </div>
                        )) : <p className="text-sm text-center text-[var(--text-secondary)] py-12">{t('no_transactions_for_asset')}</p>}
                    </div>
                );
            case 'dividends':
                 return (
                    <div className="space-y-4 pb-4 animate-fade-in">
                        {isRefreshing && fullDividendHistory.length === 0 ? (
                            <div className="flex justify-center py-8"><span className="loading loading-spinner text-[var(--accent-color)]"></span></div>
                        ) : fullDividendHistory.length > 0 ? (
                            <>
                                {/* Gráfico de Barras: Valor Recebido por Cota */}
                                <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)] shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-bold text-sm text-[var(--text-primary)]">Valor por Cota</h3>
                                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Histórico</span>
                                    </div>
                                    <DividendChart data={fullDividendHistory} />
                                </div>
                                
                                {/* Cards de Resumo */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)] flex justify-between items-center shadow-sm">
                                        <div>
                                            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">{t('total_dividends_received')}</span>
                                            <span className="text-2xl font-black text-[var(--green-text)]">{formatCurrency(totalDividendsReceived)}</span>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-[var(--green-text)]/10 flex items-center justify-center text-[var(--green-text)]">
                                            <span className="font-bold text-lg">$</span>
                                        </div>
                                    </div>
                                    <MetricItem label={t('total_year', { year: currentYear })} value={formatCurrency(totalYTD)} className="bg-[var(--bg-secondary)]" />
                                    <MetricItem label="Média (12m)" value={formatCurrency(averageMonthly)} className="bg-[var(--bg-secondary)]" />
                                </div>

                                {/* Lista Detalhada do Histórico */}
                                <h3 className="font-bold text-sm text-[var(--text-secondary)] mt-2 px-1 uppercase tracking-wider">
                                    {showAllHistory ? t('full_history') : t('recent_dividends')}
                                </h3>
                                
                                <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
                                    {displayedDividends.map((div, index) => {
                                        return (
                                            <div 
                                                key={`${div.exDate}-${index}`} 
                                                className={`p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${index !== displayedDividends.length - 1 ? 'border-b border-[var(--border-color)]' : ''} ${selectedHistoryItem === div.exDate ? 'bg-[var(--bg-tertiary-hover)]' : ''} ${!div.isReceived ? 'opacity-60 bg-[var(--bg-primary)]/30' : ''}`}
                                                onClick={() => { setSelectedHistoryItem(div.exDate); vibrate(); }}
                                            >
                                                {/* Left Side: Dates and Base Value */}
                                                <div className="flex flex-col gap-1.5">
                                                    {/* Data de Pagamento em Destaque */}
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--bg-primary)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                                                            PAGAMENTO
                                                        </span>
                                                        <span className="font-bold text-sm text-[var(--text-primary)]">
                                                            {new Date(div.paymentDate).toLocaleDateString(locale, { timeZone: 'UTC' })}
                                                        </span>
                                                        {div.isReceived && <span className="w-2 h-2 rounded-full bg-[var(--green-text)] ml-auto sm:ml-0"></span>}
                                                    </div>
                                                    
                                                    {/* Data Com e Valor por Cota */}
                                                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                        <span>Data Com: <b>{new Date(div.exDate).toLocaleDateString(locale, { day:'2-digit', month:'2-digit', year:'2-digit', timeZone: 'UTC' })}</b></span>
                                                        <span className="w-1 h-1 rounded-full bg-[var(--border-color)]"></span>
                                                        <span>Base: <b>{formatCurrency(div.value)}</b></span>
                                                    </div>
                                                </div>

                                                {/* Right Side: User Gain */}
                                                <div className="flex flex-row sm:flex-col justify-between items-center sm:items-end border-t sm:border-t-0 border-[var(--border-color)]/50 pt-2 sm:pt-0 mt-1 sm:mt-0">
                                                    <span className="text-[10px] text-[var(--text-secondary)] sm:hidden">Recebido</span>
                                                    {div.isReceived ? (
                                                        <div className="text-right">
                                                            <p className="font-bold text-[var(--green-text)] text-sm">{formatCurrency(div.totalReceived)}</p>
                                                            <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5">{div.userQuantity} cotas</p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-[var(--text-secondary)] border border-[var(--border-color)] px-2 py-1 rounded-md">
                                                            Sem Saldo na Data Com
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                {!showAllHistory && fullDividendHistory.length > 5 && (
                                    <button onClick={() => { vibrate(); setShowAllHistory(true); }} className="w-full py-3 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--accent-color)] hover:bg-[var(--bg-secondary)] rounded-xl border border-dashed border-[var(--border-color)] transition-all">
                                        {t('view_full_history')} ({fullDividendHistory.length})
                                    </button>
                                )}
                                {showAllHistory && (<button onClick={() => { vibrate(); setShowAllHistory(false); }} className="w-full py-3 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">{t('show_less')}</button>)}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-secondary)]">
                                <div className="w-16 h-16 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-3 border border-[var(--border-color)] opacity-50">
                                    <span className="text-2xl font-bold">$</span>
                                </div>
                                <p className="text-sm font-medium mb-2">Sem histórico desde a compra.</p>
                                <button onClick={handleRefresh} className="text-xs text-[var(--accent-color)] font-bold hover:underline">
                                    Tentar Atualizar
                                </button>
                            </div>
                        )}
                    </div>
                );
            default: return null;
        }
    }


    return (
        <div className="p-4 pb-20 landscape-pb-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <button 
                            onClick={onBack} 
                            className="p-2 -ml-2 mr-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary-hover)] transition-all duration-200 active:scale-95"
                            aria-label={t('back')}
                        >
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                        <h2 className="text-2xl font-bold tracking-tight">{ticker}</h2>
                    </div>
                    <button onClick={handleRefresh} disabled={isRefreshing} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95">
                        <RefreshIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                
                <div className="flex border-b border-[var(--border-color)] mb-4">
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`pb-2 px-4 text-sm font-bold transition-colors ${activeTab === 'summary' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        {t('summary')}
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`pb-2 px-4 text-sm font-bold transition-colors ${activeTab === 'history' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        {t('history')}
                    </button>
                     <button
                        onClick={() => setActiveTab('dividends')}
                        className={`pb-2 px-4 text-sm font-bold transition-colors ${activeTab === 'dividends' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        {t('dividends_received')}
                    </button>
                </div>
                
                <div key={activeTab} className="animate-fade-in">
                    {renderTabContent()}
                </div>
            </div>
        </div>
    );
};

export default AssetDetailView;
