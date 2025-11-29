import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getLearningWords } from '../../utils/db';
import { auth } from '../../services/firebase';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Set worker URL and other required paths for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = import.meta.env.BASE_URL + 'pdf.worker.min.mjs';

// Configure additional PDF.js options for proper rendering
// These paths are needed for CMap files (character maps) and standard fonts
const pdfjsVersion = pdfjs.version;
pdfjs.GlobalWorkerOptions.cMapUrl = import.meta.env.BASE_URL + 'cmaps/';
pdfjs.GlobalWorkerOptions.standardFontDataUrl = import.meta.env.BASE_URL + 'standard_fonts/';

// Configure image decoders path for JPEG 2000 support
// The image_decoders_src tells the worker where to find the image decoder module
// We use the local WASM file for consistency
pdfjs.GlobalWorkerOptions.imageDecodersPath = import.meta.env.BASE_URL + 'pdf.image_decoders.min.mjs';

export default function PdfViewer({ file, initialPage, onPageChange, onWordSelect }) {
    console.log('PdfViewer received file:', file);
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(initialPage || 1);
    const [scale, setScale] = useState(1.0);
    const [userId, setUserId] = useState(auth.currentUser?.uid);

    // Listen to auth state changes to ensure we have the userId
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setUserId(user?.uid);
        });
        return unsubscribe;
    }, []);

    // Track pages read
    const updatePagesRead = async () => {
        if (!userId) return;

        try {
            const { doc, setDoc, increment } = await import('firebase/firestore');
            const { db } = await import('../../services/firebase');

            const userRef = doc(db, 'users', userId);
            await setDoc(userRef, {
                pagesRead: increment(1),
                lastActive: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error('Error updating pages read:', error);
        }
    };

    useEffect(() => {
        // Auto-scale for mobile
        if (window.innerWidth < 768) {
            setScale(window.innerWidth / 800); // Approximate scale based on typical PDF width
        }
    }, []);

    useEffect(() => {
        if (initialPage) {
            setPageNumber(initialPage);
        }
    }, [initialPage]);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
    }

    const changePage = (offset) => {
        const newPage = Math.min(Math.max(pageNumber + offset, 1), numPages);
        if (newPage !== pageNumber) {
            setPageNumber(newPage);
            onPageChange(newPage, numPages);
            updatePagesRead(); // Track page turn
        }
    };

    // Attach word selection event listener to PDF text layer
    const [learningWords, setLearningWords] = useState(new Set());

    useEffect(() => {
        const loadLearningWords = async () => {
            const words = await getLearningWords();
            setLearningWords(words);
        };
        loadLearningWords();
    }, []);

    // Callback for when text layer is rendered
    const highlightTextLayer = () => {
        const textLayer = document.querySelector('.react-pdf__Page__textContent');
        if (!textLayer) return;

        // 1. Attach Click Listener
        if (onWordSelect) {
            const handleClick = (e) => {
                if (e.altKey && e.detail === 2) { // Alt + double-click
                    const selection = window.getSelection();
                    const word = selection.toString().trim();
                    if (word && word.length > 1) {
                        const range = selection.getRangeAt(0);
                        const rect = range.getBoundingClientRect();
                        onWordSelect(word, {
                            x: rect.left,
                            y: rect.bottom
                        });
                    }
                }
            };

            // Remove existing listener if any (simple approach: clone node to strip listeners)
            // But cloning destroys React refs/events potentially. 
            // Since this runs once per render, we can just add. 
            // Ideally we'd cleanup, but textLayer is recreated on re-render.
            textLayer.addEventListener('click', handleClick);
        }

        // 2. Apply Highlighting
        if (learningWords.size > 0) {
            const escapedWords = Array.from(learningWords).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const regex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');

            const textSpans = textLayer.querySelectorAll('span');

            textSpans.forEach(span => {
                if (span.dataset.processed) return;

                const text = span.textContent;
                if (regex.test(text)) {
                    span.dataset.processed = 'true';
                    const fragment = document.createDocumentFragment();
                    let lastIndex = 0;
                    let match;
                    regex.lastIndex = 0;

                    while ((match = regex.exec(text)) !== null) {
                        if (match.index > lastIndex) {
                            fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                        }

                        const highlightSpan = document.createElement('span');
                        highlightSpan.className = 'learning-word';
                        const matchedWord = match[0];
                        highlightSpan.textContent = matchedWord;
                        highlightSpan.onclick = (e) => {
                            e.stopPropagation();
                            const rect = highlightSpan.getBoundingClientRect();
                            onWordSelect(matchedWord, {
                                x: rect.left + (rect.width / 2),
                                y: rect.bottom
                            });
                        };

                        fragment.appendChild(highlightSpan);
                        lastIndex = regex.lastIndex;
                    }

                    if (lastIndex < text.length) {
                        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
                    }

                    span.innerHTML = '';
                    span.appendChild(fragment);
                }
            });
        }
    };

    return (
        <div className="flex flex-col items-center w-full h-full overflow-hidden bg-gray-900">
            <div className="flex-1 overflow-auto flex justify-center p-2 md:p-8 w-full">
                <Document
                    file={file}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={(error) => console.error('Error loading PDF:', error)}
                    className="shadow-2xl"
                >
                    <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={false}
                        onRenderTextLayerSuccess={highlightTextLayer}
                        className="shadow-2xl"
                    />
                </Document>
            </div>

            {/* Controls */}
            <div className="h-16 bg-gray-800 w-full flex items-center justify-between px-4 md:px-8 border-t border-gray-700 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                        className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm"
                    >
                        -
                    </button>
                    <span className="text-sm text-gray-400">{Math.round(scale * 100)}%</span>
                    <button
                        onClick={() => setScale(s => Math.min(2.0, s + 0.1))}
                        className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm"
                    >
                        +
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => changePage(-1)}
                        disabled={pageNumber <= 1}
                        className="p-2 rounded-full hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <span className="text-gray-300 font-medium">
                        Page {pageNumber} of {numPages || '--'}
                    </span>
                    <button
                        onClick={() => changePage(1)}
                        disabled={pageNumber >= numPages}
                        className="p-2 rounded-full hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>

                <div className="w-24"></div> {/* Spacer for balance */}
            </div>
        </div>
    );
}
