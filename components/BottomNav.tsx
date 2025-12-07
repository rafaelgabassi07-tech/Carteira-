
import React from 'react';
import type { View } from '../App';
import LayoutGridIcon from './icons/LayoutGridIcon';
import WalletIcon from './icons/WalletIcon';
import TransactionIcon from './icons/TransactionIcon';
import GlobeIcon from './icons/GlobeIcon';
import { vibrate } from '../utils';
import { useI18n } from '../contexts/I18nContext';

interface BottomNavProps {
  activeView: View;
  setActiveView: (view: View) => void;
}

const NavItem: React.FC<{
  label: string;
  view: View;
  icon: React.ReactElement<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-1 flex-col items-center justify-center h-full group focus:outline-none"
    >
      <div 
        className={`relative z-10 transition-all duration-300 ease-spring transform ${
          isActive ? '-translate-y-1 scale-110 text-[var(--accent-color)]' : 'text-[var(--text-secondary)] group-active:scale-95'
        }`}
      >
        {React.cloneElement(icon, { className: 'w-6 h-6', strokeWidth: isActive ? 2.5 : 2 })}
      </div>
      
      <span 
        className={`absolute bottom-2 text-[10px] font-bold tracking-wide transition-all duration-300 ${
          isActive ? 'opacity-100 translate-y-0 text-[var(--text-primary)]' : 'opacity-0 translate-y-2'
        }`}
      >
          {label}
      </span>
      
      {/* Active Glow Indicator */}
      {isActive && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-[var(--accent-color)]/10 rounded-full blur-md -z-0 animate-pulse"></div>
      )}
    </button>
  );
};


const BottomNav: React.FC<BottomNavProps> = ({ activeView, setActiveView }) => {
  const { t } = useI18n();
  
  const handleNavClick = (view: View) => {
    if (activeView !== view) {
      vibrate([5]);
      setActiveView(view);
    }
  };

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[100] flex justify-center pointer-events-none">
        <div 
          className="pointer-events-auto h-[68px] w-full max-w-[380px] bg-[var(--bg-secondary)]/90 backdrop-blur-xl border border-[var(--border-color)] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex items-center justify-between px-2 overflow-hidden ring-1 ring-white/5"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <NavItem label={t('nav_portfolio')} view="dashboard" icon={<LayoutGridIcon />} isActive={activeView === 'dashboard'} onClick={() => handleNavClick('dashboard')} />
          <NavItem label={t('nav_analysis')} view="carteira" icon={<WalletIcon />} isActive={activeView === 'carteira'} onClick={() => handleNavClick('carteira')} />
          <NavItem label={t('nav_market')} view="mercado" icon={<GlobeIcon />} isActive={activeView === 'mercado'} onClick={() => handleNavClick('mercado')} />
          <NavItem label={t('nav_transactions')} view="transacoes" icon={<TransactionIcon />} isActive={activeView === 'transacoes'} onClick={() => handleNavClick('transacoes')} />
        </div>
    </div>
  );
};

export default BottomNav;
