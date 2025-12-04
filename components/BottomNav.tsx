

import React from 'react';
import type { View } from '../App';
import LayoutGridIcon from './icons/LayoutGridIcon';
import GlobeIcon from './icons/GlobeIcon';
import NewsIcon from './icons/NewsIcon';
import TransactionIcon from './icons/TransactionIcon';
import WalletIcon from './icons/WalletIcon';
import { vibrate } from '../utils';
import { useI18n } from '../contexts/I18nContext';

interface BottomNavProps {
  activeView: View;
  setActiveView: (view: View) => void;
}

const NavItem: React.FC<{
  label: string;
  view: View;
  icon: React.ReactElement;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => {
  const activeClass = isActive ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)] opacity-70 group-hover:opacity-100';
  
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-300 ease-spring group focus:outline-none focus-visible:ring-2 ring-[var(--accent-color)] rounded-lg ${activeClass}`}
      style={{ transform: isActive ? 'scale(1.1)' : 'scale(1)' }}
    >
      <div className="transition-transform duration-300 ease-spring group-active:scale-90">
        {React.cloneElement(icon, { className: 'w-6 h-6' })}
      </div>
      <span 
        className={`text-[10px] font-bold tracking-wide mt-1 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
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

  // Explicitly defining the navigation items as requested by the user.
  const navItems: { view: View; label: string; icon: React.ReactElement }[] = [
    { view: 'dashboard', label: t('nav_portfolio'), icon: <LayoutGridIcon /> },
    { view: 'transacoes', label: t('nav_transactions'), icon: <TransactionIcon /> },
    { view: 'mercado', label: t('nav_market'), icon: <GlobeIcon /> },
    { view: 'analise', label: t('nav_analysis'), icon: <WalletIcon /> },
  ];

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-[100] transition-all duration-300 pb-safe"
    >
      <div className="relative max-w-lg mx-auto h-[72px] glass rounded-2xl m-4">
        <div className="grid grid-cols-4 h-full items-center justify-items-center">
            {navItems.map(item => (
                <NavItem 
                    key={item.view} 
                    {...item} 
                    isActive={activeView === item.view} 
                    onClick={() => handleNavClick(item.view)} 
                />
            ))}
        </div>
      </div>
    </div>
  );
};

export default BottomNav;