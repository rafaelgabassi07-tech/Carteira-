import React from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  return (
    <div className="relative flex items-center group">
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs
                      bg-[var(--bg-tertiary-hover)] text-[var(--text-primary)] text-xs rounded py-1 px-2
                      opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-10
                      scale-95 group-hover:scale-100"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} >
        {text}
        {/* Arrow */}
        <div 
          className="absolute left-1/2 transform -translate-x-1/2 top-full"
          style={{
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid var(--bg-tertiary-hover)',
          }}
        />
      </div>
    </div>
  );
};

export default Tooltip;