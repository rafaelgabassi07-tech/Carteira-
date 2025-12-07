
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
          isActive 
            ? '-translate-y-1 text-[var(--accent-color)] drop-shadow-[0_0_8px_rgba(var(--accent-rgb),0.4)]' 
            : 'text-[var(--text-secondary)] group-active:scale-90 opacity-70 group-hover:opacity-100'
        }`}
      >
        {React.cloneElement(icon, { className: 'w-6 h-6', strokeWidth: isActive ? 2.5 : 2 })}
      </div>
      
      <span 
        className={`absolute bottom-3 text-[10px] font-bold tracking-wide transition-all duration-300 ${
          isActive 
            ? 'opacity-100 translate-y-0 text-[var(--text-primary)]' 
            : 'opacity-0 translate-y-2'
        }`}
      >
          {label}
      </span>
      
      {/* Active Indicator Dot */}
      {isActive && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-8 h-8 bg-[var(--accent-color)]/10 rounded-full blur-md -z-0 pointer-events-none"></div>
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
          className="pointer-events-auto h-[72px] w-full max-w-[380px] bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center justify-between px-2 overflow-hidden ring-1 ring-white/5 transition-transform duration-300 hover:scale-[1.01]"
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
