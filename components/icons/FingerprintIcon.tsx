
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
    <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 6" />
    <path d="M5 15a7 7 0 0 1 1-6" />
    <path d="M9 18a4 4 0 0 1-1-6" />
    <path d="M12 12v.01" />
    <path d="M12 15a2 2 0 0 1 2-2" />
    <path d="M12 18a6 6 0 0 1 6-6" />
    <path d="M16 12a2 2 0 0 1 1.8 1" />
    <path d="M19 17a3 3 0 0 0 .9-3" />
    <path d="M12 22v-1" />
  </svg>
);

export default FingerprintIcon;
