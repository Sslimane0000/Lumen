/**
 * Plays audio for a given word.
 * Prioritizes high-quality human audio from a URL.
 * Falls back to native Text-to-Speech (TTS) if offline, URL is missing, or playback fails.
 *
 * @param {string} word - The word to play audio for.
 * @param {string} [audioUrl] - Optional URL for the audio file.
 */
export const playWordAudio = (word, audioUrl) => {
    // Cleanup: Stop any overlapping audio
    window.speechSynthesis.cancel();

    // Helper function for TTS fallback
    const playTTS = () => {
        if (!word) return;
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
    };

    // Network & Data Check
    if (audioUrl && navigator.onLine) {
        try {
            const audio = new Audio(audioUrl);

            // Critical: Add error handling
            audio.onerror = () => {
                console.warn(`Audio playback failed for URL: ${audioUrl}. Falling back to TTS.`);
                playTTS();
            };

            // Attempt to play
            const playPromise = audio.play();

            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    console.warn(`Audio play promise rejected: ${error}. Falling back to TTS.`);
                    playTTS();
                });
            }
        } catch (error) {
            console.error(`Error creating Audio object: ${error}. Falling back to TTS.`);
            playTTS();
        }
    } else {
        // Fallback Method (Native TTS)
        playTTS();
    }
};
