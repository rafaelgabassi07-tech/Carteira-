
import React from 'react';
import type { View } from '../App';
import WalletIcon from './icons/WalletIcon';
import TransactionIcon from './icons/TransactionIcon';
import NewsIcon from './icons/NewsIcon';
import AnalysisIcon from './icons/AnalysisIcon';
import SettingsIcon from './icons/SettingsIcon';
import { vibrate } from '../utils';
import { useI18n } from '../contexts/I18nContext';

interface BottomNavProps {
  activeView: View;
  setActiveView: (view: View) => void;
}

const NavItem: React.FC<{
  label: string;
  view: View;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => {
  const activeClass = isActive ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)] opacity-70';
  return (
    <button
      onClick={onClick}
      className={`bottom-nav-item flex flex-col items-center justify-center w-full pt-3 pb-1 transform transition-all duration-150 active:scale-95 ${activeClass}`}
    >
      <div className={`transition-transform duration-200 ${isActive ? '-translate-y-1' : ''}`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6 mb-1' })}
      </div>
      <span className={`text-[10px] font-medium tracking-wide ${isActive ? 'opacity-100' : 'opacity-0 translate-y-2'} transition-all duration-200 absolute bottom-1`}>
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
    <div className="fixed bottom-0 left-0 right-0 h-[68px] bg-[var(--bg-secondary)]/90 backdrop-blur-lg border-t border-[var(--border-color)] z-[100] lg:hidden pb-safe">
      <div className="flex justify-around items-center h-full px-2">
        <NavItem label={t('nav_portfolio')} view="carteira" icon={<WalletIcon />} isActive={activeView === 'carteira'} onClick={() => handleNavClick('carteira')} />
        <NavItem label={t('nav_transactions')} view="transacoes" icon={<TransactionIcon />} isActive={activeView === 'transacoes'} onClick={() => handleNavClick('transacoes')} />
        <NavItem label={t('nav_analysis')} view="analise" icon={<AnalysisIcon />} isActive={activeView === 'analise'} onClick={() => handleNavClick('analise')} />
        <NavItem label={t('nav_news')} view="noticias" icon={<NewsIcon />} isActive={activeView === 'noticias'} onClick={() => handleNavClick('noticias')} />
        <NavItem label={t('nav_settings')} view="settings" icon={<SettingsIcon />} isActive={activeView === 'settings'} onClick={() => handleNavClick('settings')} />
      </div>
    </div>
  );
};

export default BottomNav;
