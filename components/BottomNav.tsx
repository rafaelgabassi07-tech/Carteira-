
import React from 'react';
import type { View } from '../App';
import LayoutGridIcon from './icons/LayoutGridIcon';
import WalletIcon from './icons/WalletIcon';
import TransactionIcon from './icons/TransactionIcon';
import NewsIcon from './icons/NewsIcon';
import SettingsIcon from './icons/SettingsIcon';
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
  const activeClass = isActive ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)] opacity-70';
  
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full h-full pt-1 pb-1 transition-colors duration-200 group active:scale-95 focus:outline-none ${activeClass}`}
    >
      <div className={`transition-transform duration-300 ease-in-out mb-1 ${isActive ? '-translate-y-1' : 'translate-y-0'}`}>
        {React.cloneElement(icon, { className: 'w-6 h-6' })}
      </div>
      <span 
        className={`text-[10px] font-bold tracking-wide leading-none transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
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
    <div className="fixed bottom-0 left-0 right-0 h-[68px] bg-[var(--bg-secondary)]/90 backdrop-blur-lg border-t border-[var(--border-color)] z-[100] pb-safe max-w-md mx-auto shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
      <div className="flex justify-around items-stretch h-full px-1">
        <NavItem label={t('nav_portfolio')} view="dashboard" icon={<LayoutGridIcon />} isActive={activeView === 'dashboard'} onClick={() => handleNavClick('dashboard')} />
        <NavItem label={t('nav_analysis')} view="carteira" icon={<WalletIcon />} isActive={activeView === 'carteira'} onClick={() => handleNavClick('carteira')} />
        <NavItem label={t('nav_market')} view="mercado" icon={<GlobeIcon />} isActive={activeView === 'mercado'} onClick={() => handleNavClick('mercado')} />
        <NavItem label={t('nav_transactions')} view="transacoes" icon={<TransactionIcon />} isActive={activeView === 'transacoes'} onClick={() => handleNavClick('transacoes')} />
        <NavItem label={t('nav_news')} view="noticias" icon={<NewsIcon />} isActive={activeView === 'noticias'} onClick={() => handleNavClick('noticias')} />
      </div>
    </div>
  );
};

export default BottomNav;
