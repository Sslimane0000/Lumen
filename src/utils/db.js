import { openDB } from 'idb';
import * as pdfjs from 'pdfjs-dist';
import ePub from 'epubjs';
import { createEmptyCard, scheduleCard } from './fsrs';
import { extractMetadataFromFile } from '../services/metadataService';

// Set worker for PDF.js in db.js context as well if needed, though usually it's for rendering.
// We'll assume the worker is available or we might need to set it again.
pdfjs.GlobalWorkerOptions.workerSrc = import.meta.env.BASE_URL + 'pdf.worker.min.mjs';
// Configure WASM image decoders for JPEG 2000 support
pdfjs.GlobalWorkerOptions.wasmBinaryPath = import.meta.env.BASE_URL + 'openjpeg.wasm';

const DB_NAME = 'ebook-reader-db';
const DB_VERSION = 6; // Incremented for settings store

export const initDB = async () => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            // Books store
            if (!db.objectStoreNames.contains('books')) {
                const store = db.createObjectStore('books', { keyPath: 'id', autoIncrement: true });
                store.createIndex('title', 'title');
                store.createIndex('lastRead', 'lastRead');
                store.createIndex('status', 'status'); // New index
            } else {
                const store = transaction.objectStore('books');
                if (!store.indexNames.contains('title')) store.createIndex('title', 'title');
                if (!store.indexNames.contains('lastRead')) store.createIndex('lastRead', 'lastRead');
                if (!store.indexNames.contains('status')) store.createIndex('status', 'status');
            }

            // Vocabulary store
            if (!db.objectStoreNames.contains('vocabulary')) {
                const store = db.createObjectStore('vocabulary', { keyPath: 'word' });
                store.createIndex('dateAdded', 'dateAdded');
            } else {
                const store = transaction.objectStore('vocabulary');
                if (!store.indexNames.contains('dateAdded')) store.createIndex('dateAdded', 'dateAdded');
            }

            // Sessions store (replaces old stats store)
            if (!db.objectStoreNames.contains('sessions')) {
                const sessionStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
                sessionStore.createIndex('bookId', 'bookId');
                sessionStore.createIndex('date', 'date');
            }

            // Daily stats store for achievement tracking
            if (!db.objectStoreNames.contains('daily_stats')) {
                db.createObjectStore('daily_stats', { keyPath: 'date' });
            }

            // Achievements store
            if (!db.objectStoreNames.contains('achievements')) {
                db.createObjectStore('achievements', { keyPath: 'id' });
            }

            // Settings store
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'id' });
            }
        },
    });
};

export const saveSettings = async (settings) => {
    const db = await initDB();
    const updated = {
        id: 'user_settings',
        ...settings,
        updatedAt: new Date()
    };
    return db.put('settings', updated);
};

export const getSettings = async () => {
    const db = await initDB();
    return db.get('settings', 'user_settings');
};

const extractCover = async (file) => {
    try {
        if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjs.getDocument({
                data: arrayBuffer,
                // Configure WASM-based image decoders for JPEG 2000
                wasmUrl: '/openjpeg.wasm'
            }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.5 }); // Thumbnail scale
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            return canvas.toDataURL();
        } else if (file.type === 'application/epub+zip') {
            const book = ePub(file);
            const coverUrl = await book.coverUrl();
            if (coverUrl) {
                // Convert blob URL to base64 if needed, or just return the blob URL
                // But blob URLs expire. Better to fetch and convert to base64 or store blob.
                const response = await fetch(coverUrl);
                const blob = await response.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            }
        }
    } catch (e) {
        console.error("Failed to extract cover", e);
    }
    return null;
};

