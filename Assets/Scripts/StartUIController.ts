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

    // ─── Gesture Settings ──────────────────────────────────────────
    @input
    @hint("Use filtered pinch events (more stable during hand motion).")
    useFilteredPinch: boolean = true;

    @input
    @hint("Minimum pinch confidence required to continue (0 to 1).")
    minConfidence: number = 0.6;

    private gestureModule: GestureModule = require("LensStudio:GestureModule");
    private hasContinued: boolean = false;

    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => this.onStart());
    }

    private onStart(): void {
        this.applyCopy();
        this.showStartUi();
        this.setInitialEnabledState();
        this.bindContinueGesture();
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

