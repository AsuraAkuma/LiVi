// SoundEffectsManager.ts
// Simple helper to play local Audio Components (short SFX)
// Inspector fields:
// @input Component.AudioComponent defaultBeep

declare var script: any;

script.api = script.api || {};

script.playAudioComponent = function(audioComp: any) {
    if (!audioComp) {
        console.warn("SoundEffectsManager: no audio component assigned");
        return;
    }
    try {
        if (typeof audioComp.start === 'function') {
            audioComp.start(0);
        } else if (typeof audioComp.play === 'function') {
            audioComp.play(0);
        } else {
            console.warn("SoundEffectsManager: audio component has no start/play method");
        }
    } catch (e) {
        console.warn("SoundEffectsManager: error playing audio", e);
    }
};

script.playDefaultBeep = function() {
    script.playAudioComponent(script.defaultBeep);
};

script.api.play = script.playDefaultBeep;
script.api.playAudioComponent = script.playAudioComponent;

export {};
