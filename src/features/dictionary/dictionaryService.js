import i18next from 'i18next';

// Detect if a word contains Arabic characters
const detectLanguage = (word) => {
    // Arabic Unicode range: U+0600 to U+06FF
    const arabicPattern = /[\u0600-\u06FF]/;
    return arabicPattern.test(word) ? 'ar' : 'en';
};

// Fetch Arabic word suggestions from Wiktionary opensearch
export const fetchArabicSuggestions = async (word) => {
    const cleanWord = word.replace(/[\u064B-\u065F]/g, ''); // Remove diacritics
    const url = `https://ar.wiktionary.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanWord)}&limit=5&format=json&origin=*`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Opensearch format: [searchString, [Matches], [Descriptions], [Links]]
        // We want index 1 (the list of titles)
        const suggestions = data[1] || [];

        console.log(`Suggestions for ${word}:`, suggestions);
        return suggestions;

    } catch (error) {
        console.error('Error fetching suggestions:', error);
        return [];
    }
};

//Helper function to clean HTML and extract text
const extractTextFromHTML = (html) => {
    console.log('Raw HTML length:', html.length);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Find the first paragraph that contains substantial text (definition)
    const paragraphs = doc.querySelectorAll('p');
    console.log('Found paragraphs:', paragraphs.length);

    for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        const text = p.textContent.trim();
        console.log(`Paragraph ${i}:`, text.substring(0, 100), `(length: ${text.length})`);
        // Skip empty paragraphs and very short ones
        if (text.length > 10) {
            return text;
        }
    }

    // If no good paragraph found, try to get any text content
    const bodyText = doc.body?.textContent?.trim();
    console.log('Body text (first 200 chars):', bodyText?.substring(0, 200));

    return null;
};

import { getSettings } from '../../utils/db';

// ... (keep existing imports/constants)

// Helper to fetch audio from Free Dictionary API
const fetchAudioUrl = async (word) => {
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        if (!response.ok) return null;
        const data = await response.json();

        // Find first valid audio URL
        if (Array.isArray(data) && data.length > 0) {
            const entry = data[0];
            if (entry.phonetics) {
                const audioEntry = entry.phonetics.find(p => p.audio && p.audio.length > 0);
                return audioEntry ? audioEntry.audio : null;
            }
        }
        return null;
    } catch (error) {
        console.warn('Error fetching audio:', error);
        return null;
    }
};

