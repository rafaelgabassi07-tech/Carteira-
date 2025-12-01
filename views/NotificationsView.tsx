
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
            return <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-500/20 text-[var(--green-text)] font-bold text-lg">$</div>;
        case 'price_alert':
            return <div className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-500/20 text-amber-400 font-bold text-lg">!</div>;
        case 'milestone':
            return <div className="w-10 h-10 rounded-full flex items-center justify-center bg-sky-500/20 text-[var(--accent-color)]"><TrendingUpIcon className="w-5 h-5"/></div>;
        default:
            return <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-500/20 text-gray-400 font-bold text-lg">i</div>;
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
    
    // Reset position if notification changes (unlikely key-prop handles it, but safe)
    useEffect(() => { setOffsetX(0); }, [notification.id]);

    const handleTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        setIsSwiping(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isSwiping) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - startX.current;
        
        // Allow swiping left (negative diff)
        if (diff < 0) {
            // Prevent scrolling vertical if dragging horizontal
            if (Math.abs(diff) > 10 && e.cancelable) e.preventDefault();
            // Cap at -100px
            setOffsetX(Math.max(diff, -100));
        }
    };

    const handleTouchEnd = () => {
        setIsSwiping(false);
        if (offsetX < -70) {
            // Swiped far enough - trigger delete
            setOffsetX(-500); // Animate out screen
            setTimeout(() => onDelete(notification.id), 200); // Wait for anim
        } else {
            // Snap back
            setOffsetX(0);
        }
    };

    // Opacity logic: Only show the red background when actually swiping
    const deleteOpacity = Math.min(Math.abs(offsetX) / 50, 1);

    return (
        <div className="relative overflow-hidden rounded-2xl mb-3 h-auto min-h-[90px]">
            {/* Background Action (Delete) */}
            <div 
                className="absolute inset-0 bg-red-500 rounded-2xl flex items-center justify-end pr-5 transition-opacity duration-200"
                style={{ opacity: deleteOpacity }}
            >
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <span>EXCLUIR</span>
                    <TrashIcon className="w-5 h-5" />
                </div>
            </div>

            {/* Foreground Content */}
            <div 
                className={`relative bg-[var(--bg-secondary)] p-4 flex items-start space-x-4 border border-[var(--border-color)] transition-transform duration-200 ease-out active:scale-[0.99] rounded-2xl w-full z-10 ${notification.read ? 'opacity-60' : 'shadow-sm'}`}
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
                <div className="relative">
                    <NotificationIcon type={notification.type} />
                    {!notification.read && (
                        <div className="absolute top-0 right-0 w-3 h-3 bg-[var(--accent-color)] rounded-full border-2 border-[var(--bg-secondary)] animate-pulse"></div>
                    )}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-primary)] px-2 py-0.5 rounded-full border border-[var(--border-color)] uppercase tracking-wider">
                            {notification.type.replace('_', ' ')}
                        </span>
                        <p className="text-[10px] text-[var(--text-secondary)] opacity-70">{new Date(notification.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    
                    <p className={`text-sm font-bold truncate ${notification.read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>{notification.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 leading-relaxed">{notification.description}</p>
                    
                    {notification.relatedTicker && (
                        <div className="flex justify-end mt-2">
                            <div className="flex items-center text-[var(--accent-color)] text-[10px] font-bold gap-0.5 bg-[var(--accent-color)]/5 px-2 py-1 rounded-md">
                                VER ATIVO <ChevronRightIcon className="w-3 h-3" />
                            </div>
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
        }, 1000); 
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
        { id: 'dividend_confirmed', label: t('notif_filter_dividend') },
        { id: 'price_alert', label: t('notif_filter_price') },
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
                        <button onClick={handleClearAll} className="text-xs font-bold text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
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
                    <button key={f.id} onClick={() => { setActiveFilter(f.id); vibrate(); }} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeFilter === f.id ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow-md' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            {notifications.length > 0 ? (
                <div className="space-y-6 pb-24 md:pb-6 overflow-y-auto overflow-x-hidden custom-scrollbar landscape-pb-6">
                    {(Object.keys(groupedNotifications) as Array<keyof typeof groupedNotifications>).map(groupKey => 
                        groupedNotifications[groupKey].length > 0 && (
                            <div key={groupKey}>
                                <h2 className="text-[10px] font-bold text-[var(--text-secondary)] mb-3 uppercase tracking-wider sticky top-0 bg-[var(--bg-primary)] py-1 z-10">{groupTitles[groupKey]}</h2>
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
                  <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4 opacity-50 border border-[var(--border-color)]">
                      <div className="text-3xl">💤</div>
                  </div>
                  <p className="font-bold text-lg">{t('no_notifications_title')}</p>
                  <p className="text-xs mt-2 max-w-[220px] leading-relaxed">{t('no_notifications_subtitle')}</p>
                </div>
            )}
        </div>
    );
};

export default NotificationsView;
