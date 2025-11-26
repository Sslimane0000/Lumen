import React, { useMemo } from 'react';
import { format, eachDayOfInterval, subDays, isSameDay, startOfWeek, getDay, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';

export default function ActivityHeatmap({ data, days = 365 }) {
    const { t } = useTranslation();

    // Process data into a map for O(1) lookup
    const activityMap = useMemo(() => {
        const map = new Map();
        if (!data) return map;

        data.forEach(session => {
            const dateStr = session.date.split('T')[0]; // Ensure YYYY-MM-DD
            const current = map.get(dateStr) || { pages: 0, duration: 0, count: 0 };
            map.set(dateStr, {
                pages: current.pages + (session.pagesRead || 0),
                duration: current.duration + (session.duration || 0),
                count: current.count + 1
            });
        });
        return map;
    }, [data]);

    // Generate calendar grid
    const { weeks, maxActivity } = useMemo(() => {
        const today = new Date();
        const startDate = subDays(today, days);
        // Align to start of week (Monday)
        const start = startOfWeek(startDate, { weekStartsOn: 1 });

        const allDays = eachDayOfInterval({ start, end: today });

        const weeks = [];
        let currentWeek = [];
        let maxVal = 0;

        allDays.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const activity = activityMap.get(dateStr);
            const value = activity ? activity.pages : 0; // Base intensity on pages read
            if (value > maxVal) maxVal = value;

            currentWeek.push({
                date: day,
                dateStr,
                value,
                data: activity
            });

            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        });

        // Push partial week if any
        if (currentWeek.length > 0) {
            weeks.push(currentWeek);
        }

        return { weeks, maxActivity: maxVal };
    }, [days, activityMap]);

    const getColor = (value) => {
        if (value === 0) return 'bg-gray-800/50';
        // Simple quartiles relative to max, or fixed thresholds
        // Fixed thresholds might be better for "habit" consistency (e.g. 10 pages is good)
        if (value < 10) return 'bg-green-900/60';
        if (value < 30) return 'bg-green-700/80';
        if (value < 50) return 'bg-green-500';
        return 'bg-green-400';
    };

    return (
        <div className="w-full overflow-x-auto custom-scrollbar pb-2">
            <div className="flex gap-1 min-w-max">
                {weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col gap-1">
                        {week.map((day, dayIdx) => (
                            <div
                                key={day.dateStr}
                                className={`w-3 h-3 rounded-sm ${getColor(day.value)} transition-colors hover:ring-1 hover:ring-white/50 relative group`}
                            >
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover:block w-max">
                                    <div className="bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded border border-gray-700 shadow-xl whitespace-nowrap">
                                        <div className="font-bold text-yellow-500">{format(day.date, 'MMM d, yyyy')}</div>
                                        {day.value > 0 ? (
                                            <>
                                                <div>{day.value} {t('dashboard.pages_read')}</div>
                                                <div className="text-gray-400">{Math.round(day.data.duration / 60)}m read</div>
                                            </>
                                        ) : (
                                            <div className="text-gray-500">No activity</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-end gap-2 mt-2 text-xs text-gray-500">
                <span>Less</span>
                <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-sm bg-gray-800/50"></div>
                    <div className="w-3 h-3 rounded-sm bg-green-900/60"></div>
                    <div className="w-3 h-3 rounded-sm bg-green-700/80"></div>
                    <div className="w-3 h-3 rounded-sm bg-green-500"></div>
                    <div className="w-3 h-3 rounded-sm bg-green-400"></div>
                </div>
                <span>More</span>
            </div>
        </div>
    );
}
