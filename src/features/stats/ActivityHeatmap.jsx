import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { format, eachDayOfInterval, subDays, isSameDay, startOfWeek, endOfWeek, getDay, parseISO } from 'date-fns';
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

    // Generate calendar grid for the current year
    const { weeks, maxActivity } = useMemo(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);

        // Align to start of week (Monday) to ensure the grid is square/aligned
        const start = startOfWeek(startOfYear, { weekStartsOn: 1 });

        // End at today
        const end = today;

        const allDays = eachDayOfInterval({ start, end });

        const weeks = [];
        let currentWeek = [];
        let maxVal = 0;

        allDays.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isCurrentYear = day.getFullYear() === currentYear;
            const activity = activityMap.get(dateStr);
            const value = activity ? activity.pages : 0;

            if (value > maxVal) maxVal = value;

            currentWeek.push({
                date: day,
                dateStr,
                value,
                data: activity,
                isCurrentYear
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
    }, [data, activityMap]);

    const getColor = (day) => {
        if (!day.isCurrentYear) return 'bg-transparent ring-0'; // Invisible padding days
        if (day.value === 0) return 'bg-gray-700';
        if (day.value < 10) return 'bg-green-900/60';
        if (day.value < 30) return 'bg-green-700/80';
        if (day.value < 50) return 'bg-green-500';
        return 'bg-green-400';
    };

    const [tooltipData, setTooltipData] = React.useState(null);

    const handleMouseEnter = (e, day) => {
        if (!day.isCurrentYear) return; // Don't show tooltip for padding days
        const rect = e.target.getBoundingClientRect();
        setTooltipData({
            ...day,
            x: rect.left + rect.width / 2,
            y: rect.top - 8
        });
    };

    const handleMouseLeave = () => {
        setTooltipData(null);
    };

    return (
        <div className="w-full overflow-x-auto custom-scrollbar pb-2">
            <div className="flex gap-1 min-w-max">
                {weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col gap-1">
                        {week.map((day, dayIdx) => (
                            <div
                                key={day.dateStr}
                                onMouseEnter={(e) => handleMouseEnter(e, day)}
                                onMouseLeave={handleMouseLeave}
                                className={`w-3 h-3 rounded-sm ${getColor(day)} ${day.isCurrentYear ? 'transition-colors hover:ring-1 hover:ring-white/50 cursor-pointer' : ''}`}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-2 text-xs text-gray-500">
                <span>Less</span>
                <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-sm bg-gray-700"></div>
                    <div className="w-3 h-3 rounded-sm bg-green-900/60"></div>
                    <div className="w-3 h-3 rounded-sm bg-green-700/80"></div>
                    <div className="w-3 h-3 rounded-sm bg-green-500"></div>
                    <div className="w-3 h-3 rounded-sm bg-green-400"></div>
                </div>
                <span>More</span>
            </div>

            {/* Portal Tooltip */}
            {tooltipData && createPortal(
                <div
                    className="fixed z-[9999] pointer-events-none transform -translate-x-1/2 -translate-y-full pb-2"
                    style={{ left: tooltipData.x, top: tooltipData.y }}
                >
                    <div className="bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded border border-gray-700 shadow-xl whitespace-nowrap">
                        <div className="font-bold text-yellow-500">{format(tooltipData.date, 'MMM d, yyyy')}</div>
                        {tooltipData.value > 0 ? (
                            <>
                                <div>{tooltipData.value} {t('dashboard.pages_read')}</div>
                                <div className="text-gray-400">{Math.round(tooltipData.data.duration / 60)}m read</div>
                            </>
                        ) : (
                            <div className="text-gray-500">No activity</div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
