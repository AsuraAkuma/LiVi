// StartUITitleSubtitleBreathAnimator.ts
// Subtle idle "breathing" for title + subtitle.

@component
export class StartUITitleSubtitleBreathAnimator extends BaseScriptComponent {
    @input
    @hint("Title Text component to animate (optional but recommended).")
    titleText?: Text;

    @input
    @hint("Subtitle Text component to animate (optional but recommended).")
    subtitleText?: Text;

    @input
    @hint("Breathing period in seconds (slow/subtle).")
    periodSeconds: number = 3.8;

    // Keep this subtle; we're going for "alive" not "pulsing button".
    @input
    titleMinAlpha: number = 0.88;

    @input
    titleMaxAlpha: number = 1.0;

    @input
    subtitleMinAlpha: number = 0.75;

    @input
    subtitleMaxAlpha: number = 0.92;

    private t: number = 0;
    private titleBaseRgb: vec3 | null = null;
    private subtitleBaseRgb: vec3 | null = null;
    private warnedMissingInputs: boolean = false;

    onAwake(): void {
        if (this.titleText) {
            const c = this.titleText.textFill.color;
            this.titleBaseRgb = new vec3(c.x, c.y, c.z);
        }
        if (this.subtitleText) {
            const c = this.subtitleText.textFill.color;
            this.subtitleBaseRgb = new vec3(c.x, c.y, c.z);
        }

        this.createEvent("UpdateEvent").bind(() => this.onUpdateTick());
    }

    private onUpdateTick(): void {
        if (!this.titleText && !this.subtitleText) {
            if (!this.warnedMissingInputs) {
                this.warnedMissingInputs = true;
                print("[StartUITitleSubtitleBreathAnimator] Assign titleText and/or subtitleText in the Inspector to enable breathing.");
            }
            return;
        }

        const dt = getDeltaTime();
        this.t += dt;

        const period = Math.max(this.periodSeconds, 0.001);
        const omega = (Math.PI * 2.0) / period;

        // 0..1..0 curve (cosine) so it eases at the ends.
        const s = (Math.cos(this.t * omega) * -0.5 + 0.5);

        if (this.titleText && this.titleBaseRgb) {
            const a = this.titleMinAlpha + (this.titleMaxAlpha - this.titleMinAlpha) * s;
            const rgb = this.titleBaseRgb;
            this.titleText.textFill.color = new vec4(rgb.x, rgb.y, rgb.z, a);
        }

        if (this.subtitleText && this.subtitleBaseRgb) {
            const a = this.subtitleMinAlpha + (this.subtitleMaxAlpha - this.subtitleMinAlpha) * s;
            const rgb = this.subtitleBaseRgb;
            this.subtitleText.textFill.color = new vec4(rgb.x, rgb.y, rgb.z, a);
        }
    }
}
