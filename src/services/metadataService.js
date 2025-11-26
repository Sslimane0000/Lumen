import ePub from 'epubjs';
import * as pdfjs from 'pdfjs-dist';

/**
 * Lookup book metadata from Google Books API
 * @param {string} title - Book title to search for
 * @returns {Promise<Object|null>} - Metadata object or null if not found
 */
export const lookupBookMetadata = async (title) => {
    try {
        // Clean up title for better search results
        const cleanTitle = title
            .replace(/\.(epub|pdf)$/i, '')
            .replace(/[_-]/g, ' ')
            .trim();

        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanTitle)}&maxResults=5`;

        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Google Books API returned ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (data.items && data.items.length > 0) {
            // Find the best match among results
            const candidates = data.items.map(item => {
                const info = item.volumeInfo;
                const confidence = calculateConfidence(cleanTitle, info.title);
                return {
                    info,
                    confidence
                };
            });

            // Sort by confidence (descending) and prefer results with authors
            candidates.sort((a, b) => {
                // Boost score if author exists
                const scoreA = a.confidence + (a.info.authors ? 10 : 0);
                const scoreB = b.confidence + (b.info.authors ? 10 : 0);
                return scoreB - scoreA;
            });

            const bestMatch = candidates[0];
            const book = bestMatch.info;

            console.log(`Metadata lookup for '${cleanTitle}': Found ${candidates.length} results. Best match: '${book.title}' (${bestMatch.confidence}%)`);

            return {
                title: book.title || null,
                author: book.authors ? book.authors.join(', ') : null,
                publisher: book.publisher || null,
                publishedDate: book.publishedDate || null,
                isbn: book.industryIdentifiers ?
                    book.industryIdentifiers.find(id => id.type === 'ISBN_13')?.identifier ||
                    book.industryIdentifiers.find(id => id.type === 'ISBN_10')?.identifier
                    : null,
                description: book.description || null,
                thumbnail: book.imageLinks?.thumbnail || null,
                confidence: bestMatch.confidence
            };
        }

        return null;
    } catch (error) {
        console.error('Error looking up metadata:', error);
        return null;
    }
};

/**
 * Calculate confidence score for API match
 * @param {string} searchTitle - Original search title
 * @param {string} resultTitle - Title from API result
 * @returns {number} - Confidence score 0-100
 */
const calculateConfidence = (searchTitle, resultTitle) => {
    if (!searchTitle || !resultTitle) return 0;

    const search = searchTitle.toLowerCase();
    const result = resultTitle.toLowerCase();

    // Exact match
    if (search === result) return 100;

    // Contains check
    if (result.includes(search) || search.includes(result)) return 85;

    // Word overlap
    const searchWords = new Set(search.split(/\s+/));
    const resultWords = new Set(result.split(/\s+/));
    const overlap = [...searchWords].filter(w => resultWords.has(w)).length;
    const maxWords = Math.max(searchWords.size, resultWords.size);

    return Math.round((overlap / maxWords) * 70);
};

/**
 * Extract metadata from EPUB file
 * @param {File|Blob} file - EPUB file
 * @returns {Promise<Object|null>} - Metadata object or null
 */
export const extractEpubMetadata = async (file) => {
    try {
        const book = ePub(file);
        await book.ready;

        const metadata = await book.loaded.metadata;

        return {
            title: metadata.title || null,
            author: metadata.creator || null,
            publisher: metadata.publisher || null,
            publishedDate: metadata.pubdate || null,
            isbn: metadata.identifier || null,
            description: metadata.description || null,
            language: metadata.language || null
        };
    } catch (error) {
        console.error('Error extracting EPUB metadata:', error);
        return null;
    }
};

/**
 * Extract metadata from PDF file
 * @param {File|Blob} file - PDF file
 * @returns {Promise<Object|null>} - Metadata object or null
 */
export const extractPdfMetadata = async (file) => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({
            data: arrayBuffer,
            // Configure WASM-based image decoders for JPEG 2000
            wasmUrl: '/openjpeg.wasm'
        }).promise;
        const metadata = await pdf.getMetadata();

        const info = metadata.info;

        return {
            title: info.Title || null,
            author: info.Author || null,
            publisher: info.Producer || null,
            creationDate: info.CreationDate || null,
            subject: info.Subject || null,
            keywords: info.Keywords || null
        };
    } catch (error) {
        console.error('Error extracting PDF metadata:', error);
        return null;
    }
};

/**
 * Extract metadata from file based on type
 * @param {File|Blob} file - Book file
 * @param {string} type - MIME type
 * @returns {Promise<Object|null>} - Metadata object or null
 */
export const extractMetadataFromFile = async (file, type) => {
    if (type === 'application/epub+zip') {
        return await extractEpubMetadata(file);
    } else if (type === 'application/pdf') {
        return await extractPdfMetadata(file);
    }
    return null;
};

/**
 * Repair book metadata by combining file extraction and API lookup
 * @param {Object} book - Book object from database
 * @returns {Promise<Object|null>} - Repaired metadata or null
 */
export const repairBookMetadata = async (book) => {
    try {
        const results = {
            original: {
                title: book.title,
                author: book.author || null,
                publisher: book.publisher || null
            },
            file: null,
            api: null,
            proposed: null
        };

        // Extract from file if available
        if (book.data) {
            results.file = await extractMetadataFromFile(book.data, book.type);
        }

        // Lookup from API
        results.api = await lookupBookMetadata(book.title);

        // Merge strategy: File metadata > API data > Original data
        results.proposed = {
            title: results.file?.title || results.api?.title || book.title,
            author: results.file?.author || results.api?.author || book.author || null,
            publisher: results.file?.publisher || results.api?.publisher || book.publisher || null,
            isbn: results.file?.isbn || results.api?.isbn || null,
            description: results.api?.description || null,
            thumbnail: results.api?.thumbnail || null,
            confidence: results.api?.confidence || 0
        };

        return results;
    } catch (error) {
        console.error('Error repairing metadata:', error);
        return null;
    }
};

/**
 * Batch repair metadata for multiple books
 * @param {Array} books - Array of book objects
 * @param {Function} onProgress - Progress callback (current, total)
 * @returns {Promise<Array>} - Array of repair results
 */
export const batchRepairMetadata = async (books, onProgress) => {
    const results = [];

    for (let i = 0; i < books.length; i++) {
        if (onProgress) {
            onProgress(i + 1, books.length);
        }

        const result = await repairBookMetadata(books[i]);
        if (result) {
            results.push({
                bookId: books[i].id,
                ...result
            });
        }

        // Rate limiting - wait 100ms between API calls
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
};
