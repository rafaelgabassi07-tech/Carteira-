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
      aria-label="FII Master Logo"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: '#06b6d4', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="128" fill="#09090b"/>
      <rect x="112" y="280" width="80" height="120" rx="20" fill={`url(#${gradientId})`} />
      <rect x="216" y="200" width="80" height="200" rx="20" fill={`url(#${gradientId})`} />
      <rect x="320" y="112" width="80" height="288" rx="20" fill={`url(#${gradientId})`} />
    </svg>
  );
};

export default Logo;