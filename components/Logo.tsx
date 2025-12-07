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
      viewBox={isFull ? "0 0 140 40" : "0 0 512 512"}
      className={className}
      role="img"
      aria-label="Invest Logo"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" style={{ stopColor: '#2563eb', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#60a5fa', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      
      {isFull ? (
        <g>
            {/* Symbol serving as 'I' */}
            <g transform="translate(0, 4)">
                 {/* Left Bar (Small) */}
                 <rect x="2" y="14" width="8" height="14" rx="2" fill={`url(#${gradientId})`} opacity="0.8" />
                 {/* Right Bar (Tall) */}
                 <rect x="14" y="4" width="8" height="24" rx="2" fill={`url(#${gradientId})`} />
            </g>

            {/* Text: nvest */}
            {/* Using a cleaner, slightly lighter weight font representation for elegance */}
            <text 
              x="30" 
              y="28" 
              fontFamily="'Inter', -apple-system, sans-serif" 
              fontWeight="600" 
              fontSize="26" 
              letterSpacing="-0.03em" 
              fill="currentColor"
            >
              nvest
            </text>
        </g>
      ) : (
        // Icon Only Layout (Square)
        <g transform="translate(136, 126)">
            <rect x="0" y="110" width="100" height="150" rx="16" fill={`url(#${gradientId})`} opacity="0.8" />
            <rect x="140" y="0" width="100" height="260" rx="16" fill={`url(#${gradientId})`} />
        </g>
      )}
    </svg>
  );
};

export default Logo;