import React from 'react';
import type { View } from '../App';
import LayoutGridIcon from './icons/LayoutGridIcon';
import WalletIcon from './icons/WalletIcon';
import TransactionIcon from './icons/TransactionIcon';
import NewsIcon from './icons/NewsIcon';
import SettingsIcon from './icons/SettingsIcon';
import BellIcon from './icons/BellIcon';
import { vibrate } from '../utils';
import { useI18n } from '../contexts/I18nContext';

interface BottomNavProps {
  activeView: View;
  setActiveView: (view: View) => void;
  unreadNotifications: number;
}

const NavItem: React.FC<{
  label: string;
  view: View;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}> = ({ label, icon, isActive, onClick, badge }) => {
  const activeClass = isActive ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)] opacity-70';
  
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center justify-center w-full h-full transition-colors duration-200 group active:scale-95 focus:outline-none ${activeClass}`}
    >
      <div className={`relative transition-transform duration-300 ease-in-out ${isActive ? '-translate-y-2' : 'translate-y-0'}`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
        {badge && badge > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 rounded-full min-w-[16px] h-4 flex items-center justify-center">
                {badge}
            </span>
        )}
      </div>
      <span 
        className={`absolute bottom-1 text-[10px] font-bold tracking-wide transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}
      >
          {label}
      </span>
    </button>
  );
};


const BottomNav: React.FC<BottomNavProps> = ({ activeView, setActiveView, unreadNotifications }) => {
  const { t } = useI18n();
  
  const handleNavClick = (view: View) => {
    vibrate();
    setActiveView(view);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[68px] bg-[var(--bg-secondary)]/90 backdrop-blur-lg border-t border-[var(--border-color)] z-[100] lg:hidden pb-safe">
      <div className="flex justify-around items-stretch h-full px-2">
        <NavItem label={t('nav_portfolio')} view="dashboard" icon={<LayoutGridIcon />} isActive={activeView === 'dashboard'} onClick={() => handleNavClick('dashboard')} />
        <NavItem label={t('nav_analysis')} view="carteira" icon={<WalletIcon />} isActive={activeView === 'carteira'} onClick={() => handleNavClick('carteira')} />
        <NavItem label={t('nav_transactions')} view="transacoes" icon={<TransactionIcon />} isActive={activeView === 'transacoes'} onClick={() => handleNavClick('transacoes')} />
        <NavItem label={t('notifications')} view="notificacoes" icon={<BellIcon />} isActive={activeView === 'notificacoes'} onClick={() => handleNavClick('notificacoes')} badge={unreadNotifications} />
        <NavItem label={t('nav_settings')} view="settings" icon={<SettingsIcon />} isActive={activeView === 'settings'} onClick={() => handleNavClick('settings')} />
      </div>
    </div>
  );
};

export default BottomNav;