export const fetchDefinition = async (word) => {
    try {
        const settings = await getSettings() || {};
        const language = detectLanguage(word);
        console.log('Dictionary lookup:', { word, language, settings });

        if (language === 'ar') {
            return await fetchArabicDefinition(word, settings.geminiKey);
        } else {
            // English Word Logic
            let definitionData = null;

            if (settings.useAiEnglish) {
                definitionData = await fetchAiEnglishDefinition(word, settings.geminiKey, settings.showArabicTranslation);
            } else {
                // Use Wiktionary
                const response = await fetch(
                    `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
                    {
                        headers: {
                            'Api-User-Agent': 'EbookReader/1.0 (Personal Educational Project; mailto:admin@example.com)'
                        }
                    }
                );

                if (!response.ok) {
                    console.warn(`Wiktionary API failed for word "${word}": ${response.status} ${response.statusText}`);
                } else {
                    const data = await response.json();
                    if (data.en && data.en.length > 0) {
                        const meanings = data.en.map(entry => ({
                            partOfSpeech: entry.partOfSpeech,
                            definitions: entry.definitions.map(def => def.definition.replace(/<[^>]*>?/gm, ''))
                        }));

                        definitionData = {
                            word: word,
                            meanings: meanings,
                            language: 'en'
                        };
                    }
                }
            }

            // Fetch audio separately and merge
            if (definitionData) {
                const audioUrl = await fetchAudioUrl(word);
                if (audioUrl) {
                    definitionData.audio = audioUrl;
                }
                return definitionData;
            }
            return null;
        }
    } catch (error) {
        console.error("Dictionary API Error:", error);
        return null;
    }
};

// Helper function for Arabic lookups using Gemini AI
const fetchArabicDefinition = async (word, apiKey) => {
    if (!apiKey) {
        console.warn("No Gemini API Key provided.");
        return {
            word: word,
            meanings: [{
                partOfSpeech: "Error",
                definitions: ["Please set your Gemini API Key in the Settings tab."]
            }],
            language: 'ar'
        };
    }

    // Use gemini-flash-lite-latest (smallest and most cost effective)
    const modelVersion = "gemini-flash-lite-latest";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent?key=${apiKey}`;

    // THE "PROGRAMMING" IS HERE:
    // We instruct the AI to behave strictly like a JSON API.
    const prompt = `
Role: You are a strict Arabic-to-Arabic Dictionary API.
Input Word: "${word}"

Instructions:
1. Analyze the input word (respecting diacritics/Tashkeel if present).
2. Identify the root (Lemma) and the specific meaning.
3. If it is a plural, define the singular.
4. Output ONLY valid JSON. Do not write markdown or conversational text.
5. **CRITICAL**: Provide a SIMPLE, CONCISE definition in Arabic. Avoid complex sentence structures. Do not mix English words unless absolutely necessary for etymology.

Required JSON Structure:
{
  "lemma": "The root/singular form (e.g., 'كِتَاب')",
  "definition": "A simple, clear definition in Arabic (Al-Waseet style)",
  "pos": "Part of Speech (e.g., اسم, فعل)",
  "root": "The linguistic root (e.g., ك-ت-ب)"
}
`;

    try {
        console.log(`Fetching AI definition for: ${word}`);

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        // Check if the response is OK before parsing
        if (!response.ok) {
            if (response.status === 429) {
                console.error("Rate limit exceeded (429)");
                return {
                    word: word,
                    meanings: [{
                        partOfSpeech: "خطأ",
                        definitions: ["طلبات كثيرة جداً. يرجى الإبطاء أو التحقق من حصة API الخاصة بك."]
                    }],
                    language: 'ar'
                };
            }
            console.error(`API request failed: ${response.status} ${response.statusText}`);
            return {
                word: word,
                meanings: [{
                    partOfSpeech: "خطأ",
                    definitions: [`فشل الاتصال بالخادم: ${response.status}`]
                }],
                language: 'ar'
            };
        }

        const data = await response.json();

        // Check for API errors in the response body
        if (data.error) {
            console.error("Gemini API Error:", data.error.message);
            return {
                word: word,
                meanings: [{
                    partOfSpeech: "خطأ",
                    definitions: [`خطأ في API: ${data.error.message}`]
                }],
                language: 'ar'
            };
        }

        // Use optional chaining to safely access candidates
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
            console.error("No text content in API response");
            return {
                word: word,
                meanings: [{
                    partOfSpeech: "خطأ",
                    definitions: ["لم يتم العثور على تعريف"]
                }],
                language: 'ar'
            };
        }

        // Clean response (sometimes AI adds ```json wrappers)
        const cleanedText = rawText.replace(/```json|```/g, '').trim();

        const result = JSON.parse(cleanedText);
        console.log('Gemini result:', result);

        // Format for the app's expected structure
        const definitionText = `(${result.lemma}) ${result.pos}: ${result.definition}`;

        return {
            word: word,
            meanings: [{
                partOfSpeech: `${result.pos} • الجذر: ${result.root}`,
                definitions: [definitionText]
            }],
            language: 'ar'
        };

    } catch (error) {
        console.error("AI Dictionary Error:", error);
        return {
            word: word,
            meanings: [{
                partOfSpeech: "خطأ",
                definitions: ["فشل في الحصول على التعريف. حاول مرة أخرى."]
            }],
            language: 'ar'
        };
    }
};

const fetchAiEnglishDefinition = async (word, apiKey, showArabic) => {
    if (!apiKey) return null;

    const modelVersion = "gemini-flash-lite-latest";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent?key=${apiKey}`;

    const prompt = `
Role: You are a Dictionary API.
Input Word: "${word}"
Target Language: ${showArabic ? 'Arabic (Monolingual Style)' : 'English'}

Instructions:
1. Define the word "${word}".
${showArabic
            ? `2. **CRITICAL**: Provide a FULL DEFINITION in ARABIC. Do not just translate the word. Explain the meaning of the English word using Arabic text, similar to how a monolingual Arabic dictionary defines words.
3. Identify Part of Speech (in Arabic or English).
4. Output ONLY valid JSON.`
            : `2. Define the word in simple English.
3. Identify Part of Speech.
4. Output ONLY valid JSON.`}

Required JSON Structure:
{
  "word": "${word}",
  "meanings": [
    {
      "partOfSpeech": "noun/verb/etc",
      "definitions": ["${showArabic ? 'Arabic definition explaining the English word' : 'English definition'}"]
    }
  ]
}
`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        // Check if the response is OK before parsing
        if (!response.ok) {
            if (response.status === 429) {
                console.error("Rate limit exceeded (429)");
                return {
                    word: word,
                    meanings: [{
                        partOfSpeech: "Error",
                        definitions: ["Too many requests. Please slow down or check your API quota."]
                    }],
                    language: 'en'
                };
            }
            console.error(`API request failed: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();

        // Check for API errors in the response body
        if (data.error) {
            console.error("Gemini API Error:", data.error.message);
            return null;
        }

        // Use optional chaining to safely access candidates
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
            console.error("No text content in API response");
            return null;
        }

        const cleanedText = rawText.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleanedText);

        return {
            word: result.word,
            meanings: result.meanings,
            language: 'en' // Keep as 'en' so it's treated as an English word entry, but content is Arabic
        };

    } catch (error) {
        console.error("AI English Dictionary Error:", error);
        return null;
    }
};

