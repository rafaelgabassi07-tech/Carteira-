
import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import type { DividendHistoryEvent } from '../types';
import { vibrate } from '../utils';

interface DividendChartProps {
    data: DividendHistoryEvent[];
}

type Period = '6m' | '1y' | '5y' | 'all';

const DividendChart: React.FC<DividendChartProps> = ({ data }) => {
    const { formatCurrency } = useI18n();
    const [period, setPeriod] = useState<Period>('1y');
    const [tooltip, setTooltip] = useState<{ date: string, value: number, x: number, y: number } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 }); // Start at 0 to prevent initial glitch
    const [isClicked, setIsClicked] = useState(false);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    // Use requestAnimationFrame to avoid "ResizeObserver loop limit exceeded"
                    requestAnimationFrame(() => {
                        setDimensions({ width, height });
                    });
                }
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const handleClick = () => {
        vibrate();
        setIsClicked(true);
        setTimeout(() => setIsClicked(false), 200);
    };

    // Filter Data based on Period
    const filteredData = useMemo(() => {
        if (!data || data.length === 0) return [];
        
        // Ensure sorted by payment date ascending
        const sortedData = [...data].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
        
        const now = new Date();
        let cutoffDate = new Date(0); // Default 'all' (epoch)

        if (period === '6m') cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        else if (period === '1y') cutoffDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        else if (period === '5y') cutoffDate = new Date(now.getFullYear() - 5, now.getMonth(), 1);

        const result = sortedData.filter(d => new Date(d.paymentDate) >= cutoffDate);
        return result;
    }, [data, period]);

    const { width, height } = dimensions;
    const padding = { top: 30, right: 10, bottom: 30, left: 45 }; // Increased padding
    
    const maxValue = useMemo(() => Math.max(...filteredData.map(d => d.value), 0), [filteredData]);
    const effectiveMaxValue = maxValue === 0 ? 1 : maxValue * 1.2; // 20% headroom

    // Y-Axis Ticks
    const yTicks = useMemo(() => {
        if (effectiveMaxValue <= 0) return [0];
        const numTicks = 3; 
        const step = effectiveMaxValue / (numTicks - 1);
        return Array.from({ length: numTicks }, (_, i) => i * step);
    }, [effectiveMaxValue]);

    const handleMouseMove = (event: { clientX: number, clientY: number }) => {
        if (!svgRef.current || filteredData.length === 0 || width === 0) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left; 
        
        const chartWidth = width - padding.left - padding.right;
        const barSlotWidth = chartWidth / filteredData.length;
        const index = Math.floor((x - padding.left) / barSlotWidth);

        if (index >= 0 && index < filteredData.length) {
            const pointData = filteredData[index];
            const chartHeight = height - padding.top - padding.bottom;
            const barHeight = (pointData.value / effectiveMaxValue) * chartHeight;
            const barX = padding.left + index * barSlotWidth + (barSlotWidth * 0.5);
            const barY = height - padding.bottom - barHeight;
            
            setTooltip({ 
                date: pointData.paymentDate,
                value: pointData.value,
                x: barX, 
                y: barY 
            });
        } else {
             setTooltip(null);
        }
    };

    if (data.length === 0) return (
        <div className="w-full h-full flex items-center justify-center text-xs text-[var(--text-secondary)] border border-dashed border-[var(--border-color)] rounded-xl opacity-50">
            Sem histórico
        </div>
    );

    const chartWidth = Math.max(0, width - padding.left - padding.right);
    const chartHeight = Math.max(0, height - padding.top - padding.bottom);
    const barSlotWidth = filteredData.length > 0 ? chartWidth / filteredData.length : 0;
    const barWidth = Math.max(4, Math.min(barSlotWidth * 0.6, 40)); 

    const handlePeriodChange = (p: Period) => {
        vibrate();
        setPeriod(p);
    }

    return (
        <div 
            className={`w-full h-full flex flex-col transition-transform duration-200 ${isClicked ? 'scale-[1.01]' : ''}`}
            onClick={handleClick}
        >
            {/* Header & Filters */}
            <div className="flex justify-between items-center mb-4 px-1">
                <h3 className="font-bold text-[var(--text-primary)] text-sm">Histórico de Pagamentos</h3>
                <div className="flex bg-[var(--bg-primary)] p-0.5 rounded-lg border border-[var(--border-color)]">
                    {(['6m', '1y', '5y', 'all'] as Period[]).map((p) => (
                        <button
                            key={p}
                            onClick={(e) => { e.stopPropagation(); handlePeriodChange(p); }}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all active:scale-95 ${period === p ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            {p === 'all' ? 'Máx' : p.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart Area */}
            <div ref={containerRef} className="relative flex-1 w-full min-h-[180px]">
                {width > 0 && height > 0 && filteredData.length > 0 ? (
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
                        className="w-full h-full cursor-crosshair overflow-visible"
                    >
                        {/* Grid Lines & Y Axis Labels */}
                        {yTicks.map((tick, i) => {
                            const y = height - padding.bottom - (tick / effectiveMaxValue) * chartHeight;
                            return (
                                <g key={i}>
                                    <line 
                                        x1={padding.left} 
                                        y1={y} 
                                        x2={width - padding.right} 
                                        y2={y} 
                                        stroke="var(--border-color)" 
                                        strokeWidth="0.5" 
                                        strokeDasharray="3 3"
                                        opacity="0.4"
                                    />
                                    <text 
                                        x={padding.left - 8} 
                                        y={y + 3} 
                                        textAnchor="end" 
                                        fontSize="10" 
                                        fontWeight="500"
                                        fill="var(--text-secondary)"
                                    >
                                        {tick.toFixed(2)}
                                    </text>
                                </g>
                            )
                        })}

                        {/* Bars */}
                        {filteredData.map((d, i) => {
                            const barHeight = (d.value / effectiveMaxValue) * chartHeight;
                            const x = padding.left + i * barSlotWidth + (barSlotWidth - barWidth) / 2;
                            const y = height - padding.bottom - barHeight;
                            const isHovered = tooltip?.date === d.paymentDate;
                            
                            // Date Label logic (Optimized for density)
                            const maxLabels = Math.floor(chartWidth / 40); // Assuming ~40px per label
                            const step = Math.ceil(filteredData.length / maxLabels);
                            const showLabel = i % step === 0;
                            
                            const dateLabel = new Date(d.paymentDate).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');

                            return (
                                <g key={`${d.paymentDate}-${i}`}>
                                    {/* Invisible hit area for better touch targets */}
                                    <rect
                                        x={padding.left + i * barSlotWidth}
                                        y={padding.top}
                                        width={barSlotWidth}
                                        height={chartHeight}
                                        fill="transparent"
                                    />
                                    {/* The Bar */}
                                    <rect
                                        x={x}
                                        y={y}
                                        width={barWidth}
                                        height={Math.max(barHeight, 0)}
                                        fill="var(--accent-color)"
                                        rx={Math.min(barWidth/2, 4)}
                                        className="transition-all duration-300"
                                        style={{ 
                                            opacity: isHovered ? 1 : 0.8,
                                            transformOrigin: 'bottom',
                                            animation: 'grow-up 0.4s ease-out forwards',
                                            animationDelay: `${i * 30}ms`
                                        }}
                                    />
                                    {/* X-Axis Label */}
                                    {showLabel && (
                                        <text 
                                            x={x + barWidth / 2} 
                                            y={height - 10} 
                                            textAnchor="middle" 
                                            fontSize="9" 
                                            fill="var(--text-secondary)"
                                            className="capitalize"
                                        >
                                            {dateLabel.split('/')[0]}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-[var(--text-secondary)] opacity-60">
                        {width === 0 ? 'Carregando gráfico...' : 'Sem dados para o período.'}
                    </div>
                )}

                {/* Tooltip */}
                {tooltip && (
                    <div 
                        className="absolute bg-[var(--bg-secondary)] border border-[var(--border-color)] p-2 rounded-xl text-xs shadow-xl pointer-events-none transition-all z-20 whitespace-nowrap backdrop-blur-md"
                        style={{ 
                            left: tooltip.x, 
                            top: tooltip.y - 15, 
                            transform: `translate(-50%, -100%)`
                        }}
                    >
                        <p className="text-[var(--text-secondary)] mb-0.5 capitalize font-semibold">
                            {new Date(tooltip.date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </p>
                        <p className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[var(--accent-color)]"></span>
                            {formatCurrency(tooltip.value)} <span className="text-[10px] font-normal text-[var(--text-secondary)]">/ cota</span>
                        </p>
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[var(--border-color)]"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DividendChart;
