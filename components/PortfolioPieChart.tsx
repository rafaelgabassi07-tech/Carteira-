
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
    '#3b82f6', // blue-500
    '#22c55e', // green-500
    '#f97316', // orange-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#14b8a6', // teal-500
    '#e11d48', // rose-600
    '#f59e0b', // amber-500
];


const PieRing: React.FC<{ data: { percentage: number }[], radius: number, strokeWidth: number, animate: boolean }> = ({ data, radius, strokeWidth, animate }) => {
    let cumulativePercentage = 0;
    const circumference = 2 * Math.PI * radius;
    
    return (
        <>
            {data.map((slice, index) => {
                const offset = cumulativePercentage;
                cumulativePercentage += slice.percentage;
                const arcLength = (slice.percentage / 100) * circumference;
                
                // If calculating empty or zero slices, avoid rendering artifacts
                if (slice.percentage <= 0) return null;

                return (
                    <circle
                        key={index}
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="transparent"
                        stroke={colors[index % colors.length]}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${circumference}`}
                        strokeDashoffset={animate ? circumference - (arcLength) : circumference} 
                        transform={`rotate(${(offset * 3.6) - 90}, 50, 50)`}
                        strokeLinecap="round"
                        style={{
                            transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)',
                            transitionDelay: `${index * 100}ms`
                        }}
                    />
                );
            })}
        </>
    );
};

const PortfolioPieChart: React.FC<PortfolioPieChartProps> = ({ data, goals }) => {
    const { t, formatCurrency } = useI18n();
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setAnimate(true), 100);
        return () => clearTimeout(timer);
    }, []);
    
    const goalData = React.useMemo(() => {
        return data.map(slice => ({ ...slice, percentage: goals[slice.name] || 0 }));
    }, [data, goals]);

    const hasGoals = Object.values(goals).some(g => Number(g) > 0);

    return (
        <div className="flex flex-col md:flex-row items-center gap-6 p-2 animate-fade-in">
            <div className="relative w-48 h-48 flex-shrink-0 transform transition-transform duration-700 ease-out" style={{ transform: animate ? 'scale(1) rotate(0deg)' : 'scale(0.8) rotate(-90deg)', opacity: animate ? 1 : 0 }}>
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    <circle cx="50" cy="50" r={40} fill="transparent" stroke="var(--border-color)" strokeWidth={18} opacity={0.2}/>
                    {hasGoals && <circle cx="50" cy="50" r={25} fill="transparent" stroke="var(--border-color)" strokeWidth={12} opacity={0.2}/>}
                    
                    {/* Outer Ring: Goals */}
                    {hasGoals && <PieRing data={goalData} radius={40} strokeWidth={10} animate={animate}/>}
                    
                    {/* Inner Ring: Current Allocation */}
                    <PieRing data={data} radius={hasGoals ? 25 : 40} strokeWidth={hasGoals ? 12 : 18} animate={animate}/>
                </svg>
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                         <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('segments')}</span>
                    </div>
                </div>
            </div>
             <div className="w-full flex-1 space-y-3">
                {hasGoals && (
                    <div className="flex justify-around text-xs mb-3 border-b border-[var(--border-color)] pb-2">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] opacity-50"/>{t('current')}</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[var(--text-secondary)]"/>{t('goal')}</div>
                    </div>
                )}
                {data.map((slice, index) => (
                    <div 
                        key={slice.name} 
                        className="flex items-center justify-between text-sm transition-all duration-500 transform translate-y-0 opacity-100" 
                        style={{ 
                            transitionDelay: `${300 + index * 50}ms`,
                            opacity: animate ? 1 : 0,
                            transform: animate ? 'translateY(0)' : 'translateY(10px)'
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: colors[index % colors.length] }}></div>
                            <span className="text-[var(--text-primary)] font-medium">{t(slice.name.toLowerCase().replace(/ /g, '_')) || slice.name}</span>
                        </div>
                        <div className="text-right">
                           <span className="font-bold">{slice.percentage.toFixed(1)}%</span>
                           {hasGoals && <span className="text-xs text-[var(--text-secondary)]"> / {(goals[slice.name] || 0).toFixed(0)}%</span>}
                           <p className="text-[10px] text-[var(--text-secondary)]">{formatCurrency(slice.value)}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PortfolioPieChart;
