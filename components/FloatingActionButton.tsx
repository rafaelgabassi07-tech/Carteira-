
import React from 'react';
import PlusIcon from './icons/PlusIcon';

interface FloatingActionButtonProps {
  onClick: () => void;
  id?: string;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onClick, id }) => {
  return (
    <button
      id={id}
      onClick={onClick}
      className="fixed bottom-32 right-5 bg-[var(--accent-color)] text-[var(--accent-color-text)] w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:bg-sky-500 transition-all z-40 animate-scale-in active:scale-95 landscape-fab"
      aria-label="Adicionar item"
    >
      <PlusIcon className="w-8 h-8" />
    </button>
  );
};

export default FloatingActionButton;
