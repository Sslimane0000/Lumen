// Mocks
global.window = {
    speechSynthesis: {
        cancel: () => console.log('Mock: speechSynthesis.cancel() called'),
        speak: (utterance) => console.log(`Mock: speechSynthesis.speak() called with text: "${utterance.text}"`),
    }
};

global.SpeechSynthesisUtterance = class {
    constructor(text) {
        this.text = text;
    }
};

global.navigator = {
    onLine: true
};

global.Audio = class {
    constructor(url) {
        this.url = url;
        this.onerror = null;
    }
    play() {
        console.log(`Mock: Audio.play() called for URL: ${this.url}`);
        if (this.url.includes('fail')) {
            // Simulate error
            setTimeout(() => {
                if (this.onerror) this.onerror();
            }, 0);
            return Promise.reject('Simulated playback failure');
        }
        return Promise.resolve();
    }
};

// Function from src/utils/audio.js (modified to remove export)
const playWordAudio = (word, audioUrl) => {
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

// Tests
async function runTests() {
    console.log('--- Test 1: Online with valid URL ---');
    playWordAudio('hello', 'https://example.com/hello.mp3');

    console.log('\n--- Test 2: Online with failing URL (should fallback to TTS) ---');
    playWordAudio('fail', 'https://example.com/fail.mp3');

    // Wait for async error handling
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('\n--- Test 3: Offline (should fallback to TTS) ---');
    global.navigator.onLine = false;
    playWordAudio('offline', 'https://example.com/offline.mp3');

    console.log('\n--- Test 4: No URL (should fallback to TTS) ---');
    global.navigator.onLine = true;
    playWordAudio('no_url');
}

runTests().catch(console.error);
