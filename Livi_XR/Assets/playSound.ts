@component
export default class PlaySound extends BaseScriptComponent {
    @input
    sound?: AudioComponent;
    @input
    loop_count: number = 0;
    @input
    text: string = "";
    @input
    tts_voice_id: string = "";
    @input
    desired_sound_name: string = "";
    @input
    backend_base_url: string = "https://localhost:3001";
    @input
    allow_insecure_http_for_debug: boolean = false;
    @input
    internet_module?: InternetModule;
    @input
    remote_media_module?: RemoteMediaModule;

    onAwake() {
        const api: any = this.api as any;
        api.play = () => this.playNow();
        api.playRequestedSound = () => this.playNow();

        this.createEvent("OnStartEvent").bind(() => {
            this.playNow();
        });
    }

    private playNow() {
        void this.playRequestedSound();
    }

    private async playRequestedSound() {
        if (!this.sound) {
            print("[PlaySound] Missing required AudioComponent input: sound.");
            return;
        }

        const ttsText = (this.text || "").trim();
        const desiredSound = (this.desired_sound_name || "").trim();
        if (!ttsText && !desiredSound) {
            this.sound.play(this.loop_count);
            return;
        }

        if (!this.internet_module || !this.remote_media_module) {
            print("[PlaySound] Missing internet_module or remote_media_module input. Playing currently assigned sound instead.");
            this.sound.play(this.loop_count);
            return;
        }

        try {
            let relativeUrl: string;
            if (ttsText) {
                relativeUrl = await this.requestGeneratedTtsUrl(ttsText);
            } else {
                relativeUrl = await this.requestGeneratedSoundUrl(desiredSound);
            }

            const absoluteUrl = this.toAbsoluteUrl(relativeUrl);
            const dynamicResource = this.internet_module.makeResourceFromUrl(absoluteUrl);

            this.remote_media_module.loadResourceAsAudioTrackAsset(
                dynamicResource,
                (audioTrackAsset: AudioTrackAsset) => {
                    if (!this.sound) {
                        return;
                    }

                    this.sound.audioTrack = audioTrackAsset;
                    this.sound.play(this.loop_count);
                },
                (errorMessage: string) => {
                    print("[PlaySound] Failed to load remote audio track: " + errorMessage);
                    this.sound?.play(this.loop_count);
                }
            );
        } catch (error) {
            print("[PlaySound] Failed to generate or load desired sound '" + desiredSound + "': " + error);
            const errorText = String(error);
            if (errorText.indexOf("URL is not secure") !== -1 || errorText.indexOf("Insecure backend URL") !== -1) {
                print(
                    "[PlaySound] Use an https backend_base_url, or set allow_insecure_http_for_debug=true and enable the Experimental API for insecure URLs in Lens Studio."
                );
            }
            this.sound.play(this.loop_count);
        }
    }

    private async requestGeneratedTtsUrl(ttsText: string): Promise<string> {
        if (!this.internet_module) {
            throw new Error("internet_module input is required to request backend audio.");
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

    private async requestGeneratedSoundUrl(soundPrompt: string): Promise<string> {
        if (!this.internet_module) {
            throw new Error("internet_module input is required to request backend audio.");
        }

        const endpoint = this.getValidatedBackendBaseUrl() + "/api/sfx";
        const response = await this.internet_module.fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompts: [soundPrompt]
            })
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
            throw new Error("Response is missing items[0].downloadUrl.");
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