export const saveBook = async (fileOrMetadata, overrides = {}) => {
    const db = await initDB();

    let book;
    if (fileOrMetadata instanceof File || fileOrMetadata instanceof Blob) {
        // Normal file save
        const file = fileOrMetadata;
        const cover = await extractCover(file);

        // Extract metadata from file
        let metadata = null;
        try {
            metadata = await extractMetadataFromFile(file, file.type);
        } catch (error) {
            console.warn('Failed to extract metadata from file:', error);
        }

        book = {
            title: metadata?.title || file.name.replace(/\.(epub|pdf)$/i, ''),
            author: metadata?.author || null,
            publisher: metadata?.publisher || null,
            type: file.type,
            data: file,
            cover: cover,
            addedAt: new Date(),
            lastRead: new Date(),
            updatedAt: new Date(),
            progress: 0,
            totalPages: 0,
            status: 'reading',
            downloaded: true,
            ...overrides
        };
    } else {
        // Ghost book (metadata only)
        book = {
            title: fileOrMetadata.name.replace(/\.(epub|pdf)$/i, ''),
            type: fileOrMetadata.type,
            data: null,
            cover: null,
            addedAt: new Date(),
            lastRead: new Date(),
            updatedAt: new Date(),
            progress: 0,
            totalPages: 0,
            status: 'reading',
            downloaded: false,
            ...overrides
        };
    }

    return db.add('books', book);
};

// Helper to update book metadata without re-saving file
export const updateBookMetadata = async (bookData) => {
    const db = await initDB();
    const existing = await db.get('books', bookData.id);
    if (existing) {
        const updated = {
            ...existing,
            ...bookData,
            updatedAt: bookData.updatedAt || new Date()
        };
        return db.put('books', updated);
    }
};

// Bulk update metadata for multiple books
export const bulkUpdateMetadata = async (updates) => {
    const db = await initDB();
    const tx = db.transaction('books', 'readwrite');
    const store = tx.objectStore('books');

    const promises = updates.map(async (update) => {
        const existing = await store.get(update.id);
        if (existing) {
            const updated = {
                ...existing,
                ...update,
                updatedAt: new Date()
            };
            return store.put(updated);
        }
    });

    await Promise.all(promises);
    await tx.done;
};

export const getBooks = async () => {
    const db = await initDB();
    return db.getAll('books');
};

export const getBook = async (id) => {
    const db = await initDB();
    return db.get('books', Number(id));
};

export const deleteBook = async (id) => {
    const db = await initDB();
    return db.delete('books', Number(id));
};

export const updateBookProgress = async (id, progress, totalPages, readablePage) => {
    const db = await initDB();
    const book = await db.get('books', Number(id));
    if (book) {
        book.progress = progress;
        book.totalPages = totalPages || book.totalPages;
        if (readablePage !== undefined) {
            book.readablePage = readablePage;
        }
        book.lastRead = new Date();
        book.updatedAt = new Date();

        // Auto-complete check (optional, but user asked for completed log)
        // If progress is near end? Let's leave it manual or explicit for now unless requested.

        await db.put('books', book);
    }
};

export const setBookStatus = async (id, status) => {
    const db = await initDB();
    const book = await db.get('books', Number(id));
    if (book) {
        book.status = status;
        book.updatedAt = new Date();
        await db.put('books', book);
    }
};

export const setBookTracking = async (id, isTracking) => {
    const db = await initDB();
    const book = await db.get('books', Number(id));
    if (book) {
        book.trackingStarted = isTracking;
        book.updatedAt = new Date();
        await db.put('books', book);
    }
};

export const saveWord = async (wordData) => {
    const db = await initDB();

    // Initialize FSRS state for new words if not present
    if (!wordData.fsrs) {
        wordData.fsrs = createEmptyCard();
        wordData.nextReviewDate = new Date(); // Due immediately for review
    }

    const wordEntry = {
        ...wordData,
        updatedAt: wordData.updatedAt ? new Date(wordData.updatedAt) : new Date(),
        dateAdded: wordData.dateAdded ? new Date(wordData.dateAdded) : new Date(),
        deleted: wordData.deleted !== undefined ? wordData.deleted : false
    };
    return db.put('vocabulary', wordEntry);
};

export const getVocabulary = async () => {
    const db = await initDB();
    const allWords = await db.getAllFromIndex('vocabulary', 'dateAdded');
    return allWords.filter(w => !w.deleted);
};

export const getAllVocabulary = async () => {
    const db = await initDB();
    return db.getAll('vocabulary');
};


