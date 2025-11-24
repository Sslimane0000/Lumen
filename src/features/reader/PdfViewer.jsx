import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Set worker URL and other required paths for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Configure additional PDF.js options for proper rendering
// These paths are needed for CMap files (character maps) and standard fonts
const pdfjsVersion = pdfjs.version;
pdfjs.GlobalWorkerOptions.cMapUrl = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/cmaps/`;
pdfjs.GlobalWorkerOptions.standardFontDataUrl = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/standard_fonts/`;

// Configure image decoders path for JPEG 2000 support
// The image_decoders_src tells the worker where to find the image decoder module
const imageDecodersUrl = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.image_decoders.min.mjs`;
pdfjs.GlobalWorkerOptions.imageDecodersPath = imageDecodersUrl;

export default function PdfViewer({ file, initialPage, onPageChange, onWordSelect }) {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(initialPage || 1);
    const [scale, setScale] = useState(1.0);

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
        setPageNumber(newPage);
        onPageChange(newPage, numPages);
    };

    // Attach word selection event listener to PDF text layer
    useEffect(() => {
        if (!onWordSelect) return;

        // Wait for text layer to render
        const timer = setTimeout(() => {
            const textLayer = document.querySelector('.react-pdf__Page__textContent');
            if (textLayer) {
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

                textLayer.addEventListener('click', handleClick);
                return () => textLayer.removeEventListener('click', handleClick);
            }
        }, 500); // Wait for text layer to render

        return () => clearTimeout(timer);
    }, [pageNumber, onWordSelect]); // Re-attach when page changes


    return (
        <div className="flex flex-col items-center w-full h-full overflow-hidden bg-gray-900">
            <div className="flex-1 overflow-auto flex justify-center p-8 w-full">
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
                        className="shadow-2xl"
                    />
                </Document>
            </div>

            {/* Controls */}
            <div className="h-16 bg-gray-800 w-full flex items-center justify-between px-8 border-t border-gray-700 z-10">
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
