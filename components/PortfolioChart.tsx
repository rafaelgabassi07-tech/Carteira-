import React, { useMemo } from 'react';
import type { Asset } from '../types';
import { useI18n } from '../contexts/I18nContext';

interface PortfolioChartProps {
    assets: Asset[];
    onBarClick: (ticker: string) => void;
    highlightedTicker: string | null;
}

const PortfolioChart: React.FC<PortfolioChartProps> = ({ assets, onBarClick, highlightedTicker }) => {
    const { formatCurrency } = useI18n();
    const chartData = useMemo(() => {
        const totalValue = assets.reduce((acc, asset) => acc + asset.currentPrice * asset.quantity, 0);
        return assets
            .map(asset => {
                const value = asset.currentPrice * asset.quantity;
                const percentage = totalValue > 0 ? (value / totalValue) * 100 : 0;
                return {
                    ticker: asset.ticker,
                    value: value,
                    percentage: percentage,
                };
            })
            .sort((a, b) => b.value - a.value);
    }, [assets]);

    const colors = ['bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-indigo-500', 'bg-rose-500', 'bg-teal-500'];

    return (
        <div className="space-y-4">
            {chartData.map((data, index) => {
                const isHighlighted = data.ticker === highlightedTicker;
                return (
                    <div 
                        key={data.ticker} 
                        onClick={() => onBarClick(data.ticker)} 
                        className={`p-2 rounded-lg cursor-pointer transition-all duration-200 ${isHighlighted ? 'bg-[var(--bg-tertiary-hover)]' : ''}`}
                    >
                        <div className="flex justify-between items-center mb-1 text-sm">
                            <span className="font-bold">{data.ticker}</span>
                            <span className="text-[var(--text-secondary)]">{data.percentage.toFixed(2)}%</span>
                        </div>
                        <div className={`w-full bg-gray-700 rounded-full h-2.5 transition-all duration-200 ${isHighlighted ? 'ring-1 ring-offset-2 ring-offset-[var(--bg-secondary)] ring-[var(--accent-color)]' : ''}`}>
                            <div
                                className={`${colors[index % colors.length]} h-2.5 rounded-full transition-[width] duration-700 ease-out`}
                                style={{ width: `${data.percentage}%` }}
                            ></div>
                        </div>
                        <div className="text-right text-xs text-[var(--text-secondary)] mt-1">
                            {formatCurrency(data.value)}
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

export default PortfolioChart;