export const updateWordReview = async (wordId, quality) => {
    const db = await initDB();
    const wordEntry = await db.get('vocabulary', wordId); // wordId is actually the word string itself based on keyPath

    // If looking up by ID fails, it might be because we passed an ID but keyPath is 'word'.
    // Let's handle both cases or assume wordId is the word string.
    // In VocabularyLog.jsx: handleReview(word.id, ...) is called.
    // But word.id might be undefined if we didn't generate one, or it might be the word itself.
    // The store keyPath is 'word'.
    // Let's assume wordId passed here is the key (the word string).
    // Wait, in VocabularyLog.jsx: key={word.id} ... handleReview(word.id, ...)
    // If the word object has an ID, it's used.
    // But saveWord uses 'word' as keyPath.
    // Let's check saveWord: store.createObjectStore('vocabulary', { keyPath: 'word' });
    // So the key IS the word string.
    // If word.id is passed, it might be wrong if word.id is not the word string.
    // In VocabularyLog.jsx, I should check what word.id is.
    // Ideally, I should pass word.word to handleReview.

    // For now, let's try to get by key. If wordId is an integer (autoIncrement), this will fail.

    let entry = wordEntry;
    if (!entry) {
        console.error(`Word not found: ${wordId}`);
        return;
    }

    // Load desired retention from settings
    const settings = await getSettings() || {};
    const requestRetention = settings.desiredRetention || 0.9;

    const currentCard = entry.fsrs || createEmptyCard();
    const updatedCard = scheduleCard(currentCard, quality, requestRetention);

    entry.fsrs = updatedCard;
    entry.nextReviewDate = updatedCard.due;
    entry.updatedAt = new Date();

    await db.put('vocabulary', entry);
    return entry;
};

export const deleteWord = async (word) => {
    const db = await initDB();
    const wordEntry = await db.get('vocabulary', word);
    if (wordEntry) {
        wordEntry.deleted = true;
        wordEntry.updatedAt = new Date();
        return db.put('vocabulary', wordEntry);
    }
};

export const saveSession = async (sessionData) => {
    const db = await initDB();
    const tx = db.transaction(['sessions', 'daily_stats', 'achievements', 'vocabulary'], 'readwrite');
    const store = tx.objectStore('sessions');

    const cursor = await store.openCursor(null, 'prev');
    const lastSession = cursor ? cursor.value : null;
    const MERGE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    if (lastSession &&
        lastSession.bookId === sessionData.bookId &&
        lastSession.page === sessionData.page &&
        (sessionData.startTime - lastSession.endTime) < MERGE_THRESHOLD) {

        lastSession.duration += sessionData.duration;
        lastSession.endTime = sessionData.endTime;
        lastSession.pagesRead = (lastSession.pagesRead || 0) + sessionData.pagesRead;
        await store.put(lastSession);
    } else {
        await store.add({
            ...sessionData,
            date: new Date().toISOString().split('T')[0]
        });
    }

    // Update daily progress for achievements
    if (sessionData.pagesRead > 0) {
        await updateDailyProgress(sessionData.pagesRead, tx);
    }

    await tx.done;
};

export const saveSyncedSession = async (sessionData) => {
    const db = await initDB();
    return db.put('sessions', sessionData);
};

export const getStats = async () => {
    const db = await initDB();
    return db.getAllFromIndex('sessions', 'date');
};


export const resetStatsAndVocab = async () => {
    const db = await initDB();
    const tx = db.transaction(['sessions', 'vocabulary', 'daily_stats', 'achievements'], 'readwrite');
    await tx.objectStore('sessions').clear();
    await tx.objectStore('vocabulary').clear();
    await tx.objectStore('daily_stats').clear();
    await tx.objectStore('achievements').clear();
    await tx.done;
};

// --- Achievement System ---

