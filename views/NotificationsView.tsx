
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
import InfoIcon from '../components/icons/InfoIcon';
import DollarSignIcon from '../components/icons/DollarSignIcon';
import AlertTriangleIcon from '../components/icons/AlertTriangleIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';

const NotificationIcon: React.FC<{ type: NotificationType }> = ({ type }) => {
    let icon, color;
    switch (type) {
        case 'dividend_confirmed':
            icon = <DollarSignIcon className="w-5 h-5"/>;
            color = 'text-emerald-500';
            break;
        case 'price_alert':
            icon = <AlertTriangleIcon className="w-5 h-5"/>;
            color = 'text-amber-500';
            break;
        case 'milestone':
            icon = <TrendingUpIcon className="w-5 h-5"/>;
            color = 'text-sky-500';
            break;
        default:
            icon = <InfoIcon className="w-5 h-5"/>;
            color = 'text-gray-400';
    }
    return (
        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-[var(--bg-primary)] border border-[var(--border-color)] ${color}`}>
            {icon}
        </div>
    );
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
        <div className="relative group">
            {/* Background Action (Delete) */}
            <div 
                className="absolute inset-0 bg-red-500 rounded-2xl flex items-center justify-end px-6 transition-opacity duration-200"
                style={{ opacity: deleteOpacity }}
            >
                <TrashIcon className="w-6 h-6 text-white" />
            </div>

            {/* Foreground Content */}
            <div 
                className={`relative bg-[var(--bg-secondary)] p-4 flex items-center gap-4 transition-all duration-200 ease-out active:scale-[0.98] rounded-2xl w-full z-10 ${notification.read ? 'opacity-60' : 'shadow-sm border border-[var(--accent-color)]/20'}`}
                style={{ 
                    transform: `translateX(${offsetX}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.2s ease-out, opacity 0.3s'
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
                         <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[var(--accent-color)] rounded-full border-2 border-[var(--bg-secondary)] shadow-sm animate-pulse"></span>
                    )}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <p className={`text-sm font-bold truncate ${notification.read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>{notification.title}</p>
                        <span className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60 flex-shrink-0 ml-2">
                            {new Date(notification.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-snug line-clamp-2 mt-0.5">{notification.description}</p>
                    
                    {notification.relatedTicker && (
                        <span className="flex items-center text-[var(--accent-color)] text-[10px] font-bold gap-0.5 mt-2 hover:underline">
                            VER ATIVO <ChevronRightIcon className="w-3 h-3" />
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const NotificationsView: React.FC<{ setActiveView: (view: View) => void; onSelectAsset: (ticker: string) => void; onOpenSettings: (screen: MenuScreen) => void; }> = ({ setActiveView, onSelectAsset, onOpenSettings }) => {
    const { t } = useI18n();
    const { notifications, markNotificationsAsRead, markSingleNotificationAsRead, deleteNotification, clearAllNotifications } = usePortfolio();
    
    // Removed automatic read effect to fix user issue.
    // Notifications now stay unread until clicked or "Mark all" is used.

    const handleNotificationClick = (notification: AppNotification) => {
        markSingleNotificationAsRead(notification.id);
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

    const handleMarkAllRead = () => {
        vibrate();
        markNotificationsAsRead();
    };

    const goToSettings = () => {
        vibrate();
        onOpenSettings('notifications');
    };

    const groupedNotifications = useMemo(() => {
        const groups: { [key: string]: AppNotification[] } = { today: [], yesterday: [], older: [] };
        const todayDate = new Date().toDateString();
        const yesterdayDate = new Date(Date.now() - 86400000).toDateString();

        // Sort by newest first
        const sorted = [...notifications].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        for (const n of sorted) {
            const nDate = new Date(n.date).toDateString();
            if (nDate === todayDate) groups.today.push(n);
            else if (nDate === yesterdayDate) groups.yesterday.push(n);
            else groups.older.push(n);
        }
        return groups;
    }, [notifications]);

    const groupTitles = { today: t('today'), yesterday: t('yesterday'), older: t('older') };
    const hasUnread = notifications.some(n => !n.read);
    
    return (
        <div className="h-full flex flex-col overflow-x-hidden">
             <div className="flex items-center justify-between p-4 pb-2">
                 <div className="flex items-center">
                    <button onClick={() => setActiveView('dashboard')} className="p-2 -ml-2 mr-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary-hover)] transition-all duration-200 active:scale-95" aria-label={t('back')}>
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <h1 className="text-2xl font-bold">{t('notifications')}</h1>
                 </div>
                 <div className="flex space-x-2 items-center">
                    {notifications.length > 0 && (
                        <>
                            {hasUnread && (
                                <button onClick={handleMarkAllRead} className="p-2 rounded-full text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 transition-colors" aria-label={t('mark_all_as_read')}>
                                    <CheckCircleIcon className="w-5 h-5" />
                                </button>
                            )}
                            <button onClick={handleClearAll} className="p-2 rounded-full text-red-500/80 hover:text-red-500 hover:bg-red-500/10 transition-colors" aria-label={t('clear_all')}>
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </>
                    )}
                    <button onClick={goToSettings} className="p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary-hover)] transition-colors" aria-label="Configurações">
                        <SettingsIcon className="w-5 h-5" />
                    </button>
                 </div>
            </div>

            {notifications.length > 0 ? (
                <div className="flex-1 space-y-6 p-4 pb-24 md:pb-6 overflow-y-auto overflow-x-hidden custom-scrollbar landscape-pb-6">
                    {(Object.keys(groupedNotifications) as Array<keyof typeof groupedNotifications>).map(groupKey => 
                        groupedNotifications[groupKey].length > 0 && (
                            <div key={groupKey} className="relative">
                                <h2 className="text-[10px] font-bold text-[var(--text-secondary)] mb-3 uppercase tracking-wider sticky top-0 bg-[var(--bg-primary)]/80 backdrop-blur-md py-2 z-20 px-1 flex items-center justify-between">
                                    {groupTitles[groupKey]}
                                    <span className="bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full border border-[var(--border-color)]">{groupedNotifications[groupKey].length}</span>
                                </h2>
                                <div className="space-y-3">
                                    {groupedNotifications[groupKey].map((notification, index) => (
                                        <div className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                                            <SwipeableNotificationItem 
                                                key={notification.id}
                                                notification={notification}
                                                onClick={handleNotificationClick}
                                                onDelete={deleteNotification}
                                            />
                                        </div>
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
