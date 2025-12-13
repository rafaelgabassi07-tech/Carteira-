
import { useMemo } from 'react';
import type { Asset, Transaction, MonthlyIncome, DividendHistoryEvent } from '../types';
import { calculatePortfolioMetrics, safeFloat } from '../utils';
import { STATIC_FII_SECTORS } from '../constants';

export interface PayerData {
    ticker: string;
    totalPaid: number;
    count: number;
    lastExDate?: string;
    nextPaymentDate?: string;
    isProvisioned?: boolean;
    yieldOnCost: number;
    averageMonthly: number;
    projectedAmount: number;
}

export const usePortfolioCalculations = (transactions: Transaction[], marketData: Record<string, any>) => {
    
    const metrics = useMemo(() => calculatePortfolioMetrics(transactions), [transactions]);

    const assets = useMemo(() => {
        return Object.keys(metrics).map(ticker => {
            const m = metrics[ticker];
            const data = marketData[ticker.toUpperCase()] || {};
            const avgPrice = m.quantity > 0 ? m.totalCost / m.quantity : 0;
            const curPrice = data.currentPrice || avgPrice;
            
            const histMap = new Map<string, DividendHistoryEvent>();
            (data.dividendsHistory || []).forEach((d: DividendHistoryEvent) => histMap.set(d.exDate, d));
            
            let segment = data.assetType || data.sector;
            if (!segment || segment === 'Outros') {
                segment = STATIC_FII_SECTORS[ticker.toUpperCase()];
            }
            if (!segment) segment = 'Outros';

            // Ensure YOC calculation is safe
            const dyVal = data.dy || 0;
            const yoc = avgPrice > 0 ? ((curPrice * (dyVal/100))/avgPrice)*100 : 0;

            return {
                ticker, 
                quantity: m.quantity, 
                avgPrice: safeFloat(avgPrice), 
                currentPrice: curPrice,
                priceHistory: data.priceHistory || [],
                dividendsHistory: Array.from(histMap.values()).sort((a,b) => b.exDate.localeCompare(a.exDate)),
                dy: data.dy, 
                pvp: data.pvp, 
                segment: segment,
                administrator: data.administrator, 
                vacancyRate: data.vacancyRate, 
                liquidity: data.dailyLiquidity,
                shareholders: data.shareholders, 
                yieldOnCost: safeFloat(yoc),
                nextPaymentDate: data.nextPaymentDate, 
                lastDividend: data.lastDividend,
                lastUpdated: data.lastUpdated,
                lastFundamentalUpdate: data.lastFundamentalUpdate,
                netWorth: data.netWorth,
                vpPerShare: data.vpPerShare,
                businessDescription: data.businessDescription,
                riskAssessment: data.riskAssessment,
                strengths: data.strengths,
                dividendCAGR: data.dividendCAGR,
                capRate: data.capRate,
                managementFee: data.managementFee
            };
        }).filter(a => a.quantity > 0.000001);
    }, [metrics, marketData]);

    const { monthlyIncome, payersData, totalReceived, fullIncomeHistory, annualDistribution } = useMemo(() => {
        let totalReceived = 0;
        const monthlyAggregation: Record<string, number> = {}; // Last 12 months for dashboard
        const fullHistoryAggregation: Record<string, number> = {}; // All time history for reports
        const annualDistribution: Record<string, Record<string, number>> = {}; // Year -> Ticker -> Amount
        const payerAggregation: Record<string, Partial<PayerData>> = {};
        
        const transactionsByTicker: Record<string, Transaction[]> = {};
        transactions.forEach(tx => {
            if (!transactionsByTicker[tx.ticker]) transactionsByTicker[tx.ticker] = [];
            transactionsByTicker[tx.ticker].push(tx);
        });
        Object.values(transactionsByTicker).forEach(list => list.sort((a, b) => a.date.localeCompare(b.date)));

        assets.forEach(asset => {
            const assetTxs = transactionsByTicker[asset.ticker] || [];
            if (assetTxs.length === 0) return;
            
            const projectedYearly = asset.dy ? (asset.quantity * asset.currentPrice * (asset.dy / 100)) : 0;
            const assetYoC = asset.avgPrice > 0 ? (projectedYearly / (asset.quantity * asset.avgPrice)) * 100 : 0;

            payerAggregation[asset.ticker] = { 
                ticker: asset.ticker, 
                yieldOnCost: safeFloat(assetYoC), 
                totalPaid: 0, 
                count: 0, 
                projectedAmount: 0 
            };

            const history = asset.dividendsHistory || [];
            history.forEach(div => {
                let qtyOwnedAtExDate = 0;
                for (const tx of assetTxs) {
                    if (tx.date >= div.exDate) break;
                    if (tx.type === 'Compra') qtyOwnedAtExDate += tx.quantity;
                    else qtyOwnedAtExDate -= tx.quantity;
                }
                
                qtyOwnedAtExDate = Math.max(0, qtyOwnedAtExDate);

                if (qtyOwnedAtExDate > 0) {
                    const amount = safeFloat(qtyOwnedAtExDate * div.value);
                    if (div.isProvisioned) {
                        payerAggregation[asset.ticker]!.projectedAmount = safeFloat(payerAggregation[asset.ticker]!.projectedAmount! + amount);
                    } else {
                        totalReceived = safeFloat(totalReceived + amount);
                        payerAggregation[asset.ticker]!.totalPaid = safeFloat(payerAggregation[asset.ticker]!.totalPaid! + amount);
                        payerAggregation[asset.ticker]!.count!++;
                        
                        const monthKey = div.paymentDate.substring(0, 7); 
                        
                        // For dashboard (Last 12 months check done later, just aggregating here)
                        monthlyAggregation[monthKey] = safeFloat((monthlyAggregation[monthKey] || 0) + amount);
                        
                        // For Full History
                        fullHistoryAggregation[monthKey] = safeFloat((fullHistoryAggregation[monthKey] || 0) + amount);

                        // For Annual Distribution (Yearly Reports)
                        const yearKey = div.paymentDate.substring(0, 4);
                        if (!annualDistribution[yearKey]) annualDistribution[yearKey] = {};
                        annualDistribution[yearKey][asset.ticker] = safeFloat((annualDistribution[yearKey][asset.ticker] || 0) + amount);
                    }
                }
            });

            const sortedHistory = [...history].sort((a,b) => b.exDate.localeCompare(a.exDate));
            const latestDiv = sortedHistory[0];
            const provisioned = sortedHistory.filter(d => d.isProvisioned).sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

            if (payerAggregation[asset.ticker]) {
                payerAggregation[asset.ticker]!.lastExDate = latestDiv?.exDate;
                payerAggregation[asset.ticker]!.isProvisioned = provisioned.length > 0;
                payerAggregation[asset.ticker]!.nextPaymentDate = provisioned.length > 0 ? provisioned[0].paymentDate : latestDiv?.paymentDate;
                const totalPaid = payerAggregation[asset.ticker]!.totalPaid!;
                const uniqueMonthsPaid = new Set(history.filter(d => !d.isProvisioned).map(d => d.paymentDate.substring(0,7))).size;
                payerAggregation[asset.ticker]!.averageMonthly = uniqueMonthsPaid > 0 ? safeFloat(totalPaid / uniqueMonthsPaid) : 0;
            }
        });
        
        const now = new Date();
        const monthlyData: MonthlyIncome[] = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyData.push({ month: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''), total: monthlyAggregation[key] || 0 });
        }
        
        return { 
            monthlyIncome: monthlyData, 
            payersData: Object.values(payerAggregation) as PayerData[], 
            totalReceived,
            fullIncomeHistory: fullHistoryAggregation,
            annualDistribution
        };
    }, [assets, transactions]);

    const { yieldOnCost, projectedAnnualIncome } = useMemo(() => {
        const totalInvested = assets.reduce((acc, a) => acc + (a.quantity * a.avgPrice), 0);
        const totalProjected = assets.reduce((acc, a) => acc + (a.quantity * a.currentPrice * ((a.dy || 0) / 100)), 0);
        const yoc = totalInvested > 0 ? (totalProjected / totalInvested) * 100 : 0;
        return { yieldOnCost: safeFloat(yoc), projectedAnnualIncome: safeFloat(totalProjected) };
    }, [assets]);

    return {
        assets,
        monthlyIncome,
        payersData,
        totalReceived,
        yieldOnCost,
        projectedAnnualIncome,
        fullIncomeHistory,
        annualDistribution
    };
};
