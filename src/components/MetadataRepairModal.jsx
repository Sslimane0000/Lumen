import React, { useState, useEffect } from 'react';
import { X, Check, RefreshCw, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { batchRepairMetadata } from '../services/metadataService';
import { bulkUpdateMetadata } from '../utils/db';
import { useTranslation } from 'react-i18next';

export default function MetadataRepairModal({ books, onClose, onComplete }) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [repairResults, setRepairResults] = useState([]);
    const [selectedBooks, setSelectedBooks] = useState(new Set());
    const [expandedBook, setExpandedBook] = useState(null);

    // Books with missing metadata
    const booksNeedingRepair = books.filter(book => !book.author);

    useEffect(() => {
        // Auto-select all books needing repair
        setSelectedBooks(new Set(booksNeedingRepair.map(b => b.id)));
    }, [books]);

    const handleScan = async () => {
        setLoading(true);
        setRepairResults([]);

        try {
            const booksToScan = booksNeedingRepair.filter(b => selectedBooks.has(b.id));
            const results = await batchRepairMetadata(booksToScan, (current, total) => {
                setProgress({ current, total });
            });

            setRepairResults(results);
        } catch (error) {
            console.error('Error scanning metadata:', error);
            alert(t('library.metadata_scan_error'));
        } finally {
            setLoading(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    const handleApply = async () => {
        setLoading(true);

        try {
            const updates = repairResults
                .filter(result => result.proposed.author) // Only update if we found an author
                .map(result => ({
                    id: result.bookId,
                    author: result.proposed.author,
                    publisher: result.proposed.publisher,
                    title: result.proposed.title
                }));

            await bulkUpdateMetadata(updates);
            onComplete();
        } catch (error) {
            console.error('Error applying metadata:', error);
            alert(t('library.metadata_apply_error'));
        } finally {
            setLoading(false);
        }
    };

    const toggleBookSelection = (bookId) => {
        const newSelected = new Set(selectedBooks);
        if (newSelected.has(bookId)) {
            newSelected.delete(bookId);
        } else {
            newSelected.add(bookId);
        }
        setSelectedBooks(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedBooks.size === booksNeedingRepair.length) {
            setSelectedBooks(new Set());
        } else {
            setSelectedBooks(new Set(booksNeedingRepair.map(b => b.id)));
        }
    };

    const getConfidenceColor = (confidence) => {
        if (confidence >= 85) return 'text-green-400';
        if (confidence >= 70) return 'text-yellow-400';
        return 'text-orange-400';
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{t('library.repair_metadata')}</h2>
                        <p className="text-sm text-gray-400 mt-1">
                            {t('library.repair_metadata_desc', { count: booksNeedingRepair.length })}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {booksNeedingRepair.length === 0 ? (
                        <div className="text-center py-12">
                            <Check className="w-12 h-12 text-green-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">
                                {t('library.all_books_complete')}
                            </h3>
                            <p className="text-gray-400">
                                {t('library.all_books_have_metadata')}
                            </p>
                        </div>
                    ) : repairResults.length === 0 ? (
                        <div className="space-y-3">
                            {/* Select All */}
                            <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                                <input
                                    type="checkbox"
                                    checked={selectedBooks.size === booksNeedingRepair.length}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-gray-600 bg-gray-700"
                                />
                                <span className="text-sm text-gray-300 flex-1">
                                    {t('library.select_all')} ({booksNeedingRepair.length} {t('library.books_lowercase')})
                                </span>
                            </div>

                            {/* Book List */}
                            {booksNeedingRepair.map(book => (
                                <div
                                    key={book.id}
                                    className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedBooks.has(book.id)}
                                        onChange={() => toggleBookSelection(book.id)}
                                        className="w-4 h-4 rounded border-gray-600 bg-gray-700"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-white truncate">{book.title}</h3>
                                        <p className="text-sm text-gray-500">
                                            {t('library.author_missing')}
                                        </p>
                                    </div>
                                    <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {repairResults.map((result) => {
                                const book = books.find(b => b.id === result.bookId);
                                const isExpanded = expandedBook === result.bookId;
                                const hasChanges = result.proposed.author !== result.original.author;

                                return (
                                    <div
                                        key={result.bookId}
                                        className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden"
                                    >
                                        <div
                                            className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-900/70"
                                            onClick={() => setExpandedBook(isExpanded ? null : result.bookId)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-white truncate">{book.title}</h3>
                                                {result.proposed.author ? (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Check className="w-4 h-4 text-green-400" />
                                                        <p className="text-sm text-gray-300">
                                                            {result.proposed.author}
                                                        </p>
                                                        {result.proposed.confidence && (
                                                            <span className={`text-xs ${getConfidenceColor(result.proposed.confidence)}`}>
                                                                ({result.proposed.confidence}% {t('library.match')})
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-500 mt-1">
                                                        {t('library.no_metadata_found')}
                                                    </p>
                                                )}
                                            </div>
                                            {isExpanded ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>

                                        {isExpanded && (
                                            <div className="border-t border-gray-700 p-4 space-y-3 bg-gray-900/30">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">
                                                            {t('library.current')}
                                                        </h4>
                                                        <div className="space-y-2 text-sm">
                                                            <div>
                                                                <span className="text-gray-500">{t('library.author')}:</span>
                                                                <span className="text-white ml-2">
                                                                    {result.original.author || t('library.none')}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500">{t('library.publisher')}:</span>
                                                                <span className="text-white ml-2">
                                                                    {result.original.publisher || t('library.none')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">
                                                            {t('library.proposed')}
                                                        </h4>
                                                        <div className="space-y-2 text-sm">
                                                            <div>
                                                                <span className="text-gray-500">{t('library.author')}:</span>
                                                                <span className={`ml-2 ${hasChanges ? 'text-green-400 font-medium' : 'text-white'}`}>
                                                                    {result.proposed.author || t('library.none')}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500">{t('library.publisher')}:</span>
                                                                <span className="text-white ml-2">
                                                                    {result.proposed.publisher || t('library.none')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-700 p-6 flex items-center justify-between">
                    <div className="text-sm text-gray-400">
                        {loading && progress.total > 0 && (
                            <span>{t('library.scanning')} {progress.current}/{progress.total}...</span>
                        )}
                        {!loading && repairResults.length > 0 && (
                            <span>
                                {repairResults.filter(r => r.proposed.author).length} / {repairResults.length} {t('library.books_found_metadata')}
                            </span>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                        >
                            {t('common.cancel')}
                        </button>

                        {repairResults.length === 0 ? (
                            <button
                                onClick={handleScan}
                                disabled={loading || selectedBooks.size === 0}
                                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('library.scanning')}...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4" />
                                        {t('library.scan_metadata')}
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={handleApply}
                                disabled={loading || repairResults.filter(r => r.proposed.author).length === 0}
                                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('library.applying')}...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        {t('library.apply_changes')}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
