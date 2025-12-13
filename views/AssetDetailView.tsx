
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import RefreshIcon from '../components/icons/RefreshIcon';
import AnalysisIcon from '../components/icons/AnalysisIcon';
import DividendChart from '../components/charts/DividendChart';
import CountUp from '../components/CountUp';
import { vibrate } from '../utils';
import type { ToastMessage } from '../types';

interface AssetDetailViewProps {
    ticker: string;
    onBack: () => void;
    onViewTransactions: (ticker: string) => void;
    addToast: (message: string, type?: ToastMessage['type']) => void;
}

// Sub-components for cleaner render logic
const ProgressBar: React.FC<{ value: number; max: number; label?: string; colorClass: string; inverse?: boolean }> = ({ value, max, label, colorClass, inverse }) => {
    let percent = (value / max) * 100;
    if (percent > 100) percent = 100;
    
    return (
        <div className="w-full mt-1.5">
            {label && <div className="flex justify-between text-[9px] text-[var(--text-secondary)] mb-0.5"><span>{label}</span><span>{value.toFixed(1)}%</span></div>}
            <div className="h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden border border-[var(--border-color)]">
                <div className={`h-full rounded-full transition-all duration-500 ease-out ${colorClass}`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
};

const GroupHeader: React.FC<{ title: string }> = ({ title }) => (
    <h4 className="col-span-full text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-4 mb-2 border-b border-[var(--border-color)] pb-1">{title}</h4>
);

const IndicatorItem: React.FC<{ label: string; value: string; subtext?: React.ReactNode }> = ({ label, value, subtext }) => (
    <div className="flex flex-col p-2 rounded-lg hover:bg-[var(--bg-tertiary-hover)] transition-colors">
        <span className="text-[10px] text-[var(--text-secondary)] font-medium mb-0.5 uppercase tracking-wide opacity-80">{label}</span>
        <span className="text-sm font-bold text-[var(--text-primary)] truncate">{value}</span>
        {subtext}
    </div>
);

const AssetDetailView: React.FC<AssetDetailViewProps> = ({ ticker, onBack, onViewTransactions, addToast }) => {
    const { t, formatCurrency, locale } = useI18n();
    const { getAssetByTicker, transactions, refreshSingleAsset } = usePortfolio();
    const [activeTab, setActiveTab] = useState('summary');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showAllHistory, setShowAllHistory] = useState(false);
    
    const asset = getAssetByTicker(ticker);

    // Initial Data Check
    useEffect(() => {
        let isMounted = true;
        const checkAndLoad = async () => {
            // If asset exists but lacks deep data, or simply to ensure freshness
            if (asset) {
                setIsRefreshing(true);
                try {
                    await refreshSingleAsset(ticker);
                } catch(e: any){
                    // Silent catch
                } finally {
                    if (isMounted) setIsRefreshing(false);
                }
            }
        };
        checkAndLoad();
        return () => { isMounted = false; };
    }, [ticker]); 

    const handleRefresh = useCallback(async () => {
        if (isRefreshing) return;
        vibrate();
        setIsRefreshing(true);
        addToast(t('toast_updating_prices'));
        try {
            await refreshSingleAsset(ticker, true);
            addToast(t('toast_update_success'), 'success');
        } catch (e: any) {
            addToast(e.message, 'error');
        } finally {
            setIsRefreshing(false);
        }
    }, [ticker, refreshSingleAsset, isRefreshing, addToast, t]);

    const assetTransactions = useMemo(() => {
        return transactions.filter(tx => tx.ticker === ticker).sort((a, b) => b.date.localeCompare(a.date));
    }, [transactions, ticker]);

    const fullDividendHistory = useMemo(() => {
        return (asset?.dividendsHistory || []).sort((a,b) => b.paymentDate.localeCompare(a.paymentDate));
    }, [asset?.dividendsHistory]);

    const currentValue = asset ? asset.quantity * asset.currentPrice : 0;
    const totalInvested = asset ? asset.quantity * asset.avgPrice : 0;
    const variation = currentValue - totalInvested;

    // --- Render Helpers ---

    if (!asset && !isRefreshing) return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-[var(--text-secondary)]">
            <p className="mb-4">{t('asset_not_found')}</p>
            <button onClick={onBack} className="text-[var(--accent-color)] font-bold">Voltar</button>
        </div>
    );

    if (!asset) return <div className="h-full w-full bg-[var(--bg-primary)]"></div>;

    const renderSummary = () => (
        <div className="space-y-4 animate-fade-in">
            {/* Main Value Card */}
            <div className="bg-gradient-to-br from-[var(--bg-tertiary-hover)] to-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-lg shadow-[var(--accent-color)]/5">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('current_position')}</p>
                        <p className="text-4xl font-black text-[var(--text-primary)] tracking-tighter">
                            <CountUp end={currentValue} formatter={formatCurrency} />
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('result')}</p>
                        <div className={`text-xl font-bold ${variation >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                            {variation >= 0 ? '+' : ''}
                            <CountUp end={Math.abs(variation)} formatter={formatCurrency} />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border-color)]/50">
                    <IndicatorItem label={t('quantity')} value={asset.quantity.toString()} />
                    <IndicatorItem label={t('avg_price')} value={formatCurrency(asset.avgPrice)} />
                </div>
            </div>

            {/* Indicators Grid */}
            <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <AnalysisIcon className="w-4 h-4 text-[var(--accent-color)]" />
                    <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wide">Indicadores Chave</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <GroupHeader title="Preço & Valuation" />
                    <IndicatorItem label="Cotação Atual" value={formatCurrency(asset.currentPrice)} />
                    <div className="flex flex-col p-2">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-wide opacity-80">P/VP</span>
                            <span className="text-sm font-bold text-[var(--text-primary)]">{asset.pvp?.toFixed(2) || '-'}</span>
                        </div>
                        {asset.pvp && (
                            <ProgressBar 
                                value={asset.pvp * 100} 
                                max={150} 
                                colorClass={asset.pvp < 1 ? 'bg-[var(--green-text)]' : (asset.pvp > 1.2 ? 'bg-[var(--red-text)]' : 'bg-yellow-500')} 
                            />
                        )}
                    </div>

                    <GroupHeader title="Renda & Dividendos" />
                    <IndicatorItem label="Dividend Yield (12m)" value={`${asset.dy?.toFixed(2) || '-'}%`} />
                    <IndicatorItem label="Yield on Cost" value={`${asset.yieldOnCost?.toFixed(2) || '-'}%`} subtext={<span className="text-[9px] text-[var(--text-secondary)] opacity-70">Pessoal</span>} />
                    <IndicatorItem label="Último Rendimento" value={formatCurrency(asset.lastDividend || 0)} />
                    <IndicatorItem label="Próx. Pagamento" value={asset.nextPaymentDate ? new Date(asset.nextPaymentDate).toLocaleDateString(locale, {day:'2-digit', month:'short'}) : '-'} />

                    <GroupHeader title="Qualidade & Liquidez" />
                    <div className="flex flex-col p-2">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-wide opacity-80">Vacância Física</span>
                            <span className="text-sm font-bold text-[var(--text-primary)]">{asset.vacancyRate !== undefined ? `${asset.vacancyRate}%` : '-'}</span>
                        </div>
                        {asset.vacancyRate !== undefined && (
                            <ProgressBar value={asset.vacancyRate} max={30} colorClass="bg-[var(--red-text)]" inverse />
                        )}
                    </div>
                    <IndicatorItem label="Liquidez Diária" value={asset.liquidity ? `R$ ${(asset.liquidity/1000000).toFixed(1)}M` : '-'} />
                    <IndicatorItem label="Nº Cotistas" value={asset.shareholders ? `${(asset.shareholders/1000).toFixed(0)}k` : '-'} />
                    <IndicatorItem label="Gestão" value={asset.administrator || '-'} />
                </div>
            </div>

            <button onClick={() => onViewTransactions(asset.ticker)} className="w-full bg-[var(--bg-tertiary-hover)] text-[var(--text-primary)] font-bold py-3.5 rounded-xl border border-[var(--border-color)] hover:bg-[var(--accent-color)]/10 hover:border-[var(--accent-color)] active:scale-[0.98] transition-all shadow-sm">
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
                    <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)] shadow-sm h-64">
                        <DividendChart data={asset?.dividendsHistory || []} />
                    </div>
                    
                    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] overflow-hidden">
                        {(showAllHistory ? fullDividendHistory : fullDividendHistory.slice(0, 5)).map((div, index) => (
                            <div key={`${div.exDate}-${index}`} className="p-4 border-b border-[var(--border-color)] last:border-0 flex justify-between items-center hover:bg-[var(--bg-tertiary-hover)] transition-colors">
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
                                    <span className={`block font-bold text-[var(--text-primary)]`}>
                                        {formatCurrency(div.value)} <span className="text-[10px] text-[var(--text-secondary)]">/ cota</span>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {fullDividendHistory.length > 5 && (
                        <button onClick={() => setShowAllHistory(!showAllHistory)} className="w-full py-3 text-xs font-bold text-[var(--text-secondary)] border border-[var(--border-color)] rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] transition-colors">
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
        <div className="h-full flex flex-col bg-[var(--bg-primary)]">
            {/* Header Fixed */}
            <div className="flex-none p-4 sticky top-0 z-30 bg-[var(--bg-primary)]/90 backdrop-blur-md border-b border-[var(--border-color)]/50">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center">
                        <button onClick={onBack} className="p-2 -ml-2 mr-2 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary-hover)] transition-all active:scale-95"><ChevronLeftIcon className="w-6 h-6" /></button>
                        <h2 className="text-2xl font-bold tracking-tight">{ticker}</h2>
                    </div>
                    <button onClick={handleRefresh} disabled={isRefreshing} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] transition-all active:scale-95">
                        <RefreshIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                
                <div className="max-w-4xl mx-auto flex border-b border-[var(--border-color)] mt-4">
                    {['summary', 'history', 'dividends'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); vibrate(); }}
                            className={`flex-1 pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === tab ? 'text-[var(--accent-color)] border-[var(--accent-color)]' : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'}`}
                        >
                            {t(tab === 'dividends' ? 'dividends_received' : tab)}
                        </button>
                    ))}
                </div>
            </div>
            
            {/* Content Scrollable Area */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 pb-24 landscape-pb-6">
                <div className="max-w-4xl mx-auto">
                    {isRefreshing && activeTab === 'summary' && !asset ? <div className="animate-pulse h-96 bg-gray-800 rounded-xl"></div> : null}
                    {activeTab === 'summary' && asset && renderSummary()}
                    {activeTab === 'history' && renderHistory()}
                    {activeTab === 'dividends' && renderDividends()}
                </div>
            </div>
        </div>
    );
};

export default AssetDetailView;
