import React, { useState, useRef, useEffect } from 'react';
import { ReactReader } from 'react-reader';

export default function EpubViewer({ file, initialLocation, onLocationChange, onWordSelect }) {
    const [location, setLocation] = useState(initialLocation || 0);

    // If file is a Blob, we need to create a URL for it? 
    // ReactReader accepts url, title, etc.
    // If we pass the blob directly to url, it might work if it's an object URL.

    const [url, setUrl] = useState(null);

    useEffect(() => {
        const loadContent = async () => {
            if (file instanceof Blob) {
                const buffer = await file.arrayBuffer();
                setUrl(buffer);
            } else {
                setUrl(file);
            }
        };
        loadContent();
    }, [file]);

    const [scale, setScale] = useState(100); // 100%

    const renditionRef = useRef(null);
    // Remove font size effect
    // useEffect(() => {
    //     if (renditionRef.current) {
    //         renditionRef.current.themes.fontSize(`${size}%`);
    //     }
    // }, [size]);

    const [pageInfo, setPageInfo] = useState({ current: 0, total: 0 });

    const locationChanged = (epubcifi) => {
        setLocation(epubcifi);
        if (renditionRef.current && renditionRef.current.book.locations.length() > 0) {
            try {
                // Ensure it's a valid CFI string before calculating page
                if (typeof epubcifi === 'string' && epubcifi.startsWith('epubcfi')) {
                    const loc = renditionRef.current.book.locations.locationFromCfi(epubcifi);
                    const current = loc + 1;
                    const total = renditionRef.current.book.locations.total;
                    setPageInfo({ current, total });
                    onLocationChange(epubcifi, current, total);
                } else {
                    // If it's not a CFI (e.g. href from TOC), just pass it up without page info for now
                    // The rendition will eventually relocate and give us a CFI if we listened to 'relocated',
                    // but ReactReader usually calls locationChanged with CFI after relocation anyway.
                    // If we get an href here, it might be an intermediate state.
                    onLocationChange(epubcifi, 0, 0);
                }
            } catch (e) {
                console.warn("Error calculating page from location:", epubcifi, e);
                onLocationChange(epubcifi, 0, 0);
            }
        } else {
            // Fallback if locations not ready
            onLocationChange(epubcifi, 0, 0);
        }
    };

    return (
        <div className="h-full w-full relative bg-gray-900">
            {/* Global Styles to force dark background on iframe and scrollbars */}
            <style>{`
                .react-reader-iframe iframe {
                    background-color: #111827 !important;
                }
                .react-reader-iframe {
                    background-color: #111827 !important;
                }
                /* Hide scrollbars for cleaner look */
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

            {/* Scrollable Container for Zoomed Content */}
            <div className="w-full h-full overflow-auto flex items-center justify-center bg-gray-900">
                <div
                    className="react-reader-iframe"
                    style={{
                        transform: `scale(${scale / 100})`,
                        transformOrigin: 'center top',
                        transition: 'transform 0.2s ease-out',
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#111827' // Ensure background is dark
                    }}
                >
                    <ReactReader
                        key={url}
                        url={url}
                        location={location}
                        locationChanged={locationChanged}
                        epubOptions={{
                            flow: 'paginated',
                            manager: 'default',
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
                            rendition.themes.register('dark', {
                                body: { color: '#e5e7eb', background: '#111827', 'font-family': 'Inter, sans-serif' },
                                p: { 'line-height': '1.8', 'font-size': '1.2rem' } // Increased line-height and base font size
                            });
                            rendition.themes.select('dark');
                            rendition.themes.fontSize('130%'); // Set base font size larger to reduce words per page

                            // Inject styles directly into the EPUB iframe to force dark background
                            rendition.hooks.content.register((contents) => {
                                const doc = contents.document;
                                const head = doc.querySelector('head');
                                if (head) {
                                    const style = doc.createElement('style');
                                    style.innerHTML = `
                                        html, body { 
                                            background-color: #111827 !important; 
                                            color: #e5e7eb !important;
                                        }
                                        * {
                                            background-color: transparent !important; /* Prevent elements from having white backgrounds */
                                        }
                                    `;
                                    head.appendChild(style);
                                }

                                // Inject word selection event listener if callback provided
                                if (onWordSelect) {
                                    doc.addEventListener('click', (e) => {
                                        if (e.altKey && e.detail === 2) {
                                            const selection = contents.window.getSelection();
                                            const word = selection.toString().trim();
                                            if (word && word.length > 1) {
                                                const range = selection.getRangeAt(0);
                                                const rect = range.getBoundingClientRect();
                                                // Convert iframe coordinates to viewport coordinates
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
                            });

                            // Generate locations for consistent page numbers (1000 chars ~ 150-200 words, but with larger font it matches visual better)
                            rendition.book.ready.then(() => {
                                rendition.book.locations.generate(1000).then(() => {
                                    // Update total immediately
                                    const total = rendition.book.locations.total;
                                    setPageInfo(prev => ({ ...prev, total }));

                                    // Try to get current location
                                    if (rendition.currentLocation()) {
                                        const cfi = rendition.currentLocation().start.cfi;
                                        const loc = rendition.book.locations.locationFromCfi(cfi);
                                        setPageInfo({ current: loc + 1, total });
                                        onLocationChange(cfi, loc + 1, total);
                                    }
                                });
                            });

                            // Listen for relocation to update page number dynamically
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
                </div>
            </div>

            {/* Controls Overlay */}
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
