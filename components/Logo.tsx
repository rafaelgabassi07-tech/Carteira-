import React, { useId } from 'react';

interface LogoProps {
  className?: string;
  variant?: 'icon' | 'full';
}

const Logo: React.FC<LogoProps> = ({ className, variant = 'icon' }) => {
  const uniqueId = useId();
  const gradientId = `logo-grad-${uniqueId.replace(/:/g, '')}`; 
  const isFull = variant === 'full';

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox={isFull ? "0 0 180 50" : "0 0 512 512"}
      className={className}
      role="img"
      aria-label="Invest Logo"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: 'var(--accent-color)', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      
      {isFull ? (
        // Full Wordmark Layout
        <g>
            {/* Symbol serving as 'I' */}
            <g transform="translate(0, 5) scale(0.12)">
                 {/* Stem */}
                 <rect x="60" y="140" width="80" height="200" rx="40" fill={`url(#${gradientId})`} />
                 {/* Arrow Head */}
                 <path d="M100 0 L220 0 A 40 40 0 0 1 260 40 L260 100 A 40 40 0 0 1 220 140 L160 140 L100 80 Z" fill="currentColor" />
                 <path d="M140 140 L140 240 L220 160 Z" fill={`url(#${gradientId})`} opacity="0.5" />
            </g>

            {/* Text: nvest */}
            <text x="40" y="38" fontFamily="var(--font-family)" fontWeight="900" fontSize="38" letterSpacing="-1" fill="currentColor">nvest</text>
        </g>
      ) : (
        // Icon Only Layout (Square)
        <g transform="translate(100, 86)">
            <rect x="20" y="140" width="80" height="200" rx="40" fill={`url(#${gradientId})`} />
            <path d="M60 0 L180 0 A 40 40 0 0 1 220 40 L220 100 A 40 40 0 0 1 180 140 L120 140 L60 80 Z" fill="currentColor" />
            <path d="M100 140 L100 240 L180 160 Z" fill={`url(#${gradientId})`} opacity="0.5" />
        </g>
      )}
    </svg>
  );
};

export default Logo;