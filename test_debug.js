console.log('1');
try {
    global.window = {};
    console.log('2');
    global.window.speechSynthesis = {
        cancel: function () { },
        speak: function () { }
    };
    console.log('3');
} catch (e) {
    console.log('Error setting window: ' + e);
}

console.log('4');
global.SpeechSynthesisUtterance = function () { };
console.log('5');
global.navigator = { onLine: true };
console.log('6');
global.Audio = function () { this.play = function () { return Promise.resolve(); } };
console.log('7');

var playWordAudio = function (word, audioUrl) {
    console.log('Inside function');
    window.speechSynthesis.cancel();
    console.log('Cancelled');
};

console.log('8');
playWordAudio('test', 'url');
console.log('9');
