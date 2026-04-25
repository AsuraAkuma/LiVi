// AudioSystemTest.js
// Plays a referenced AudioComponent on Lens start and logs what happened.
//
// @input Component.AudioComponent audio
// @input int playCount = 1

function log(msg) {
    print("[AudioSystemTest] " + msg);
}

function safePlay() {
    if (!script.audio) {
        log("ERROR: No AudioComponent bound to input 'audio'.");
        return;
    }

    // Try to log some useful state (some props may not exist depending on asset type).
    try {
        log("AudioComponent found. enabled=" + script.audio.enabled + ", volume=" + script.audio.volume);
    } catch (e) {
        log("AudioComponent found. (Could not read enabled/volume: " + e + ")");
    }

    var count = (script.playCount === undefined || script.playCount === null) ? 1 : script.playCount;
    log("Calling audio.play(" + count + ")");

    try {
        script.audio.play(count);
        log("play() called successfully");
    } catch (e2) {
        log("ERROR calling play(): " + e2);
    }
}

// Lens start
safePlay();
