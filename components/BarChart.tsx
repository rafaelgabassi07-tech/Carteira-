import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import type { MonthlyIncome } from '../types';
import { debounce } from '../utils';

interface BarChartProps {
    data: MonthlyIncome[];
}

const BarChart: React.FC<BarChartProps> = ({ data }) => {
    const { formatCurrency } = useI18n();
    const [tooltip, setTooltip] = useState<{ month: string, total: number, x: number, y: number } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };
        
        const debouncedUpdate = debounce(updateDimensions, 200);
        
        updateDimensions();
        window.addEventListener('resize', debouncedUpdate);
        return () => window.removeEventListener('resize', debouncedUpdate);
    }, []);

    const width = dimensions.width || 300;
    const height = dimensions.height || 200;
    const padding = { top: 20, right: 10, bottom: 25, left: 35 }; // Increased left padding for Y-axis
    
    const maxValue = useMemo(() => Math.max(...data.map(d => d.total), 0), [data]);
    const effectiveMaxValue = maxValue === 0 ? 1 : maxValue;

    // Generate Y-axis ticks (0, 50%, 100%)
    const yTicks = [0, effectiveMaxValue / 2, effectiveMaxValue];

    const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current || data.length === 0) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left; 
        
        const chartWidth = width - padding.left - padding.right;
        const barSlotWidth = chartWidth / data.length;
        const index = Math.floor((x - padding.left) / barSlotWidth);

        if (index >= 0 && index < data.length) {
            const pointData = data[index];
            const barHeight = (pointData.total / effectiveMaxValue) * (height - padding.top - padding.bottom);
            const barX = padding.left + index * barSlotWidth + (barSlotWidth * 0.5);
            const barY = height - padding.bottom - barHeight;
            
            setTooltip({ 
                ...pointData, 
                x: barX, 
                y: barY 
            });
        } else {
             setTooltip(null);
        }
    };

    if (dimensions.width === 0) return <div ref={containerRef} className="w-full h-full" />;

    const chartWidth = width - padding.left - padding.right;
    const barSlotWidth = data.length > 0 ? chartWidth / data.length : 0;
    const barWidth = barSlotWidth * 0.6;

    return (
        <div ref={containerRef} className="relative w-full h-full">
            <svg 
                ref={svgRef} 
                width="100%" 
                height="100%" 
                viewBox={`0 0 ${width} ${height}`} 
                preserveAspectRatio="none"
                onMouseMove={handleMouseMove} 
                onMouseLeave={() => setTooltip(null)} 
                className="w-full h-full cursor-crosshair touch-none"
                shapeRendering="geometricPrecision"
            >
                {/* Grid Lines & Y Axis Labels */}
                {yTicks.map((tick, i) => {
                    const y = height - padding.bottom - (tick / effectiveMaxValue) * (height - padding.top - padding.bottom);
                    return (
                        <g key={i}>
                            <line 
                                x1={padding.left} 
                                y1={y} 
                                x2={width - padding.right} 
                                y2={y} 
                                stroke="var(--border-color)" 
                                strokeWidth="1" 
                                strokeDasharray="4 4"
                                opacity="0.5"
                            />
                            <text 
                                x={padding.left - 5} 
                                y={y + 3} 
                                textAnchor="end" 
                                fontSize="9" 
                                fill="var(--text-secondary)"
                            >
                                {tick >= 1000 ? `${(tick/1000).toFixed(1)}k` : tick.toFixed(0)}
                            </text>
                        </g>
                    )
                })}

                {/* Bars */}
                {data.map((d, i) => {
                    const barHeight = (d.total / effectiveMaxValue) * (height - padding.top - padding.bottom);
                    const x = padding.left + i * barSlotWidth + (barSlotWidth - barWidth) / 2;
                    const y = height - padding.bottom - barHeight;
                    return (
                        <g key={d.month}>
                            <rect
                                x={padding.left + i * barSlotWidth}
                                y={padding.top}
                                width={barSlotWidth}
                                height={height - padding.top - padding.bottom}
                                fill="transparent"
                            />
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(barHeight, 2)}
                                fill="var(--accent-color)"
                                rx="2"
                                className="transition-all duration-300 animate-grow-up hover:opacity-80"
                                style={{ 
                                    transformOrigin: `center ${height - padding.bottom}px`,
                                    animationDelay: `${Math.min(i * 50, 1000)}ms`
                                }}
                            />
                            <text 
                                x={x + barWidth / 2} 
                                y={height - 5} 
                                textAnchor="middle" 
                                fontSize="9" 
                                fill="var(--text-secondary)"
                            >
                                {d.month}
                            </text>
                        </g>
                    );
                })}
            </svg>
            {tooltip && (
                <div 
                    className="absolute bg-[var(--bg-secondary)] border border-[var(--border-color)] p-2 rounded-lg text-xs shadow-xl pointer-events-none transition-all z-10 whitespace-nowrap backdrop-blur-sm"
                    style={{ 
                        left: tooltip.x, 
                        top: tooltip.y, 
                        transform: `translate(-50%, -120%)`
                    }}
                >
                    <p className="text-[var(--text-secondary)] mb-0.5">{tooltip.month}</p>
                    <p className="font-bold text-[var(--text-primary)] text-sm">{formatCurrency(tooltip.total)}</p>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[var(--border-color)]"></div>
                </div>
            )}
        </div>
    );
};

export default BarChart;