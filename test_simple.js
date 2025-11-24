console.log('Starting test...');

// Mocks
global.window = {
    speechSynthesis: {
        cancel: function () { console.log('Mock: speechSynthesis.cancel()'); },
        speak: function (u) { console.log('Mock: speechSynthesis.speak() ' + u.text); }
    }
};

global.SpeechSynthesisUtterance = function (text) {
    this.text = text;
};

global.navigator = {
    onLine: true
};

global.Audio = function (url) {
    this.url = url;
    this.play = function () {
        console.log('Mock: Audio.play() ' + this.url);
        if (this.url.indexOf('fail') !== -1) {
            var self = this;
            setTimeout(function () {
                if (self.onerror) self.onerror();
            }, 10);
            return Promise.reject('fail');
        }
        return Promise.resolve();
    };
};

// Function
var playWordAudio = function (word, audioUrl) {
    console.log('playWordAudio called for ' + word);
    window.speechSynthesis.cancel();

    var playTTS = function () {
        if (!word) return;
        var utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
    };

    if (audioUrl && navigator.onLine) {
        try {
            var audio = new Audio(audioUrl);
            audio.onerror = function () {
                console.log('Audio error handler triggered');
                playTTS();
            };
            var p = audio.play();
            if (p) {
                p.catch(function (e) {
                    console.log('Audio promise catch triggered');
                    playTTS();
                });
            }
        } catch (e) {
            console.log('Audio creation error');
            playTTS();
        }
    } else {
        playTTS();
    }
};

// Run
playWordAudio('hello', 'http://ok.com');
setTimeout(function () {
    playWordAudio('fail', 'http://fail.com');
}, 100);
