import React, { useEffect, useState, useRef } from 'react';
import { BookOpen, Upload, Clock, Trash2, BarChart2, LogOut, Cloud, Grid, List, Search, Plus, Loader2, RefreshCw, AlertCircle, Book, Settings } from 'lucide-react';
import { saveBook, getBooks, deleteBook } from '../utils/db';
import { useNavigate } from 'react-router-dom';
import { useSync } from '../context/SyncContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import MetadataRepairModal from '../components/MetadataRepairModal';

export default function Library() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { googleUser, login, isSyncing, syncError, triggerSync } = useSync();
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('recent'); // 'recent', 'title', 'author'
    const [showMetadataModal, setShowMetadataModal] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadBooks();
    }, [isSyncing]); // Reload when sync completes

    const loadBooks = async () => {
        try {
            const allBooks = await getBooks();
            setBooks(allBooks);
        } catch (error) {
            console.error('Error loading books:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            setUploading(true);
            try {
                for (let i = 0; i < files.length; i++) {
                    await saveBook(files[i]);
                }
                await loadBooks();
            } catch (error) {
                console.error('Error uploading file:', error);
                alert('Failed to upload book. Please try again.');
            } finally {
                setUploading(false);
            }
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setUploading(true);
            try {
                for (let i = 0; i < e.dataTransfer.files.length; i++) {
                    await saveBook(e.dataTransfer.files[i]);
                }
                await loadBooks();
            } catch (error) {
                console.error('Error uploading file:', error);
                alert(t('library.upload_error'));
            } finally {
                setUploading(false);
            }
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (window.confirm(t('common.confirm_delete'))) {
            await deleteBook(id);
            await loadBooks();
        }
    };

    const getCoverImage = (book) => {
        if (book.cover) return book.cover;
        return null;
    };

    // Filtering and Sorting
    const filteredBooks = books
        .filter(book =>
            book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .sort((a, b) => {
            if (sortBy === 'recent') return new Date(b.lastRead || 0) - new Date(a.lastRead || 0);
            if (sortBy === 'title') return a.title.localeCompare(b.title);
            if (sortBy === 'author') return (a.author || '').localeCompare(b.author || '');
            return 0;
        });

    return (
        <div
            className={`min-h-screen p-8 transition-colors duration-300 ${dragActive ? 'bg-gray-800/50' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
        >
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{t('library.title')}</h1>
                    <p className="text-gray-400 text-sm">
                        {t('library.books_count', { count: books.length })} • {t('library.in_progress', { count: books.filter(b => b.progress > 0).length })}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <LanguageSwitcher />

                    {/* Google Sign-In / Sync Status */}
                    {googleUser ? (
                        <button
                            onClick={triggerSync}
                            disabled={isSyncing}
                            className={`flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-full border border-gray-700 ${isSyncing ? 'opacity-50' : 'hover:bg-gray-700'}`}
                            title={t('library.sync_drive')}
                        >
                            <Cloud className={`w-4 h-4 ${isSyncing ? 'animate-spin text-indigo-400' : syncError ? 'text-red-400' : 'text-emerald-400'}`} />
                            <span className="text-xs text-gray-400">
                                {isSyncing ? t('library.syncing') : syncError ? t('library.sync_error') : t('library.synced')}
                            </span>
                        </button>
                    ) : (
                        <button
                            onClick={login}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 hover:bg-gray-100 rounded-lg font-medium transition-colors text-sm"
                        >
                            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                            {t('library.sign_in_google')}
                        </button>
                    )}

                    <button
                        onClick={() => navigate('/stats')}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        title={t('stats.tab_stats')}
                    >
                        <BarChart2 className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => navigate('/vocabulary')}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        title={t('stats.tab_vocabulary')}
                    >
                        <BookOpen className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => navigate('/settings')}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        title={t('stats.tab_settings')}
                    >
                        <Settings className="w-5 h-5" />
                    </button>

                    {/* Repair Metadata Button */}
                    {books.filter(b => !b.author).length > 0 && (
                        <button
                            onClick={() => setShowMetadataModal(true)}
                            className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                            title={t('library.repair_metadata')}
                        >
                            <RefreshCw className="w-5 h-5" />
                            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                {books.filter(b => !b.author).length}
                            </span>
                        </button>
                    )}

                    <div className="h-6 w-px bg-gray-700 mx-1"></div>

                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'text-indigo-400 bg-gray-800' : 'text-gray-400 hover:text-white'} `}
                    >
                        <Grid className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'text-indigo-400 bg-gray-800' : 'text-gray-400 hover:text-white'} `}
                    >
                        <List className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-2"
                    >
                        {uploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4" />
                        )}
                        {t('library.import_book')}
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".epub,.pdf"
                        multiple
                        className="hidden"
                    />
                </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="max-w-7xl mx-auto mb-8 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 rtl:left-auto rtl:right-3" />
                    <input
                        type="text"
                        placeholder={t('library.search_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 rtl:pl-4 rtl:pr-10"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{t('library.sort_by')}</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 text-sm"
                    >
                        <option value="recent">{t('library.sort_recent')}</option>
                        <option value="title">{t('library.sort_title')}</option>
                        <option value="author">{t('library.sort_author')}</option>
                    </select>
                </div>
            </div>

            {/* Books Grid/List */}
            <div className="max-w-7xl mx-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                ) : filteredBooks.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-xl bg-gray-900/50">
                        <Book className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-medium text-gray-300 mb-2">{t('library.empty_title')}</h3>
                        <p className="text-gray-500 mb-6">{t('library.empty_desc')}</p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                            {t('library.browse_files')}
                        </button>
                    </div>
                ) : (
                    <div className={viewMode === 'grid'
                        ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6"
                        : "space-y-3"
                    }>
                        {filteredBooks.map((book) => (
                            <div
                                key={book.id}
                                onClick={() => navigate(`/read/${book.id}`)}
                                className={`group relative bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer
                                    ${viewMode === 'list' ? 'flex items-center p-3 gap-4' : 'flex flex-col'}
`}
                            >
                                {/* Cover */}
                                <div className={`relative ${viewMode === 'list' ? 'w-12 h-16 flex-shrink-0' : 'aspect-[2/3] w-full'}`}>
                                    {getCoverImage(book) ? (
                                        <img
                                            src={getCoverImage(book)}
                                            alt={book.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                                            <Book className="w-8 h-8 text-gray-500" />
                                        </div>
                                    )}

                                    {/* Progress Bar Overlay */}
                                    {book.progress > 0 && (
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                                            <div
                                                className="h-full bg-indigo-500"
                                                style={{ width: `${Math.min(100, (book.progress / (book.totalPages || 1)) * 100)}%` }}
                                            />
                                        </div>
                                    )}

                                    {/* Cloud / Download Indicator */}
                                    {(!book.downloaded && !book.data) && (
                                        <div className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full backdrop-blur-sm">
                                            <Cloud className="w-4 h-4 text-indigo-400" />
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className={`flex-1 ${viewMode === 'grid' ? 'p-4' : 'min-w-0'}`}>
                                    <h3 className={`font-medium text-white truncate mb-1 ${viewMode === 'grid' ? 'text-base' : 'text-sm'}`} title={book.title}>
                                        {book.title}
                                    </h3>
                                    <p className="text-sm text-gray-400 truncate mb-2">
                                        {book.author || t('library.unknown_author')}
                                    </p>

                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span>
                                            {book.progress > 0
                                                ? `${Math.round((book.progress / (book.totalPages || 1)) * 100)}%`
                                                : t('library.not_started')}
                                        </span>
                                        {book.format && (
                                            <span className="uppercase bg-gray-700 px-1.5 py-0.5 rounded text-[10px]">
                                                {book.format}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <button
                                    onClick={(e) => handleDelete(e, book.id)}
                                    className={`text-gray-500 hover:text-red-400 transition-colors
                                        ${viewMode === 'grid'
                                            ? 'absolute top-2 right-2 p-1.5 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 rtl:right-auto rtl:left-2'
                                            : 'p-2 opacity-0 group-hover:opacity-100'
                                        }
`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Metadata Repair Modal */}
            {showMetadataModal && (
                <MetadataRepairModal
                    books={books}
                    onClose={() => setShowMetadataModal(false)}
                    onComplete={() => {
                        setShowMetadataModal(false);
                        loadBooks();
                    }}
                />
            )}
        </div>
    );
}
