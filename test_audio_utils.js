// Mock browser APIs BEFORE importing the module
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

async function runTests() {
    const { playWordAudio } = await import('./src/utils/audio.js');

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
