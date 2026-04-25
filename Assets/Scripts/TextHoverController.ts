// TextHoverController.ts
// Plays a local SFX and optionally requests remote TTS when the user taps a target SceneObject.
// Inspector fields:
// @input SceneObject target
// @input string textToRead
// @input bool playTTSOnTap = true
// @input Component.AudioComponent localBeep
// @input Asset.ScriptComponent ttsScript
// @input bool logGeneratedUrl = true

declare var script: any;
declare var TouchGestures: any;

script.api = script.api || {};

function playBeep() {
    if (script.localBeep) {
        try {
            if (typeof script.localBeep.start === 'function') script.localBeep.start(0);
            else if (typeof script.localBeep.play === 'function') script.localBeep.play(0);
            else console.warn("TextHoverController: localBeep has no play/start");
        } catch (e) { console.warn("TextHoverController: error playing localBeep", e); }
    } else {
        console.warn("TextHoverController: no localBeep assigned");
    }
}

function onTap(eventData: any) {
    playBeep();
    if (script.playTTSOnTap && script.ttsScript && script.ttsScript.api && typeof script.ttsScript.api.speak === 'function') {
        script.ttsScript.api.speak(script.textToRead || "", undefined, function(url: string, err: any) {
            if (err) {
                console.warn("TextHoverController: TTS generation failed", err);
                return;
            }
            if (script.logGeneratedUrl) console.log("TextHoverController: generated TTS URL:", url);
        });
    }
}

function initialize() {
    if (!script.target) { console.warn("TextHoverController: assign `target` in Inspector"); return; }
    try {
        TouchGestures.onTap(script.target, onTap);
        console.log("TextHoverController: tap handler attached");
    } catch (e) {
        console.warn("TextHoverController: TouchGestures not available", e);
    }
}

initialize();

script.api.playBeep = playBeep;

export {};
