import { listFiles, uploadFile, downloadFile, createFolder } from './googleDrive';
import {
    getAllVocabulary, saveWord,
    getStats, saveSession, saveSyncedSession,
    getBooks, saveBook, updateBookMetadata, getBook,
    getSettings, saveSettings
} from '../utils/db';

const FOLDER_NAME = 'EbookReaderData';
let folderId = null;

const getOrCreateFolder = async () => {
    if (folderId) return folderId;

    const files = await listFiles(`name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder'`);
    if (files && files.length > 0) {
        folderId = files[0].id;
    } else {
        const folder = await createFolder(FOLDER_NAME);
        folderId = folder.id;
    }
    return folderId;
};

const syncJsonData = async (filename, localData, mergeFn) => {
    const folderId = await getOrCreateFolder();
    const files = await listFiles(`name = '${filename}' and '${folderId}' in parents`);

    let remoteData = [];
    let fileId = null;

    if (files && files.length > 0) {
        fileId = files[0].id;
        const arrayBuffer = await downloadFile(fileId);
        try {
            const decoder = new TextDecoder('utf-8');
            const jsonString = decoder.decode(arrayBuffer);
            remoteData = JSON.parse(jsonString);
        } catch (e) {
            console.error(`Error parsing ${filename}`, e);
        }
    }

    // Merge Logic
    const { mergedData, hasChanges } = mergeFn(localData, remoteData);

    if (hasChanges || !fileId) {
        const blob = new Blob([JSON.stringify(mergedData)], { type: 'application/json' });
        await uploadFile(filename, blob, 'application/json', fileId, folderId);
    }

    return mergedData;
};

// Merge Strategies
const mergeVocabulary = (local, remote) => {
    const map = new Map();
    [...remote, ...local].forEach(item => {
        const existing = map.get(item.word);
        if (!existing || new Date(item.updatedAt) > new Date(existing.updatedAt)) {
            map.set(item.word, item);
        }
    });
    return {
        mergedData: Array.from(map.values()),
        hasChanges: true // Always upload for now to be safe, or optimize later
    };
};

const mergeSessions = (local, remote) => {
    // Sessions are append-mostly, but we use ID or composite key
    // Let's use a simple dedup based on startTime + bookId
    const map = new Map();
    [...remote, ...local].forEach(item => {
        const key = `${item.bookId}-${item.startTime}`;
        if (!map.has(key)) {
            map.set(key, item);
        }
    });
    return {
        mergedData: Array.from(map.values()),
        hasChanges: true
    };
};

