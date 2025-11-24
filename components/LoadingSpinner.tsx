import React from 'react';

const LoadingSpinner: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full w-full p-8 animate-fade-in">
    <div className="relative w-12 h-12">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-[var(--bg-secondary)] rounded-full opacity-30"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-[var(--accent-color)] rounded-full border-t-transparent animate-spin"></div>
    </div>
    <p className="text-[var(--text-secondary)] text-xs font-bold mt-4 tracking-wider uppercase">Carregando...</p>
  </div>
);

export default LoadingSpinner;