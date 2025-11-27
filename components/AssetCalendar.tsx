
import React, { useState, useMemo } from 'react';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import { useI18n } from '../contexts/I18nContext';
import { vibrate } from '../utils';

interface CalendarEvent {
    date: string; // YYYY-MM-DD
    type: 'payment' | 'ex';
    value?: number;
}

interface AssetCalendarProps {
    events: CalendarEvent[];
    onDateSelect: (date: string) => void;
    selectedDate: string | null;
}

const AssetCalendar: React.FC<AssetCalendarProps> = ({ events, onDateSelect, selectedDate }) => {
    const { locale } = useI18n();
    // Initialize with current date or selected date
    const [currentMonth, setCurrentMonth] = useState(() => {
        if (selectedDate) return new Date(selectedDate);
        return new Date();
    });

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month, 1).getDay();
    };

    const handlePrevMonth = () => {
        vibrate();
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        vibrate();
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const monthName = currentMonth.toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : 'en-US', { month: 'long', year: 'numeric' });

    // Generate grid
    const days = [];
    // Empty slots for days before the 1st
    for (let i = 0; i < firstDay; i++) {
        days.push(null);
    }
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    const eventMap = useMemo(() => {
        const map: Record<string, 'payment' | 'ex'> = {};
        events.forEach(e => {
            map[e.date] = e.type;
        });
        return map;
    }, [events]);

    const handleDayClick = (day: number) => {
        vibrate();
        const year = currentMonth.getFullYear();
        const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayStr}`;
        onDateSelect(dateStr);
    };

    const weekDays = locale === 'pt-BR' ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-4 shadow-sm animate-fade-in-up">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <button onClick={handlePrevMonth} className="p-1 rounded-full hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)]">
                    <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <span className="font-bold text-[var(--text-primary)] capitalize">{monthName}</span>
                <button onClick={handleNextMonth} className="p-1 rounded-full hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)]">
                    <ChevronRightIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 mb-2">
                {weekDays.map((day, i) => (
                    <div key={i} className="text-center text-[10px] font-bold text-[var(--text-secondary)]">
                        {day}
                    </div>
                ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-y-2">
                {days.map((day, index) => {
                    if (day === null) return <div key={`empty-${index}`} />;

                    const year = currentMonth.getFullYear();
                    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
                    const dayStr = String(day).padStart(2, '0');
                    const dateStr = `${year}-${month}-${dayStr}`;
                    
                    const hasEvent = eventMap[dateStr];
                    const isSelected = selectedDate === dateStr;
                    const isToday = new Date().toISOString().split('T')[0] === dateStr;

                    return (
                        <div key={day} className="flex justify-center">
                            <button
                                onClick={() => handleDayClick(day)}
                                className={`
                                    w-8 h-8 rounded-full flex flex-col items-center justify-center text-xs font-medium transition-all relative
                                    ${isSelected ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow-lg scale-110 z-10' : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary-hover)]'}
                                    ${isToday && !isSelected ? 'border border-[var(--accent-color)] text-[var(--accent-color)]' : ''}
                                `}
                            >
                                {day}
                                {hasEvent && !isSelected && (
                                    <div className={`absolute bottom-1 w-1 h-1 rounded-full ${hasEvent === 'payment' ? 'bg-[var(--green-text)]' : 'bg-blue-400'}`}></div>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
            
            {/* Legend */}
            <div className="flex gap-4 mt-4 justify-center">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[var(--green-text)]"></div>
                    <span className="text-[10px] text-[var(--text-secondary)]">Pagamento</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full border border-[var(--accent-color)]"></div>
                    <span className="text-[10px] text-[var(--text-secondary)]">Hoje</span>
                </div>
            </div>
        </div>
    );
};

export default AssetCalendar;
