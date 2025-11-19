import React from 'react';

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m12 3-1.45 4.1-4.1-1.45 1.45 4.1-4.1 1.45 4.1 1.45-1.45 4.1 4.1-1.45 1.45 4.1 1.45-4.1 4.1 1.45-1.45-4.1 4.1-1.45-4.1-1.45 1.45-4.1-4.1 1.45Z" />
  </svg>
);

export default SparklesIcon;