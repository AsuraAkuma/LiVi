// StartUIPromptAnimator.ts
// Fades in the prompt, then gently pulses its opacity.

@component
export class StartUIPromptAnimator extends BaseScriptComponent {
    @input
    @hint("Prompt Text component (e.g. the 'Pinch to continue' text).")
    promptText?: Text;

    @input
    fadeInSeconds: number = 0.6;

    @input
    pulsePeriodSeconds: number = 2.4; // full in->out->in cycle

    @input
    minAlpha: number = 0.35;

    @input
    maxAlpha: number = 1.0;

    private t: number = 0;
    private promptBaseRgb: vec3 | null = null;
    private pillBaseRgb: vec3 | null = null;
    private warnedMissingInput: boolean = false;

    onAwake(): void {
        if (!this.promptText) {
            // Avoid hard-failing if the inspector input isn't wired.
            this.createEvent("UpdateEvent").bind(() => this.onUpdateTick());
            return;
        }

        // Cache base colors so we don't drift alpha over time.
        const c = this.promptText.textFill.color;
        this.promptBaseRgb = new vec3(c.x, c.y, c.z);

        if (this.promptText.backgroundSettings && this.promptText.backgroundSettings.enabled) {
            const bc = this.promptText.backgroundSettings.fill.color;
            this.pillBaseRgb = new vec3(bc.x, bc.y, bc.z);
        }

        // Start fully transparent.
        this.promptText.textFill.color = new vec4(c.x, c.y, c.z, 0.0);

        // Also fade the background pill if enabled.
        if (this.promptText.backgroundSettings && this.promptText.backgroundSettings.enabled) {
            const bc = this.promptText.backgroundSettings.fill.color;
            this.promptText.backgroundSettings.fill.color = new vec4(bc.x, bc.y, bc.z, 0.0);
        }

        this.createEvent("UpdateEvent").bind(() => this.onUpdateTick());
    }

    private onUpdateTick(): void {
        if (!this.promptText) {
            if (!this.warnedMissingInput) {
                this.warnedMissingInput = true;
                print("[StartUIPromptAnimator] Assign promptText in the Inspector to enable the fade/pulse.");
            }
            return;
        }

        const dt = getDeltaTime();
        this.t += dt;

        // 1) Fade-in phase
        const fade = this.fadeInSeconds > 0 ? Math.min(this.t / this.fadeInSeconds, 1.0) : 1.0;

        // 2) Pulse phase (sinusoid)
        const period = Math.max(this.pulsePeriodSeconds, 0.001);
        const omega = (Math.PI * 2.0) / period;
        const s = (Math.sin((this.t - this.fadeInSeconds) * omega) * 0.5 + 0.5); // 0..1
        const pulsed = this.minAlpha + (this.maxAlpha - this.minAlpha) * s;

        const alpha = fade * pulsed;

        // Apply to text fill
        const rgb = this.promptBaseRgb ?? new vec3(1, 1, 1);
        this.promptText.textFill.color = new vec4(rgb.x, rgb.y, rgb.z, alpha);

        // Apply to background fill (slightly lower alpha so text stays dominant)
        if (this.promptText.backgroundSettings && this.promptText.backgroundSettings.enabled) {
            const pillRgb = this.pillBaseRgb ?? new vec3(0, 0, 0);
            this.promptText.backgroundSettings.fill.color = new vec4(pillRgb.x, pillRgb.y, pillRgb.z, alpha * 0.85);
        }
    }
}

