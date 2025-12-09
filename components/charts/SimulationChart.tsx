
import React, { useMemo } from 'react';
import { useI18n } from '../../contexts/I18nContext';

interface ChartDataPoint {
    year: number;
    total: number;
    invested: number;
}

interface SimulationChartProps {
    data: ChartDataPoint[];
    years: number;
    type: 'compound' | 'simple' | 'million';
}

const SimulationChart: React.FC<SimulationChartProps> = ({ data, years, type }) => {
    const { t } = useI18n();
    const width = 300;
    const height = 200;
    const padding = { top: 20, right: 10, bottom: 20, left: 45 };

    const maxY = useMemo(() => {
        if (type === 'million') return 1000000 * 1.1;
        if (data.length === 0) return 1;
        const maxVal = Math.max(...data.map(d => d.total));
        return maxVal > 0 ? maxVal * 1.1 : 1;
    }, [data, type]);

    const getCoords = (year: number, value: number) => {
        const x = padding.left + (year / years) * (width - padding.left - padding.right);
        const y = (height - padding.bottom) - (value / maxY) * (height - padding.top - padding.bottom);
        return { x, y };
    };

    const totalPath = data.map(d => `${getCoords(d.year, d.total).x},${getCoords(d.year, d.total).y}`).join(' ');
    const investedPath = data.map(d => `${getCoords(d.year, d.invested).x},${getCoords(d.year, d.invested).y}`).join(' ');

    const totalAreaPath = `${padding.left},${height - padding.bottom} ${totalPath} ${getCoords(years, data[data.length-1]?.total || 0).x},${height - padding.bottom}`;
    const investedAreaPath = `${padding.left},${height - padding.bottom} ${investedPath} ${getCoords(years, data[data.length-1]?.invested || 0).x},${height - padding.bottom}`;

    const yLabels = useMemo(() => {
        const numLabels = 4;
        return Array.from({ length: numLabels + 1 }, (_, i) => {
            const value = (maxY / numLabels) * i;
            return {
                value,
                y: getCoords(0, value).y
            };
        });
    }, [maxY, years]);

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
            {yLabels.map(label => (
                <g key={label.value}>
                    <line x1={padding.left} y1={label.y} x2={width - padding.right} y2={label.y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="2 2" />
                    <text x={padding.left - 8} y={label.y + 3} textAnchor="end" fontSize="8" fill="var(--text-secondary)">
                        {label.value >= 1000000 ? `${(label.value / 1000000).toFixed(1)}M` : label.value >= 1000 ? `${(label.value / 1000).toFixed(0)}k` : label.value.toFixed(0)}
                    </text>
                </g>
            ))}
            
            {type === 'million' && (
                <g>
                    <line 
                        x1={padding.left} 
                        y1={getCoords(0, 1000000).y} 
                        x2={width - padding.right} 
                        y2={getCoords(0, 1000000).y} 
                        stroke="var(--green-text)" 
                        strokeWidth="1" 
                        strokeDasharray="3 3"
                    />
                    <text x={width - padding.right} y={getCoords(0, 1000000).y - 4} textAnchor="end" fontSize="8" fill="var(--green-text)" fontWeight="bold">{t('goal')}</text>
                </g>
            )}

            <polygon points={investedAreaPath} fill="var(--text-secondary)" fillOpacity="0.1" />
            <polyline fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" points={investedPath} />
            
            <polygon points={totalAreaPath} fill="var(--accent-color)" fillOpacity="0.2" />
            <polyline fill="none" stroke="var(--accent-color)" strokeWidth="2" points={totalPath} />

            <g transform={`translate(${padding.left}, 0)`}>
                <rect x="0" y="0" width="8" height="8" rx="2" fill="var(--accent-color)" />
                <text x="12" y="7" fontSize="8" fill="var(--text-primary)">{t('final_balance')}</text>
                
                <rect x="80" y="0" width="8" height="8" rx="2" fill="var(--text-secondary)" fillOpacity="0.5" />
                <text x="92" y="7" fontSize="8" fill="var(--text-secondary)">{t('total_invested_chart')}</text>
            </g>
        </svg>
    );
};

export default SimulationChart;
