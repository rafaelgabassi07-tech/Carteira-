import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 512 512" 
      className={className}
      role="img"
      aria-label="FII Master Logo"
    >
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#38bdf8', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="120" fill="#18181b"/>
      <rect x="144" y="144" width="224" height="224" rx="32" stroke="url(#logo-grad)" strokeWidth="32" fill="none" />
      <path d="M192 288V256M256 288V224M320 288V192" stroke="url(#logo-grad)" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

export default Logo;