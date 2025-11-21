

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

                return (
                    <circle
                        key={index}
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="transparent"
                        stroke={colors[index % colors.length]}
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

    const getTranslationKey = (segmentName: string) => {
        return segmentName
            .toLowerCase()
            .replace(' - ', '_')
            .replace(/ /g, '_')
            .replace(/\(|\)/g, '');
    };

    return (
        <div className="flex flex-col md:flex-row items-center gap-6 p-2 animate-fade-in">
            <div className="relative w-48 h-48 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                    <circle cx="50" cy="50" r={40} fill="transparent" stroke="var(--border-color)" strokeWidth={18} opacity={0.1}/>
                    {hasGoals && <circle cx="50" cy="50" r={25} fill="transparent" stroke="var(--border-color)" strokeWidth={12} opacity={0.1}/>}
                    
                    {hasGoals && <PieRing data={goalData} radius={40} strokeWidth={10} animate={animate} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} />}
                    
                    <PieRing data={data} radius={hasGoals ? 25 : 40} strokeWidth={hasGoals ? 12 : 18} animate={animate} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex}/>
                </svg>
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                         <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('segments')}</span>
                    </div>
                </div>
            </div>
             <div className="w-full flex-1 space-y-2 pr-2">
                {data.map((slice, index) => (
                    <div 
                        key={slice.name} 
                        className={`flex items-center justify-between text-sm transition-all duration-200 p-1.5 rounded-lg cursor-pointer gap-2 ${hoveredIndex === index ? 'bg-[var(--bg-tertiary-hover)] scale-[1.02]' : 'hover:bg-[var(--bg-primary)]'}`}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-3 h-3 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: colors[index % colors.length] }}></div>
                            <span className="text-[var(--text-primary)] font-medium truncate">{t(getTranslationKey(slice.name)) || slice.name}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                           <span className="font-bold">{slice.percentage.toFixed(1)}%</span>
                           <p className="text-[10px] text-[var(--text-secondary)]">{formatCurrency(slice.value)}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PortfolioPieChart;