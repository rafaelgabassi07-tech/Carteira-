
import React, { useState, useRef, useLayoutEffect } from 'react';
import { useI18n } from '../../contexts/I18nContext';

interface PortfolioLineChartProps {
  data: number[];
  labels?: string[];
  isPositive: boolean;
  simpleMode?: boolean;
  label?: string;
  color?: string;
}

const PortfolioLineChart: React.FC<PortfolioLineChartProps> = ({ data, labels, isPositive, simpleMode = false, label, color }) => {
  const { formatCurrency } = useI18n();
  const [activePoint, setActivePoint] = useState<{ x: number, y: number, value: number, label?: string, index: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 150 });
  const gradientId = useRef(`gradient-${Math.random().toString(36).substr(2, 9)}`).current;

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
  
  if (!data || data.length < 2) {
    return (
        <div ref={containerRef} className="w-full h-full flex items-center justify-center text-xs text-[var(--text-secondary)]">
            Dados insuficientes.
        </div>
    );
  }

  const { width, height } = dimensions;
  const padding = simpleMode 
    ? { top: 5, bottom: 5, left: 0, right: 0 } 
    : { top: 20, bottom: 30, left: 10, right: 50 };

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  
  const getCoords = (value: number, index: number) => {
      const x = padding.left + (index / (data.length - 1)) * (width - padding.left - padding.right);
      const y = (height - padding.bottom) - ((value - min) / range) * (height - padding.top - padding.bottom);
      return {x, y};
  }

  const points = data.map((d, i) => {
      const coords = getCoords(d, i);
      return `${coords.x},${coords.y}`;
  }).join(' ');

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || simpleMode) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    
    const relativeX = (x / rect.width) * width;
    const graphWidth = width - padding.left - padding.right;
    const progress = Math.max(0, Math.min(1, (relativeX - padding.left) / graphWidth));
    const index = Math.round(progress * (data.length - 1));

    if (index >= 0 && index < data.length) {
      const value = data[index];
      const {x: ptX, y: ptY} = getCoords(value, index);
      setActivePoint({ 
          x: ptX, 
          y: ptY, 
          value, 
          index,
          label: labels ? labels[index] : undefined 
      });
    }
  };

  const handleMouseLeave = () => setActivePoint(null);
  const strokeColor = color || (isPositive ? 'var(--green-text)' : 'var(--red-text)');
  const tooltipWidth = 100;
  const tooltipHeight = 50;

  return (
    <div ref={containerRef} className="relative h-full w-full select-none">
        {label && !simpleMode && (
            <div className="absolute top-0 left-2 text-[10px] font-bold z-10 bg-[var(--bg-secondary)] px-1 rounded opacity-70" style={{color: strokeColor}}>
                {label}
            </div>
        )}
        
        {dimensions.width > 0 && (
            <svg 
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`} 
                className="w-full h-full cursor-crosshair overflow-visible" 
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onTouchMove={(e) => {
                    const touch = e.touches[0];
                    if (touch) {
                        const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY } as any;
                        handleMouseMove(fakeEvent);
                    }
                }}
            >
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.4} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
            </defs>
            
            <polygon
                fill={`url(#${gradientId})`}
                stroke="none"
                points={`
                ${padding.left},${height - padding.bottom}
                ${points}
                ${width - padding.right},${height - padding.bottom}
                `}
            />

            <polyline
                fill="none"
                stroke={strokeColor}
                strokeWidth={simpleMode ? "2" : "1.5"}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />

            {activePoint && !simpleMode && (
                <g className="pointer-events-none">
                    <line
                        x1={activePoint.x}
                        y1={padding.top}
                        x2={activePoint.x}
                        y2={height - padding.bottom}
                        stroke="var(--border-color)"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                    />
                    <circle cx={activePoint.x} cy={activePoint.y} r="5" fill={strokeColor} stroke="var(--bg-secondary)" strokeWidth="2" />
                    
                    <g transform={`translate(${activePoint.x > width / 2 ? activePoint.x - tooltipWidth - 10 : activePoint.x + 10}, ${padding.top})`}>
                        <rect x="0" y="0" width={tooltipWidth} height={tooltipHeight} rx="5" fill="var(--bg-secondary)" stroke="var(--border-color)" strokeWidth="1" opacity="0.95" />
                        <text x={tooltipWidth / 2} y={tooltipHeight / 2 - 5} textAnchor="middle" fill="var(--text-secondary)" fontSize="12">{activePoint.label}</text>
                        <text x={tooltipWidth / 2} y={tooltipHeight / 2 + 15} textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontWeight="bold">
                            {formatCurrency(activePoint.value)}
                        </text>
                    </g>
                </g>
            )}
            </svg>
        )}
    </div>
  );
};

export default PortfolioLineChart;
