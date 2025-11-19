import React from 'react';

const CalculatorIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
    <line x1="8" y1="6" x2="16" y2="6"></line>
    <line x1="16" y1="14" x2="16" y2="18"></line>
    <path d="M8 10h.01"></path>
    <path d="M12 10h.01"></path>
    <path d="M16 10h.01"></path>
    <path d="M8 14h.01"></path>
    <path d="M12 14h.01"></path>
    <path d="M8 18h.01"></path>
    <path d="M12 18h.01"></path>
  </svg>
);

export default CalculatorIcon;