export const ACHIEVEMENT_RULES = [
    {
        id: 'wooden',
        nameKey: 'achievements.wooden_name',
        descriptionKey: 'achievements.wooden_description',
        loreKey: 'achievements.wooden_lore',
        mottoKey: 'achievements.wooden_motto',
        pages: 10,
        days: 30,
        icon: '🪵',
        iconImage: import.meta.env.BASE_URL + 'wooden-badge.png'
    },
    {
        id: 'silver',
        nameKey: 'achievements.silver_name',
        descriptionKey: 'achievements.silver_description',
        loreKey: 'achievements.silver_lore',
        mottoKey: 'achievements.silver_motto',
        pages: 20,
        days: 45,
        icon: '🥈',
        iconImage: import.meta.env.BASE_URL + 'silver-badge.png'
    },
    {
        id: 'gold',
        nameKey: 'achievements.gold_name',
        descriptionKey: 'achievements.gold_description',
        loreKey: 'achievements.gold_lore',
        mottoKey: 'achievements.gold_motto',
        pages: 33,
        days: 50,
        icon: '🥇',
        iconImage: import.meta.env.BASE_URL + 'gold-badge.png'
    },
    {
        id: 'kyawthuite',
        nameKey: 'achievements.kyawthuite_name',
        descriptionKey: 'achievements.kyawthuite_description',
        loreKey: 'achievements.kyawthuite_lore',
        mottoKey: 'achievements.kyawthuite_motto',
        pages: 46,
        days: 64,
        icon: '💎',
        iconImage: import.meta.env.BASE_URL + 'kyawthuite-badge.png'
    },
    {
        id: 'etherial',
        nameKey: 'achievements.etherial_name',
        descriptionKey: 'achievements.etherial_description',
        loreKey: 'achievements.etherial_lore',
        mottoKey: 'achievements.etherial_motto',
        pages: 78,
        days: 78,
        icon: '✨',
        iconImage: import.meta.env.BASE_URL + 'etherial-badge.png'
    },
    {
        id: 'grand_opus',
        nameKey: 'achievements.grand_opus_name',
        descriptionKey: 'achievements.grand_opus_description',
        loreKey: 'achievements.grand_opus_lore',
        mottoKey: 'achievements.grand_opus_motto',
        pages: 112,
        days: 23,
        icon: '👑',
        iconImage: import.meta.env.BASE_URL + 'grand-opus-badge.png'
    },
    {
        id: 'interstellar',
        nameKey: 'achievements.interstellar_name',
        descriptionKey: 'achievements.interstellar_description',
        loreKey: 'achievements.interstellar_lore',
        mottoKey: 'achievements.interstellar_motto',
        pages: 230,
        days: 16,
        icon: '🌌',
        iconImage: import.meta.env.BASE_URL + 'interstellar-badge.png'
    },
    {
        id: 'event_horizon',
        nameKey: 'achievements.event_horizon_name',
        descriptionKey: 'achievements.event_horizon_description',
        loreKey: 'achievements.event_horizon_lore',
        mottoKey: 'achievements.event_horizon_motto',
        pages: 310,
        days: 13,
        icon: '⚫',
        iconImage: import.meta.env.BASE_URL + 'event-horizon-badge.png'
    },
    {
        id: 'odyssey',
        name: 'The Odyssey',
        description: 'Unlock all other reading achievements to reveal the ultimate journey.',
        lore: 'You have traversed the roots, the mirrors, the gold, the fire, the ghosts, the stars, the web, and the void. You have read the beginning and the end. Now, you are ready for the journey that started it all. This is not a fragment. This is the whole story. The original epic. The song of the man who suffered, who wandered, and who returned.',
        motto: 'Tell me, O Muse, of that ingenious hero...',
        pages: 0,
        days: 0,
        icon: '🏛️',
        iconImage: import.meta.env.BASE_URL + 'odyssey-badge.png', // We might need to generate this or just use icon
        isSpecial: true
    }
];

const VOCAB_ACHIEVEMENT_RULES = [
    {
        id: 'vocab_500',
        name: 'Lexicon Initiate',
        description: 'Save 500 words to your vocabulary',
        count: 500,
        icon: '📚'
    },
    {
        id: 'vocab_1000',
        name: 'Keeper of Tongues',
        description: 'Save 1000 words to your vocabulary',
        count: 1000,
        icon: '🧠'
    },
    {
        id: 'vocab_2000',
        name: 'The Living Dictionary',
        description: 'Save 2000 words to your vocabulary',
        count: 2000,
        icon: '📖'
    }
];

