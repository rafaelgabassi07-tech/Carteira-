import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import type { MonthlyIncome } from '../types';
import { debounce } from '../utils';

interface BarChartProps {
    data: MonthlyIncome[];
}

const BarChart: React.FC<BarChartProps> = ({ data }) => {
    const { formatCurrency, t } = useI18n();
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
        
        // Debounce the resize listener
        const debouncedUpdate = debounce(updateDimensions, 200);
        
        updateDimensions();
        window.addEventListener('resize', debouncedUpdate);
        return () => window.removeEventListener('resize', debouncedUpdate);
    }, []);

    // Use standard coordinates for internal calculation but rely on flex/CSS for responsiveness
    const width = dimensions.width || 300;
    const height = dimensions.height || 200;
    const padding = { top: 20, right: 10, bottom: 25, left: 10 };
    
    const maxValue = useMemo(() => Math.max(...data.map(d => d.total), 0), [data]);
    const effectiveMaxValue = maxValue === 0 ? 1 : maxValue; // Avoid division by zero

    const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current || data.length === 0) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left; 
        
        // Determine which bar is being hovered based on X position
        const chartWidth = width - padding.left - padding.right;
        const barSlotWidth = chartWidth / data.length;
        const index = Math.floor((x - padding.left) / barSlotWidth);

        if (index >= 0 && index < data.length) {
            const pointData = data[index];
            const barHeight = (pointData.total / effectiveMaxValue) * (height - padding.top - padding.bottom);
            const barX = padding.left + index * barSlotWidth + (barSlotWidth * 0.2); // Center bar in slot
            const barY = height - padding.bottom - barHeight;
            
            // Calculate tooltip position (centered above bar)
            setTooltip({ 
                ...pointData, 
                x: padding.left + (index * barSlotWidth) + (barSlotWidth / 2), 
                y: barY 
            });
        } else {
             setTooltip(null);
        }
    };

    if (dimensions.width === 0) return <div ref={containerRef} className="w-full h-full" />;

    const chartWidth = width - padding.left - padding.right;
    const barSlotWidth = data.length > 0 ? chartWidth / data.length : 0;
    const barWidth = barSlotWidth * 0.6; // Bar takes 60% of slot

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
                {data.map((d, i) => {
                    const barHeight = (d.total / effectiveMaxValue) * (height - padding.top - padding.bottom);
                    const x = padding.left + i * barSlotWidth + (barSlotWidth - barWidth) / 2;
                    const y = height - padding.bottom - barHeight;
                    return (
                        <g key={d.month}>
                            {/* Invisible hit area for better touch response */}
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
                                height={Math.max(barHeight, 2)} // Ensure at least 2px height so 0 isn't invisible if needed
                                fill="var(--accent-color)"
                                rx="2"
                                className="transition-all duration-300 animate-grow-up"
                                style={{ 
                                    transformOrigin: `center ${height - padding.bottom}px`,
                                    animationDelay: `${Math.min(i * 50, 1000)}ms`
                                }}
                            />
                            <text 
                                x={x + barWidth / 2} 
                                y={height - 5} 
                                textAnchor="middle" 
                                fontSize="10" 
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
                    className="absolute bg-[var(--bg-secondary)] border border-[var(--border-color)] p-2 rounded-lg text-xs shadow-xl pointer-events-none transition-all z-10 whitespace-nowrap"
                    style={{ 
                        left: tooltip.x, 
                        top: tooltip.y, 
                        transform: `translate(${tooltip.x > width * 0.8 ? '-90%' : tooltip.x < width * 0.2 ? '-10%' : '-50%'}, -120%)`
                    }}
                >
                    <p className="text-[var(--text-secondary)]">{tooltip.month}</p>
                    <p className="font-bold text-[var(--text-primary)]">{formatCurrency(tooltip.total)}</p>
                    {/* Arrow */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[var(--border-color)]"></div>
                </div>
            )}
        </div>
    );
};

export default BarChart;