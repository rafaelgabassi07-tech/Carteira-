
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
    const [dimensions, setDimensions] = useState({ width: 300, height: 200 });

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    setDimensions({ width, height });
                }
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

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
        // If filter returns too few items for 6m/1y, maybe show at least last X items? Keeping standard logic for now.
        return result;
    }, [data, period]);

    const { width, height } = dimensions;
    const padding = { top: 20, right: 10, bottom: 25, left: 40 };
    
    const maxValue = useMemo(() => Math.max(...filteredData.map(d => d.value), 0), [filteredData]);
    const effectiveMaxValue = maxValue === 0 ? 1 : maxValue * 1.15; // 15% headroom

    // Y-Axis Ticks
    const yTicks = useMemo(() => {
        if (effectiveMaxValue <= 0) return [];
        const numTicks = 4;
        const step = effectiveMaxValue / (numTicks - 1);
        return Array.from({ length: numTicks }, (_, i) => i * step);
    }, [effectiveMaxValue]);

    const handleMouseMove = (event: { clientX: number, clientY: number }) => {
        if (!svgRef.current || filteredData.length === 0) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left; 
        
        const chartWidth = width - padding.left - padding.right;
        const barSlotWidth = chartWidth / filteredData.length;
        const index = Math.floor((x - padding.left) / barSlotWidth);

        if (index >= 0 && index < filteredData.length) {
            const pointData = filteredData[index];
            const barHeight = (pointData.value / effectiveMaxValue) * (height - padding.top - padding.bottom);
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
        <div className="w-full h-48 flex items-center justify-center text-xs text-[var(--text-secondary)] border border-dashed border-[var(--border-color)] rounded-xl">
            Sem dados históricos.
        </div>
    );

    const chartWidth = Math.max(0, width - padding.left - padding.right);
    const chartHeight = Math.max(0, height - padding.top - padding.bottom);
    const barSlotWidth = filteredData.length > 0 ? chartWidth / filteredData.length : 0;
    const barWidth = Math.max(2, Math.min(barSlotWidth * 0.7, 30)); // Responsive bar width

    const handlePeriodChange = (p: Period) => {
        vibrate();
        setPeriod(p);
    }

    return (
        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-4 shadow-sm animate-fade-in-up">
            {/* Header & Filters */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-[var(--text-primary)] text-sm px-1">Histórico de Pagamentos</h3>
                <div className="flex bg-[var(--bg-primary)] p-0.5 rounded-lg border border-[var(--border-color)]">
                    {(['6m', '1y', '5y', 'all'] as Period[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => handlePeriodChange(p)}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${period === p ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            {p === 'all' ? 'Máx' : p.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart Area */}
            <div ref={containerRef} className="relative w-full h-48">
                {filteredData.length > 0 ? (
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
                                        strokeDasharray="2 2"
                                        opacity="0.5"
                                    />
                                    <text 
                                        x={padding.left - 6} 
                                        y={y + 3} 
                                        textAnchor="end" 
                                        fontSize="9" 
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
                            
                            // Date Label logic (sparse labels)
                            const showLabel = filteredData.length <= 12 || i % Math.ceil(filteredData.length / 6) === 0 || i === filteredData.length - 1;
                            const dateLabel = new Date(d.paymentDate).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

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
                                            opacity: isHovered ? 1 : 0.7
                                        }}
                                    />
                                    {/* X-Axis Label */}
                                    {showLabel && (
                                        <text 
                                            x={x + barWidth / 2} 
                                            y={height - 5} 
                                            textAnchor="middle" 
                                            fontSize="8" 
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
                    <div className="w-full h-full flex items-center justify-center text-xs text-[var(--text-secondary)]">
                        Sem dados para o período selecionado.
                    </div>
                )}

                {/* Tooltip */}
                {tooltip && (
                    <div 
                        className="absolute bg-[var(--bg-secondary)] border border-[var(--border-color)] p-2 rounded-lg text-xs shadow-xl pointer-events-none transition-all z-10 whitespace-nowrap backdrop-blur-md"
                        style={{ 
                            left: tooltip.x, 
                            top: tooltip.y - 10, 
                            transform: `translate(-50%, -100%)`
                        }}
                    >
                        <p className="text-[var(--text-secondary)] mb-0.5 capitalize">
                            {new Date(tooltip.date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </p>
                        <p className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]"></span>
                            {formatCurrency(tooltip.value)} <span className="text-[9px] font-normal text-[var(--text-secondary)]">/ cota</span>
                        </p>
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[var(--border-color)]"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DividendChart;
