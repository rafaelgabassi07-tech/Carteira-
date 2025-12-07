import React, { useId } from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className }) => {
  const uniqueId = useId();
  const gradientId = `logo-grad-${uniqueId.replace(/:/g, '')}`; 

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 512 512" 
      className={className}
      role="img"
      aria-label="Invest Logo"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#06b6d4', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      
      {/* Background shape mimicking the app icon style, but utilizing current text color or gradient if needed */}
      <rect x="0" y="0" width="512" height="512" rx="120" fill={`url(#${gradientId})`} />
      
      {/* Bars */}
      <g fill="#ffffff" transform="translate(86, 106)">
        <rect x="0" y="180" width="80" height="120" rx="20" opacity="0.6" />
        <rect x="110" y="90" width="80" height="210" rx="20" opacity="0.8" />
        <rect x="220" y="0" width="80" height="300" rx="20" />
        <circle cx="260" cy="-40" r="20" fill="#ffffff" opacity="0.9" />
      </g>
    </svg>
  );
};

export default Logo;