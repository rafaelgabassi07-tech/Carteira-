
import React from 'react';
import type { View } from '../App';
import LayoutGridIcon from './icons/LayoutGridIcon';
import WalletIcon from './icons/WalletIcon';
import TransactionIcon from './icons/TransactionIcon';
import NewsIcon from './icons/NewsIcon';
import SettingsIcon from './icons/SettingsIcon';
import UserIcon from './icons/UserIcon';
import GlobeIcon from './icons/GlobeIcon';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { vibrate } from '../utils';
import Logo from './Logo';

interface SidebarProps {
  activeView: View;
  setActiveView: (view: View) => void;
}

const SidebarItem: React.FC<{
  label: string;
  view: View;
  icon: React.ReactElement<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => {
  const activeClass = isActive 
    ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-r-[3px] border-[var(--accent-color)]' 
    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary-hover)] hover:text-[var(--text-primary)] border-r-[3px] border-transparent opacity-80 hover:opacity-100';

  return (
    <button
      onClick={onClick}
      className={`flex items-center w-full px-6 py-4 transition-all duration-200 group relative ${activeClass}`}
    >
      <div className={`mr-4 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'scale-110' : ''}`}>
        {React.cloneElement(icon, { className: 'w-5 h-5' })}
      </div>
      <span className="font-semibold text-sm tracking-wide">{label}</span>
    </button>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
  const { t } = useI18n();
  const { userProfile } = usePortfolio();

  const handleNavClick = (view: View) => {
    vibrate();
    setActiveView(view);
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header / Logo */}
      <div className="p-8 flex items-center gap-4 mb-2">
        <Logo className="w-10 h-10 rounded-xl shadow-lg shadow-[var(--accent-color)]/20" />
        <div>
            <h1 className="font-black text-xl text-[var(--text-primary)] tracking-tight leading-none">FII Master</h1>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">Portfolio</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-1 custom-scrollbar">
        <div className="px-6 py-2">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider opacity-50 mb-2">Menu Principal</p>
        </div>
        <SidebarItem label={t('nav_portfolio')} view="dashboard" icon={<LayoutGridIcon />} isActive={activeView === 'dashboard'} onClick={() => handleNavClick('dashboard')} />
        <SidebarItem label={t('nav_analysis')} view="carteira" icon={<WalletIcon />} isActive={activeView === 'carteira'} onClick={() => handleNavClick('carteira')} />
        <SidebarItem label={t('nav_market')} view="mercado" icon={<GlobeIcon />} isActive={activeView === 'mercado'} onClick={() => handleNavClick('mercado')} />
        <SidebarItem label={t('nav_transactions')} view="transacoes" icon={<TransactionIcon />} isActive={activeView === 'transacoes'} onClick={() => handleNavClick('transacoes')} />
        <SidebarItem label={t('nav_news')} view="noticias" icon={<NewsIcon />} isActive={activeView === 'noticias'} onClick={() => handleNavClick('noticias')} />
        
        <div className="px-6 py-2 mt-6">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider opacity-50 mb-2">Conta</p>
        </div>
        <SidebarItem label={t('nav_settings')} view="settings" icon={<SettingsIcon />} isActive={activeView === 'settings'} onClick={() => handleNavClick('settings')} />
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-[var(--border-color)]/50 bg-[var(--bg-primary)]/30 backdrop-blur-sm">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--bg-tertiary-hover)] transition-colors cursor-pointer" onClick={() => handleNavClick('settings')}>
            <div className="w-10 h-10 rounded-full border-2 border-[var(--accent-color)] overflow-hidden">
                {userProfile.avatarUrl ? (
                    <img src={userProfile.avatarUrl} alt="User" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-[var(--bg-secondary)] flex items-center justify-center"><UserIcon className="w-5 h-5"/></div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--text-primary)] truncate">{userProfile.name || 'Investidor'}</p>
                <p className="text-[10px] text-[var(--text-secondary)] truncate">{userProfile.email || 'usuario@fiimaster.app'}</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
