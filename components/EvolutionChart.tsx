
import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import type { PortfolioEvolutionPoint } from '../types';

interface EvolutionChartProps {
    data: PortfolioEvolutionPoint[];
}

const EvolutionChart: React.FC<EvolutionChartProps> = ({ data }) => {
    const { formatCurrency, t } = useI18n();
    const [tooltip, setTooltip] = useState<{ point: PortfolioEvolutionPoint, x: number, y: number } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 300, height: 200 });

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        const updateDimensions = () => {
             if (container) {
                 const { width, height } = container.getBoundingClientRect();
                 // Ensure we don't set 0 dimensions which causes NaN issues
                 if (width > 0 && height > 0) {
                     setDimensions({ width, height });
                 }
             }
        };

        const observer = new ResizeObserver(() => {
             requestAnimationFrame(updateDimensions);
        });
        
        observer.observe(container);
        // Initial call
        updateDimensions();

        return () => observer.disconnect();
    }, []);
    
    const { width, height } = dimensions;
    const padding = { top: 20, right: 10, bottom: 25, left: 35 };
    const chartWidth = Math.max(0, width - padding.left - padding.right);
    const chartHeight = Math.max(0, height - padding.top - padding.bottom);
    
    // Prevent division by zero if data is empty
    const barSlotWidth = data.length > 0 ? chartWidth / data.length : 0;
    const barWidth = Math.max(1, barSlotWidth * 0.7);

    const maxValue = useMemo(() => {
        const max = Math.max(...data.map(d => Math.max(d.marketValue, d.invested)), 0);
        return max === 0 ? 1 : max * 1.1; // Add 10% headroom and prevent 0
    }, [data]);

    const yTicks = useMemo(() => {
        const numTicks = 4;
        const step = maxValue / (numTicks - 1);
        return Array.from({ length: numTicks }, (_, i) => i * step);
    }, [maxValue]);
    
    const xLabels = useMemo(() => {
        if (data.length === 0) return [];
        const maxLabels = Math.max(1, Math.floor(chartWidth / 50));
        if(data.length <= maxLabels) return data.map((d, i) => ({ label: d.month, index: i }));
        const step = Math.ceil(data.length / maxLabels);
        return data.filter((_, i) => i % step === 0).map((d, i) => ({ label: d.month, index: i * step }));
    }, [data, chartWidth]);


    const handleMouseMove = (event: { clientX: number, clientY: number }) => {
        if (!svgRef.current || data.length === 0 || barSlotWidth === 0) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left; 
        
        const index = Math.min(data.length - 1, Math.max(0, Math.floor((x - padding.left) / barSlotWidth)));

        if (index >= 0 && index < data.length) {
            const pointData = data[index];
            const barHeight = (pointData.marketValue / maxValue) * chartHeight;
            const barX = padding.left + index * barSlotWidth + (barSlotWidth / 2);
            const barY = height - padding.bottom - barHeight;
            
            setTooltip({ point: pointData, x: barX, y: barY });
        }
    };
    
    if (data.length === 0) {
        return (
            <div ref={containerRef} className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] text-xs">
                <p>Sem dados de evolução.</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative w-full h-full">
            <svg 
                ref={svgRef} 
                viewBox={`0 0 ${width} ${height}`} 
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
                {yTicks.map((tick, i) => {
                    const y = height - padding.bottom - (tick / maxValue) * chartHeight;
                    return (
                        <g key={i}>
                            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="2 2" />
                            <text x={padding.left - 5} y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-secondary)">
                                {tick >= 1000 ? `${(tick/1000).toFixed(0)}k` : tick.toFixed(0)}
                            </text>
                        </g>
                    )
                })}
                
                {xLabels.map(({ label, index }) => (
                     <text key={index} x={padding.left + index * barSlotWidth + (barSlotWidth / 2)} y={height - 5} textAnchor="middle" fontSize="9" fill="var(--text-secondary)">
                         {label}
                     </text>
                ))}

                {data.map((d, i) => {
                    const barHeight = Math.max(0, (d.marketValue / maxValue) * chartHeight);
                    const investedHeight = Math.max(0, (d.invested / maxValue) * chartHeight);
                    // Safe coordinate calculation
                    const x = padding.left + i * barSlotWidth + (barSlotWidth - barWidth) / 2;
                    const y = height - padding.bottom - barHeight;
                    const yInvested = height - padding.bottom - investedHeight;

                    return (
                        <g key={d.month}>
                             <rect
                                x={x}
                                y={yInvested}
                                width={barWidth}
                                height={investedHeight}
                                fill="var(--text-secondary)"
                                opacity={0.3}
                                rx="2"
                                 className="animate-grow-up"
                                 style={{ transformOrigin: `bottom`, animationDelay: `${i*30}ms` }}
                            />
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                fill="var(--accent-color)"
                                opacity={0.7}
                                rx="2"
                                className="animate-grow-up"
                                style={{ transformOrigin: `bottom`, animationDelay: `${i*30}ms` }}
                            />
                        </g>
                    );
                })}
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
