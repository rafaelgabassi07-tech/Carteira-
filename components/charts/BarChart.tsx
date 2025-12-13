
import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import type { MonthlyIncome } from '../../types';

interface BarChartProps {
    data: MonthlyIncome[];
}

const BarChart: React.FC<BarChartProps> = ({ data }) => {
    const { formatCurrency } = useI18n();
    const [tooltip, setTooltip] = useState<{ month: string, total: number, x: number, y: number } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const gradientId = useMemo(() => `barGradient-${Math.random().toString(36).substr(2, 9)}`, []);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    requestAnimationFrame(() => {
                        setDimensions({ width, height });
                    });
                }
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const { width, height } = dimensions;
    const padding = { top: 20, right: 10, bottom: 25, left: 35 };
    
    const maxValue = useMemo(() => Math.max(...data.map(d => d.total), 0), [data]);
    const effectiveMaxValue = maxValue === 0 ? 1 : maxValue * 1.1;

    const yTicks = useMemo(() => {
        if (effectiveMaxValue <= 1) return [0, 0.5, 1];
        const numTicks = 3;
        const step = effectiveMaxValue / (numTicks - 1);
        return Array.from({ length: numTicks }, (_, i) => i * step);
    }, [effectiveMaxValue]);

    const handleMouseMove = (event: { clientX: number, clientY: number }) => {
        if (!svgRef.current || data.length === 0 || width === 0) return;
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

    if (dimensions.width === 0 && data.length > 0) return <div ref={containerRef} className="w-full h-full" />;

    if (data.length === 0) return (
        <div ref={containerRef} className="w-full h-full flex items-center justify-center text-xs text-[var(--text-secondary)]">
            Sem dados.
        </div>
    );

    const chartWidth = Math.max(0, width - padding.left - padding.right);
    const barSlotWidth = data.length > 0 ? chartWidth / data.length : 0;
    const barWidth = Math.max(4, Math.min(barSlotWidth * 0.65, 40));

    // Smart Label Logic
    // Approx 35px per label needed to avoid overlap
    const maxLabels = Math.floor(chartWidth / 35);
    const step = Math.ceil(data.length / maxLabels);

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
                onTouchStart={(e) => {
                    const touch = e.touches[0];
                    if (touch) handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
                }}
                onTouchMove={(e) => {
                    const touch = e.touches[0];
                    if (touch) handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
                }}
                className="w-full h-full cursor-crosshair"
            >
                 <defs>
                    <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="1" />
                    </linearGradient>
                </defs>

                {/* Y Axis Grid & Labels */}
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
                                strokeWidth="0.5" 
                                strokeDasharray="2 2"
                                opacity="0.5"
                            />
                            <text 
                                x={padding.left - 6} 
                                y={y + 3} 
                                textAnchor="end" 
                                fontSize="9" 
                                fill="var(--text-secondary)"
                                fontWeight="500"
                            >
                                {tick >= 1000 ? `${(tick/1000).toFixed(0)}k` : tick.toFixed(0)}
                            </text>
                        </g>
                    )
                })}

                {/* Bars & X Axis Labels */}
                {data.map((d, i) => {
                    const barHeight = (d.total / effectiveMaxValue) * (height - padding.top - padding.bottom);
                    const x = padding.left + i * barSlotWidth + (barSlotWidth - barWidth) / 2;
                    const y = height - padding.bottom - barHeight;
                    const isHovered = tooltip?.month === d.month;
                    
                    // Show label if index matches step OR if it's the last item (to ensure range end is visible)
                    // But prioritizing step consistency to avoid overlapping the second to last.
                    const showLabel = i % step === 0; 

                    return (
                        <g key={d.month}>
                            {/* Hit Area */}
                            <rect
                                x={padding.left + i * barSlotWidth}
                                y={padding.top}
                                width={barSlotWidth}
                                height={height - padding.top - padding.bottom}
                                fill="transparent"
                            />
                            {/* Visual Bar */}
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(barHeight, 0)}
                                fill={`url(#${gradientId})`}
                                rx={Math.min(barWidth / 2, 4)}
                                className="transition-all duration-300"
                                style={{ 
                                    opacity: isHovered ? 1 : 0.8,
                                    transformOrigin: 'bottom',
                                    animation: 'grow-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                                    animationDelay: `${i * 30}ms`
                                }}
                            />
                            {/* X Label */}
                            {showLabel && (
                                <text 
                                    x={x + barWidth / 2} 
                                    y={height - 6} 
                                    textAnchor="middle" 
                                    fontSize="9" 
                                    fill="var(--text-secondary)"
                                    className="capitalize"
                                    fontWeight="500"
                                >
                                    {d.month.split('/')[0]}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
            
            {/* Tooltip */}
            {tooltip && (
                <div 
                    className="absolute bg-[var(--bg-secondary)] border border-[var(--border-color)] p-2 rounded-xl text-xs shadow-xl pointer-events-none transition-all z-20 whitespace-nowrap backdrop-blur-md"
                    style={{ 
                        left: tooltip.x, 
                        top: tooltip.y - 8, 
                        transform: `translate(-50%, -100%)`
                    }}
                >
                    <p className="text-[var(--text-secondary)] mb-0.5 capitalize font-semibold text-[10px]">{tooltip.month}</p>
                    <p className="font-bold text-[var(--text-primary)] text-sm">{formatCurrency(tooltip.total)}</p>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[var(--border-color)]"></div>
                </div>
            )}
        </div>
    );
};

export default BarChart;
