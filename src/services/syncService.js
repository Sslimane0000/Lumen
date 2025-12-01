import { listFiles, uploadFile, downloadFile, createFolder, getFile } from './googleDrive';
import {
    getAllVocabulary, saveWord,
    getStats, saveSession, saveSyncedSession,
    getBooks, saveBook, updateBookMetadata, getBook,
    getSettings, saveSettings
} from '../utils/db';

const FOLDER_NAME = 'EbookReaderData';
const FOLDER_ID_KEY = 'ebookReaderDriveFolderId';
let folderId = localStorage.getItem(FOLDER_ID_KEY);
let folderPromise = null;

const getOrCreateFolder = () => {
    // If we have a promise running or resolved in memory for this session, return it.
    if (folderPromise) return folderPromise;

    folderPromise = (async () => {
        console.log(`Resolving Sync Folder...`);
        try {
            // 1. Find ALL folders with the name
            const folders = await listFiles(`name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
            console.log(`Found ${folders?.length || 0} folders named '${FOLDER_NAME}'`);

            if (!folders || folders.length === 0) {
                console.log(`No folder found. Creating new one.`);
                const folder = await createFolder(FOLDER_NAME);
                folderId = folder.id;
                localStorage.setItem(FOLDER_ID_KEY, folderId);
                return folderId;
            }

            // 2. If we have folders, find the one with the most data
            // Optimization: If only one exists, just use it.
            if (folders.length === 1) {
                folderId = folders[0].id;
                console.log(`Only one folder found. Using: ${folderId}`);
                localStorage.setItem(FOLDER_ID_KEY, folderId);
                return folderId;
            }

            console.log("Multiple folders found. Checking contents to find the correct one...");
            let bestFolder = null;
            let maxFiles = -1;

            for (const folder of folders) {
                // Check for key data files
                const contents = await listFiles(`'${folder.id}' in parents and (name = 'vocabulary.json' or name = 'books_metadata.json' or name = 'sessions.json') and trashed = false`);
                const count = contents ? contents.length : 0;
                console.log(`Folder ${folder.id} contains ${count} key files.`);

                if (count > maxFiles) {
                    maxFiles = count;
                    bestFolder = folder;
                }
            }

            // 3. Use the best folder
            if (bestFolder) {
                console.log(`Selected best folder: ${bestFolder.id} (Files: ${maxFiles})`);
                folderId = bestFolder.id;
            } else {
                // Fallback (shouldn't happen if folders.length > 0, but just in case)
                folderId = folders[0].id;
                console.log(`Defaulting to first folder: ${folderId}`);
            }

            localStorage.setItem(FOLDER_ID_KEY, folderId);
            return folderId;

        } catch (e) {
            console.error("Error in getOrCreateFolder:", e);
            folderPromise = null; // Reset promise on error so we can retry
            throw e;
        }
    })();

    return folderPromise;
};

const syncJsonData = async (filename, localData, mergeFn) => {
    const folderId = await getOrCreateFolder();
    const files = await listFiles(`name = '${filename}' and '${folderId}' in parents`);

    let remoteData = [];
    let fileId = null;

    if (files && files.length > 0) {
        fileId = files[0].id;
        console.log(`[Sync] Found ${filename} (ID: ${fileId})`);
        const arrayBuffer = await downloadFile(fileId);
        console.log(`[Sync] Downloaded ${filename}: ${arrayBuffer.byteLength} bytes`);
        try {
            const decoder = new TextDecoder('utf-8');
            const jsonString = decoder.decode(arrayBuffer);
            remoteData = JSON.parse(jsonString);
            console.log(`[Sync] Parsed ${filename}: ${Array.isArray(remoteData) ? remoteData.length : 'Object'} items`);
        } catch (e) {
            console.error(`[Sync] Error parsing ${filename}`, e);
        }
    } else {
        console.log(`[Sync] No remote file found for ${filename}`);
    }

    const { mergedData, hasChanges } = mergeFn(localData, remoteData);
    console.log(`Sync ${filename}: Local=${Array.isArray(localData) ? localData.length : 'obj'}, Remote=${Array.isArray(remoteData) ? remoteData.length : 'obj'}, Merged=${Array.isArray(mergedData) ? mergedData.length : 'obj'}, HasChanges=${hasChanges}`);

    if (hasChanges || !fileId) {
        console.log(`Uploading updated ${filename}...`);
        const blob = new Blob([JSON.stringify(mergedData)], { type: 'application/json' });
        await uploadFile(filename, blob, 'application/json', fileId, folderId);
    } else {
        console.log(`No changes for ${filename}, skipping upload.`);
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
                // Check if already linked to a valid remote file
                if (book.driveId) {
                    const existingRemote = remoteFiles.find(f => f.id === book.driveId);
                    if (existingRemote) {
                        console.log(`Skipping upload for '${book.title}' - already linked to remote file.`);
                        continue;
                    }
                }

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

        // Helper for fuzzy title matching
        const normalizeTitle = (str) => {
            return str.toLowerCase()
                .replace(/[^\w\s]/g, '') // Remove special chars
                .replace(/\s+/g, ' ')     // Collapse spaces
                .trim();
        };

        // 3. Create "Ghost Books" for Remote Files missing locally
        for (const file of remoteFiles) {
            const filename = file.name;
            const title = filename.replace(/\.(epub|pdf)$/i, '');
            const normalizedRemoteTitle = normalizeTitle(title);

            console.log(`Checking remote book: '${title}' (norm: '${normalizedRemoteTitle}')`);

            // Try to find existing local book by Drive ID or Title (normalized)
            const localBook = localBooks.find(b => {
                const normalizedLocalTitle = normalizeTitle(b.title);

                // Strict match
                if (b.driveId === file.id) return true;
                if (normalizedLocalTitle === normalizedRemoteTitle) return true;

                // Substring match (fuzzy) - only if titles are long enough to avoid false positives
                if (normalizedLocalTitle.length > 10 && normalizedRemoteTitle.includes(normalizedLocalTitle)) {
                    console.log(`  -> Fuzzy Match: Local '${normalizedLocalTitle}' is inside Remote '${normalizedRemoteTitle}'`);
                    return true;
                }
                if (normalizedRemoteTitle.length > 10 && normalizedLocalTitle.includes(normalizedRemoteTitle)) {
                    console.log(`  -> Fuzzy Match: Remote '${normalizedRemoteTitle}' is inside Local '${normalizedLocalTitle}'`);
                    return true;
                }

                return false;
            });

            if (!localBook) {
                console.log(`  -> No match found. Creating ghost book.`);
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
            } else if (!localBook.driveId) {
                // Link existing local book to remote file if not already linked
                console.log(`  -> Match found! Linking local book '${localBook.title}' to remote file`);
                await updateBookMetadata({ id: localBook.id, driveId: file.id });
            } else {
                console.log(`  -> Already linked to '${localBook.title}'`);
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

        console.log(`Downloaded ${arrayBuffer.byteLength} bytes`);
        console.log(`ArrayBuffer is valid:`, arrayBuffer instanceof ArrayBuffer);

        const book = await getBook(bookId);
        if (book) {
            // Ensure correct MIME type for EPUB
            const mimeType = book.type === 'application/epub+zip' || book.title?.endsWith('.epub')
                ? 'application/epub+zip'
                : book.type;

            console.log(`Creating blob with type: ${mimeType}`);
            const blob = new Blob([arrayBuffer], { type: mimeType });
            console.log(`Created blob: ${blob.size} bytes, type: ${blob.type}`);

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

        const merged = await syncJsonData('settings.json', localSettings, mergeSettings);

        if (merged && Object.keys(merged).length > 0) {
            await saveSettings(merged);
        }
        console.log('Settings Synced');
    }
};
