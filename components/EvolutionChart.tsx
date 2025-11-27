
import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import type { PortfolioEvolutionPoint } from '../types';

interface EvolutionChartProps {
    data: PortfolioEvolutionPoint[];
    chartType?: 'bar' | 'line';
}

const EvolutionChart: React.FC<EvolutionChartProps> = ({ data, chartType = 'line' }) => {
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
    const padding = { top: 30, right: 10, bottom: 25, left: 45 };
    const chartWidth = Math.max(0, width - padding.left - padding.right);
    const chartHeight = Math.max(0, height - padding.top - padding.bottom);

    const maxValue = useMemo(() => {
        const max = Math.max(...data.map(d => Math.max(d.marketValue, d.invested)), 0);
        return max === 0 ? 1 : max * 1.1;
    }, [data]);

    const yTicks = useMemo(() => {
        const numTicks = 4;
        const step = maxValue / (numTicks - 1);
        return Array.from({ length: numTicks }, (_, i) => i * step);
    }, [maxValue]);
    
    // Bar logic
    const barSlotWidth = data.length > 0 ? chartWidth / data.length : 0;
    const barWidth = Math.max(4, Math.min(barSlotWidth * 0.6, 40));

    const getX = (index: number) => {
        if (chartType === 'line') {
            return padding.left + (index / (data.length - 1 || 1)) * chartWidth;
        }
        return padding.left + index * barSlotWidth + (barSlotWidth - barWidth) / 2;
    };
    
    const getY = (value: number) => (height - padding.bottom) - (value / maxValue) * chartHeight;

    const handleMouseMove = (event: { clientX: number, clientY: number }) => {
        if (!svgRef.current || data.length === 0) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        
        let index = -1;
        
        if (chartType === 'line') {
            const relativeX = x - padding.left;
            const progress = Math.max(0, Math.min(1, relativeX / chartWidth));
            index = Math.round(progress * (data.length - 1));
        } else {
            index = Math.floor((x - padding.left) / barSlotWidth);
        }

        if (index >= 0 && index < data.length) {
            const pointData = data[index];
            const highestVal = Math.max(pointData.marketValue, pointData.invested);
            const tooltipY = getY(highestVal);
            const tooltipX = getX(index) + (chartType === 'bar' ? barWidth / 2 : 0);
            
            setTooltip({ point: pointData, x: tooltipX, y: tooltipY, index });
        } else {
            setTooltip(null);
        }
    };
    
    if (data.length === 0) {
        return (
            <div ref={containerRef} className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] text-xs">
                <p>Sem dados para exibir.</p>
            </div>
        );
    }

    // Line Chart Path Generation
    const createPath = (key: 'marketValue' | 'invested') => {
        return data.map((d, i) => `${getX(i)},${getY(d[key])}`).join(' ');
    };

    const createAreaPath = (key: 'marketValue' | 'invested') => {
        const line = createPath(key);
        return `${getX(0)},${height - padding.bottom} ${line} ${getX(data.length - 1)},${height - padding.bottom}`;
    };

    const totalReturn = tooltip ? (tooltip.point.marketValue - tooltip.point.invested) + tooltip.point.cumulativeDividends : 0;

    return (
        <div ref={containerRef} className="relative w-full h-full">
            <svg 
                ref={svgRef} 
                viewBox={`0 0 ${width} ${height}`} 
                onMouseMove={(e) => handleMouseMove(e)} 
                onMouseLeave={() => setTooltip(null)} 
                onTouchStart={(e) => {
                    const touch = e.touches[0];
                    if (touch) handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
                }}
                onTouchMove={(e) => {
                    const touch = e.touches[0];
                    if (touch) handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
                }}
                className="w-full h-full cursor-crosshair"
                shapeRendering="geometricPrecision"
            >
                <defs>
                    <linearGradient id="marketValueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-color)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--accent-color)" stopOpacity={0} />
                    </linearGradient>
                </defs>

                {/* Y-Axis Grid & Labels */}
                {yTicks.map((tick, i) => {
                    const y = getY(tick);
                    return (
                        <g key={i}>
                            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="2 2" />
                            <text x={padding.left - 8} y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-secondary)">
                                {tick >= 1000 ? `${(tick/1000).toFixed(0)}k` : tick.toFixed(0)}
                            </text>
                        </g>
                    )
                })}
                
                {/* X-Axis Labels */}
                {data.map((d, i) => {
                    const skip = Math.ceil(data.length / (width / 50)); 
                    if (i % skip !== 0 && i !== data.length - 1) return null;
                    const x = getX(i) + (chartType === 'bar' ? barWidth / 2 : 0);
                    
                    return (
                        <text key={i} x={x} y={height - 5} textAnchor="middle" fontSize="9" fill="var(--text-secondary)">
                            {d.month.split('/')[0]}
                        </text>
                    );
                })}
                
                {/* Chart Visualization */}
                {chartType === 'line' ? (
                    <>
                        {/* Market Value Area */}
                        <polygon points={createAreaPath('marketValue')} fill="url(#marketValueGradient)" />
                        
                        {/* Invested Line (Dashed) */}
                        <polyline 
                            points={createPath('invested')} 
                            fill="none" 
                            stroke="var(--text-secondary)" 
                            strokeWidth="1.5" 
                            strokeDasharray="4 4"
                            opacity="0.7"
                        />

                        {/* Market Value Line */}
                        <polyline 
                            points={createPath('marketValue')} 
                            fill="none" 
                            stroke="var(--accent-color)" 
                            strokeWidth="2" 
                        />
                        
                        {/* Active Point Dot */}
                        {tooltip && (
                            <g>
                                <circle cx={tooltip.x} cy={getY(tooltip.point.invested)} r="3" fill="var(--bg-secondary)" stroke="var(--text-secondary)" strokeWidth="1.5" />
                                <circle cx={tooltip.x} cy={getY(tooltip.point.marketValue)} r="4" fill="var(--bg-secondary)" stroke="var(--accent-color)" strokeWidth="2" />
                                <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={height - padding.bottom} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="2 2" />
                            </g>
                        )}
                    </>
                ) : (
                    // Bar Chart Implementation
                    data.map((d, i) => {
                        const x = getX(i);
                        const yBase = height - padding.bottom;
                        const investedH = (d.invested / maxValue) * chartHeight;
                        const marketH = (d.marketValue / maxValue) * chartHeight;
                        const gain = d.marketValue - d.invested;
                        
                        return (
                            <g key={i} opacity={tooltip && tooltip.index !== i ? 0.4 : 1} className="transition-opacity duration-200">
                                {/* Invested Bar (Background/Base) */}
                                <rect x={x} y={yBase - investedH} width={barWidth} height={investedH} fill="var(--text-secondary)" fillOpacity="0.2" rx={2} />
                                
                                {/* Value Bar (Overlay) */}
                                {gain >= 0 ? (
                                    // Profit: Draw accent part on top of invested height? No, just show full market height for comparison
                                    <rect x={x} y={yBase - marketH} width={barWidth} height={marketH} fill="var(--accent-color)" rx={2} />
                                ) : (
                                    // Loss: Draw market value in red/warning color
                                    <rect x={x} y={yBase - marketH} width={barWidth} height={marketH} fill="var(--red-text)" opacity="0.8" rx={2} />
                                )}
                            </g>
                        );
                    })
                )}
            </svg>
            
            {tooltip && (
                <div 
                    className="absolute bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3 rounded-lg text-xs shadow-xl pointer-events-none transition-all z-10 whitespace-nowrap backdrop-blur-md"
                    style={{ 
                        left: tooltip.x, 
                        top: Math.min(tooltip.y, getY(tooltip.point.invested)) - 10, 
                        transform: `translate(-50%, -100%)`
                    }}
                >
                    <p className="text-center font-bold text-[var(--text-primary)] mb-2">{tooltip.point.month}</p>
                    
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-2 h-2 rounded-full bg-[var(--accent-color)]" />
                        <span className="text-[var(--text-secondary)]">{t('patrimony')}</span>
                        <span className="font-bold text-sm ml-auto">{formatCurrency(tooltip.point.marketValue)}</span>
                    </div>

                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] opacity-50" />
                        <span className="text-[var(--text-secondary)]">{t('invested_amount')}</span>
                        <span className="font-bold text-sm ml-auto text-[var(--text-secondary)]">{formatCurrency(tooltip.point.invested)}</span>
                    </div>

                    {tooltip.point.cumulativeDividends > 0 && (
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-2 h-2 rounded-full bg-[var(--green-text)] opacity-80" />
                            <span className="text-[var(--text-secondary)]">Proventos Acum.</span>
                            <span className="font-bold text-sm ml-auto text-[var(--green-text)]">{formatCurrency(tooltip.point.cumulativeDividends)}</span>
                        </div>
                    )}
                    
                    <div className="border-t border-[var(--border-color)] my-2 opacity-50"></div>
                    
                    <div className="flex items-center gap-3">
                        <span className="text-[var(--text-secondary)] font-bold">Retorno Total</span>
                        <span className={`font-bold text-sm ml-auto ${totalReturn >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                            {formatCurrency(totalReturn)}
                        </span>
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[var(--border-color)]"></div>
                </div>
            )}
        </div>
    );
};

export default EvolutionChart;
