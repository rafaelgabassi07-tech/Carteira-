
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
    const padding = { top: 30, right: 10, bottom: 25, left: 45 };
    const chartWidth = Math.max(0, width - padding.left - padding.right);
    const chartHeight = Math.max(0, height - padding.top - padding.bottom);

    const maxValue = useMemo(() => {
        const max = Math.max(...data.map(d => Math.max(d.marketValue, d.invested)), 0);
        return max === 0 ? 1 : max * 1.1;
    }, [data]);

    // Bar Configuration
    const barSlotWidth = data.length > 0 ? chartWidth / data.length : 0;
    const barWidth = Math.max(4, Math.min(barSlotWidth * 0.6, 40)); // Cap max width

    const yTicks = useMemo(() => {
        const numTicks = 4;
        const step = maxValue / (numTicks - 1);
        return Array.from({ length: numTicks }, (_, i) => i * step);
    }, [maxValue]);
    
    const getX = (index: number) => padding.left + index * barSlotWidth + (barSlotWidth - barWidth) / 2;
    const getY = (value: number) => (height - padding.bottom) - (value / maxValue) * chartHeight;

    const handleMouseMove = (event: { clientX: number, clientY: number }) => {
        if (!svgRef.current || data.length === 0) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        
        const index = Math.floor((x - padding.left) / barSlotWidth);

        if (index >= 0 && index < data.length) {
            const pointData = data[index];
            // Tooltip position at the top of the highest bar
            const highestVal = Math.max(pointData.marketValue, pointData.invested);
            const tooltipY = getY(highestVal);
            const tooltipX = getX(index) + barWidth / 2;
            
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
                
                {/* X-Axis Labels (Sparse) */}
                {data.map((d, i) => {
                    // Show label if it fits (simple logic: skip based on density)
                    const skip = Math.ceil(data.length / (width / 50)); 
                    if (i % skip !== 0 && i !== data.length - 1) return null;
                    
                    return (
                        <text key={i} x={getX(i) + barWidth / 2} y={height - 5} textAnchor="middle" fontSize="9" fill="var(--text-secondary)">
                            {d.month.split('/')[0]}
                        </text>
                    );
                })}
                
                {/* Bars */}
                {data.map((d, i) => {
                    const x = getX(i);
                    const yBase = height - padding.bottom;
                    
                    const investedH = (d.invested / maxValue) * chartHeight;
                    const marketH = (d.marketValue / maxValue) * chartHeight;
                    
                    // Logic for "Gain Stacking"
                    // Base Bar: Represents the Invested Amount (Cost) - Darker/Neutral Color
                    // Top Bar: Represents Gain (Market Value - Invested) - Vibrant Color
                    
                    const gain = d.marketValue - d.invested;
                    
                    return (
                        <g key={i} opacity={tooltip && tooltip.index !== i ? 0.4 : 1} className="transition-opacity duration-200">
                            {/* 1. Base Bar (Invested) */}
                            <rect 
                                x={x} 
                                y={yBase - investedH} 
                                width={barWidth} 
                                height={investedH} 
                                fill="var(--bg-tertiary-hover)" // Darker, more neutral for base
                                stroke="var(--border-color)"
                                strokeWidth="1"
                                rx={2}
                            />
                            
                            {/* 2. Gain Bar (Stacked on top of Invested) */}
                            {gain > 0 && (
                                <rect
                                    x={x}
                                    y={yBase - marketH} // Starts at top of Market Value
                                    width={barWidth}
                                    height={marketH - investedH} // Height is the difference (Gain)
                                    fill="var(--accent-color)" // Vibrant for gain
                                    rx={2}
                                    className="animate-grow-up"
                                    style={{ transformOrigin: `center ${yBase - investedH}px` }}
                                />
                            )}
                            
                            {/* 3. Loss Indicator (If Market < Invested) */}
                            {gain < 0 && (
                                <rect
                                    x={x}
                                    y={yBase - investedH}
                                    width={barWidth}
                                    height={investedH - marketH}
                                    fill="var(--red-text)"
                                    opacity="0.5"
                                    rx={2}
                                />
                            )}
                        </g>
                    );
                })}

                {/* Optional Trend Line for Invested Amount to help visualize baseline */}
                <polyline 
                    points={data.map((d, i) => `${getX(i) + barWidth/2},${getY(d.invested)}`).join(' ')}
                    fill="none"
                    stroke="var(--text-secondary)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.5"
                />

            </svg>
            
            {tooltip && (
                <div 
                    className="absolute bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3 rounded-lg text-xs shadow-xl pointer-events-none transition-all z-10 whitespace-nowrap backdrop-blur-md"
                    style={{ 
                        left: tooltip.x, 
                        top: tooltip.y - 10, 
                        transform: `translate(-50%, -100%)`
                    }}
                >
                    <p className="text-center font-bold text-[var(--text-primary)] mb-2">{tooltip.point.month}</p>
                    
                    {/* Market Value (Total Height) */}
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-2 h-2 rounded-full bg-[var(--accent-color)]" />
                        <span className="text-[var(--text-secondary)]">{t('patrimony')}</span>
                        <span className="font-bold text-sm ml-auto">{formatCurrency(tooltip.point.marketValue)}</span>
                    </div>

                    {/* Invested (Base) */}
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)]" />
                        <span className="text-[var(--text-secondary)]">{t('invested_amount')}</span>
                        <span className="font-bold text-sm ml-auto text-[var(--text-secondary)]">{formatCurrency(tooltip.point.invested)}</span>
                    </div>
                    
                    <div className="border-t border-[var(--border-color)] my-2 opacity-50"></div>
                    
                    {/* Result (Gain/Loss) */}
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${tooltip.point.marketValue >= tooltip.point.invested ? 'bg-[var(--green-text)]' : 'bg-[var(--red-text)]'}`} />
                        <span className="text-[var(--text-secondary)]">{t('result')}</span>
                        <span className={`font-bold text-sm ml-auto ${tooltip.point.marketValue >= tooltip.point.invested ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                            {formatCurrency(tooltip.point.marketValue - tooltip.point.invested)}
                        </span>
                    </div>
                    
                    {/* Arrow */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[var(--border-color)]"></div>
                </div>
            )}
        </div>
    );
};

export default EvolutionChart;
