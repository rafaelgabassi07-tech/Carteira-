
import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { View, } from '../App';
import type { AppNotification, NotificationType } from '../types';
import type { MenuScreen } from './SettingsView';
import { vibrate } from '../utils';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import SettingsIcon from '../components/icons/SettingsIcon';
import TrashIcon from '../components/icons/TrashIcon';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';

const NotificationIcon: React.FC<{ type: NotificationType }> = ({ type }) => {
    switch (type) {
        case 'dividend_confirmed':
            return <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-500/10 text-emerald-500 font-bold text-lg shadow-sm border border-emerald-500/20">$</div>;
        case 'price_alert':
            return <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-500/10 text-amber-500 font-bold text-lg shadow-sm border border-amber-500/20">!</div>;
        case 'milestone':
            return <div className="w-10 h-10 rounded-full flex items-center justify-center bg-sky-500/10 text-sky-500 shadow-sm border border-sky-500/20"><TrendingUpIcon className="w-5 h-5"/></div>;
        default:
            return <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-500/10 text-gray-400 font-bold text-lg shadow-sm border border-gray-500/20">i</div>;
    }
};

const SwipeableNotificationItem: React.FC<{ 
    notification: AppNotification; 
    onDelete: (id: number) => void;
    onClick: (n: AppNotification) => void;
}> = ({ notification, onDelete, onClick }) => {
    const [offsetX, setOffsetX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const startX = useRef(0);
    
    useEffect(() => { setOffsetX(0); }, [notification.id]);

    const handleTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        setIsSwiping(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isSwiping) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - startX.current;
        
        if (diff < 0) {
            if (Math.abs(diff) > 10 && e.cancelable) e.preventDefault();
            setOffsetX(Math.max(diff, -100));
        }
    };

    const handleTouchEnd = () => {
        setIsSwiping(false);
        if (offsetX < -70) {
            setOffsetX(-500); 
            setTimeout(() => onDelete(notification.id), 200); 
        } else {
            setOffsetX(0);
        }
    };

    const deleteOpacity = Math.min(Math.abs(offsetX) / 50, 1);

    return (
        <div className="relative overflow-hidden mb-3 h-auto min-h-[90px] group">
            {/* Background Action (Delete) */}
            <div 
                className="absolute inset-y-0 right-0 bg-red-500 rounded-2xl flex items-center justify-center w-[100px] transition-opacity duration-200 my-0.5"
                style={{ opacity: deleteOpacity }}
            >
                <div className="flex flex-col items-center text-white font-bold text-[10px] gap-1">
                    <TrashIcon className="w-5 h-5" />
                    <span>EXCLUIR</span>
                </div>
            </div>

            {/* Foreground Content */}
            <div 
                className={`relative bg-[var(--bg-secondary)] p-4 flex items-start space-x-4 border border-[var(--border-color)] transition-transform duration-200 ease-out active:scale-[0.98] rounded-2xl w-full z-10 ${notification.read ? 'opacity-60' : 'shadow-sm'}`}
                style={{ 
                    transform: `translateX(${offsetX}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.2s ease-out'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={() => {
                    if (offsetX === 0) {
                        vibrate();
                        onClick(notification);
                    }
                }}
            >
                <div className="relative flex-shrink-0">
                    <NotificationIcon type={notification.type} />
                    {!notification.read && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-color)] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--accent-color)] border-2 border-[var(--bg-secondary)]"></span>
                        </span>
                    )}
                </div>
                
                <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex justify-between items-start mb-1.5">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                            {notification.type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60">
                            {new Date(notification.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    </div>
                    
                    <p className={`text-sm font-bold truncate mb-1 ${notification.read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>{notification.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2">{notification.description}</p>
                    
                    {notification.relatedTicker && (
                        <div className="flex justify-end mt-2">
                            <span className="flex items-center text-[var(--accent-color)] text-[9px] font-bold gap-0.5 hover:underline">
                                VER DETALHES <ChevronRightIcon className="w-2.5 h-2.5" />
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const NotificationsView: React.FC<{ setActiveView: (view: View) => void; onSelectAsset: (ticker: string) => void; onOpenSettings: (screen: MenuScreen) => void; }> = ({ setActiveView, onSelectAsset, onOpenSettings }) => {
    const { t } = useI18n();
    const { notifications, markNotificationsAsRead, unreadNotificationsCount, deleteNotification, clearAllNotifications } = usePortfolio();
    
    useEffect(() => {
        const timer = setTimeout(() => {
            if (unreadNotificationsCount > 0) {
                markNotificationsAsRead();
            }
        }, 1500); 
        return () => clearTimeout(timer);
    }, [unreadNotificationsCount, markNotificationsAsRead]);
    
    const [activeFilter, setActiveFilter] = useState<'all' | NotificationType>('all');

    const handleNotificationClick = (notification: AppNotification) => {
        if (notification.relatedTicker) {
            onSelectAsset(notification.relatedTicker);
        }
    };
    
    const handleClearAll = () => {
        vibrate();
        if (window.confirm(t('clear_all') + '?')) {
            clearAllNotifications();
        }
    };

    const goToSettings = () => {
        vibrate();
        onOpenSettings('notifications');
    };

    const groupedNotifications = useMemo(() => {
        let visible = activeFilter !== 'all' ? notifications.filter(n => n.type === activeFilter) : notifications;
        
        const groups: { [key: string]: AppNotification[] } = { today: [], yesterday: [], older: [] };
        const todayDate = new Date().toDateString();
        const yesterdayDate = new Date(Date.now() - 86400000).toDateString();

        for (const n of visible) {
            const nDate = new Date(n.date).toDateString();
            if (nDate === todayDate) groups.today.push(n);
            else if (nDate === yesterdayDate) groups.yesterday.push(n);
            else groups.older.push(n);
        }
        return groups;
    }, [notifications, activeFilter]);

    const groupTitles = { today: t('today'), yesterday: t('yesterday'), older: t('older') };
    const filters: { id: 'all' | NotificationType; label: string }[] = [
        { id: 'all', label: t('notif_filter_all') },
        { id: 'dividend_confirmed', label: 'Proventos' },
        { id: 'price_alert', label: 'Alertas' },
    ];

    return (
        <div className="p-4 h-full flex flex-col overflow-x-hidden">
            <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center">
                    <button onClick={() => setActiveView('dashboard')} className="p-2 -ml-2 mr-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary-hover)] transition-all duration-200 active:scale-95" aria-label={t('back')}>
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <h1 className="text-2xl font-bold">{t('notifications')}</h1>
                 </div>
                 <div className="flex space-x-2 items-center">
                    {notifications.length > 0 && (
                        <button onClick={handleClearAll} className="text-[10px] font-bold text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg active:scale-95 transition-transform bg-red-500/10 border border-red-500/20">
                            {t('clear_all')}
                        </button>
                    )}
                    <button onClick={goToSettings} className="p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary-hover)] transition-colors" aria-label="Configurações">
                        <SettingsIcon className="w-5 h-5" />
                    </button>
                 </div>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
                {filters.map(f => (
                    <button key={f.id} onClick={() => { setActiveFilter(f.id); vibrate(); }} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${activeFilter === f.id ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] border-[var(--accent-color)] shadow-md' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]'}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            {notifications.length > 0 ? (
                <div className="space-y-6 pb-24 md:pb-6 overflow-y-auto overflow-x-hidden custom-scrollbar landscape-pb-6">
                    {(Object.keys(groupedNotifications) as Array<keyof typeof groupedNotifications>).map(groupKey => 
                        groupedNotifications[groupKey].length > 0 && (
                            <div key={groupKey} className="relative">
                                <h2 className="text-[10px] font-bold text-[var(--text-secondary)] mb-3 uppercase tracking-wider sticky top-0 bg-[var(--bg-primary)]/95 backdrop-blur-md py-2 z-20 px-1 border-b border-[var(--border-color)]/50 w-full">
                                    {groupTitles[groupKey]}
                                </h2>
                                <div className="space-y-1">
                                    {groupedNotifications[groupKey].map((notification) => (
                                        <SwipeableNotificationItem 
                                            key={notification.id}
                                            notification={notification}
                                            onClick={handleNotificationClick}
                                            onDelete={deleteNotification}
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    )}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--text-secondary)] pb-20 animate-fade-in">
                  <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-6 border border-[var(--border-color)] shadow-sm">
                      <div className="text-3xl opacity-50">💤</div>
                  </div>
                  <p className="font-bold text-lg text-[var(--text-primary)]">{t('no_notifications_title')}</p>
                  <p className="text-xs mt-2 max-w-[220px] leading-relaxed opacity-70">{t('no_notifications_subtitle')}</p>
                </div>
            )}
        </div>
    );
};

export default NotificationsView;
