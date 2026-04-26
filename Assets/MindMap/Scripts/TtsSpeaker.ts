@component
export class TtsSpeaker extends BaseScriptComponent {
    @input
    @allowUndefined
    sound?: AudioComponent;
    @input
    tts_voice_id: string = "";
    @input
    backend_base_url: string = "https://localhost:3001";
    @input
    allow_insecure_http_for_debug: boolean = false;
    @input
    @allowUndefined
    internet_module?: InternetModule;
    @input
    @allowUndefined
    remote_media_module?: RemoteMediaModule;

    private isSpeaking: boolean = false;

    onAwake() {
        // No-op. This component is driven by external speak(text) calls.
    }

    public async speak(text: string): Promise<void> {
        const clean = (text || "").trim();
        if (!clean) {
            return;
        }

        if (!this.sound) {
            print("[TtsSpeaker] Missing AudioComponent input: sound.");
            return;
        }

        if (!this.internet_module || !this.remote_media_module) {
            print("[TtsSpeaker] Missing internet_module or remote_media_module input.");
            return;
        }

        if (this.isSpeaking) {
            // Simple guard so rapid pinches do not overlap.
            return;
        }

        this.isSpeaking = true;

        try {
            const relativeUrl = await this.requestGeneratedTtsUrl(clean);
            const absoluteUrl = this.toAbsoluteUrl(relativeUrl);
            const dynamicResource = this.internet_module.makeResourceFromUrl(absoluteUrl);

            this.remote_media_module.loadResourceAsAudioTrackAsset(
                dynamicResource,
                (audioTrackAsset: AudioTrackAsset) => {
                    if (!this.sound) {
                        this.isSpeaking = false;
                        return;
                    }
                    this.sound.audioTrack = audioTrackAsset;
                    this.sound.play(1);
                    this.isSpeaking = false;
                },
                (errorMessage: string) => {
                    print("[TtsSpeaker] Failed to load remote audio: " + errorMessage);
                    this.isSpeaking = false;
                }
            );
        } catch (error) {
            print("[TtsSpeaker] TTS request failed: " + error);
            this.isSpeaking = false;
        }
    }

    private async requestGeneratedTtsUrl(ttsText: string): Promise<string> {
        if (!this.internet_module) {
            throw new Error("internet_module input is required.");
        }

        const endpoint = this.getValidatedBackendBaseUrl() + "/api/tts";
        const requestBody: { texts: string[]; voiceId?: string } = {
            texts: [ttsText]
        };

        const voiceId = (this.tts_voice_id || "").trim();
        if (voiceId) {
            requestBody.voiceId = voiceId;
        }

        const response = await this.internet_module.fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const details = await this.safeReadResponseText(response);
            throw new Error("Backend returned status " + response.status + ". " + details);
        }

        const parsed = await response.json();
        const payload = parsed && parsed.json ? parsed.json : parsed;
        const firstItem = payload?.items?.[0];
        const downloadUrl = firstItem?.downloadUrl;

        if (typeof downloadUrl !== "string" || !downloadUrl.length) {
            throw new Error("TTS response is missing items[0].downloadUrl.");
        }

        return downloadUrl;
    }

    private getBackendBaseUrl(): string {
        const value = (this.backend_base_url || "").trim();
        const sanitized = value.endsWith("/") ? value.slice(0, -1) : value;
        return sanitized || "https://localhost:3001";
    }

    private getValidatedBackendBaseUrl(): string {
        const baseUrl = this.getBackendBaseUrl();
        const isInsecure = baseUrl.startsWith("http://");

        if (isInsecure && !this.allow_insecure_http_for_debug) {
            throw new Error(
                "Insecure backend URL blocked. Set backend_base_url to https://..., or enable allow_insecure_http_for_debug and Experimental API insecure URLs."
            );
        }

        return baseUrl;
    }

    private toAbsoluteUrl(pathOrUrl: string): string {
        if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
            return pathOrUrl;
        }

        const baseUrl = this.getValidatedBackendBaseUrl();

        if (pathOrUrl.startsWith("/")) {
            return baseUrl + pathOrUrl;
        }

        return baseUrl + "/" + pathOrUrl;
    }

    private async safeReadResponseText(response: Response): Promise<string> {
        try {
            return await response.text();
        } catch {
            return "";
        }
    }
}
