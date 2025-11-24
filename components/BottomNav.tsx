
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
  id?: string;
}> = ({ label, icon, isActive, onClick, id }) => {
  const activeClass = isActive ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)]';
  return (
    <button
      id={id}
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full pt-2 pb-1 transform transition-all duration-150 active:scale-95 ${activeClass} hover:text-[var(--accent-color)]`}
    >
      {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
};

const BottomNav: React.FC<BottomNavProps> = ({ activeView, setActiveView }) => {
  const { t } = useI18n();
  const navItems: { label: string; view: View; icon: React.ReactNode }[] = [
    { label: t('nav_portfolio'), view: 'carteira', icon: <WalletIcon /> },
    { label: t('nav_transactions'), view: 'transacoes', icon: <TransactionIcon /> },
    { label: t('nav_analysis'), view: 'analise', icon: <AnalysisIcon /> },
    { label: t('nav_news'), view: 'noticias', icon: <NewsIcon /> },
    { label: t('nav_settings'), view: 'settings', icon: <SettingsIcon /> },
  ];

  const handleNavClick = (view: View) => {
    vibrate();
    setActiveView(view);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] max-w-md mx-auto z-40">
      <div className="flex justify-around items-center h-full">
        {navItems.map((item) => (
          <NavItem
            key={item.view}
            id={`nav-${item.view}`}
            label={item.label}
            view={item.view}
            icon={item.icon}
            isActive={activeView === item.view}
            onClick={() => handleNavClick(item.view)}
          />
        ))}
      </div>
    </div>
  );
};

export default BottomNav;
