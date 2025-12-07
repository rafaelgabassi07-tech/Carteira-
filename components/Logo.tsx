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
      viewBox={isFull ? "0 0 120 32" : "0 0 32 32"}
      className={className}
      role="img"
      aria-label="Invest Logo"
      fill="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" style={{ stopColor: 'currentColor', stopOpacity: 0.6 }} />
          <stop offset="100%" style={{ stopColor: 'currentColor', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      
      {/* The Graphical "I" - Always rendered */}
      <g transform={isFull ? "translate(0, 4)" : "translate(6, 4)"}>
           {/* Left Bar (Foundation) */}
           <rect x="2" y="10" width="6" height="14" rx="2" fill={`url(#${gradientId})`} fillOpacity="0.6" />
           {/* Right Bar (Growth) */}
           <rect x="10" y="2" width="6" height="22" rx="2" fill={`url(#${gradientId})`} />
      </g>

      {/* The rest of the word "nvest" - Only in full variant */}
      {isFull && (
        <text 
          x="24" 
          y="24" 
          fontFamily="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          fontWeight="600" 
          fontSize="22" 
          letterSpacing="-0.04em" 
          fill="currentColor"
        >
          nvest
        </text>
      )}
    </svg>
  );
};

export default Logo;