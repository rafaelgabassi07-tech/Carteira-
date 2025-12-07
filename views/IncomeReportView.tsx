import React, { useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import CountUp from '../components/CountUp';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import CalendarIcon from '../components/icons/CalendarIcon';
import PageHeader from '../components/PageHeader';
import { vibrate, fromISODate } from '../utils';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import ClockIcon from '../components/icons/ClockIcon';
import WalletIcon from '../components/icons/WalletIcon';
import type { DividendHistoryEvent, Transaction, Asset } from '../types';

// --- Types ---
interface MonthlyData {
    month: string;
    total: number;
    year: number;
    isoDate: string; // YYYY-MM
}

interface PayerData {
    ticker: string;
    totalPaid: number;
    count: number;
    lastExDate?: string;
    nextPaymentDate?: string;
    isProvisioned?: boolean;
    yieldOnCost: number;
    averageMonthly: number;
    projectedAmount?: number;
}

interface DividendStats {
    totalReceived: number;
    monthlyData: MonthlyData[];
    payersData: PayerData[];
    averageIncome: number;
    annualForecast: number;
    yieldOnCost: number;
}

// --- Logic Hook ---
const useDividendCalculations = (transactions: Transaction[], assets: Asset[]): DividendStats => {
    return useMemo(() => {
        let totalReceived = 0;
        let totalInvestedGlobal = 0;
        let annualForecast = 0;
        
        const monthlyAggregation: Record<string, number> = {}; 
        const payerAggregation: Record<string, PayerData> = {};

        const allTickers = Array.from(new Set(transactions.map(t => t.ticker)));

        allTickers.forEach((ticker) => {
            const assetData = assets.find(a => a.ticker === ticker);
            if (!assetData) return;

            const assetValue = assetData.quantity * assetData.currentPrice;
            const projectedYearly = assetData.dy ? assetValue * (assetData.dy / 100) : 0;
            annualForecast += projectedYearly;

            const assetTxs = transactions
                .filter(t => t.ticker === ticker)
                .sort((a, b) => a.date.localeCompare(b.date));
            
            if (assetTxs.length === 0) return;

            let assetTotalInvested = 0;
            let qtyAtEnd = 0;
            assetTxs.forEach(tx => {
                if (tx.type === 'Compra') {
                    assetTotalInvested += (tx.quantity * tx.price) + (tx.costs || 0);
                    qtyAtEnd += tx.quantity;
                } else {
                    const avgPrice = qtyAtEnd > 0 ? assetTotalInvested / qtyAtEnd : 0;
                    assetTotalInvested -= tx.quantity * avgPrice;
                    qtyAtEnd -= tx.quantity;
                }
            });
            totalInvestedGlobal += Math.max(0, assetTotalInvested);

            const history = assetData.dividendsHistory || [];
            let tickerTotalPaid = 0;
            let count = 0;
            
            const sortedHistory = [...history].sort((a, b) => b.exDate.localeCompare(a.exDate));
            const latestDividend = sortedHistory[0];
            
            let projectedAmount = 0;
            let hasProvisioned = false;
            let nextPaymentDate: string | undefined = undefined;

            const provisionedDividends = sortedHistory.filter(d => d.isProvisioned);
            if (provisionedDividends.length > 0) {
                hasProvisioned = true;
                nextPaymentDate = provisionedDividends.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))[0].paymentDate;

                provisionedDividends.forEach(provDiv => {
                    let qtyOwned = 0;
                    for (const tx of assetTxs) {
                        if (tx.date >= provDiv.exDate) break;
                        if (tx.type === 'Compra') qtyOwned += tx.quantity;
                        else if (tx.type === 'Venda') qtyOwned -= tx.quantity;
                    }
                    if (Math.max(0, qtyOwned) > 0) {
                        projectedAmount += Math.max(0, qtyOwned) * provDiv.value;
                    }
                });
            } else if (latestDividend) {
                nextPaymentDate = latestDividend.paymentDate;
            }

            sortedHistory.forEach((div: DividendHistoryEvent) => {
                if (div.exDate < assetTxs[0].date || div.isProvisioned) return;

                let qtyOwned = 0;
                for (const tx of assetTxs) {
                    if (tx.date >= div.exDate) break; 
                    if (tx.type === 'Compra') qtyOwned += tx.quantity;
                    else if (tx.type === 'Venda') qtyOwned -= tx.quantity;
                }
                
                if (Math.max(0, qtyOwned) > 0) {
                    const amount = Math.max(0, qtyOwned) * div.value;
                    totalReceived += amount;
                    tickerTotalPaid += amount;
                    count++;
                    const monthKey = div.paymentDate.substring(0, 7); 
                    monthlyAggregation[monthKey] = (monthlyAggregation[monthKey] || 0) + amount;
                }
            });
            
            const assetYoC = assetTotalInvested > 0 ? (projectedYearly / assetTotalInvested) * 100 : 0;

            payerAggregation[ticker] = {
                ticker, totalPaid: tickerTotalPaid, count,
                lastExDate: latestDividend?.exDate, nextPaymentDate, isProvisioned: hasProvisioned, yieldOnCost: assetYoC,
                averageMonthly: count > 0 ? tickerTotalPaid / Math.max(1, Math.min(count, 12)) : 0, projectedAmount,
            };
        });

        const now = new Date();
        const monthlyData: MonthlyData[] = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyData.push({
                isoDate: key,
                month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
                year: d.getFullYear(),
                total: monthlyAggregation[key] || 0,
            });
        }
        
        