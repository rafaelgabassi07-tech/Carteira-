import React from 'react';

const FingerprintIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M12 12a3 3 0 0 0-3 3" />
    <path d="M12 2a10 10 0 0 0-10 10c0 4.4 3.6 8 8 8" />
    <path d="M22 12c0-4.4-3.6-8-8-8" />
    <path d="M12 12a3 3 0 0 1 3 3" />
    <path d="M12 5a7 7 0 0 1 7 7" />
    <path d="M5 12a7 7 0 0 1 7-7" />
  </svg>
);

export default FingerprintIcon;
