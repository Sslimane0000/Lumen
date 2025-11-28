import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';

const app = express();
app.use(cors());

const PORT = 5000;

app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: "No query provided" });

        console.log(`Searching for: ${query}...`);

        // 1. Fetch HTML from Anna's Archive
        const url = `https://annas-archive.org/search?q=${encodeURIComponent(query)}`;

        const { data } = await axios.get(url, {
            headers: {
                // User-Agent makes us look like a real browser so we don't get blocked
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        // 2. Parse HTML
        const $ = cheerio.load(data);
        const results = [];

        // 3. Extract Book Data - look at parent containers
        const links = $('a[href*="/md5/"]');
        console.log(`Found ${links.length} potential book links`);

        links.each((i, element) => {
            if (i >= 15) return; // Limit to top 15 results

            const $link = $(element);

            // Get parent container that has all the info
            const $container = $link.closest('div').parent();
            const fullText = $container.text().trim();

            // DEBUG: Show first 500 chars of container text for first few results
            if (i < 2) {
                console.log(`\n=== Book ${i} Container Text (first 500 chars) ===`);
                console.log(fullText.substring(0, 500));
                console.log('================\n');
            }

            // Get title from the link
            let title = $link.text().trim();

            // Skip entries with no title (probably duplicate image links)
            if (!title || title.length < 3) {
                return; // Skip to next iteration
            }

            // Try to find author in the container
            let author = "Unknown Author";
            // Look for patterns like "George R.R. Martin" or "Author: Name"
            const authorPatterns = [
                /(?:by |Author[s]?:\s*)([A-Z][^,\n]+?)(?:\s*[,;\n]|$)/,
                /([A-Z][a-z]+(?:\s+[A-Z]\.?)+(?:\s+[A-Z][a-z]+)+)/  // Match names like "George R.R. Martin"
            ];

            for (const pattern of authorPatterns) {
                const match = fullText.match(pattern);
                if (match && match[1]?.trim()) {
                    author = match[1].trim();
                    // Clean up common suffixes
                    author = author.replace(/\s*[,;].*$/, '').trim();
                    if (author.length > 3 && author.length < 100) {
                        break;
                    }
                }
            }

            // Get file format and size from container
            let fileInfo = "Unknown format";
            const formats = ['pdf', 'epub', 'mobi', 'azw3', 'djvu'];

            // Try to find format followed by size
            for (const format of formats) {
                const regex = new RegExp(`\\b(${format})\\b[^a-z]{0,20}?([0-9.]+\\s*[KMG]B)`, 'i');
                const match = fullText.match(regex);
                if (match) {
                    fileInfo = `${match[1].toUpperCase()}, ${match[2]}`;
                    break;
                }
            }

            // If no size found, try just format
            if (fileInfo === "Unknown format") {
                for (const format of formats) {
                    if (fullText.toLowerCase().includes(format)) {
                        fileInfo = format.toUpperCase();
                        break;
                    }
                }
            }

            const href = $link.attr('href');
            const link = href?.startsWith('http') ? href : `https://annas-archive.org${href}`;

            // Get cover image
            const cover = $container.find('img').first().attr('src');
            const fullCover = cover?.startsWith('http') ? cover : cover ? `https://annas-archive.org${cover}` : null;

            console.log(`Book ${i}: ${title} by ${author} - ${fileInfo}`);

            results.push({
                title,
                author,
                cover: fullCover,
                fileInfo,
                link
            });
        });

        console.log(`Found ${results.length} results.`);
        res.json(results);

    } catch (error) {
        console.error("Search failed:", error.message);
        res.status(500).json({ error: "Failed to fetch data" });
    }
});

// New endpoint to get download links for a specific book
app.get('/api/download/:md5', async (req, res) => {
    try {
        const { md5 } = req.params;
        console.log(`Fetching download links for MD5: ${md5}...`);

        const url = `https://annas-archive.org/md5/${md5}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(data);
        const downloads = [];

        // Look for download links
        // Anna's Archive usually has a section "Slow Partner Server" or similar
        // We want to find external mirror links or direct downloads

        // 1. specific slow partner server links often look like /slow_download/
        $('a[href*="/slow_download/"]').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            downloads.push({
                url: href.startsWith('http') ? href : `https://annas-archive.org${href}`,
                label: text || `Slow Partner Server ${i + 1}`
            });
        });

        // 2. Look for external mirrors (Libgen, IPFS, etc)
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();

            if (!href) return;

            // Filter out internal/useless links
            if (href.includes('/account/') || href.includes('/donate') || href.includes('/search') || href.includes('/datasets')) return;

            // Check for known mirror patterns
            const isMirror = href.includes('library.lol') ||
                href.includes('libgen') ||
                href.includes('ipfs') ||
                href.includes('cloudflare-ipfs') ||
                text.includes('Slow Partner Server');

            if (isMirror) {
                // Avoid duplicates
                const fullUrl = href.startsWith('http') ? href : `https://annas-archive.org${href}`;
                if (!downloads.some(d => d.url === fullUrl)) {
                    downloads.push({
                        url: fullUrl,
                        label: text || 'External Mirror'
                    });
                }
            }
        });

        // Prioritize Libgen links (Libgen.li, library.lol, etc)
        downloads.sort((a, b) => {
            const isLibgenA = a.url.includes('libgen') || a.url.includes('library.lol');
            const isLibgenB = b.url.includes('libgen') || b.url.includes('library.lol');

            if (isLibgenA && !isLibgenB) return -1;
            if (!isLibgenA && isLibgenB) return 1;
            return 0;
        });

        console.log(`Found ${downloads.length} download links`);

        // Debug: log found links
        downloads.forEach((d, i) => console.log(`Link ${i}: ${d.label} -> ${d.url}`));

        res.json({ downloads: downloads.slice(0, 5) }); // Return top 5 links

    } catch (error) {
        console.error("Failed to get download links:", error.message);
        res.status(500).json({ error: "Failed to fetch download links" });
    }
});

app.listen(PORT, () => {
    console.log(`Backend Server running on http://localhost:${PORT}`);
});