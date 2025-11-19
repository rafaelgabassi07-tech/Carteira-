import React, { useState, useRef } from 'react';
import { useI18n } from '../contexts/I18nContext';

interface PortfolioLineChartProps {
  data: number[];
  isPositive: boolean;
  simpleMode?: boolean;
  label?: string;
  color?: string;
}

const PortfolioLineChart: React.FC<PortfolioLineChartProps> = ({ data, isPositive, simpleMode = false, label, color }) => {
  const { formatCurrency } = useI18n();
  const [activePoint, setActivePoint] = useState<{ x: number, y: number, value: number, index: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Generate a stable ID for this component instance's gradient
  const gradientId = useRef(`gradient-${Math.random().toString(36).substr(2, 9)}`).current;
  
  if (!data || data.length < 2) return <div className="flex items-center justify-center h-full text-sm text-[var(--text-secondary)]">Dados insuficientes.</div>;

  const width = 300;
  const height = simpleMode ? 100 : 150; // Increased default height for better aspect ratio
  const padding = { top: 20, bottom: 20, left: 10, right: 10 };

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  
  // Normalize points to chart dimensions
  const getCoords = (value: number, index: number) => {
      const x = padding.left + (index / (data.length - 1)) * (width - padding.left - padding.right);
      // Invert Y because SVG origin is top-left
      const y = (height - padding.bottom) - ((value - min) / range) * (height - padding.top - padding.bottom);
      return {x, y};
  }

  const points = data.map((d, i) => {
      const coords = getCoords(d, i);
      return `${coords.x},${coords.y}`;
  }).join(' ');

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    
    // Ratio of pixel to SVG unit
    // const ratio = width / rect.width; 
    
    const relativeX = Math.max(0, Math.min(1, (x / rect.width)));
    const index = Math.round(relativeX * (data.length - 1));

    if (index >= 0 && index < data.length) {
      const value = data[index];
      const {x: ptX, y: ptY} = getCoords(value, index);
      setActivePoint({ x: ptX, y: ptY, value, index });
    }
  };

  const handleMouseLeave = () => {
    setActivePoint(null);
  };

  const strokeColor = color || (isPositive ? 'var(--green-text)' : 'var(--red-text)');

  return (
    <div className="relative h-full w-full overflow-hidden">
    {label && <div className="absolute top-0 left-2 text-xs font-bold z-10" style={{color: strokeColor}}>{label}</div>}
    <svg 
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`} 
      className="w-full h-full cursor-crosshair" 
      preserveAspectRatio="none"
      onMouseMove={simpleMode ? undefined : handleMouseMove}
      onMouseLeave={simpleMode ? undefined : handleMouseLeave}
      shapeRendering="geometricPrecision"
    >
       <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
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
        strokeWidth="2"
        vectorEffect="non-scaling-stroke" 
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        style={{
          strokeDasharray: 1000,
          strokeDashoffset: 1000,
          animation: 'draw 1.5s ease-out forwards',
        }}
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
            vectorEffect="non-scaling-stroke"
            strokeDasharray="4 4"
          />
          <circle cx={activePoint.x} cy={activePoint.y} r="4" fill={strokeColor} stroke="var(--bg-secondary)" strokeWidth="2" />
           <g transform={`translate(${activePoint.x > width / 2 ? activePoint.x - 90 : activePoint.x + 10}, ${Math.max(padding.top, activePoint.y - 30)})`}>
              <rect x="0" y="0" width="80" height="25" rx="4" fill="var(--bg-secondary)" stroke="var(--border-color)" strokeWidth="1" opacity="0.95" />
              <text x="40" y="16" textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontWeight="bold">
                  {formatCurrency(activePoint.value)}
              </text>
          </g>
        </g>
      )}
    </svg>
    </div>
  );
};

export default PortfolioLineChart;