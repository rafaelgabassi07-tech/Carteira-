
import React, { useEffect, useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';

interface PieChartData {
  name: string;
  value: number;
  percentage: number;
}

interface PortfolioPieChartProps {
  data: PieChartData[];
  goals: Record<string, number>;
}

const colors = [
    '#3b82f6', '#22c55e', '#f97316', '#8b5cf6', 
    '#ec4899', '#14b8a6', '#e11d48', '#f59e0b',
];

const sectorColorMap: Record<string, string> = {
    // Novas Categorias Macro
    'Tijolo': '#f97316', // Laranja
    'Papel': '#3b82f6', // Azul
    'Fiagro': '#22c55e', // Verde
    'FOF': '#a855f7', // Roxo
    'Infra': '#eab308', // Amarelo
    'Outros': '#94a3b8', // Cinza

    // Legacy / Fallback mappings
    'Logística': '#f97316',
    'Híbrido': '#fb923c',
    'Shoppings': '#fbbf24',
    'Lajes Corporativas': '#f59e0b',
    'Fundos de Fundos': '#a855f7',
};

const PieRing: React.FC<{ data: PieChartData[], radius: number, strokeWidth: number, animate: boolean, hoveredIndex: number | null, setHoveredIndex: (i: number | null) => void }> = ({ data, radius, strokeWidth, animate, hoveredIndex, setHoveredIndex }) => {
    let cumulativePercentage = 0;
    const circumference = 2 * Math.PI * radius;
    
    return (
        <>
            {data.map((slice, index) => {
                const offset = cumulativePercentage;
                cumulativePercentage += slice.percentage;
                const arcLength = (slice.percentage / 100) * circumference;
                
                if (slice.percentage <= 0) return null;
                
                const isHovered = hoveredIndex === index;
                const color = sectorColorMap[slice.name] || colors[index % colors.length];

                return (
                    <circle
                        key={index}
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="transparent"
                        stroke={color}
                        strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                        strokeDasharray={`${Math.max(0, arcLength - 1)} ${circumference}`} // -1 for small gap
                        strokeDashoffset={-offset * (circumference / 100)} 
                        transform="rotate(-90 50 50)"
                        strokeLinecap="round"
                        className="transition-all duration-300 cursor-pointer hover:brightness-110"
                        style={{
                            transition: 'stroke-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s, stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)',
                            strokeDashoffset: animate ? -offset * (circumference / 100) : circumference,
                            opacity: hoveredIndex !== null && !isHovered ? 0.3 : 1,
                        }}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => setHoveredIndex(index === hoveredIndex ? null : index)}
                    />
                );
            })}
        </>
    );
};

const PortfolioPieChart: React.FC<PortfolioPieChartProps> = ({ data, goals }) => {
    const { t, formatCurrency } = useI18n();
    const [animate, setAnimate] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setAnimate(true), 100);
        return () => clearTimeout(timer);
    }, []);
    
    const DONUT_RADIUS = 40;
    const DONUT_STROKE_WIDTH = 12;

    const activeItem = hoveredIndex !== null ? data[hoveredIndex] : null;
    const totalValue = useMemo(() => data.reduce((acc, item) => acc + item.value, 0), [data]);

    return (
        <div className="flex flex-col md:flex-row items-center gap-8 p-2 animate-fade-in">
            {/* Chart Area */}
            <div className="relative w-48 h-48 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-xl">
                    {/* Background Track */}
                    <circle cx="50" cy="50" r={DONUT_RADIUS} fill="transparent" stroke="var(--bg-primary)" strokeWidth={DONUT_STROKE_WIDTH} opacity="0.5" />
                    <PieRing data={data} radius={DONUT_RADIUS} strokeWidth={DONUT_STROKE_WIDTH} animate={animate} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex}/>
                </svg>
                
                {/* Center Info */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-widest mb-0.5">
                        {activeItem ? activeItem.name : t('total_invested')}
                    </span>
                    <span className={`font-bold text-[var(--text-primary)] ${activeItem ? 'text-2xl' : 'text-lg'}`}>
                        {activeItem ? `${activeItem.percentage.toFixed(1)}%` : formatCurrency(totalValue)}
                    </span>
                    {activeItem && (
                        <span className="text-xs font-medium text-[var(--text-secondary)] mt-1 bg-[var(--bg-primary)] px-2 py-0.5 rounded-full border border-[var(--border-color)]">
                            {formatCurrency(activeItem.value)}
                        </span>
                    )}
                </div>
            </div>

            {/* Minimalist Legend Grid */}
             <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.map((slice, index) => {
                     const color = sectorColorMap[slice.name] || colors[index % colors.length];
                     const goal = goals[slice.name] || 0;
                     const isHovered = hoveredIndex === index;
                     const isDimmed = hoveredIndex !== null && !isHovered;

                     return (
                        <div 
                            key={slice.name} 
                            className={`
                                group relative p-3 rounded-xl cursor-pointer transition-all duration-300 border border-transparent
                                ${isHovered ? 'bg-[var(--bg-tertiary-hover)] scale-[1.02] shadow-md border-[var(--border-color)]' : 'hover:bg-[var(--bg-primary)]'}
                                ${isDimmed ? 'opacity-40 blur-[1px]' : 'opacity-100'}
                            `}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            onClick={() => setHoveredIndex(index === hoveredIndex ? null : index)}
                        >
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    {/* Color Indicator */}
                                    <div 
                                        className={`w-1.5 h-8 rounded-full transition-all duration-300 ${isHovered ? 'h-10' : ''}`} 
                                        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}40` }}
                                    ></div>
                                    
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm text-[var(--text-primary)] leading-tight">{slice.name}</span>
                                        <span className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">{formatCurrency(slice.value)}</span>
                                    </div>
                                </div>
                                
                                <div className="text-right">
                                    <div className="font-bold text-base text-[var(--text-primary)]">
                                        {slice.percentage.toFixed(1)}<span className="text-xs text-[var(--text-secondary)] font-normal">%</span>
                                    </div>
                                    {goal > 0 && (
                                        <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-0.5">
                                            Meta: {goal}%
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                     );
                })}
            </div>
        </div>
    );
};

export default PortfolioPieChart;