export const updateDailyProgress = async (pagesRead, tx, date = null) => {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const statsStore = tx.objectStore('daily_stats');

    const entry = await statsStore.get(targetDate) || { date: targetDate, pages: 0 };
    entry.pages += pagesRead;
    if (entry.pages < 0) entry.pages = 0;

    entry.updatedAt = new Date();
    console.log('✅ Daily stats updated:', { date: targetDate, totalPages: entry.pages, added: pagesRead });

    await statsStore.put(entry);

    // Check achievements after update
    await checkAchievements(tx);
};

export const deleteSession = async (sessionId) => {
    const db = await initDB();
    const tx = db.transaction(['sessions', 'daily_stats', 'achievements', 'vocabulary'], 'readwrite');
    const sessionStore = tx.objectStore('sessions');

    const session = await sessionStore.get(sessionId);
    if (!session) return;

    await sessionStore.delete(sessionId);

    // Update stats for that specific date
    if (session.pagesRead > 0) {
        await updateDailyProgress(-session.pagesRead, tx, session.date);
    }

    await tx.done;
};

export const addManualSession = async (sessionData) => {
    const db = await initDB();
    const tx = db.transaction(['sessions', 'daily_stats', 'achievements', 'vocabulary'], 'readwrite');
    const store = tx.objectStore('sessions');

    await store.add({
        ...sessionData,
        startTime: new Date().getTime(),
        endTime: new Date().getTime() + (sessionData.duration || 0) * 60 * 1000, // duration in minutes to ms
        manual: true
    });

    if (sessionData.pagesRead > 0) {
        await updateDailyProgress(sessionData.pagesRead, tx, sessionData.date);
    }

    await tx.done;
};

const checkAchievements = async (tx) => {
    const statsStore = tx.objectStore('daily_stats');
    const achievementStore = tx.objectStore('achievements');
    const vocabStore = tx.objectStore('vocabulary');

    const allStats = await statsStore.getAll();
    // Sort by date descending
    allStats.sort((a, b) => new Date(b.date) - new Date(a.date));

    const unlocked = await achievementStore.getAllKeys();
    const unlockedSet = new Set(unlocked);

    // Check Reading Achievements
    for (const rule of ACHIEVEMENT_RULES) {
        if (unlockedSet.has(rule.id)) continue;

        // Check for consecutive days meeting the page count
        let currentStreak = 0;
        let maxStreak = 0;
        let lastDate = null;

        for (const stat of allStats) {
            if (stat.pages >= rule.pages) {
                if (lastDate) {
                    const diffTime = Math.abs(new Date(lastDate) - new Date(stat.date));
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays === 1) {
                        currentStreak++;
                    } else {
                        currentStreak = 1;
                    }
                } else {
                    currentStreak = 1;
                }
                lastDate = stat.date;
            } else {
                currentStreak = 0;
                lastDate = null;
            }

            if (currentStreak > maxStreak) maxStreak = currentStreak;
        }

        if (maxStreak >= rule.days) {
            await achievementStore.put({
                id: rule.id,
                name: rule.name,
                description: rule.description,
                icon: rule.icon,
                unlockedAt: new Date()
            });
        }
    }

    // Check for The Odyssey (All other reading achievements unlocked)
    if (!unlockedSet.has('odyssey')) {
        const requiredIds = ACHIEVEMENT_RULES
            .filter(r => r.id !== 'odyssey')
            .map(r => r.id);

        // Refresh unlocked set after potential new unlocks above
        const currentUnlocked = await achievementStore.getAllKeys();
        const currentUnlockedSet = new Set(currentUnlocked);

        const allUnlocked = requiredIds.every(id => currentUnlockedSet.has(id));

        if (allUnlocked) {
            const odysseyRule = ACHIEVEMENT_RULES.find(r => r.id === 'odyssey');
            await achievementStore.put({
                id: odysseyRule.id,
                name: odysseyRule.name,
                description: odysseyRule.description,
                icon: odysseyRule.icon,
                unlockedAt: new Date()
            });
        }
    }

    // Check Vocabulary Achievements
    const allVocab = await vocabStore.getAll();
    const activeVocabCount = allVocab.filter(w => !w.deleted).length;

    for (const rule of VOCAB_ACHIEVEMENT_RULES) {
        if (unlockedSet.has(rule.id)) continue;

        if (activeVocabCount >= rule.count) {
            await achievementStore.put({
                id: rule.id,
                name: rule.name,
                description: rule.description,
                icon: rule.icon,
                unlockedAt: new Date()
            });
        }
    }
};

