import React, { useState, useRef, useEffect } from 'react';
import { ReactReader } from 'react-reader';
import { getLearningWords } from '../../utils/db';

export default function EpubViewer({ file, initialLocation, onLocationChange, onWordSelect, language }) {
    console.log('EpubViewer received file:', file);
    const [location, setLocation] = useState(initialLocation || 0);
    const [bookData, setBookData] = useState(null);
    const [scale, setScale] = useState(100); // 100%
    const isRTL = language === 'ar' || language === 'he';

    useEffect(() => {
        const loadContent = async () => {
            if (file instanceof Blob) {
                // Convert Blob to ArrayBuffer - ReactReader/epub.js accepts ArrayBuffer directly
                console.log('Converting EPUB Blob to ArrayBuffer...');
                const arrayBuffer = await file.arrayBuffer();
                console.log('EPUB ArrayBuffer ready:', arrayBuffer.byteLength, 'bytes');
                setBookData(arrayBuffer);
            } else if (file instanceof ArrayBuffer) {
                console.log('EPUB ArrayBuffer provided directly:', file.byteLength, 'bytes');
                setBookData(file);
            } else if (typeof file === 'string') {
                // If it's a URL string, use it directly
                console.log('EPUB URL provided:', file);
                setBookData(file);
            } else {
                console.error('Unsupported file type for EPUB:', typeof file);
            }
        };
        loadContent();
    }, [file]);

    const renditionRef = useRef(null);
    const [pageInfo, setPageInfo] = useState({ current: 0, total: 0 });

    const locationChanged = (epubcifi) => {
        setLocation(epubcifi);
        if (renditionRef.current && renditionRef.current.book.locations.length() > 0) {
            try {
                if (typeof epubcifi === 'string' && epubcifi.startsWith('epubcfi')) {
                    const loc = renditionRef.current.book.locations.locationFromCfi(epubcifi);
                    const current = loc + 1;
                    const total = renditionRef.current.book.locations.total;
                    setPageInfo({ current, total });
                    onLocationChange(epubcifi, current, total);
                } else {
                    onLocationChange(epubcifi, 0, 0);
                }
            } catch (e) {
                console.warn("Error calculating page from location:", epubcifi, e);
                onLocationChange(epubcifi, 0, 0);
            }
        } else {
            onLocationChange(epubcifi, 0, 0);
        }
    };

    return (
        <div className="h-full w-full relative bg-gray-900">
            <style>{`
                .react-reader-iframe iframe {
                    background-color: #111827 !important;
                }
                .react-reader-iframe {
                    background-color: #111827 !important;
                }
                ::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                ::-webkit-scrollbar-track {
                    background: #111827; 
                }
                ::-webkit-scrollbar-thumb {
                    background: #374151; 
                    border-radius: 4px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #4b5563; 
                }
            `}</style>

            <div className="w-full h-full overflow-auto flex items-center justify-center bg-gray-900">
                <div
                    className="react-reader-iframe"
                    style={{
                        transform: `scale(${scale / 100})`,
                        transformOrigin: 'center top',
                        transition: 'transform 0.2s ease-out',
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#111827'
                    }}
                >
                    {bookData ? (
                        <ReactReader
                            key={typeof bookData === 'string' ? bookData : 'epub-data'}
                            url={bookData}
                            location={location}
                            locationChanged={locationChanged}
                            epubOptions={{
                                flow: 'paginated',
                                manager: 'default',
                                direction: isRTL ? 'rtl' : 'ltr'
                            }}
                            loadingView={<div className="flex items-center justify-center h-full text-gray-400">Loading EPUB...</div>}
                            styles={{
                                container: { backgroundColor: '#111827' },
                                readerArea: { backgroundColor: '#111827', transition: undefined },
                                titleArea: { color: '#e5e7eb' },
                                tocArea: { backgroundColor: '#1f2937' },
                                tocButton: { color: '#e5e7eb' },
                                arrow: { color: '#e5e7eb' }
                            }}
                            getRendition={(rendition) => {
                                renditionRef.current = rendition;

                                // Simple font size adjustment without themes API
                                rendition.hooks.content.register(async (contents) => {
                                    try {
                                        console.log('[EpubViewer] Content hook fired');
                                        const doc = contents.document;
                                        const head = doc.querySelector('head');
                                        if (head) {
                                            const style = doc.createElement('style');
                                            style.innerHTML = `
                                                html, body { 
                                                    background-color: #111827 !important; 
                                                    color: #e5e7eb !important;
                                                    font-family: Inter, sans-serif !important;
                                                }
                                                p {
                                                    line-height: 1.6 !important;
                                                    font-size: 1rem !important;
                                                }
                                                @media (min-width: 768px) {
                                                    p {
                                                        line-height: 1.8 !important;
                                                        font-size: 1.2rem !important;
                                                    }
                                                }
                                                * {
                                                    background-color: transparent !important;
                                                }
                                                .learning-word {
                                                    border-bottom: 2px dotted #fbbf24 !important;
                                                    cursor: help !important;
                                                    background-color: rgba(251, 191, 36, 0.1) !important;
                                                }
                                            `;
                                            head.appendChild(style);
                                            console.log('[EpubViewer] CSS injected');
                                        }

                                        // Highlight learning words
                                        const learningWords = await getLearningWords();
                                        console.log('[EpubViewer] Learning words:', learningWords.size, Array.from(learningWords));

                                        if (learningWords.size > 0) {
                                            const escapedWords = Array.from(learningWords).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                                            const regex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');

                                            const treeWalker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
                                            const nodesToReplace = [];

                                            let node;
                                            while (node = treeWalker.nextNode()) {
                                                if (node.nodeValue && regex.test(node.nodeValue)) {
                                                    nodesToReplace.push(node);
                                                }
                                            }

                                            console.log('[EpubViewer] Found', nodesToReplace.length, 'text nodes to highlight');

                                            nodesToReplace.forEach(textNode => {
                                                const fragment = doc.createDocumentFragment();
                                                let lastIndex = 0;
                                                let match;

                                                regex.lastIndex = 0;
                                                const text = textNode.nodeValue;

                                                while ((match = regex.exec(text)) !== null) {
                                                    if (match.index > lastIndex) {
                                                        fragment.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
                                                    }

                                                    const span = doc.createElement('span');
                                                    span.className = 'learning-word';
                                                    span.textContent = match[0];
                                                    span.dataset.word = match[0];

                                                    span.onclick = (e) => {
                                                        e.stopPropagation();
                                                        const rect = span.getBoundingClientRect();
                                                        const iframeRect = rendition.manager.container.getBoundingClientRect();

                                                        onWordSelect(match[0], {
                                                            x: rect.left + iframeRect.left + (rect.width / 2),
                                                            y: rect.bottom + iframeRect.top
                                                        });
                                                    };

                                                    fragment.appendChild(span);
                                                    lastIndex = regex.lastIndex;
                                                }

                                                if (lastIndex < text.length) {
                                                    fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
                                                }

                                                textNode.parentNode.replaceChild(fragment, textNode);
                                            });

                                            console.log('[EpubViewer] Highlighting complete');
                                        } else {
                                            console.log('[EpubViewer] No learning words to highlight');
                                        }

                                        // Existing click handler for general word selection
                                        if (onWordSelect) {
                                            doc.addEventListener('click', (e) => {
                                                if (e.altKey && e.detail === 2) {
                                                    const selection = contents.window.getSelection();
                                                    const word = selection.toString().trim();
                                                    if (word && word.length > 1) {
                                                        const range = selection.getRangeAt(0);
                                                        const rect = range.getBoundingClientRect();
                                                        const iframe = contents.document.defaultView.frameElement;
                                                        if (iframe) {
                                                            const iframeRect = iframe.getBoundingClientRect();
                                                            onWordSelect(word, {
                                                                x: rect.left + iframeRect.left,
                                                                y: rect.bottom + iframeRect.top
                                                            });
                                                        }
                                                    }
                                                }
                                            });
                                        }
                                    } catch (err) {
                                        console.error("[EpubViewer] Error in content register hook:", err);
                                    }
                                });

                                rendition.book.ready.then(() => {
                                    rendition.book.locations.generate(3000).then(() => {
                                        const total = rendition.book.locations.total;
                                        setPageInfo(prev => ({ ...prev, total }));

                                        if (rendition.currentLocation()) {
                                            const cfi = rendition.currentLocation().start.cfi;
                                            const loc = rendition.book.locations.locationFromCfi(cfi);
                                            setPageInfo({ current: loc + 1, total });
                                            onLocationChange(cfi, loc + 1, total);
                                        }
                                    });
                                });

                                rendition.on('relocated', (location) => {
                                    if (rendition.book.locations.length() > 0) {
                                        const cfi = location.start.cfi;
                                        const loc = rendition.book.locations.locationFromCfi(cfi);
                                        const total = rendition.book.locations.total;
                                        setPageInfo({ current: loc + 1, total });
                                        onLocationChange(cfi, loc + 1, total);
                                    }
                                });
                            }}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            <div className="text-center">
                                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p>Preparing EPUB...</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="absolute bottom-4 right-4 z-50 flex gap-4 bg-gray-800/90 p-2 rounded-lg backdrop-blur-sm border border-gray-700 shadow-xl items-center">
                <span className="text-gray-300 text-sm font-medium px-2 border-r border-gray-600">
                    {pageInfo.total > 0 ? `Page ${pageInfo.current} of ${pageInfo.total}` : 'Calculating pages...'}
                </span>
                <div className="flex gap-2">
                    <button onClick={() => setScale(s => Math.max(50, s - 10))} className="p-2 hover:bg-gray-700 rounded text-white font-bold w-8 h-8 flex items-center justify-center">-</button>
                    <span className="text-gray-300 text-sm flex items-center w-12 justify-center">{scale}%</span>
                    <button onClick={() => setScale(s => Math.min(300, s + 10))} className="p-2 hover:bg-gray-700 rounded text-white font-bold w-8 h-8 flex items-center justify-center">+</button>
                </div>
            </div>
        </div>
    );
}
