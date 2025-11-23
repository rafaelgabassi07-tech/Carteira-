import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import type { PortfolioEvolutionPoint } from '../types';

interface EvolutionChartProps {
    data: PortfolioEvolutionPoint[];
}

const EvolutionChart: React.FC<EvolutionChartProps> = ({ data }) => {
    const { formatCurrency, t } = useI18n();
    const [tooltip, setTooltip] = useState<{ point: PortfolioEvolutionPoint, x: number, y: number, index: number } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 300, height: 288 });

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        const updateDimensions = () => {
             if (container) {
                 const { width, height } = container.getBoundingClientRect();
                 if (width > 0 && height > 0) {
                     setDimensions({ width, height });
                 }
             }
        };

        const observer = new ResizeObserver(updateDimensions);
        observer.observe(container);
        updateDimensions();
        return () => observer.disconnect();
    }, []);
    
    const { width, height } = dimensions;
    const padding = { top: 20, right: 10, bottom: 25, left: 45 };
    const chartWidth = Math.max(0, width - padding.left - padding.right);
    const chartHeight = Math.max(0, height - padding.top - padding.bottom);

    const maxValue = useMemo(() => {
        const max = Math.max(...data.map(d => Math.max(d.marketValue, d.invested)), 0);
        return max === 0 ? 1 : max * 1.1;
    }, [data]);

    const getCoords = (index: number, value: number) => {
        const x = padding.left + (index / (data.length - 1)) * chartWidth;
        const y = (height - padding.bottom) - (value / maxValue) * chartHeight;
        return { x, y };
    };

    const yTicks = useMemo(() => {
        const numTicks = 4;
        const step = maxValue / (numTicks - 1);
        return Array.from({ length: numTicks }, (_, i) => i * step);
    }, [maxValue]);
    
    const xLabels = useMemo(() => {
        if (data.length <= 1) return [];
        const maxLabels = Math.max(2, Math.floor(chartWidth / 60));
        if(data.length <= maxLabels) return data.map((d, i) => ({ label: d.month, index: i }));
        const step = Math.ceil((data.length -1) / (maxLabels -1));
        const indices = new Set([0, data.length-1]);
        for(let i=1; i<maxLabels-1; i++) {
            indices.add(i*step);
        }
        return Array.from(indices).sort((a,b)=>a-b).map(i => ({ label: data[i].month, index: i }));
    }, [data, chartWidth]);

    const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current || data.length === 0) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        
        const progress = Math.max(0, Math.min(1, (x - padding.left) / chartWidth));
        const index = Math.round(progress * (data.length - 1));

        if (index >= 0 && index < data.length) {
            const pointData = data[index];
            const coords = getCoords(index, pointData.marketValue);
            setTooltip({ point: pointData, x: coords.x, y: coords.y, index });
        }
    };
    
    if (data.length < 2) {
        return (
            <div ref={containerRef} className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] text-xs">
                <p>Dados insuficientes para exibir evolução.</p>
            </div>
        );
    }
    
    const investedPath = data.map((d, i) => `${getCoords(i, d.invested).x},${getCoords(i, d.invested).y}`).join(' ');
    const marketValuePath = data.map((d, i) => `${getCoords(i, d.marketValue).x},${getCoords(i, d.marketValue).y}`).join(' ');
    const marketValueAreaPath = `${padding.left},${height - padding.bottom} ${marketValuePath} ${getCoords(data.length-1, data[data.length-1].marketValue).x},${height - padding.bottom}`;
    const investedAreaPath = `${padding.left},${height - padding.bottom} ${investedPath} ${getCoords(data.length-1, data[data.length-1].invested).x},${height - padding.bottom}`;

    return (
        <div ref={containerRef} className="relative w-full h-full">
            <svg 
                ref={svgRef} 
                viewBox={`0 0 ${width} ${height}`} 
                onMouseMove={handleMouseMove} 
                onMouseLeave={() => setTooltip(null)} 
                onTouchStart={(e) => {
                    const touch = e.touches[0];
                    if (touch) handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as React.MouseEvent<SVGSVGElement>);
                }}
                onTouchMove={(e) => {
                    const touch = e.touches[0];
                    if (touch) handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as React.MouseEvent<SVGSVGElement>);
                }}
                className="w-full h-full cursor-crosshair"
            >
                <defs>
                    <linearGradient id="marketValueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-color)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--accent-color)" stopOpacity={0} />
                    </linearGradient>
                     <linearGradient id="investedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--text-secondary)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="var(--text-secondary)" stopOpacity={0} />
                    </linearGradient>
                </defs>
                
                {yTicks.map((tick, i) => {
                    const y = getCoords(0, tick).y;
                    return (
                        <g key={i}>
                            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="2 2" />
                            <text x={padding.left - 8} y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-secondary)">
                                {tick >= 1000 ? `${(tick/1000).toFixed(0)}k` : tick.toFixed(0)}
                            </text>
                        </g>
                    )
                })}
                
                {xLabels.map(({ label, index }) => (
                     <text key={index} x={getCoords(index, 0).x} y={height - 5} textAnchor="middle" fontSize="9" fill="var(--text-secondary)">
                         {label}
                     </text>
                ))}
                
                {/* Area Fills */}
                <polygon points={investedAreaPath} fill="url(#investedGradient)" />
                <polygon points={marketValueAreaPath} fill="url(#marketValueGradient)" />

                {/* Lines */}
                <polyline fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" points={investedPath} strokeDasharray="3 3" />
                <polyline fill="none" stroke="var(--accent-color)" strokeWidth="2" points={marketValuePath} />
                
                {/* Tooltip */}
                {tooltip && (
                    <g>
                        <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={height - padding.bottom} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="2 2" />
                        <circle cx={getCoords(tooltip.index, tooltip.point.invested).x} cy={getCoords(tooltip.index, tooltip.point.invested).y} r="4" fill="var(--bg-secondary)" stroke="var(--text-secondary)" strokeWidth="2" />
                        <circle cx={tooltip.x} cy={tooltip.y} r="4" fill="var(--bg-secondary)" stroke="var(--accent-color)" strokeWidth="2" />
                    </g>
                )}
            </svg>
            
            {tooltip && (
                <div 
                    className="absolute bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3 rounded-lg text-xs shadow-xl pointer-events-none transition-all z-10 whitespace-nowrap"
                    style={{ 
                        left: tooltip.x, 
                        top: padding.top, 
                        transform: `translateX(${tooltip.x > width / 2 ? '-110%' : '10%'})`
                    }}
                >
                    <p className="text-center font-bold text-[var(--text-primary)] mb-2">{tooltip.point.month}</p>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--text-secondary)] opacity-50" />
                        <span className="text-[var(--text-secondary)]">{t('invested_amount')}:</span>
                        <span className="font-bold text-sm ml-auto">{formatCurrency(tooltip.point.invested)}</span>
                    </div>
                     <div className="flex items-center gap-2 mb-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-color)]" />
                        <span className="text-[var(--text-secondary)]">{t('patrimony')}:</span>
                        <span className="font-bold text-sm ml-auto">{formatCurrency(tooltip.point.marketValue)}</span>
                    </div>
                    
                     <div className="border-t border-[var(--border-color)] my-1"></div>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-2.5 h-2.5" />
                        <span className="text-[var(--text-secondary)]">{t('result')}:</span>
                        <span className={`font-bold text-sm ml-auto ${tooltip.point.marketValue - tooltip.point.invested >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                            {formatCurrency(tooltip.point.marketValue - tooltip.point.invested)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EvolutionChart;
