// RemoteTTSExample.ts
// Example: request TTS from the ElevenLabsTextToSpeech script and show/play the returned URL.
// Inspector fields:
// @input Asset.ScriptComponent ttsScript
// @input Component.AudioComponent audioToPlay
// @input string exampleText = "This is a sample TTS."

declare var script: any;

script.api = script.api || {};

script.runExample = function() {
    if (!script.ttsScript || !script.ttsScript.api || typeof script.ttsScript.api.speak !== 'function') {
        console.warn("RemoteTTSExample: ttsScript not configured or missing speak()");
        return;
    }
    var text = script.exampleText || "Sample";
    console.log("RemoteTTSExample: requesting TTS for:", text);
    script.ttsScript.api.speak(text, undefined, function(url: string, err: any) {
        if (err) { console.warn("RemoteTTSExample: TTS failed", err); return; }
        console.log("RemoteTTSExample: TTS audio URL ready:", url);
        // If your Audio Component supports setting a remote URL programmatically, try that.
        if (script.audioToPlay) {
            try {
                if (typeof script.audioToPlay.setUrl === 'function') {
                    script.audioToPlay.setUrl(url);
                    if (typeof script.audioToPlay.play === 'function') script.audioToPlay.play(0);
                    return;
                }
            } catch (e) { console.warn("RemoteTTSExample: failed to setUrl/play audioToPlay", e); }
        }
        console.log("RemoteTTSExample: assign the URL to a Remote Audio asset in Lens Studio:", url);
    });
};

script.api.runExample = script.runExample;

export {};
