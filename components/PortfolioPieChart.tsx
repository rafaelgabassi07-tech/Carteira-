

import React, { useEffect, useState } from 'react';
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
    'Logística': '#161c2d',
    'Híbrido': '#1face8',
    'Papel': '#4575f0',
    'Shoppings': '#7d899e',
    'Lajes Corporativas': '#ec4899',
    'Fundos de Fundos': '#f97316',
    'Outros': '#94a3b8'
};


const PieRing: React.FC<{ data: { percentage: number, name: string }[], radius: number, strokeWidth: number, animate: boolean, hoveredIndex: number | null, setHoveredIndex: (i: number | null) => void }> = ({ data, radius, strokeWidth, animate, hoveredIndex, setHoveredIndex }) => {
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
                        strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                        strokeDasharray={`${arcLength} ${circumference}`}
                        strokeDashoffset={-offset * (circumference / 100)} 
                        transform="rotate(-90 50 50)"
                        strokeLinecap="butt"
                        className="transition-all duration-300 cursor-pointer"
                        style={{
                            transition: 'stroke-width 0.3s, opacity 0.3s, stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)',
                            strokeDashoffset: animate ? -offset * (circumference / 100) : circumference,
                            opacity: hoveredIndex !== null && !isHovered ? 0.4 : 1,
                        }}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
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
    
    const goalData = React.useMemo(() => {
        return data.map(slice => ({ ...slice, percentage: goals[slice.name] || 0 }));
    }, [data, goals]);

    const hasGoals = Object.values(goals).some(g => Number(g) > 0);
    
    const DONUT_RADIUS = 42;
    const DONUT_STROKE_WIDTH = 16;

    const getTranslationKey = (segmentName: string) => {
        return segmentName
            .toLowerCase()
            .replace(' - ', '_')
            .replace(/ /g, '_')
            .replace(/\(|\)/g, '');
    };

    return (
        <div className="flex flex-col md:flex-row items-center gap-8 p-4 animate-fade-in">
            <div className="relative w-40 h-40 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                    <circle cx="50" cy="50" r={DONUT_RADIUS} fill="transparent" stroke="var(--border-color)" strokeWidth={DONUT_STROKE_WIDTH} opacity={0.05}/>
                    
                    {hasGoals && <PieRing data={goalData} radius={DONUT_RADIUS} strokeWidth={DONUT_STROKE_WIDTH / 2} animate={animate} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} />}
                    
                    <PieRing data={data} radius={hasGoals ? DONUT_RADIUS / 2 : DONUT_RADIUS} strokeWidth={hasGoals ? DONUT_STROKE_WIDTH / 1.5 : DONUT_STROKE_WIDTH} animate={animate} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex}/>
                </svg>
            </div>
             <div className="w-full flex-1 space-y-3">
                {data.map((slice, index) => {
                     const color = sectorColorMap[slice.name] || colors[index % colors.length];
                     return (
                        <div 
                            key={slice.name} 
                            className={`flex items-center justify-between text-base transition-all duration-200 p-1 rounded-lg cursor-pointer ${hoveredIndex === index ? 'bg-[var(--bg-tertiary-hover)]' : ''}`}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: color }}></div>
                                <span className="text-[var(--text-primary)] font-medium text-sm">{t(getTranslationKey(slice.name)) || slice.name}</span>
                            </div>
                            <div className="text-right font-mono">
                                <span className="font-bold text-sm text-[var(--text-primary)] tracking-tight">{formatCurrency(slice.value)}</span>
                                <span className="text-xs text-[var(--text-secondary)] ml-2">({slice.percentage.toFixed(1)}%)</span>
                            </div>
                        </div>
                     );
                })}
            </div>
        </div>
    );
};

export default PortfolioPieChart;