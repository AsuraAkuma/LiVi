/**
 * StartUIController – Minimal modern start screen flow (pinch to continue)
 *
 * Connections:
 * - startUiRoot: Root SceneObject that contains your Start UI visuals (ScreenTransform/Text/etc.)
 * - titleText/subtitleText/promptText: Optional Text components to populate at runtime
 * - enableOnContinue/disableOnContinue: SceneObjects to toggle when the user continues
 */
@component
export default class StartUIController extends BaseScriptComponent {
    // ─── References ────────────────────────────────────────────────
    @input
    @hint("Root object for the Start UI (will be shown until user pinches).")
    startUiRoot?: SceneObject;

    @input
    @hint("Optional: Title text component to set (e.g., 'LiVi').")
    titleText?: Text;

    @input
    @hint("Optional: Subtitle/description text component to set.")
    subtitleText?: Text;

    @input
    @hint("Optional: 'Pinch to continue' text component to set.")
    promptText?: Text;

    // ─── Copy ──────────────────────────────────────────────────────
    @input
    @hint("Main title shown on the start screen.")
    title: string = "LiVi";

    @input
    @hint("Short subtitle shown under the title.")
    subtitle: string = "Real-time imagery + sound while you read";

    @input
    @hint("Instruction text shown at the bottom.")
    prompt: string = "Pinch to continue";

    // ─── Flow ──────────────────────────────────────────────────────
    @input
    @hint("SceneObjects enabled after the user pinches to continue.")
    enableOnContinue: SceneObject[] = [];

    @input
    @hint("SceneObjects disabled after the user pinches to continue (besides startUiRoot).")
    disableOnContinue: SceneObject[] = [];

    // ─── Exit Animation ────────────────────────────────────────────
    @input
    @hint("Seconds for Start UI exit animation after pinch (0 disables animation).")
    exitDurationSeconds: number = 0.35;

    @input
    @hint("Scale multiplier applied by the end of the exit animation.")
    exitEndScale: number = 0.9;

    @input
    @hint("Screen-space Y offset added by the end of the exit animation (positive moves up).")
    exitEndYOffset: number = 10.0;

    // ─── Gesture Settings ──────────────────────────────────────────
    @input
    @hint("Use filtered pinch events (more stable during hand motion).")
    useFilteredPinch: boolean = true;

    @input
    @hint("Minimum pinch confidence required to continue (0 to 1).")
    minConfidence: number = 0.6;

    private gestureModule: GestureModule = require("LensStudio:GestureModule");
    private hasContinued: boolean = false;

    // Exit animation state
    private isExiting: boolean = false;
    private exitT: number = 0.0;
    private exitStartPos: vec3 | null = null;
    private exitStartScale: vec3 | null = null;

    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => this.onStart());
        this.createEvent("UpdateEvent").bind(() => this.onUpdate());
    }

    private onStart(): void {
        this.applyCopy();
        this.showStartUi();
        this.setInitialEnabledState();
        this.bindContinueGesture();
    }

    private onUpdate(): void {
        if (!this.isExiting) {
            return;
        }

        const root = this.startUiRoot;
        if (!root) {
            // Nothing to animate; just finish.
            this.finishContinue();
            return;
        }

        const duration = Math.max(0.0, this.exitDurationSeconds);
        if (duration <= 0.0) {
            this.finishContinue();
            return;
        }

        if (this.exitStartPos === null) {
            this.exitStartPos = root.getTransform().getLocalPosition();
        }
        if (this.exitStartScale === null) {
            this.exitStartScale = root.getTransform().getLocalScale();
        }

        this.exitT += getDeltaTime();
        const t = Math.min(1.0, this.exitT / duration);

        // Smoothstep easing
        const eased = t * t * (3.0 - 2.0 * t);

        const startPos = this.exitStartPos;
        const startScale = this.exitStartScale;

        const endPos = new vec3(startPos.x, startPos.y + this.exitEndYOffset, startPos.z);
        const endScale = new vec3(
            startScale.x * this.exitEndScale,
            startScale.y * this.exitEndScale,
            startScale.z * this.exitEndScale
        );

        const lerp3 = (a: vec3, b: vec3, tt: number) => {
            return new vec3(
                a.x + (b.x - a.x) * tt,
                a.y + (b.y - a.y) * tt,
                a.z + (b.z - a.z) * tt
            );
        };

        root.getTransform().setLocalPosition(lerp3(startPos, endPos, eased));
        root.getTransform().setLocalScale(lerp3(startScale, endScale, eased));

        if (t >= 1.0) {
            this.finishContinue();
        }
    }

    private applyCopy(): void {
        const safeTitle = (this.title || "").trim();
        const safeSubtitle = (this.subtitle || "").trim();
        const safePrompt = (this.prompt || "").trim();

        if (this.titleText) {
            this.titleText.text = safeTitle;
        }
        if (this.subtitleText) {
            this.subtitleText.text = safeSubtitle;
        }
        if (this.promptText) {
            this.promptText.text = safePrompt;
        }
    }

    private showStartUi(): void {
        if (this.startUiRoot) {
            this.startUiRoot.enabled = true;
        }
    }

    private setInitialEnabledState(): void {
        // Make the start UI feel like a "gate" without requiring additional scripts.
        for (let i = 0; i < this.enableOnContinue.length; i++) {
            const obj = this.enableOnContinue[i];
            if (obj) {
                obj.enabled = false;
            }
        }
    }

    private bindContinueGesture(): void {
        const bindDown = (hand: any) => {
            const downEvent = this.useFilteredPinch
                ? this.gestureModule.getFilteredPinchDownEvent(hand)
                : this.gestureModule.getPinchDownEvent(hand);

            downEvent.add((args: PinchDownArgs) => {
                if (this.hasContinued) {
                    return;
                }

                // Some GestureModule typings don't expose confidence on PinchDownArgs.
                // Treat pinch-down as "confident" and rely on useFilteredPinch when desired.
                this.continue();
            });
        };

        bindDown(GestureModule.HandType.Left);
        bindDown(GestureModule.HandType.Right);
    }

    private continue(): void {
        if (this.hasContinued) {
            return;
        }
        this.hasContinued = true;

        // Play exit animation (if enabled) before toggling the rest of the scene.
        if (this.exitDurationSeconds > 0.0 && this.startUiRoot) {
            this.isExiting = true;
            this.exitT = 0.0;
            this.exitStartPos = null;
            this.exitStartScale = null;
            return;
        }

        this.finishContinue();
    }

    private finishContinue(): void {
        if (this.isExiting) {
            this.isExiting = false;
        }

        // Disable start UI.
        if (this.startUiRoot) {
            this.startUiRoot.enabled = false;
        }

        // Disable any additional objects requested.
        for (let i = 0; i < this.disableOnContinue.length; i++) {
            const obj = this.disableOnContinue[i];
            if (obj) {
                obj.enabled = false;
            }
        }

        // Enable the next phase of the scene.
        for (let i = 0; i < this.enableOnContinue.length; i++) {
            const obj = this.enableOnContinue[i];
            if (obj) {
                obj.enabled = true;
            }
        }

        print("[StartUIController] Continued via pinch.");
    }
}
