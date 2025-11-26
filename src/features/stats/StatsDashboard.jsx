import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats as getSessions, getAchievements, resetStatsAndVocab, getVocabularyCount, deleteSession, addManualSession, getBooks, unlockAllAchievements, ACHIEVEMENT_RULES } from '../../utils/db';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trash2, AlertTriangle, Trophy, Lock, ArrowLeft, BookOpen, X, BookA, Plus } from 'lucide-react';
import { useSync } from '../../context/SyncContext';
import { STORY_CHAPTERS } from '../../data/story';
import { EXTRA_LORE } from '../../data/extraLore';
import { LORE_LOCATIONS } from '../../data/loreLocations';
import { useDictionary } from '../../hooks/useDictionary';
import DictionaryPopup from '../dictionary/DictionaryPopup';


import SettingsTab from '../settings/SettingsTab';
import VocabularyLog from '../dictionary/VocabularyLog';
import { BarChart2, Book, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function StatsDashboard({ initialTab = 'stats' }) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    // Dictionary Hook
    const {
        selectedWord,
        definition,
        suggestions,
        popupPosition,
        handleWordSelect,
        handleSelectSuggestion,
        handleSaveWord,
        closePopup
    } = useDictionary();

    const handleTextSelection = (e) => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text && text.length > 1) {
            // Get selection coordinates
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            handleWordSelect(text, {
                x: rect.left + (rect.width / 2),
                y: rect.bottom
            });
        }
    };
    const chartContainerRef = useRef(null);
    const [stats, setStats] = useState([]);
    const [weeklyData, setWeeklyData] = useState([]);
    const [achievements, setAchievements] = useState([]);
    const [vocabCount, setVocabCount] = useState(0);
    const [showDangerZone, setShowDangerZone] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [loading, setLoading] = useState(true);
    const [chartWidth, setChartWidth] = useState(0);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [showOdysseySelect, setShowOdysseySelect] = useState(false);
    const [activeTab, setActiveTab] = useState(initialTab);

    const { isSyncing, resetRemoteStatsAndVocab } = useSync();

    // Manual Entry State
    const [showManualForm, setShowManualForm] = useState(false);
    const [books, setBooks] = useState([]);
    const [manualEntry, setManualEntry] = useState({
        bookId: '',
        pagesRead: '',
        date: new Date().toISOString().split('T')[0],
        duration: ''
    });

    useEffect(() => {
        if (activeTab === 'stats') {
            loadStats();
        }
    }, [isSyncing, activeTab]);

    useEffect(() => {
        const updateWidth = () => {
            if (chartContainerRef.current) {
                setChartWidth(chartContainerRef.current.offsetWidth);
            }
        };

        if (activeTab === 'stats') {
            // Initial measure
            updateWidth();
            // Resize listener
            window.addEventListener('resize', updateWidth);
            // Also use ResizeObserver for container resize
            const observer = new ResizeObserver(updateWidth);
            if (chartContainerRef.current) {
                observer.observe(chartContainerRef.current);
            }
            return () => {
                window.removeEventListener('resize', updateWidth);
                observer.disconnect();
            };
        }
    }, [activeTab]);

    const loadStats = async () => {
        const sessions = await getSessions();
        setStats(sessions);
        processWeeklyData(sessions);

        const ach = await getAchievements();
        setAchievements(ach);

        const count = await getVocabularyCount();
        setVocabCount(count);

        const allBooks = await getBooks();
        setBooks(allBooks);

        setLoading(false);
    };

    // ... (keep existing helper functions like processWeeklyData, formatDuration, handleReset, etc.)

    const processWeeklyData = (sessions) => {
        const start = startOfWeek(new Date(), { weekStartsOn: 1 });
        const end = endOfWeek(new Date(), { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start, end });

        const data = days.map(day => {
            const daySessions = sessions.filter(s => isSameDay(new Date(s.date), day));
            const totalDuration = daySessions.reduce((acc, s) => acc + s.duration, 0);
            return {
                name: format(day, 'EEE'),
                minutes: Math.round(totalDuration / 60),
                date: day
            };
        });

        setWeeklyData(data);
    };

    const formatDuration = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hrs > 0) {
            return `${hrs}h ${mins}m ${secs}s`;
        }
        return `${mins}m ${secs}s`;
    };

    const handleReset = async () => {
        if (deleteConfirm === 'DELETE') {
            await resetStatsAndVocab();
            await resetRemoteStatsAndVocab(); // Sync deletion
            setStats([]);
            setWeeklyData([]);
            setAchievements([]); // Clear UI
            setVocabCount(0);
            setShowDangerZone(false);
            setDeleteConfirm('');
            alert(t('dashboard.reset_alert'));
        }
    };

    const handleDeleteSession = async (sessionId) => {
        if (window.confirm(t('dashboard.confirm_delete_session'))) {
            await deleteSession(sessionId);
            loadStats();
        }
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        if (!manualEntry.bookId || !manualEntry.pagesRead || !manualEntry.date) return;

        await addManualSession({
            bookId: parseInt(manualEntry.bookId),
            pagesRead: parseInt(manualEntry.pagesRead),
            date: manualEntry.date,
            duration: parseInt(manualEntry.duration) || 0
        });

        setShowManualForm(false);
        setManualEntry({
            bookId: '',
            pagesRead: '',
            date: new Date().toISOString().split('T')[0],
            duration: ''
        });
        loadStats();
    };

    // Helper function to render content with clickable locations
    const renderContentWithLocations = (content) => {
        if (!content) return [];

        // Create a mapping of translated names to location objects
        const locationMap = {};
        Object.values(LORE_LOCATIONS).forEach(location => {
            // Get the translated name using the key
            const translatedName = location.nameKey ? t(location.nameKey) : location.name;
            if (translatedName) {
                locationMap[translatedName.toLowerCase()] = location;
            }
            // Also map the original English name as a fallback
            if (location.name) {
                locationMap[location.name.toLowerCase()] = location;
            }
        });

        // Create a regex pattern from all location names (translated and original), sorted by length
        const locationNames = Object.keys(locationMap).sort((a, b) => b.length - a.length);

        if (locationNames.length === 0) return [{ type: 'text', content }];

        const pattern = new RegExp(`(${locationNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');

        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = pattern.exec(content)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push({
                    type: 'text',
                    content: content.substring(lastIndex, match.index)
                });
            }

            // Find the location object using the matched text (normalized to lowercase)
            const matchedText = match[0].toLowerCase();
            const location = locationMap[matchedText];

            // Add the location match
            if (location) {
                parts.push({
                    type: 'location',
                    content: match[0], // Keep original casing from text
                    location: location
                });
            } else {
                // Fallback if something weird happens (shouldn't happen due to regex construction)
                parts.push({
                    type: 'text',
                    content: match[0]
                });
            }

            lastIndex = pattern.lastIndex;
        }

        // Add remaining text
        if (lastIndex < content.length) {
            parts.push({
                type: 'text',
                content: content.substring(lastIndex)
            });
        }

        return parts;
    };

    // Group sessions by date (Today, Yesterday, Date)
    const groupedSessions = stats.slice().reverse().reduce((groups, session) => {
        const date = new Date(session.date);
        let key = format(date, 'MMMM d, yyyy');
        if (isSameDay(date, new Date())) key = 'Today';
        else if (isSameDay(date, subDays(new Date(), 1))) key = 'Yesterday';

        if (!groups[key]) groups[key] = [];
        groups[key].push(session);
        return groups;
    }, {});

    return (
        <div className="p-6 max-w-4xl mx-auto text-gray-100">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h2 className="text-2xl font-bold text-white">{t('dashboard.title')}</h2>
                </div>

                {/* Tab Navigation */}
                <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'stats'
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                    >
                        <BarChart2 className="w-4 h-4" />
                        {t('dashboard.stats')}
                    </button>
                    <button
                        onClick={() => setActiveTab('vocabulary')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'vocabulary'
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                    >
                        <Book className="w-4 h-4" />
                        {t('dashboard.vocabulary')}
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'settings'
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                    >
                        <Settings className="w-4 h-4" />
                        {t('dashboard.settings')}
                    </button>
                </div>

                {activeTab === 'stats' && (
                    <button
                        onClick={() => setShowManualForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        {t('dashboard.add_entry')}
                    </button>
                )}
            </div>

            {/* Content Area */}
            {activeTab === 'stats' && (
                <>
                    {/* Stats Overview Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {/* Weekly Activity Chart */}
                        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                            <h3 className="text-lg font-semibold mb-4 text-gray-300">{t('dashboard.weekly_activity')}</h3>
                            <div ref={chartContainerRef} className="h-64 w-full" style={{ minHeight: '250px' }}>
                                {loading || chartWidth === 0 ? (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                        {t('dashboard.loading_chart')}
                                    </div>
                                ) : (
                                    <BarChart width={chartWidth} height={250} data={weeklyData}>
                                        <XAxis
                                            dataKey="name"
                                            stroke="#9ca3af"
                                            tick={{ fill: '#9ca3af' }}
                                        />
                                        <YAxis
                                            stroke="#9ca3af"
                                            tick={{ fill: '#9ca3af' }}
                                            label={{ value: t('dashboard.minutes'), angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                                            cursor={{ fill: '#374151', opacity: 0.4 }}
                                        />
                                        <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                                            {weeklyData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={isSameDay(entry.date, new Date()) ? '#818cf8' : '#4f46e5'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                )}
                            </div>
                        </div>

                        {/* Total Vocabulary Card */}
                        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 flex flex-col justify-center items-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                            <div className="p-4 bg-emerald-500/10 rounded-full mb-4">
                                <BookA className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider mb-1">{t('dashboard.total_vocabulary')}</h3>
                            <div className="text-5xl font-bold text-white mb-2">{vocabCount}</div>
                            <p className="text-gray-500 text-sm">{t('dashboard.words_collected')}</p>
                        </div>
                    </div>

                    {/* Achievements Section */}
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg mb-8 border border-gray-700">
                        <h3 className="text-lg font-semibold mb-4 text-gray-300 flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-yellow-500" />
                            {t('dashboard.achievements')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {achievements.filter(a => a.type !== 'vocab' && a.id !== 'odyssey').map((ach) => {
                                const isOdyssey = ach.id === 'odyssey';
                                return (
                                    <div
                                        key={ach.id}
                                        className={`p-4 rounded-lg border transition-all duration-300 ease-out cursor-pointer
                                ${isOdyssey ? 'col-span-1 md:col-span-2 bg-gradient-to-br from-gray-800 to-gray-900 border-yellow-500/50 shadow-xl shadow-yellow-900/20' : ''}
                                ${ach.unlocked
                                                ? isOdyssey
                                                    ? 'border-yellow-400 hover:border-yellow-300 hover:shadow-2xl hover:shadow-yellow-500/30'
                                                    : 'bg-gray-700/50 border-yellow-500/30 hover:border-yellow-400/60 hover:shadow-lg hover:shadow-yellow-500/20'
                                                : 'bg-gray-800 border-gray-700 hover:border-gray-600 hover:shadow-lg'} 
                                hover:scale-[1.02] hover:-translate-y-1`}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`text-2xl transition-all duration-300 ${ach.unlocked ? '' : 'grayscale'} 
                                    group-hover:scale-110 ${isOdyssey ? 'text-4xl' : ''}`}>
                                                {ach.iconImage && !isOdyssey ? (
                                                    <img
                                                        src={ach.iconImage}
                                                        alt={ach.name}
                                                        className={`w-16 h-16 object-contain transition-all duration-300 
                                                ${ach.unlocked ? 'drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' : ''}`}
                                                    />
                                                ) : (
                                                    ach.icon
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className={`font-medium ${ach.unlocked ? 'text-yellow-400' : 'text-gray-400'} ${isOdyssey ? 'text-xl font-serif tracking-wide' : ''}`}>
                                                    {t(ach.nameKey || ach.name)}
                                                </h4>
                                                {ach.unlocked ? (
                                                    <span className="text-xs text-gray-500">
                                                        Unlocked {format(new Date(ach.unlockedAt), 'MMM d')}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-500">
                                                        {isOdyssey ? 'Locked' : `${ach.progress}/${ach.days} days • Streak: ${ach.currentStreak}`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className={`text-xs text-gray-400 mb-2 ${isOdyssey ? 'text-sm text-gray-300 italic' : ''}`}>{t(ach.descriptionKey || ach.description)}</p>

                                        {/* Lore and Motto */}
                                        {(ach.loreKey || ach.lore) && (
                                            <div className={`mb-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700/50 ${isOdyssey ? 'bg-black/40 border-yellow-900/30' : ''}`}>
                                                <p className={`text-xs text-gray-300 leading-relaxed mb-2 ${isOdyssey ? 'text-sm font-serif' : ''}`}>
                                                    {t(ach.loreKey || ach.lore)}
                                                </p>
                                                {(ach.mottoKey || ach.motto) && (
                                                    <p className="text-xs text-yellow-400/80 italic font-medium">"{t(ach.mottoKey || ach.motto)}"</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Progress Bar */}
                                        {!ach.unlocked && !isOdyssey && (
                                            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-500"
                                                    style={{ width: `${(ach.progress / ach.days) * 100}%` }}
                                                />
                                            </div>
                                        )}

                                        {ach.unlocked && (
                                            <div className="mt-4 grid grid-cols-6 gap-2 select-none">
                                                {EXTRA_LORE.filter(l => l.parentAchievementId === ach.id).map(lore => {
                                                    const daysSinceUnlock = ach.unlockedAt ? Math.floor((new Date() - new Date(ach.unlockedAt)) / (1000 * 60 * 60 * 24)) : 0;
                                                    const isUnlocked = ach.unlocked && daysSinceUnlock >= lore.daysAfterUnlock;

                                                    if (!isUnlocked) return null;

                                                    return (
                                                        <div
                                                            key={lore.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedChapter({
                                                                    titleKey: lore.titleKey,
                                                                    subtitleKey: lore.subtitleKey,
                                                                    author: lore.author,
                                                                    length: lore.length,
                                                                    contentKey: lore.contentKey,
                                                                    image: lore.iconImage
                                                                });
                                                            }}
                                                            className="col-span-1 aspect-square rounded-md border border-gray-700 bg-black/40 hover:bg-gray-700 hover:border-yellow-500/50 transition-all duration-300 cursor-pointer flex items-center justify-center group/lore relative select-none"
                                                            title={lore.title}
                                                        >
                                                            <img
                                                                src={lore.iconImage}
                                                                alt={lore.title}
                                                                className="w-12 h-12 object-contain opacity-80 group-hover/lore:opacity-100 transition-opacity"
                                                                style={{ transform: lore.scale ? `scale(${lore.scale})` : 'scale(1)' }}
                                                            />
                                                            {/* Tooltip-like label on hover */}
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[150px] px-2 py-1 bg-gray-900 text-xs text-gray-300 rounded border border-gray-700 opacity-0 group-hover/lore:opacity-100 pointer-events-none transition-opacity z-10">
                                                                {lore.title}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}




                                        {ach.unlocked && (
                                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700/50">
                                                <div className="flex items-center gap-1 text-xs text-yellow-500">
                                                    <Trophy className="w-3 h-3" /> {t('dashboard.completed')}
                                                </div>
                                                {(STORY_CHAPTERS[ach.id] || isOdyssey) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isOdyssey) {
                                                                setShowOdysseySelect(true);
                                                            } else {
                                                                setSelectedChapter(STORY_CHAPTERS[ach.id]);
                                                            }
                                                        }}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 
                                                text-yellow-400 text-xs font-medium rounded-full transition-colors border border-yellow-500/20
                                                ${isOdyssey ? 'px-6 py-2 text-sm bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/40' : ''}`}
                                                    >
                                                        <BookOpen className="w-3 h-3" />
                                                        {isOdyssey ? t('dashboard.read_epic') : t('dashboard.read_chapter')}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Vocabulary Milestones */}
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg mb-8 border border-gray-700">
                        <h3 className="text-lg font-semibold mb-4 text-gray-300 flex items-center gap-2">
                            <BookA className="w-5 h-5 text-emerald-500" />
                            {t('dashboard.vocab_milestones')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {achievements.filter(a => a.type === 'vocab').map((ach) => (
                                <div
                                    key={ach.id}
                                    className={`p-4 rounded-lg border transition-all duration-300 ease-out
                                ${ach.unlocked
                                            ? 'bg-gray-700/50 border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                                            : 'bg-gray-800 border-gray-700'}`}
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`text-2xl ${ach.unlocked ? '' : 'grayscale opacity-50'}`}>
                                            {ach.icon}
                                        </div>
                                        <div>
                                            <h4 className={`font-medium text-sm ${ach.unlocked ? 'text-emerald-400' : 'text-gray-400'}`}>
                                                {t(ach.nameKey || ach.name)}
                                            </h4>
                                            <p className="text-xs text-gray-500">{t(ach.descriptionKey || ach.description)}</p>
                                        </div>
                                    </div>

                                    {!ach.unlocked ? (
                                        <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all duration-500"
                                                style={{ width: `${(ach.progress / ach.totalRequired) * 100}%` }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                                            <Trophy className="w-3 h-3" /> {t('dashboard.unlocked')}
                                        </div>
                                    )}
                                    {!ach.unlocked && (
                                        <p className="text-xs text-gray-500 mt-1 text-right">
                                            {ach.progress} / {ach.totalRequired}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Story Chapter Modal */}
                    {selectedChapter && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                            onClick={() => setSelectedChapter(null)}
                        >
                            <div
                                className="bg-gray-900 w-full max-w-2xl max-h-[80vh] rounded-xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="p-6 border-b border-gray-800 flex items-start justify-between bg-gray-900/50">
                                    <div>
                                        <h3 className="text-xl font-bold text-yellow-500 mb-1 font-serif tracking-wide">
                                            {selectedChapter.titleKey ? t(selectedChapter.titleKey) : selectedChapter.title}
                                        </h3>
                                        {selectedChapter.subtitle && (
                                            <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">
                                                {selectedChapter.subtitleKey ? t(selectedChapter.subtitleKey) : renderContentWithLocations(selectedChapter.subtitle).map((part, partIdx) => {
                                                    if (part.type === 'location') {
                                                        return (
                                                            <span
                                                                key={partIdx}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedLocation(part.location);
                                                                }}
                                                                className="text-yellow-500 hover:text-yellow-400 hover:underline cursor-pointer transition-colors"
                                                            >
                                                                {part.content}
                                                            </span>
                                                        );
                                                    }
                                                    return part.content;
                                                })}
                                            </p>
                                        )}
                                        {selectedChapter.author && (
                                            <p className="text-xs text-gray-500 mb-1">
                                                {t('dashboard.author')}: {renderContentWithLocations(selectedChapter.author).map((part, partIdx) => {
                                                    if (part.type === 'location') {
                                                        return (
                                                            <span
                                                                key={partIdx}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedLocation(part.location);
                                                                }}
                                                                className="text-yellow-500 hover:text-yellow-400 hover:underline cursor-pointer transition-colors"
                                                            >
                                                                {part.content}
                                                            </span>
                                                        );
                                                    }
                                                    return part.content;
                                                })}
                                            </p>
                                        )}
                                        {selectedChapter.length && (
                                            <p className="text-xs text-gray-500 mb-2">{t('dashboard.length')}: {selectedChapter.length}</p>
                                        )}
                                        <div className="h-1 w-20 bg-yellow-500/30 rounded-full"></div>

                                        {selectedChapter.loreKey && (
                                            <div className="mt-4 p-4 bg-black/40 rounded-lg border border-gray-800/50 backdrop-blur-sm">
                                                <p className="text-sm text-gray-300 italic mb-3 leading-relaxed font-serif">
                                                    "{t(selectedChapter.loreKey)}"
                                                </p>
                                                {selectedChapter.mottoKey && (
                                                    <p className="text-xs text-yellow-500 font-bold tracking-wider text-right uppercase">
                                                        — {t(selectedChapter.mottoKey)}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setSelectedChapter(null)}
                                        className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-8 overflow-y-auto custom-scrollbar bg-gray-900">
                                    <div
                                        className="prose prose-invert prose-yellow max-w-none font-stack"
                                        onMouseUp={handleTextSelection}
                                    >
                                        {selectedChapter.image && (
                                            <div className="flex justify-center mb-6">
                                                <img
                                                    src={selectedChapter.image}
                                                    alt={selectedChapter.title}
                                                    className="max-w-[200px] h-auto rounded-lg"
                                                />
                                            </div>
                                        )}
                                        {(selectedChapter.contentKey ? t(selectedChapter.contentKey) : selectedChapter.content).split('\n\n').map((paragraph, idx) => {
                                            const contentParts = renderContentWithLocations(paragraph);
                                            return (
                                                <p key={idx} className="text-gray-300 leading-relaxed mb-4 text-lg">
                                                    {contentParts.map((part, partIdx) => {
                                                        if (part.type === 'location') {
                                                            return (
                                                                <span
                                                                    key={partIdx}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedLocation(part.location);
                                                                    }}
                                                                    className="text-yellow-300 bg-yellow-500/20 px-1 rounded underline cursor-pointer hover:text-yellow-200 hover:bg-yellow-500/30 transition-all font-semibold"
                                                                >
                                                                    {part.content}
                                                                </span>
                                                            );
                                                        }
                                                        return part.content;
                                                    })}
                                                </p>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between">
                                    {(() => {
                                        // Get all available chapters in order
                                        const odysseyChapters = ACHIEVEMENT_RULES
                                            .filter(rule => rule.id !== 'odyssey' && STORY_CHAPTERS[rule.id])
                                            .map(rule => ({
                                                ...STORY_CHAPTERS[rule.id],
                                                subtitle: rule.name,
                                                subtitleKey: rule.nameKey,
                                                loreKey: rule.loreKey,
                                                mottoKey: rule.mottoKey,
                                                id: rule.id
                                            }));

                                        const currentIndex = odysseyChapters.findIndex(c => c.title === selectedChapter.title);
                                        const hasPrev = currentIndex > 0;
                                        const hasNext = currentIndex < odysseyChapters.length - 1;

                                        if (currentIndex === -1) {
                                            // Not part of the Odyssey sequence (e.g. single chapter view)
                                            return (
                                                <p className="text-xs text-gray-500 italic w-full text-center">
                                                    {selectedChapter.subtitle ? t('dashboard.journey_continues') : t('dashboard.unlock_next')}
                                                </p>
                                            );
                                        }

                                        return (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (hasPrev) setSelectedChapter(odysseyChapters[currentIndex - 1]);
                                                    }}
                                                    disabled={!hasPrev}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                                ${hasPrev
                                                            ? 'text-yellow-500 hover:bg-yellow-500/10'
                                                            : 'text-gray-600 cursor-not-allowed'}`}
                                                >
                                                    <ArrowLeft className="w-4 h-4" />
                                                    {t('dashboard.previous')}
                                                </button>

                                                <span className="text-xs text-gray-500 font-serif">
                                                    {t('dashboard.part')} {currentIndex + 1} {t('dashboard.of')} {odysseyChapters.length}
                                                </span>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (hasNext) setSelectedChapter(odysseyChapters[currentIndex + 1]);
                                                    }}
                                                    disabled={!hasNext}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                                ${hasNext
                                                            ? 'text-yellow-500 hover:bg-yellow-500/10'
                                                            : 'text-gray-600 cursor-not-allowed'}`}
                                                >
                                                    {t('dashboard.next')}
                                                    <ArrowLeft className="w-4 h-4 rotate-180" />
                                                </button>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Odyssey Chapter Selection Modal */}
                    {showOdysseySelect && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
                            onClick={() => setShowOdysseySelect(false)}
                        >
                            <div
                                className="bg-gray-900 w-full max-w-4xl max-h-[85vh] rounded-xl border border-yellow-900/50 shadow-2xl overflow-hidden flex flex-col"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="p-8 border-b border-yellow-900/30 bg-gradient-to-r from-gray-900 to-gray-800 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-3xl font-bold text-yellow-500 font-serif tracking-wider mb-2">{t('dashboard.odyssey_title')}</h2>
                                        <p className="text-gray-400 italic">{t('dashboard.odyssey_subtitle')}</p>
                                    </div>
                                    <button
                                        onClick={() => setShowOdysseySelect(false)}
                                        className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="p-8 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {ACHIEVEMENT_RULES
                                        .filter(rule => rule.id !== 'odyssey' && STORY_CHAPTERS[rule.id])
                                        .map((rule, index) => {
                                            const chapter = STORY_CHAPTERS[rule.id];
                                            return (
                                                <button
                                                    key={rule.id}
                                                    onClick={() => {
                                                        setSelectedChapter({
                                                            title: chapter.title,
                                                            subtitle: rule.name,
                                                            subtitleKey: rule.nameKey,
                                                            loreKey: rule.loreKey,
                                                            mottoKey: rule.mottoKey,
                                                            content: chapter.content
                                                        });
                                                        setShowOdysseySelect(false);
                                                    }}
                                                    className="group text-left p-6 rounded-lg border border-gray-800 bg-gray-800/50 hover:bg-gray-800 hover:border-yellow-500/30 transition-all duration-300"
                                                >
                                                    <span className="text-xs font-bold text-yellow-500/50 uppercase tracking-widest mb-2 block group-hover:text-yellow-500 transition-colors">
                                                        {t('dashboard.part')} {index + 1}
                                                    </span>
                                                    <h3 className="text-lg font-medium text-gray-200 group-hover:text-white mb-2 font-serif">
                                                        {chapter.title}
                                                    </h3>
                                                    <p className="text-sm text-gray-500 line-clamp-2 group-hover:text-gray-400">
                                                        {rule.name}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Manual Entry Modal */}
                    {showManualForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                            onClick={() => setShowManualForm(false)}
                        >
                            <div
                                className="bg-gray-800 w-full max-w-md rounded-xl border border-gray-700 shadow-2xl p-6"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-white">{t('dashboard.add_reading_entry')}</h3>
                                    <button
                                        onClick={() => setShowManualForm(false)}
                                        className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleManualSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('dashboard.book')}</label>
                                        <select
                                            value={manualEntry.bookId}
                                            onChange={(e) => setManualEntry({ ...manualEntry, bookId: e.target.value })}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            required
                                        >
                                            <option value="">{t('dashboard.select_book')}</option>
                                            {books.map(book => (
                                                <option key={book.id} value={book.id}>{book.title}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('dashboard.pages_read')}</label>
                                        <input
                                            type="number"
                                            value={manualEntry.pagesRead}
                                            onChange={(e) => setManualEntry({ ...manualEntry, pagesRead: e.target.value })}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            required
                                            min="1"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('dashboard.date')}</label>
                                        <input
                                            type="date"
                                            value={manualEntry.date}
                                            onChange={(e) => setManualEntry({ ...manualEntry, date: e.target.value })}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('dashboard.duration')}</label>
                                        <input
                                            type="number"
                                            value={manualEntry.duration}
                                            onChange={(e) => setManualEntry({ ...manualEntry, duration: e.target.value })}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            min="0"
                                        />
                                    </div>

                                    <div className="flex justify-end gap-3 mt-6">
                                        <button
                                            type="button"
                                            onClick={() => setShowManualForm(false)}
                                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                        >
                                            {t('dashboard.cancel')}
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                                        >
                                            {t('dashboard.save_entry')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Recent Sessions */}
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg mb-8 border border-gray-700">
                        <h3 className="text-lg font-semibold mb-4 text-gray-300">{t('stats.recent_sessions')}</h3>
                        <div className="space-y-6">
                            {Object.entries(groupedSessions).map(([dateGroup, sessions]) => (
                                <div key={dateGroup}>
                                    <h4 className="text-sm font-medium text-gray-500 mb-2 sticky top-0 bg-gray-800 py-1">{dateGroup}</h4>
                                    <div className="space-y-2">
                                        {sessions.map((session, index) => (
                                            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0 pl-2 group">
                                                <div>
                                                    <p className="text-gray-300 font-medium flex items-center gap-2">
                                                        {session.manual && <span className="text-xs bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">Manual</span>}
                                                        {session.page ? `Page ${session.page}` : `${session.pagesRead} pages`}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{format(new Date(session.date), 'HH:mm')}</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-indigo-400 font-mono text-sm">{formatDuration(session.duration)}</span>
                                                    <button
                                                        onClick={() => handleDeleteSession(session.id || session.startTime)} // Fallback to startTime if id missing
                                                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Delete session"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {stats.length === 0 && (
                                <p className="text-gray-500 text-center py-4">No reading sessions recorded yet.</p>
                            )}
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="mt-12 border-t border-gray-700 pt-8">
                        <button
                            onClick={() => setShowDangerZone(!showDangerZone)}
                            className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                        >
                            <AlertTriangle className="w-4 h-4" />
                            Danger Zone
                        </button>

                        {
                            showDangerZone && (
                                <div className="mt-4 bg-red-900/20 border border-red-900/50 rounded-lg p-4">
                                    <h4 className="text-red-400 font-medium mb-2">Reset All Data</h4>
                                    <p className="text-red-300/70 text-sm mb-4">
                                        This will permanently delete all reading logs, vocabulary, and statistics. This action cannot be undone.
                                    </p>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            placeholder={t('stats.reset_confirm_placeholder')}
                                            value={deleteConfirm}
                                            onChange={(e) => setDeleteConfirm(e.target.value)}
                                            className="bg-gray-900 border border-red-900/50 rounded px-3 py-1.5 text-sm text-red-200 placeholder-red-900/50 focus:outline-none focus:border-red-500"
                                        />
                                        <button
                                            onClick={handleReset}
                                            disabled={deleteConfirm !== 'DELETE'}
                                            className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            {t('stats.reset_button')}
                                        </button>
                                    </div>
                                </div>
                            )
                        }
                    </div>


                    {/* Location Modal */}
                    {
                        selectedLocation && (
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
                                onClick={() => setSelectedLocation(null)}
                            >
                                <div
                                    className="relative max-w-5xl max-h-[85vh] rounded-xl overflow-hidden shadow-2xl bg-black group"
                                    onClick={e => e.stopPropagation()}
                                >
                                    {/* Image - determines container size */}
                                    <img
                                        src={selectedLocation.backgroundImage}
                                        alt={selectedLocation.name}
                                        className="max-w-full max-h-[85vh] object-contain block"
                                    />

                                    {/* Overlay with Vignette */}
                                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/80"></div>

                                    {/* Content Overlay */}
                                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                        <div className="flex items-start justify-between p-6 shrink-0 pointer-events-auto">
                                            <h3 className="text-2xl font-bold text-yellow-500 font-serif tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                                {selectedLocation.nameKey ? t(selectedLocation.nameKey) : selectedLocation.name}
                                            </h3>
                                            <button
                                                onClick={() => setSelectedLocation(null)}
                                                className="p-2 hover:bg-black/40 rounded-full text-gray-300 hover:text-white transition-colors backdrop-blur-sm"
                                            >
                                                <X className="w-6 h-6" />
                                            </button>
                                        </div>

                                        <div className="p-6 pointer-events-auto flex justify-center">
                                            <div className="bg-black/20 backdrop-blur-[1px] p-4 rounded-xl border border-white/5 shadow-xl w-full max-w-2xl">
                                                <p
                                                    className={`text-gray-100 leading-relaxed text-base ${selectedLocation.font || ''} drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] text-center`}
                                                    onMouseUp={handleTextSelection}
                                                >
                                                    {selectedLocation.descriptionKey ? t(selectedLocation.descriptionKey) : selectedLocation.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                </>
            )
            }

            {
                activeTab === 'vocabulary' && (
                    <VocabularyLog isEmbedded={true} />
                )
            }

            {
                activeTab === 'settings' && (
                    <SettingsTab />
                )
            }
            {/* Dictionary Popup */}
            {selectedWord && (
                <DictionaryPopup
                    word={selectedWord}
                    definition={definition}
                    position={popupPosition}
                    onClose={closePopup}
                    onSave={handleSaveWord}
                    suggestions={suggestions}
                    onSelectSuggestion={handleSelectSuggestion}
                    onWordSelect={handleWordSelect}
                />
            )}
        </div >
    );
}
