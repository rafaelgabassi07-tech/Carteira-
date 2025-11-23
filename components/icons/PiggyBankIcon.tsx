import React from 'react';

const PiggyBankIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M10 20.5c0 .83.67 1.5 1.5 1.5h1c.83 0 1.5-.67 1.5-1.5v-2.09A3.99 3.99 0 0 0 16.41 14H18c2.21 0 4-1.79 4-4V7c0-2.21-1.79-4-4-4h-1" />
    <path d="M6 7.1c0-2.03.84-3.85 2.22-5.11" />
    <path d="M12.5 5A3.5 3.5 0 0 0 9 8.5v0" />
    <path d="M2.22 9.11A6.01 6.01 0 0 1 6 4.1" />
    <path d="M6 18.41V20c0 .83.67 1.5 1.5 1.5h1c.83 0 1.5-.67 1.5-1.5v-1.5" />
    <path d="M2 12h2" />
  </svg>
);

export default PiggyBankIcon;