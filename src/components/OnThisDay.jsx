import React, { useState, useEffect } from 'react';
import { Calendar, RefreshCw, ExternalLink } from 'lucide-react';

export default function OnThisDay() {
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchOnThisDay = async () => {
        setLoading(true);
        setError(null);
        try {
            const today = new Date();
            const month = today.getMonth() + 1;
            const day = today.getDate();
            const cacheKey = `onthisday_${month}_${day}`;

            // Check cache first
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const age = Date.now() - timestamp;
                // Cache for 24 hours
                if (age < 24 * 60 * 60 * 1000) {
                    setEvent(data);
                    setLoading(false);
                    return;
                }
            }

            // Use the proxy configured in vite.config.js
            const response = await fetch(`/api/zenquotes/${month}/${day}`);

            if (!response.ok) {
                throw new Error('Failed to fetch data');
            }

            const data = await response.json();

            // ZenQuotes returns an array of events. We'll pick one random interesting one.
            // Filter for "Events" type if possible, or just take any valid entry.
            // The API structure is typically an array of objects with 'text' and 'year'.

            if (data && data.length > 0) {
                // Filter out births/deaths if we only want events, but the API mixes them.
                // Let's just pick a random one to keep it fresh.
                const randomEvent = data[Math.floor(Math.random() * data.length)];
                setEvent(randomEvent);

                // Cache the result
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: randomEvent,
                    timestamp: Date.now()
                }));
            } else {
                setError('No events found for today.');
            }
        } catch (err) {
            console.error('Error fetching On This Day:', err);
            setError('Could not load history.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOnThisDay();
    }, []);

    if (error) return null; // Hide component on error to not clutter UI

    return (
        <div className="w-full max-w-4xl mx-auto mt-12 mb-8 px-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700/50 shadow-2xl p-8">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                    {/* Icon & Date */}
                    <div className="flex flex-col items-center justify-center bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 min-w-[100px]">
                        <Calendar className="w-8 h-8 text-indigo-400 mb-2" />
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">On This Day</span>
                        <span className="text-xl font-bold text-white">
                            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        {loading ? (
                            <div className="animate-pulse space-y-3">
                                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-baseline gap-3 mb-2">
                                    <span className="text-3xl font-serif font-bold text-indigo-400">
                                        {event?.year}
                                    </span>
                                    <div className="h-px flex-1 bg-gradient-to-r from-gray-700 to-transparent"></div>
                                </div>
                                <p className="text-lg text-gray-300 font-serif leading-relaxed">
                                    {event?.text}
                                </p>
                                <div className="mt-4 flex items-center gap-4">
                                    <button
                                        onClick={fetchOnThisDay}
                                        className="text-xs flex items-center gap-1.5 text-gray-500 hover:text-indigo-400 transition-colors"
                                        title="Load another event"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        Refresh Event
                                    </button>
                                    <a
                                        href={`https://en.wikipedia.org/wiki/${event?.text?.split(' ')[0]}`} // Naive link attempt, mostly for show or if the text starts with a keyword
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs flex items-center gap-1.5 text-gray-500 hover:text-indigo-400 transition-colors ml-auto"
                                    >
                                        Source: ZenQuotes <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
