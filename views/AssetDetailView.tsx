
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

// Helper para barras de progresso (P/VP e Vacância)
const ProgressBar: React.FC<{ value: number; max: number; label?: string; colorClass: string; inverse?: boolean }> = ({ value, max, label, colorClass, inverse }) => {
    let percent = (value / max) * 100;
    if (percent > 100) percent = 100;
    
    // Se inverse=true (ex: Vacância), quanto menor melhor.
    // Se não (ex: P/VP), usamos lógica de range.
    
    return (
        <div className="w-full mt-1.5">
            {label && <div className="flex justify-between text-[9px] text-[var(--text-secondary)] mb-0.5"><span>{label}</span><span>{value.toFixed(1)}%</span></div>}
            <div className="h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden border border-[var(--border-color)]">
                <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
};

const GroupHeader: React.FC<{ title: string }> = ({ title }) => (
    <h4 className="col-span-full text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-4 mb-2 border-b border-[var(--border-color)] pb-1">{title}</h4>
);

const IndicatorItem: React.FC<{ label: string; value: string; subtext?: React.ReactNode }> = ({ label, value, subtext }) => (
    <div className="flex flex-col">
        <span className="text-[10px] text-[var(--text-secondary)] font-medium mb-0.5">{label}</span>
        <span className="text-sm font-bold text-[var(--text-primary)]">{value}</span>
        {subtext}
    </div>
);

const AssetDetailView: React.FC<AssetDetailViewProps> = ({ ticker, onBack, onViewTransactions }) => {
    const { t, formatCurrency, locale } = useI18n();
    const { getAssetByTicker, transactions, refreshSingleAsset } = usePortfolio();
    const [activeTab, setActiveTab] = useState('summary');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showAllHistory, setShowAllHistory] = useState(false);
    
    const asset = getAssetByTicker(ticker);

    useEffect(() => {
        const checkAndLoad = async () => {
            const isStale = !asset?.lastUpdated || (Date.now() - asset.lastUpdated > 5 * 60 * 1000);
            if (isStale && (!asset || !asset.dividendsHistory || asset.dividendsHistory.length === 0)) {
                setIsRefreshing(true);
                try {
                    await refreshSingleAsset(ticker, true);
                } finally {
                    setIsRefreshing(false);
                }
            }
        };
        checkAndLoad();
    }, [ticker, refreshSingleAsset, asset?.lastUpdated]); 

    const handleRefresh = useCallback(async () => {
        if (isRefreshing) return;
        vibrate();
        setIsRefreshing(true);
        try {
            await refreshSingleAsset(ticker, true);
        } finally {
            setIsRefreshing(false);
        }
    }, [ticker, refreshSingleAsset, isRefreshing]);

    const assetTransactions = useMemo(() => {
        return transactions.filter(tx => tx.ticker === ticker).sort((a, b) => b.date.localeCompare(a.date));
    }, [transactions, ticker]);

    // Lógica Dividendos
    const fullDividendHistory = useMemo(() => {
        const history = asset?.dividendsHistory || [];
        if (history.length === 0) return [];
        
        const txs = transactions.filter(t => t.ticker === ticker).sort((a,b) => a.date.localeCompare(b.date));
        const historySorted = [...history].sort((a,b) => b.paymentDate.localeCompare(a.paymentDate));

        if (txs.length === 0) {
             return historySorted.map(div => ({ ...div, userQuantity: 0, totalReceived: 0, isReceived: false }));
        }

        const firstPurchaseDate = txs[0].date;
        let processedHistory = historySorted.map(div => {
            let qty = 0;
            for(const tx of txs) {
                if (tx.date >= div.exDate) break;
                if (tx.type === 'Compra') qty += tx.quantity;
                else qty -= tx.quantity;
            }
            const userQty = Math.max(0, qty);
            return { ...div, userQuantity: userQty, totalReceived: userQty * div.value, isReceived: userQty > 0 };
        });

        if (firstPurchaseDate) {
            processedHistory = processedHistory.filter(div => div.exDate >= firstPurchaseDate || div.isProvisioned);
        }
        return processedHistory;
    }, [asset?.dividendsHistory, transactions, ticker]);

    // Metrics
    const currentValue = asset ? asset.quantity * asset.currentPrice : 0;
    const totalInvested = asset ? asset.quantity * asset.avgPrice : 0;
    const variation = currentValue - totalInvested;
    const variationPercent = totalInvested > 0 ? (variation / totalInvested) * 100 : 0;

    if (!asset && !isRefreshing) return <div className="p-8 text-center">{t('asset_not_found')}</div>;

    const renderSummary = () => (
        <div className="space-y-4 animate-fade-in">
            {/* Position Card */}
            <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('current_position')}</p>
                        <p className="text-3xl font-black text-[var(--text-primary)] tracking-tight">{formatCurrency(currentValue)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('result')}</p>
                        <div className={`text-lg font-bold ${variation >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                            {variation >= 0 ? '+' : ''}{formatCurrency(variation)}
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border-color)]">
                    <IndicatorItem label={t('quantity')} value={asset.quantity.toString()} />
                    <IndicatorItem label={t('avg_price')} value={formatCurrency(asset.avgPrice)} />
                </div>
            </div>

            {/* NEW KEY INDICATORS LAYOUT */}
            <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <AnalysisIcon className="w-4 h-4 text-[var(--accent-color)]" />
                    <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wide">Indicadores Chave</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {/* Valuation Group */}
                    <GroupHeader title="Preço & Valuation" />
                    <IndicatorItem label="Cotação Atual" value={formatCurrency(asset.currentPrice)} />
                    <div className="flex flex-col">
                        <IndicatorItem label="P/VP" value={asset.pvp?.toFixed(2) || '-'} />
                        {asset.pvp && (
                            <ProgressBar 
                                value={asset.pvp * 100} 
                                max={150} 
                                colorClass={asset.pvp < 1 ? 'bg-[var(--green-text)]' : (asset.pvp > 1.2 ? 'bg-[var(--red-text)]' : 'bg-yellow-500')} 
                            />
                        )}
                    </div>

                    {/* Income Group */}
                    <GroupHeader title="Renda & Dividendos" />
                    <IndicatorItem label="Dividend Yield (12m)" value={`${asset.dy?.toFixed(2) || '-'}%`} />
                    <IndicatorItem label="Yield on Cost" value={`${asset.yieldOnCost?.toFixed(2) || '-'}%`} subtext={<span className="text-[9px] text-[var(--text-secondary)] opacity-70">Pessoal</span>} />
                    <IndicatorItem label="Último Rendimento" value={formatCurrency(asset.lastDividend || 0)} />
                    <IndicatorItem label="Próx. Pagamento" value={asset.nextPaymentDate ? new Date(asset.nextPaymentDate).toLocaleDateString(locale, {day:'2-digit', month:'short'}) : '-'} />

                    {/* Quality Group */}
                    <GroupHeader title="Qualidade & Liquidez" />
                    <div className="flex flex-col">
                        <IndicatorItem label="Vacância Física" value={asset.vacancyRate !== undefined ? `${asset.vacancyRate}%` : '-'} />
                        {asset.vacancyRate !== undefined && (
                            <ProgressBar value={asset.vacancyRate} max={30} colorClass="bg-[var(--red-text)]" inverse />
                        )}
                    </div>
                    <IndicatorItem label="Liquidez Diária" value={asset.liquidity ? `R$ ${(asset.liquidity/1000000).toFixed(1)}M` : '-'} />
                    <IndicatorItem label="Nº Cotistas" value={asset.shareholders ? `${(asset.shareholders/1000).toFixed(0)}k` : '-'} />
                    <IndicatorItem label="Gestão" value={asset.administrator || '-'} />
                </div>
            </div>

            <button onClick={() => asset && onViewTransactions(asset.ticker)} className="w-full bg-[var(--bg-tertiary-hover)] text-[var(--text-primary)] font-bold py-3 rounded-xl border border-[var(--border-color)] hover:bg-[var(--accent-color)]/10 hover:border-[var(--accent-color)] transition-all">
                {t('view_transactions')}
            </button>
        </div>
    );

    const renderHistory = () => (
        <div className="space-y-3 pb-4">
            {assetTransactions.length > 0 ? assetTransactions.map((tx, index) => (
                <div key={tx.id} className="bg-[var(--bg-secondary)] p-4 rounded-xl text-sm border border-[var(--border-color)] shadow-sm flex justify-between items-center">
                    <div>
                        <p className={`font-bold text-base mb-0.5 ${tx.type === 'Compra' ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>{t(tx.type === 'Compra' ? 'buy' : 'sell')}</p>
                        <p className="text-xs text-[var(--text-secondary)] font-medium">{new Date(tx.date).toLocaleDateString(locale, { timeZone: 'UTC' })}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-[var(--text-primary)]">{formatCurrency(tx.quantity * tx.price)}</p>
                        <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">{`${tx.quantity} × ${formatCurrency(tx.price)}`}</p>
                    </div>
                </div>
            )) : <p className="text-center py-12 text-[var(--text-secondary)]">{t('no_transactions_for_asset')}</p>}
        </div>
    );

    const renderDividends = () => (
        <div className="space-y-4 pb-4">
            {fullDividendHistory.length > 0 ? (
                <>
                    <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)] shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-sm text-[var(--text-primary)]">Histórico de Pagamentos</h3>
                        </div>
                        <DividendChart data={asset?.dividendsHistory || []} />
                    </div>
                    
                    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] overflow-hidden">
                        {(showAllHistory ? fullDividendHistory : fullDividendHistory.slice(0, 5)).map((div, index) => (
                            <div key={`${div.exDate}-${index}`} className="p-4 border-b border-[var(--border-color)] last:border-0 flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${div.isProvisioned ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                                            {div.isProvisioned ? 'Futuro' : 'Pago'}
                                        </span>
                                        <span className="text-xs font-bold text-[var(--text-primary)]">{new Date(div.paymentDate).toLocaleDateString(locale, {timeZone:'UTC'})}</span>
                                    </div>
                                    <span className="text-xs text-[var(--text-secondary)]">Data Com: {new Date(div.exDate).toLocaleDateString(locale, {day:'2-digit', month:'2-digit', year:'2-digit', timeZone:'UTC'})}</span>
                                </div>
                                <div className="text-right">
                                    <span className={`block font-bold ${div.isReceived || div.isProvisioned ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] opacity-50'}`}>
                                        {formatCurrency(div.totalReceived)}
                                    </span>
                                    <span className="text-[10px] text-[var(--text-secondary)]">{formatCurrency(div.value)} / cota</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {fullDividendHistory.length > 5 && (
                        <button onClick={() => setShowAllHistory(!showAllHistory)} className="w-full py-3 text-xs font-bold text-[var(--text-secondary)] border border-[var(--border-color)] rounded-xl">
                            {showAllHistory ? t('show_less') : `${t('view_full_history')} (${fullDividendHistory.length})`}
                        </button>
                    )}
                </>
            ) : (
                <div className="text-center py-12 text-[var(--text-secondary)]">Sem histórico.</div>
            )}
        </div>
    );

    return (
        <div className="p-4 pb-20 landscape-pb-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <button onClick={onBack} className="p-2 -ml-2 mr-2 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary-hover)]"><ChevronLeftIcon className="w-6 h-6" /></button>
                        <h2 className="text-2xl font-bold tracking-tight">{ticker}</h2>
                    </div>
                    <button onClick={handleRefresh} disabled={isRefreshing} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)]">
                        <RefreshIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                
                <div className="flex border-b border-[var(--border-color)] mb-4">
                    {['summary', 'history', 'dividends'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); vibrate(); }}
                            className={`pb-2 px-4 text-sm font-bold transition-colors ${activeTab === tab ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`}
                        >
                            {t(tab === 'dividends' ? 'dividends_received' : tab)}
                        </button>
                    ))}
                </div>
                
                {activeTab === 'summary' && renderSummary()}
                {activeTab === 'history' && renderHistory()}
                {activeTab === 'dividends' && renderDividends()}
            </div>
        </div>
    );
};

export default AssetDetailView;
