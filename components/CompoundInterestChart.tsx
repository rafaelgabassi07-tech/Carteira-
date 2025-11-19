import React, { useMemo, useState, useRef } from 'react';
import { useI18n } from '../contexts/I18nContext';

interface ChartProps {
  initial: number;
  monthly: number;
  rate: number;
  years: number;
}

const CompoundInterestChart: React.FC<ChartProps> = ({ initial, monthly, rate, years }) => {
  const { formatCurrency, t } = useI18n();
  const [tooltip, setTooltip] = useState<{ year: number; total: number; invested: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const data = useMemo(() => {
    if (years <= 0 || rate < 0) return []; // Allow 0 rate
    const points = Array.from({ length: years + 1 }, (_, i) => {
      const P = initial;
      const PMT = monthly;
      const r = rate / 100 / 12;
      const n = i * 12;
      
      const futureValue = P * Math.pow(1 + r, n) + (PMT > 0 && r > 0 ? PMT * ((Math.pow(1 + r, n) - 1) / r) : (PMT * n));
      const invested = P + PMT * n;
      
      return { year: i, total: futureValue, invested };
    });
    return points;
  }, [initial, monthly, rate, years]);

  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-sm text-[var(--text-secondary)]">{t('help_calculators')}</div>;
  }

  const width = 500;
  const height = 250;
  const padding = { top: 10, right: 10, bottom: 20, left: 10 };
  
  const maxValue = Math.max(...data.map(d => d.total));
  const effectiveMaxValue = maxValue === 0 ? 1 : maxValue; // Avoid division by zero
  
  const toSvgCoords = (point: { year: number; value: number }) => {
    const x = padding.left + (point.year / years) * (width - padding.left - padding.right);
    const y = (height - padding.bottom) - (point.value / effectiveMaxValue) * (height - padding.top - padding.bottom);
    return { x, y };
  };

  const totalAreaPath = "M" + data.map(p => `${toSvgCoords({ year: p.year, value: p.total }).x},${toSvgCoords({ year: p.year, value: p.total }).y}`).join(" L") + ` L${toSvgCoords({ year: years, value: 0 }).x},${height - padding.bottom} L${padding.left},${height - padding.bottom} Z`;
  const investedAreaPath = "M" + data.map(p => `${toSvgCoords({ year: p.year, value: p.invested }).x},${toSvgCoords({ year: p.year, value: p.invested }).y}`).join(" L") + ` L${toSvgCoords({ year: years, value: 0 }).x},${height - padding.bottom} L${padding.left},${height - padding.bottom} Z`;

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const inverted = point.matrixTransform(svg.getScreenCTM()?.inverse());
    
    const yearIndex = Math.round(((inverted.x - padding.left) / (width - padding.left - padding.right)) * years);
    if (yearIndex >= 0 && yearIndex < data.length) {
      const pointData = data[yearIndex];
      const { x, y } = toSvgCoords({ year: pointData.year, value: pointData.total });
      setTooltip({ ...pointData, x, y });
    }
  };

  return (
    <div className="mt-4">
      <h4 className="font-bold text-center mb-2">{t('compound_interest_chart')}</h4>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} className="w-full h-auto cursor-crosshair">
        <g className="animate-wipe-in">
             <path d={totalAreaPath} fill="var(--accent-color)" fillOpacity="0.3" />
             <path d={investedAreaPath} fill="var(--accent-color)" fillOpacity="0.5" />
        </g>

        {tooltip && (
          <g>
            <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={height - padding.bottom} stroke="var(--border-color)" strokeDasharray="3 3" />
            <circle cx={tooltip.x} cy={tooltip.y} r="4" fill="var(--accent-color)" stroke="var(--bg-primary)" strokeWidth="2" />
            <g transform={`translate(${tooltip.x > width / 2 ? tooltip.x - 140 : tooltip.x + 10}, ${padding.top + 10})`}>
                <rect x="0" y="0" width="130" height="60" rx="4" fill="var(--bg-secondary)" opacity="0.9" />
                <text x="10" y="20" fill="var(--text-primary)" fontSize="12">{t('year')}: {tooltip.year}</text>
                <text x="10" y="38" fill="var(--text-secondary)" fontSize="12">{t('total_invested_chart')}: {formatCurrency(tooltip.invested)}</text>
                <text x="10" y="56" fill="var(--accent-color)" fontSize="12" fontWeight="bold">{t('final_balance')}: {formatCurrency(tooltip.total)}</text>
            </g>
          </g>
        )}
        <text x={padding.left} y={height-5} fontSize="10" fill="var(--text-secondary)">0</text>
        <text x={width/2} y={height-5} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">{Math.floor(years/2)} {t('years_axis')}</text>
        <text x={width - padding.right} y={height-5} textAnchor="end" fontSize="10" fill="var(--text-secondary)">{years}</text>
      </svg>
      <div className="flex justify-center space-x-4 text-xs mt-2">
        <div className="flex items-center space-x-1.5"><div className="w-3 h-3 rounded" style={{backgroundColor: 'var(--accent-color)', opacity: 0.5}}></div><span>{t('total_invested_chart')}</span></div>
        <div className="flex items-center space-x-1.5"><div className="w-3 h-3 rounded" style={{backgroundColor: 'var(--accent-color)', opacity: 0.3}}></div><span>{t('total_interest_chart')}</span></div>
      </div>
    </div>
  );
};

export default CompoundInterestChart;