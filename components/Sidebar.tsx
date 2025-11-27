
import React from 'react';
import type { View } from '../App';
import WalletIcon from './icons/WalletIcon';
import TransactionIcon from './icons/TransactionIcon';
import NewsIcon from './icons/NewsIcon';
import AnalysisIcon from './icons/AnalysisIcon';
import SettingsIcon from './icons/SettingsIcon';
import BellIcon from './icons/BellIcon';
import { useI18n } from '../contexts/I18nContext';
import { vibrate } from '../utils';

interface SidebarProps {
  activeView: View;
  setActiveView: (view: View) => void;
}

const SidebarItem: React.FC<{
  label: string;
  view: View;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => {
  const activeClass = isActive 
    ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-r-4 border-[var(--accent-color)]' 
    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary-hover)] hover:text-[var(--text-primary)] border-r-4 border-transparent';

  return (
    <button
      onClick={onClick}
      className={`flex items-center w-full p-4 transition-all duration-200 group ${activeClass}`}
    >
      <div className={`mr-4 transition-transform group-hover:scale-110 ${isActive ? 'scale-110' : ''}`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
      </div>
      <span className="font-bold text-sm tracking-wide">{label}</span>
    </button>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
  const { t } = useI18n();

  const handleNavClick = (view: View) => {
    vibrate();
    setActiveView(view);
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 h-full bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex-shrink-0 shadow-xl z-50">
      {/* Header / Logo */}
      <div className="p-6 flex items-center gap-3 border-b border-[var(--border-color)]/50 mb-2">
        <div className="w-10 h-10 bg-gradient-to-br from-[var(--accent-color)] to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <WalletIcon className="w-6 h-6 text-white" />
        </div>
        <div>
            <h1 className="font-black text-xl text-[var(--text-primary)] tracking-tight leading-none">Invest</h1>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Portfolio</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1">
        <SidebarItem
          label={t('nav_portfolio')}
          view="carteira"
          icon={<WalletIcon />}
          isActive={activeView === 'carteira'}
          onClick={() => handleNavClick('carteira')}
        />
        <SidebarItem
          label={t('nav_transactions')}
          view="transacoes"
          icon={<TransactionIcon />}
          isActive={activeView === 'transacoes'}
          onClick={() => handleNavClick('transacoes')}
        />
        <SidebarItem
          label={t('nav_analysis')}
          view="analise"
          icon={<AnalysisIcon />}
          isActive={activeView === 'analise'}
          onClick={() => handleNavClick('analise')}
        />
        <SidebarItem
          label={t('nav_news')}
          view="noticias"
          icon={<NewsIcon />}
          isActive={activeView === 'noticias'}
          onClick={() => handleNavClick('noticias')}
        />
        <SidebarItem
          label={t('notifications')}
          view="notificacoes"
          icon={<BellIcon />}
          isActive={activeView === 'notificacoes'}
          onClick={() => handleNavClick('notificacoes')}
        />
      </nav>

      {/* Footer / Settings */}
      <div className="p-4 border-t border-[var(--border-color)]/50">
        <button
            onClick={() => handleNavClick('settings')}
            className={`flex items-center w-full p-3 rounded-xl transition-all duration-200 ${activeView === 'settings' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-inner border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary-hover)]'}`}
        >
            <SettingsIcon className="w-5 h-5 mr-3" />
            <span className="font-bold text-sm">{t('nav_settings')}</span>
        </button>
        <div className="mt-4 text-center">
            <p className="text-[10px] text-[var(--text-secondary)] opacity-60">v1.6.2 Desktop</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
