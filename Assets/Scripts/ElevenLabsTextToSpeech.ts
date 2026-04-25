// ElevenLabsTextToSpeech.ts
// ScriptComponent that requests a TTS MP3 URL from a backend proxy.
// Inspector fields:
// @input string proxyEndpoint  // e.g. https://myproxy.example.com/generate-tts
// @input string defaultVoice

declare var XMLHttpRequest: any;

type TTSGeneratedCallback = (url?: string, err?: any) => void;

@component
export class ElevenLabsTextToSpeech extends BaseScriptComponent {
    @input
    proxyEndpoint: string = "";

    @input
    defaultVoice: string = "";

    onAwake() {
        // Keep compatibility with existing scripts that call ttsScript.api.speak().
        var api = this.api;
        if (!api) {
            console.warn("ElevenLabsTextToSpeech: script.api is unavailable.");
            return;
        }
        api.generateTTS = this.generateTTS.bind(this);
        api.speak = this.speak.bind(this);

        console.log("ElevenLabsTextToSpeech: onAwake - API methods registered.");

        this.createEvent("OnStartEvent").bind(() => {
            console.log("ElevenLabsTextToSpeech: OnStartEvent fired.");

            if (!this.proxyEndpoint) {
                console.warn("ElevenLabsTextToSpeech: proxyEndpoint is empty.");
                return;
            }

            if (this.proxyEndpoint.indexOf("api.elevenlabs.io") >= 0) {
                console.warn("ElevenLabsTextToSpeech: proxyEndpoint looks like direct ElevenLabs API; this script expects your backend proxy endpoint.");
            }

            console.log("ElevenLabsTextToSpeech: waiting for external calls via script.api.speak().");
        });
    }

    generateTTS(text: string, voiceId?: string, callback?: TTSGeneratedCallback): void {
        var endpoint = this.proxyEndpoint || "";
        var voice = voiceId || this.defaultVoice || "";
        if (!endpoint) {
            console.warn("ElevenLabsTextToSpeech: proxyEndpoint not set on the Script component.");
            if (callback) {
                callback(undefined, "no-endpoint");
            }
            return;
        }

        try {
            var xhr = new XMLHttpRequest();
            xhr.open("POST", endpoint, true);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.onreadystatechange = () => {
                if (xhr.readyState !== 4) {
                    return;
                }

                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var res = JSON.parse(xhr.responseText);
                        if (callback) {
                            callback(res.url);
                        }
                    } catch (e) {
                        if (callback) {
                            callback(undefined, e);
                        }
                    }
                } else if (callback) {
                    callback(undefined, xhr.statusText || xhr.responseText);
                }
            };
            xhr.send(JSON.stringify({ text: text, voice: voice }));
        } catch (e) {
            if (callback) {
                callback(undefined, e);
            }
        }
    }

    speak(text: string, voiceId?: string, onGenerated?: TTSGeneratedCallback): void {
        this.generateTTS(text, voiceId, function (url?: string, err?: any) {
            if (err) {
                console.warn("ElevenLabsTextToSpeech.speak error:", err);
                if (onGenerated) {
                    onGenerated(undefined, err);
                }
                return;
            }
            console.log("ElevenLabsTextToSpeech: TTS ready at", url);
            if (onGenerated) {
                onGenerated(url, null);
            }
        });
    }
}