export const syncService = {
    async syncVocabulary() {
        console.log('Syncing Vocabulary...');
        const localVocab = await getAllVocabulary();
        const merged = await syncJsonData('vocabulary.json', localVocab, mergeVocabulary);

        // Update local DB with merged data
        for (const word of merged) {
            await saveWord(word);
        }
        console.log('Vocabulary Synced');
    },

    async syncSessions() {
        console.log('Syncing Sessions...');
        const localStats = await getStats();
        const merged = await syncJsonData('sessions.json', localStats, mergeSessions);

        for (const session of merged) {
            await saveSyncedSession(session);
        }
        console.log('Sessions Synced');
    },

    async syncBooks() {
        console.log('Syncing Books...');
        const folderId = await getOrCreateFolder();
        const localBooks = await getBooks();
        const remoteFiles = await listFiles(`'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and name != 'vocabulary.json' and name != 'sessions.json' and name != 'books_metadata.json' and name != 'settings.json'`);

        // 1. Sync Metadata (Progress & Covers)
        // We include driveId in metadata if we have it, to help other clients
        const metadataMap = localBooks.map(b => ({
            id: b.title,
            progress: b.progress,
            lastRead: b.lastRead,
            totalPages: b.totalPages,
            status: b.status,
            updatedAt: b.updatedAt,
            cover: b.cover, // Sync cover (base64)
            driveId: b.driveId
        }));

        const mergeMetadata = (local, remote) => {
            const map = new Map();
            [...remote, ...local].forEach(item => {
                const existing = map.get(item.id);
                if (!existing || new Date(item.updatedAt) > new Date(existing.updatedAt)) {
                    map.set(item.id, item);
                }
            });
            return { mergedData: Array.from(map.values()), hasChanges: true };
        };

        const mergedMetadata = await syncJsonData('books_metadata.json', metadataMap, mergeMetadata);

        // 2. Upload Local Books that are missing remotely
        for (const book of localBooks) {
            // Only upload if we have the data (not a ghost book)
            if (book.data) {
                const filename = book.title + (book.type === 'application/pdf' ? '.pdf' : '.epub');
                const remoteFile = remoteFiles.find(f => f.name === filename);

                if (!remoteFile) {
                    console.log(`Uploading ${book.title}...`);
                    const res = await uploadFile(filename, book.data, book.type, null, folderId);
                    // Update local driveId
                    await updateBookMetadata({ id: book.id, driveId: res.id });
                } else if (!book.driveId) {
                    // Link existing
                    await updateBookMetadata({ id: book.id, driveId: remoteFile.id });
                }
            }
        }

        // 3. Create "Ghost Books" for Remote Files missing locally
        for (const file of remoteFiles) {
            const filename = file.name;
            const title = filename.replace(/\.(epub|pdf)$/i, '');
            const localBook = localBooks.find(b => b.title === title);

            if (!localBook) {
                console.log(`Found remote book: ${title}`);
                // Find metadata for cover and progress
                const meta = mergedMetadata.find(m => m.id === title);

                await saveBook({
                    name: filename,
                    type: file.mimeType,
                    // NO DATA - Ghost Book
                }, {
                    driveId: file.id,
                    cover: meta?.cover,
                    progress: meta?.progress || 0,
                    totalPages: meta?.totalPages || 0,
                    lastRead: meta?.lastRead || new Date(),
                    status: meta?.status || 'reading',
                    downloaded: false
                });
            }
        }

        // 4. Update Metadata for existing books (Progress sync)
        for (const meta of mergedMetadata) {
            const localBook = localBooks.find(b => b.title === meta.id);
            if (localBook) {
                if (new Date(meta.updatedAt) > new Date(localBook.updatedAt)) {
                    await updateBookMetadata({
                        id: localBook.id,
                        progress: meta.progress,
                        lastRead: meta.lastRead,
                        totalPages: meta.totalPages,
                        status: meta.status,
                        updatedAt: meta.updatedAt,
                        cover: meta.cover || localBook.cover, // Update cover if better?
                        driveId: meta.driveId || localBook.driveId
                    });
                }
            }
        }
        console.log('Books Synced');
    },

    async downloadBook(bookId, driveId, onProgress) {
        console.log(`Downloading book content for ${bookId}...`);
        const arrayBuffer = await downloadFile(driveId, onProgress);

        const book = await getBook(bookId);
        if (book) {
            const blob = new Blob([arrayBuffer], { type: book.type });
            // Update the book record with the blob
            await updateBookMetadata({
                id: bookId,
                data: blob,
                downloaded: true
            });
            return blob;
        }
    },

    async resetRemoteStatsAndVocab() {
        console.log('Resetting remote stats and vocab...');
        const folderId = await getOrCreateFolder();

        // Upload empty arrays to overwrite existing files
        const emptyBlob = new Blob([JSON.stringify([])], { type: 'application/json' });
        const emptySettingsBlob = new Blob([JSON.stringify({})], { type: 'application/json' });

        // Find existing files to get their IDs for overwriting
        const files = await listFiles(`'${folderId}' in parents and (name = 'vocabulary.json' or name = 'sessions.json' or name = 'settings.json')`);

        for (const file of files) {
            const blob = file.name === 'settings.json' ? emptySettingsBlob : emptyBlob;
            await uploadFile(file.name, blob, 'application/json', file.id, folderId);
        }
        console.log('Remote stats and vocab reset.');
    },

    async syncSettings() {
        console.log('Syncing Settings...');
        const localSettings = await getSettings() || {};

        const mergeSettings = (local, remote) => {
            // Last Write Wins based on updatedAt
            const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
            const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;

            if (remoteTime > localTime) {
                return { mergedData: remote, hasChanges: false }; // Remote is newer, update local
            } else if (localTime > remoteTime) {
                return { mergedData: local, hasChanges: true }; // Local is newer, update remote
            }
            return { mergedData: local, hasChanges: false }; // Same
        };

        // syncJsonData expects array or object? It handles parsing.
        // But our generic syncJsonData might need adjustment if it expects arrays for merging?
        // Actually syncJsonData just passes parsed JSON to mergeFn.
        // Let's check syncJsonData implementation.
        // It returns mergedData.

        const merged = await syncJsonData('settings.json', localSettings, mergeSettings);

        if (merged && Object.keys(merged).length > 0) {
            await saveSettings(merged);
        }
        console.log('Settings Synced');
    }
};

