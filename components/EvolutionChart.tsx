
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
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    
    const gradientId = useMemo(() => `evoGradient-${Math.random().toString(36).substr(2, 9)}`, []);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        const observer = new ResizeObserver(entries => {
             for (const entry of entries) {
                 const { width, height } = entry.contentRect;
                 setDimensions({ width, height });
             }
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);
    
    const { width, height } = dimensions;
    const padding = { top: 20, right: 0, bottom: 20, left: 0 }; // Full width chart approach
    const chartWidth = Math.max(0, width - padding.left - padding.right);
    const chartHeight = Math.max(0, height - padding.top - padding.bottom);

    // Dynamic Scale Calculation
    const { min, max } = useMemo(() => {
        if (data.length === 0) return { min: 0, max: 100 };
        
        const allValues = data.flatMap(d => [d.marketValue, d.invested]);
        let maxVal = Math.max(...allValues);
        let minVal = Math.min(...allValues); 
        
        const range = maxVal - minVal;
        
        // Add dynamic padding to prevent flat lines
        // If range is 0 (all values same) or very small, force a +/- 10% scale
        // This ensures the line has breathing room
        let effectiveRange = range;
        if (range === 0 || (range / maxVal < 0.01)) { // Less than 1% variation
             effectiveRange = maxVal * 0.1 || 10;
        }
        
        const paddingValue = effectiveRange * 0.20; // 20% padding

        let effectiveMin = minVal - paddingValue;
        let effectiveMax = maxVal + paddingValue;
        
        // Avoid negative scales unless real debt exists
        if (effectiveMin < 0 && minVal >= 0) effectiveMin = 0;
        
        // Handle pure zero case
        if (effectiveMax === 0) effectiveMax = 100;

        return { min: effectiveMin, max: effectiveMax };
    }, [data]);

    const getX = (index: number) => {
        if (data.length <= 1) return padding.left;
        return padding.left + (index / (data.length - 1)) * chartWidth;
    };
    
    const getY = (value: number) => {
        // Prevent division by zero
        if (max === min) return height / 2;
        const percent = (value - min) / (max - min);
        return (height - padding.bottom) - (percent * chartHeight);
    };

    const handleMouseMove = (event: React.MouseEvent | React.TouchEvent) => {
        if (!svgRef.current || data.length === 0) return;
        const rect = svgRef.current.getBoundingClientRect();
        
        let clientX;
        if ('touches' in event) {
            clientX = event.touches[0].clientX;
        } else {
            clientX = (event as React.MouseEvent).clientX;
        }

        const x = clientX - rect.left;
        
        // Find closest point index
        const relativeX = Math.max(0, Math.min(chartWidth, x - padding.left));
        const progress = relativeX / chartWidth;
        const index = Math.round(progress * (data.length - 1));

        if (index >= 0 && index < data.length) {
            const pointData = data[index];
            // Tooltip Y follows the Market Value line
            const tooltipY = getY(pointData.marketValue);
            const tooltipX = getX(index);
            
            setTooltip({ point: pointData, x: tooltipX, y: tooltipY, index });
        }
    };

    if (width === 0 || data.length === 0) return <div ref={containerRef} className="w-full h-full" />;

    // Generate Paths
    const marketPath = data.map((d, i) => `${getX(i).toFixed(1)},${getY(d.marketValue).toFixed(1)}`).join(' ');
    const investedPath = data.map((d, i) => `${getX(i).toFixed(1)},${getY(d.invested).toFixed(1)}`).join(' ');
    const areaPath = `${getX(0)},${height} ${marketPath} ${getX(data.length - 1)},${height}`;

    const spread = tooltip ? tooltip.point.marketValue - tooltip.point.invested : 0;

    return (
        <div ref={containerRef} className="relative w-full h-full select-none">
            <svg 
                ref={svgRef} 
                viewBox={`0 0 ${width} ${height}`} 
                className="w-full h-full cursor-crosshair overflow-visible"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setTooltip(null)}
                onTouchStart={handleMouseMove}
                onTouchMove={handleMouseMove}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-color)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--accent-color)" stopOpacity={0} />
                    </linearGradient>
                </defs>

                {/* --- Grid Lines (Minimalist) --- */}
                <line x1={0} y1={getY(min)} x2={width} y2={getY(min)} stroke="var(--border-color)" strokeDasharray="4 4" strokeWidth="1" opacity="0.3" />
                <line x1={0} y1={getY(max)} x2={width} y2={getY(max)} stroke="var(--border-color)" strokeDasharray="4 4" strokeWidth="1" opacity="0.3" />

                {/* --- Charts --- */}
                
                {/* 1. Market Value Area */}
                <path d={areaPath} fill={`url(#${gradientId})`} />

                {/* 2. Invested Line (Dashed) */}
                <path 
                    d={`M${investedPath}`} 
                    fill="none" 
                    stroke="var(--text-secondary)" 
                    strokeWidth="1.5" 
                    strokeDasharray="4 4" 
                    opacity="0.6" 
                />

                {/* 3. Market Value Line (Solid, Prominent) */}
                <path 
                    d={`M${marketPath}`} 
                    fill="none" 
                    stroke="var(--accent-color)" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                />

                {/* --- Interaction --- */}
                {tooltip && (
                    <g>
                        {/* Vertical Indicator Line */}
                        <line 
                            x1={tooltip.x} y1={padding.top} 
                            x2={tooltip.x} y2={height} 
                            stroke="var(--border-color)" 
                            strokeWidth="1" 
                        />
                        
                        {/* Invested Dot */}
                        <circle 
                            cx={tooltip.x} cy={getY(tooltip.point.invested)} 
                            r="3" 
                            fill="var(--bg-secondary)" 
                            stroke="var(--text-secondary)" 
                            strokeWidth="2" 
                        />

                        {/* Market Value Dot (Active) */}
                        <circle 
                            cx={tooltip.x} cy={getY(tooltip.point.marketValue)} 
                            r="5" 
                            fill="var(--accent-color)" 
                            stroke="var(--bg-secondary)" 
                            strokeWidth="2" 
                            className="animate-pulse"
                        />
                    </g>
                )}
            </svg>

            {/* --- HTML Tooltip (Better z-index handling) --- */}
            {tooltip && (
                <div 
                    className="absolute z-20 pointer-events-none transition-transform duration-75"
                    style={{ 
                        left: tooltip.x, 
                        top: 0, 
                        transform: `translateX(${tooltip.x > width * 0.6 ? '-105%' : '5%'}) translateY(${Math.min(Math.max(tooltip.y - 60, 0), height - 120)}px)` 
                    }}
                >
                    <div className="bg-[var(--bg-secondary)]/90 backdrop-blur-md border border-[var(--border-color)] rounded-xl shadow-xl p-3 text-xs w-48">
                        <p className="font-bold text-[var(--text-primary)] mb-2 border-b border-[var(--border-color)] pb-1">
                            {new Date(tooltip.point.dateISO).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]"></span>
                                Patrimônio
                            </span>
                            <span className="font-bold text-[var(--text-primary)]">{formatCurrency(tooltip.point.marketValue)}</span>
                        </div>

                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] opacity-50"></span>
                                Investido
                            </span>
                            <span className="font-medium text-[var(--text-secondary)]">{formatCurrency(tooltip.point.invested)}</span>
                        </div>

                        <div className={`flex justify-between items-center pt-2 border-t border-[var(--border-color)] ${spread >= 0 ? 'text-[var(--green-text)]' : 'text-[var(--red-text)]'}`}>
                            <span className="font-bold uppercase text-[9px] tracking-wider">Resultado</span>
                            <span className="font-bold">
                                {spread >= 0 ? '+' : ''}{formatCurrency(spread)}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EvolutionChart;
