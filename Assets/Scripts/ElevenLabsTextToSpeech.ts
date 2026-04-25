// ElevenLabsTextToSpeech.ts
// Lightweight Lens Studio script to request a TTS MP3 URL from a backend proxy.
// Inspector fields:
// @input string proxyEndpoint  // e.g. https://myproxy.example.com/generate-tts
// @input string defaultVoice

declare var script: any;
declare var XMLHttpRequest: any;

script.api = script.api || {};

script.proxyEndpoint = script.proxyEndpoint || "";
script.defaultVoice = script.defaultVoice || "";

script.generateTTS = function(text: string, voiceId?: string, callback?: (url?: string, err?: any) => void) {
    var endpoint = script.proxyEndpoint || "";
    var voice = voiceId || script.defaultVoice || "";
    if (!endpoint) {
        console.warn("ElevenLabsTextToSpeech: proxyEndpoint not set on the Script component.");
        callback && callback(undefined, "no-endpoint");
        return;
    }

    try {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", endpoint, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var res = JSON.parse(xhr.responseText);
                        callback && callback(res.url);
                    } catch (e) {
                        callback && callback(undefined, e);
                    }
                } else {
                    callback && callback(undefined, xhr.statusText || xhr.responseText);
                }
            }
        };
        xhr.send(JSON.stringify({ text: text, voice: voice }));
    } catch (e) {
        callback && callback(undefined, e);
    }
};

// Convenience: request generation and return url via callback
script.speak = function(text: string, voiceId?: string, onGenerated?: (url?: string, err?: any) => void) {
    script.generateTTS(text, voiceId, function(url: string, err: any) {
        if (err) {
            console.warn("ElevenLabsTextToSpeech.speak error:", err);
            if (onGenerated) onGenerated(undefined, err);
            return;
        }
        console.log("ElevenLabsTextToSpeech: TTS ready at", url);
        if (onGenerated) onGenerated(url, null);
    });
};

// Expose via api for other ScriptComponents to call
script.api.generateTTS = script.generateTTS;
script.api.speak = script.speak;

export {};
