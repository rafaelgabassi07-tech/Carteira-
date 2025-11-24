import React, { useMemo, useState } from 'react';
import type { View, } from '../App';
import type { NotificationType } from '../types';
import type { MenuScreen } from './SettingsView';
import { usePersistentState, vibrate } from '../utils';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { generateNotifications, Notification } from '../services/dynamicDataService';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import SettingsIcon from '../components/icons/SettingsIcon';
import TrashIcon from '../components/icons/TrashIcon';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';

const NotificationIcon: React.FC<{ type: string }> = ({ type }) => {
    switch (type) {
        case 'dividend':
            return <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-500/20 text-[var(--green-text)] font-bold text-lg">$</div>;
        case 'price':
            return <div className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-500/20 text-amber-400 font-bold text-lg">!</div>;
        case 'news':
            return <div className="w-10 h-10 rounded-full flex items-center justify-center bg-sky-500/20 text-[var(--accent-color)] font-bold text-lg">i</div>;
        default:
            return null;
    }
};

const NotificationsView: React.FC<{ setActiveView: (view: View) => void; onSelectAsset: (ticker: string) => void; onOpenSettings: (screen: MenuScreen) => void; }> = ({ setActiveView, onSelectAsset, onOpenSettings }) => {
    const { t } = useI18n();
    const { assets } = usePortfolio();
    
    // Only generate initial notifications if the list is empty (first load behavior)
    // In a real app, this would come from a backend/websocket
    const initialNotifications = useMemo(() => generateNotifications(assets), [assets]);
    
    const [notifications, setNotifications] = usePersistentState<Notification[]>('app-notifications', initialNotifications);
    const [settings] = usePersistentState('notification-settings', { price: true, dividend: true, news: false });
    const [activeFilter, setActiveFilter] = useState<'all' | NotificationType>('all');

    const toggleRead = (id: number) => {
        vibrate(5);
        setNotifications(
            notifications.map(n => n.id === id ? { ...n, read: !n.read } : n)
        );
    };

    const deleteNotification = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        vibrate(10);
        setNotifications(notifications.filter(n => n.id !== id));
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read) {
            toggleRead(notification.id);
        }
        
        if (notification.relatedTicker) {
            vibrate();
            onSelectAsset(notification.relatedTicker);
        }
    };

    const markAllAsRead = () => {
        vibrate();
        setNotifications(notifications.map(n => ({ ...n, read: true })));
    };

    const clearAll = () => {
        vibrate();
        if (window.confirm(t('clear_all') + '?')) {
            setNotifications([]);
        }
    };

    const goToSettings = () => {
        vibrate();
        onOpenSettings('notifications');
    };

    const groupedNotifications = useMemo(() => {
        // First filter by settings (user preference on what types to receive)
        let visible = notifications.filter(n => settings[n.type]);
        
        // Then filter by UI chip
        if (activeFilter !== 'all') {
            visible = visible.filter(n => n.type === activeFilter);
        }

        const groups: { [key: string]: Notification[] } = {
            today: [],
            yesterday: [],
            older: [],
        };

        const todayDate = new Date().toDateString();
        const yesterdayDate = new Date(Date.now() - 86400000).toDateString();

        for (const n of visible) {
            const nDate = new Date(n.date).toDateString();
            if (nDate === todayDate) {
                groups.today.push(n);
            } else if (nDate === yesterdayDate) {
                groups.yesterday.push(n);
            } else {
                groups.older.push(n);
            }
        }
        return groups;
    }, [notifications, settings, activeFilter]);

    const groupTitles = {
        today: t('today'),
        yesterday: t('yesterday'),
        older: t('older')
    };

    const filters: { id: 'all' | NotificationType; label: string }[] = [
        { id: 'all', label: t('notif_filter_all') },
        { id: 'dividend', label: t('notif_filter_dividend') },
        { id: 'price', label: t('notif_filter_price') },
        { id: 'news', label: t('notif_filter_news') },
    ];

    return (
        <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center">
                    <button 
                        onClick={() => setActiveView('carteira')} 
                        className="p-2 -ml-2 mr-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary-hover)] transition-all duration-200 active:scale-95"
                        aria-label={t('back')}
                    >
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <h1 className="text-2xl font-bold">{t('notifications')}</h1>
                 </div>
                 <div className="flex space-x-2">
                    <button 
                        onClick={goToSettings} 
                        className="p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary-hover)] transition-colors"
                        aria-label="Configurações"
                    >
                        <SettingsIcon className="w-5 h-5" />
                    </button>
                    {notifications.some(n => !n.read) && (
                        <button onClick={markAllAsRead} className="text-xs bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-bold px-3 py-1.5 rounded-lg flex items-center whitespace-nowrap">
                            Lidas
                        </button>
                    )}
                 </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
                {filters.map(f => (
                    <button
                        key={f.id}
                        onClick={() => { setActiveFilter(f.id); vibrate(); }}
                        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeFilter === f.id ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow-md' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {Object.values(groupedNotifications).some((g: Notification[]) => g.length > 0) ? (
                <div className="space-y-6 pb-24 md:pb-6 overflow-y-auto custom-scrollbar landscape-pb-6">
                    {(Object.keys(groupedNotifications) as Array<keyof typeof groupedNotifications>).map(groupKey => 
                        groupedNotifications[groupKey].length > 0 && (
                            <div key={groupKey}>
                                <h2 className="text-xs font-bold text-[var(--text-secondary)] mb-3 uppercase tracking-wider sticky top-0 bg-[var(--bg-primary)] py-1 z-10">{groupTitles[groupKey]}</h2>
                                <div className="space-y-3">
                                    {groupedNotifications[groupKey].map((notification, index) => (
                                        <div 
                                            key={notification.id} 
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`relative overflow-hidden bg-[var(--bg-secondary)] p-4 rounded-xl flex items-start space-x-4 cursor-pointer transition-all border border-[var(--border-color)] active:scale-[0.98] animate-fade-in-up group hover:border-[var(--accent-color)]/30 ${notification.read ? 'opacity-60' : 'shadow-sm border-l-4 border-l-[var(--accent-color)]'}`}
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            <NotificationIcon type={notification.type} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <p className={`text-sm font-bold truncate ${notification.read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>{notification.title}</p>
                                                    {/* Delete Button (Visible on hover or touch actions in future) */}
                                                    <button 
                                                        onClick={(e) => deleteNotification(e, notification.id)}
                                                        className="text-gray-400 hover:text-red-500 p-1.5 -mr-2 -mt-2 rounded-full hover:bg-[var(--bg-primary)] transition-colors z-10"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                                <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 leading-relaxed">{notification.description}</p>
                                                <div className="flex justify-between items-center mt-2">
                                                    <p className="text-[10px] text-[var(--text-secondary)] opacity-70">{new Date(notification.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                                    {notification.relatedTicker && (
                                                        <div className="flex items-center text-[var(--accent-color)] text-[10px] font-bold gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            VER ATIVO <ChevronRightIcon className="w-4 h-4" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    )}
                     <div className="text-center mt-8 mb-4">
                        <button onClick={clearAll} className="text-xs text-red-400 font-bold hover:underline py-2 px-4 rounded-lg hover:bg-red-500/10 transition-colors">{t('clear_all')}</button>
                     </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--text-secondary)] pb-20 animate-fade-in">
                  <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4 opacity-50 border border-[var(--border-color)]">
                      <div className="text-3xl">💤</div>
                  </div>
                  <p className="font-bold text-lg">{t('no_notifications_title')}</p>
                  <p className="text-xs mt-2 max-w-[220px] leading-relaxed">{t('no_notifications_subtitle')}</p>
                  
                  <button onClick={goToSettings} className="mt-6 text-xs font-bold text-[var(--accent-color)] hover:underline">
                      Gerenciar Preferências
                  </button>
                </div>
            )}
        </div>
    );
};

export default NotificationsView;