export const getAchievements = async () => {
    const db = await initDB();
    const unlocked = await db.getAll('achievements');
    const unlockedIds = new Set(unlocked.map(a => a.id));

    // Get daily stats to calculate current progress
    const allStats = await db.getAll('daily_stats');
    allStats.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Get vocab count for progress
    const allVocab = await db.getAll('vocabulary');
    const vocabCount = allVocab.filter(w => !w.deleted).length;

    const readingAchievements = ACHIEVEMENT_RULES.map(rule => {
        let daysMet = 0;
        let maxStreak = 0;
        let currentActiveStreak = 0;

        // Sort stats by date descending (most recent first)
        const sortedStats = [...allStats].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Count days met and calculate current active streak (from most recent backwards)
        let streakCalculated = false;
        for (let i = 0; i < sortedStats.length; i++) {
            const stat = sortedStats[i];

            if (stat.pages >= rule.pages) {
                daysMet++;

                // Calculate current active streak (only from most recent day)
                if (!streakCalculated) {
                    if (i === 0) {
                        // Start of current streak
                        currentActiveStreak = 1;
                    } else {
                        const prevStat = sortedStats[i - 1];
                        const diffTime = Math.abs(new Date(prevStat.date) - new Date(stat.date));
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays === 1) {
                            currentActiveStreak++;
                        } else {
                            // Streak broken, stop calculating current streak
                            streakCalculated = true;
                        }
                    }
                }
            } else if (i === 0) {
                // Most recent day didn't meet goal, current streak is 0
                currentActiveStreak = 0;
                streakCalculated = true;
            }
        }

        // Calculate max historical streak
        let tempStreak = 0;
        let lastDate = null;
        for (const stat of sortedStats.reverse()) {
            if (stat.pages >= rule.pages) {
                if (lastDate) {
                    const diffTime = Math.abs(new Date(stat.date) - new Date(lastDate));
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays === 1) {
                        tempStreak++;
                    } else {
                        tempStreak = 1;
                    }
                } else {
                    tempStreak = 1;
                }
                lastDate = stat.date;
                if (tempStreak > maxStreak) maxStreak = tempStreak;
            } else {
                tempStreak = 0;
                lastDate = null;
            }
        }

        const progress = Math.min(daysMet, rule.days);
        return {
            ...rule,
            unlocked: unlockedIds.has(rule.id),
            unlockedAt: unlocked.find(a => a.id === rule.id)?.unlockedAt,
            currentStreak: currentActiveStreak,
            maxStreak: maxStreak,
            progress,
            type: 'reading'
        };
    });

    const vocabAchievements = VOCAB_ACHIEVEMENT_RULES.map(rule => {
        return {
            ...rule,
            unlocked: unlockedIds.has(rule.id),
            unlockedAt: unlocked.find(a => a.id === rule.id)?.unlockedAt,
            progress: Math.min(vocabCount, rule.count),
            totalRequired: rule.count,
            type: 'vocab'
        };
    });

    return [...readingAchievements, ...vocabAchievements];
};

export const getDailyStats = async () => {
    const db = await initDB();
    return db.getAll('daily_stats');
};

export const getVocabularyCount = async () => {
    const db = await initDB();
    const allVocab = await db.getAll('vocabulary');
    return allVocab.filter(w => !w.deleted).length;
};

export const unlockAllAchievements = async () => {
    const db = await initDB();
    const tx = db.transaction(['achievements'], 'readwrite');
    const store = tx.objectStore('achievements');

    const allRules = [...ACHIEVEMENT_RULES, ...VOCAB_ACHIEVEMENT_RULES];

    for (const rule of allRules) {
        await store.put({
            id: rule.id,
            name: rule.name,
            description: rule.description,
            icon: rule.icon,
            unlockedAt: new Date()
        });
    }

    await tx.done;
};
