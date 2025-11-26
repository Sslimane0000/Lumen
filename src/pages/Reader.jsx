import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBook, updateBookProgress, setBookTracking } from '../utils/db';
import PdfViewer from '../features/reader/PdfViewer';
import EpubViewer from '../features/reader/EpubViewer';
import DictionaryPopup from '../features/dictionary/DictionaryPopup';
import { useTranslation } from 'react-i18next';
import { useReadingTimer } from '../hooks/useReadingTimer';
import { useSync } from '../context/SyncContext';
import { useDictionary } from '../hooks/useDictionary';
import { ArrowLeft, Play, Pause } from 'lucide-react';

export default function Reader() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);

    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);

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

    // Timer Hook
    // Use readablePage if available, otherwise progress (CFI/PageNum)
    const pagesReadRef = React.useRef(0);
    const lastPageRef = React.useRef(book?.readablePage || 0);

    useReadingTimer(id, book?.readablePage || book?.progress, book?.trackingStarted, pagesReadRef);

    useEffect(() => {
        if (!id) {
            navigate('/');
            return;
        }
        loadBook(id);
    }, [id, navigate]);

    const loadBook = async (bookId) => {
        try {
            let data = await getBook(bookId);
            if (!data) {
                alert(t('reader.book_not_found'));
                navigate('/');
                return;
            }

            // Check if we need to download the book content
            if (data.driveId && (!data.data || !data.downloaded)) {
                console.log("Book content missing, downloading from Drive...");
                setDownloading(true);

                // Dynamically import syncService to avoid circular dependencies if any, 
                // or just to keep bundle size optimized until needed.
                // Actually, standard import is fine, but let's use dynamic for safety in this existing structure
                const { syncService } = await import('../services/syncService');

                try {
                    const blob = await syncService.downloadBook(data.id, data.driveId, (progress) => {
                        setDownloadProgress(progress);
                    });

                    // Update local data object with the new blob so we can render immediately
                    data = { ...data, data: blob, downloaded: true };
                } catch (err) {
                    console.error("Failed to download book:", err);
                    alert(t('reader.download_failed') || "Failed to download book content. Please check your connection.");
                    navigate('/');
                    return;
                } finally {
                    setDownloading(false);
                }
            } else if (!data.data) {
                // No driveId and no data?
                alert(t('reader.book_no_content') || "Book content is missing and cannot be downloaded.");
                navigate('/');
                return;
            }

            setBook(data);
            if (data.readablePage) lastPageRef.current = data.readablePage;
        } catch (error) {
            console.error('Error loading book:', error);
            alert(t('reader.error_loading'));
            navigate('/');
        } finally {
            setLoading(false);
        }
    };

    const { autoSync } = useSync();

    const handleProgressUpdate = (restorePoint, current, total) => {
        if (book) {
            // restorePoint: CFI (EPUB) or PageNum (PDF) - used to restore position
            // current: Human readable page number (Standard Page for EPUB, PageNum for PDF)
            // total: Total pages (Standard Total for EPUB, TotalPages for PDF)

            // Track pages read volume
            if (current && lastPageRef.current && current !== lastPageRef.current) {
                if (current > lastPageRef.current) {
                    pagesReadRef.current += (current - lastPageRef.current);
                }
                lastPageRef.current = current;
            } else if (current && !lastPageRef.current) {
                lastPageRef.current = current;
            }

            updateBookProgress(book.id, restorePoint, total, current);

            setBook(prev => ({
                ...prev,
                progress: restorePoint,
                totalPages: total || prev.totalPages,
                readablePage: current // Store the human readable page number for the log
            }));
        }
    };

    const toggleTracking = async () => {
        if (book) {
            const newStatus = !book.trackingStarted;
            await setBookTracking(book.id, newStatus);
            setBook(prev => ({ ...prev, trackingStarted: newStatus }));
        }
    };

    // Check downloading state FIRST so it takes priority over generic loading
    if (downloading) {
        const isPercentage = downloadProgress >= 0 && downloadProgress <= 1;
        const isBytes = downloadProgress < 0;
        const bytes = Math.abs(downloadProgress);
        const mbDownloaded = (bytes / 1024 / 1024).toFixed(2);

        return (
            <div className="h-screen flex flex-col items-center justify-center text-white bg-gray-900 gap-4">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <h2 className="text-xl font-semibold">Downloading Book...</h2>
                <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden relative">
                    {isPercentage && downloadProgress > 0 ? (
                        <div
                            className="h-full bg-indigo-500 transition-all duration-300"
                            style={{ width: `${downloadProgress * 100}%` }}
                        />
                    ) : (
                        <div className="absolute inset-0 bg-indigo-500/50 animate-pulse w-full h-full" />
                    )}
                </div>
                <p className="text-gray-400 text-sm">
                    {isPercentage && downloadProgress > 0
                        ? `${Math.round(downloadProgress * 100)}%`
                        : isBytes && bytes > 0
                            ? `${mbDownloaded} MB downloaded`
                            : "Please wait..."}
                </p>
            </div>
        );
    }

    if (loading) {
        return <div className="h-screen flex items-center justify-center text-white">Loading...</div>;
    }

    if (!book) return null;

    return (
        <div className="h-screen flex flex-col bg-gray-900">
            {/* Header */}
            <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 shrink-0 z-20">
                <div className="flex items-center">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-gray-700 rounded-full text-gray-300 transition-colors mr-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-sm font-medium text-gray-300 truncate max-w-md">
                        {book.title}
                    </h1>
                </div>

                <button
                    onClick={toggleTracking}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${book.trackingStarted
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                >
                    {book.trackingStarted ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {book.trackingStarted ? t('reader.tracking_on') : t('reader.start_tracking')}
                </button>
            </div>

            {/* Viewer Container */}
            <div className="flex-1 overflow-hidden relative">
                {book.type === 'application/pdf' ? (
                    <PdfViewer
                        file={book.data}
                        initialPage={book.progress}
                        onPageChange={(page, total) => handleProgressUpdate(page, page, total)}
                        onWordSelect={handleWordSelect}
                    />
                ) : (
                    <EpubViewer
                        file={book.data}
                        initialLocation={book.progress}
                        onLocationChange={(cfi, current, total) => handleProgressUpdate(cfi, current, total)}
                        onWordSelect={handleWordSelect}
                    />
                )}
            </div>

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
        </div>
    );
}

