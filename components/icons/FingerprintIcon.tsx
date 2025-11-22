
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
    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
    <path d="M15 14a2 2 0 0 1-2 2" />
    <path d="M12 3a6 6 0 0 0-6 6c0 .01 0 .02 0 .03" />
    <path d="M12 3a6 6 0 0 1 6 6c0 .01 0 .02 0 .03" />
    <path d="M19.5 10a7.5 7.5 0 0 0-1.5-3.5" />
    <path d="M6 6.5a7.5 7.5 0 0 0-1.5 3.5" />
    <path d="M12 22a10 10 0 0 1-10-10" />
    <path d="M22 12a10 10 0 0 1-10 10" />
    <path d="M8 14a5 5 0 0 1 3-4" />
    <path d="M12.5 18a5 5 0 0 1-3.5 2" />
    <path d="M16 18a5 5 0 0 0 3.5-2" />
  </svg>
);

export default FingerprintIcon;