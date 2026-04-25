// LiViElevenLabsTest.ts
// Test harness: plays local SFX and requests TTS generation via linked scripts.
// Inspector fields:
// @input Asset.ScriptComponent ttsScript
// @input Asset.ScriptComponent sfxScript
// @input string sampleText = "Hello from LiVi!"

declare var script: any;

script.api = script.api || {};

script.runAllTests = function() {
    console.log("LiViElevenLabsTest: running tests...");

    if (script.sfxScript && script.sfxScript.api && typeof script.sfxScript.api.play === 'function') {
        console.log("Playing local SFX...");
        try { script.sfxScript.api.play(); } catch (e) { console.warn("Error playing SFX", e); }
    } else {
        console.warn("LiViElevenLabsTest: sfxScript not configured or has no play()");
    }

    if (script.ttsScript && script.ttsScript.api && typeof script.ttsScript.api.speak === 'function') {
        console.log("Requesting TTS generation...");
        script.ttsScript.api.speak(script.sampleText || "Test", undefined, function(url: string, err: any) {
            if (err) { console.warn("TTS test failed", err); return; }
            console.log("TTS test success, URL:", url);
        });
    } else {
        console.warn("LiViElevenLabsTest: ttsScript not configured or has no speak()");
    }
};

export {};
