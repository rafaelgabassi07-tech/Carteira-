
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
  const activeClass = isActive ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)] opacity-60 hover:opacity-100';
  
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center w-full h-full transition-colors duration-200 group active:scale-90 focus:outline-none ${activeClass}`}
    >
      <div className={`transition-all duration-300 ease-spring ${isActive ? '-translate-y-2.5 scale-110' : 'translate-y-0'}`}>
        {React.cloneElement(icon, { className: 'w-6 h-6' })}
      </div>
      <span 
        className={`text-[9px] font-bold tracking-wide leading-none transition-all duration-300 absolute bottom-3 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      >
          {label}
      </span>
    </button>
  );
};


const BottomNav: React.FC<BottomNavProps> = ({ activeView, setActiveView }) => {
  const { t } = useI18n();
  
  const handleNavClick = (view: View) => {
    vibrate();
    setActiveView(view);
  };

  return (
    <div 
      className="fixed bottom-5 left-5 right-5 h-[64px] bg-[var(--bg-secondary)]/90 backdrop-blur-xl border border-[var(--border-color)] z-[100] max-w-[400px] mx-auto shadow-[0_8px_32px_rgba(0,0,0,0.25)] rounded-2xl transition-all duration-300"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-4 h-full px-1">
        <NavItem label={t('nav_portfolio')} view="dashboard" icon={<LayoutGridIcon />} isActive={activeView === 'dashboard'} onClick={() => handleNavClick('dashboard')} />
        <NavItem label={t('nav_analysis')} view="carteira" icon={<WalletIcon />} isActive={activeView === 'carteira'} onClick={() => handleNavClick('carteira')} />
        <NavItem label={t('nav_market')} view="mercado" icon={<GlobeIcon />} isActive={activeView === 'mercado'} onClick={() => handleNavClick('mercado')} />
        <NavItem label={t('nav_transactions')} view="transacoes" icon={<TransactionIcon />} isActive={activeView === 'transacoes'} onClick={() => handleNavClick('transacoes')} />
      </div>
    </div>
  );
};

export default BottomNav;
