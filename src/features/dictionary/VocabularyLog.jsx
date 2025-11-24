import React, { useEffect, useState } from 'react';
import { getVocabulary, updateWordReview, deleteWord, getSettings } from '../../utils/db';
import { Search, Clock, CheckCircle, AlertCircle, BookOpen, Trash2, Brain, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useSync } from '../../context/SyncContext';
import FlashcardModal from './FlashcardModal';

export default function VocabularyLog({ isEmbedded = false }) {
    const { t } = useTranslation();
    const { autoSync } = useSync();
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all'); // 'all', 'due', 'learned'
    const [showFlashcards, setShowFlashcards] = useState(false);
    const [dueWords, setDueWords] = useState([]);
    const [newCardsPerDay, setNewCardsPerDay] = useState(20);
    const [newCardsReviewedToday, setNewCardsReviewedToday] = useState(0);

    useEffect(() => {
        loadVocabulary();
        loadSettings();
        loadDailyTracking();
    }, []);

    const loadVocabulary = async () => {
        try {
            const allWords = await getVocabulary();
            setWords(allWords.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return dateB - dateA;
            }));
        } catch (error) {
            console.error("Error loading vocabulary:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        const settings = await getSettings() || {};
        setNewCardsPerDay(settings.newCardsPerDay || 20);
    };

    const loadDailyTracking = () => {
        const today = new Date().toDateString();
        const stored = localStorage.getItem('flashcard_daily_tracking');
        if (stored) {
            const data = JSON.parse(stored);
            if (data.date === today) {
                setNewCardsReviewedToday(data.count);
            } else {
                // New day, reset
                localStorage.setItem('flashcard_daily_tracking', JSON.stringify({ date: today, count: 0 }));
                setNewCardsReviewedToday(0);
            }
        } else {
            localStorage.setItem('flashcard_daily_tracking', JSON.stringify({ date: today, count: 0 }));
            setNewCardsReviewedToday(0);
        }
    };

    const handleReview = async (word, rating) => {
        await updateWordReview(word.word, rating);
        await loadVocabulary();
    };

    const openFlashcardReview = (reviewMode) => {
        let cardsToReview = [];
        if (reviewMode === 'due') {
            // Review cards that have been reviewed before and are due
            cardsToReview = words.filter(w =>
                w.fsrs?.reps > 0 && (!w.nextReviewDate || new Date(w.nextReviewDate) <= new Date())
            );
        } else if (reviewMode === 'new') {
            // Review new cards (never reviewed before)
            const newCards = words.filter(w => !w.fsrs || w.fsrs.reps === 0);
            const limit = newCardsPerDay - newCardsReviewedToday;
            cardsToReview = newCards.slice(0, Math.max(0, limit));
        }
        setDueWords(cardsToReview);
        setShowFlashcards(true);
    };

    const closeFlashcardReview = async () => {
        // Update daily tracking if any new cards were reviewed
        const newCardsInSession = dueWords.filter(w => !w.fsrs || w.fsrs.reps === 0).length;
        if (newCardsInSession > 0) {
            const today = new Date().toDateString();
            const newCount = newCardsReviewedToday + newCardsInSession;
            localStorage.setItem('flashcard_daily_tracking', JSON.stringify({ date: today, count: newCount }));
            setNewCardsReviewedToday(newCount);
        }

        setShowFlashcards(false);
        await loadVocabulary();
        // Auto-sync vocabulary after review session
        autoSync();
    };

    const handleDeleteWord = async (word) => {
        if (window.confirm(t('common.confirm_delete'))) {
            await deleteWord(word);
            loadVocabulary();
        }
    };

    const filteredWords = words.filter(word => {
        const matchesSearch = word.word.toLowerCase().includes(searchQuery.toLowerCase());
        const isDue = new Date(word.nextReviewDate) <= new Date();

        if (filter === 'due') return matchesSearch && isDue;
        if (filter === 'learned') return matchesSearch && !isDue; // Simplified logic
        return matchesSearch;
    });

    const dueCount = filteredWords.filter(w =>
        w.fsrs?.reps > 0 && (!w.nextReviewDate || new Date(w.nextReviewDate) <= new Date())
    ).length;
    const newCount = Math.min(
        filteredWords.filter(w => !w.fsrs || w.fsrs.reps === 0).length,
        Math.max(0, newCardsPerDay - newCardsReviewedToday)
    );

    return (
        <div className={`bg-gray-900 text-gray-100 ${!isEmbedded ? 'min-h-screen p-8' : ''}`}>
            {!isEmbedded && (
                <div className="max-w-4xl mx-auto mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">{t('vocabulary.title')}</h1>
                    <p className="text-gray-400">
                        {t('vocabulary.words_saved', { count: words.length })} • <span className="text-indigo-400">{t('vocabulary.due_review', { count: dueCount })}</span>
                    </p>
                </div>
            )}

            <div className="max-w-4xl mx-auto">
                {/* Controls */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 rtl:left-auto rtl:right-3" />
                        <input
                            type="text"
                            placeholder={t('vocabulary.search_placeholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-indigo-500 rtl:pl-4 rtl:pr-10"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('due')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${filter === 'due' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            <Clock className="w-4 h-4" />
                            {t('vocabulary.due')}
                        </button>
                        {dueCount > 0 && (
                            <button
                                onClick={() => openFlashcardReview('due')}
                                className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg hover:shadow-xl"
                            >
                                <Brain className="w-4 h-4" />
                                Review Due ({dueCount})
                            </button>
                        )}
                        {newCount > 0 && (
                            <button
                                onClick={() => openFlashcardReview('new')}
                                className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg hover:shadow-xl"
                            >
                                <Sparkles className="w-4 h-4" />
                                Review New ({newCount})
                            </button>
                        )}
                    </div>
                </div>

                {/* Word List */}
                <div className="grid gap-4">
                    {filteredWords.length === 0 ? (
                        <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700 border-dashed">
                            <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-500">{t('vocabulary.empty_state')}</p>
                        </div>
                    ) : (
                        filteredWords.map(word => {
                            const isDue = !word.nextReviewDate || new Date(word.nextReviewDate) <= new Date();
                            return (
                                <div key={word.word} className="bg-gray-800 p-4 rounded-xl border border-gray-700 hover:border-indigo-500/50 transition-colors flex items-center justify-between group">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-white mb-1">{word.word}</h3>
                                        <p className="text-sm text-gray-400 line-clamp-1">
                                            {(() => {
                                                const def = word.meanings?.[0]?.definitions?.[0] || word.definition?.meanings?.[0]?.definitions?.[0] || 'No definition';
                                                return def.replace(/<[^>]*>?/gm, '');
                                            })()}
                                        </p>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                            <span>Reviews: {word.fsrs?.reps || 0}</span>
                                            <span>•</span>
                                            <span className={isDue ? 'text-amber-400 font-medium' : ''}>
                                                {isDue
                                                    ? (word.nextReviewDate ? t('vocabulary.due') : 'New')
                                                    : (word.nextReviewDate && !isNaN(new Date(word.nextReviewDate).getTime())
                                                        ? t('vocabulary.due_in', { days: formatDistanceToNow(new Date(word.nextReviewDate)) })
                                                        : 'Scheduled')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDeleteWord(word.word)}
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title={t('common.delete')}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Flashcard Modal */}
            {showFlashcards && dueWords.length > 0 && (
                <FlashcardModal
                    words={dueWords}
                    onReview={handleReview}
                    onClose={closeFlashcardReview}
                />
            )}
        </div>
    );
}
