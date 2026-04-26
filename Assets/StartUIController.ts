/**
 * StartUIController – Minimal modern start screen flow (pinch to continue)
 *
 * Connections:
 * - startUiRoot: Root SceneObject that contains your Start UI visuals (ScreenTransform/Text/etc.)
 * - titleText/subtitleText/promptText: Optional Text components to populate at runtime
 * - enableOnContinue/disableOnContinue: SceneObjects to toggle when the user continues
 */
import {HandInputData} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData";
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

    // ─── Leave Animation ────────────────────────────────────────────
    @input
    @hint("Seconds for the Start UI to fade/scale out after pinch.")
    leaveDurationSeconds: number = 0.8;

    @input
    @hint("Scale multiplier applied by the end of the leave animation (e.g. 0.96 = slight shrink).")
    leaveEndScale: number = 0.98;

    @input
    @hint("If true, fades all Text components under startUiRoot during the leave animation.")
    fadeTextsOnLeave: boolean = true;

    // ─── Editor Fallback ────────────────────────────────────────────
    @input
    @hint("In Lens Studio editor preview, allow a screen tap/click to continue (since pinch may not be available).")
    enableEditorTapToContinue: boolean = true;

    @input
    @hint("Ignore continue inputs for this many seconds after start (prevents accidental dismiss on preview focus).")
    ignoreInputsForSeconds: number = 0.6;

    private gestureModule: GestureModule = require("LensStudio:GestureModule");
    private hasContinued: boolean = false;
    private isLeaving: boolean = false;
    private leaveT: number = 0;
    private isUsingSikPinch: boolean = false;
    private timeSinceStart: number = 0;

    private cachedTexts: Text[] = [];
    private cachedTextRgb: vec3[] = [];
    private cachedTextAlpha: number[] = [];
    private startUiBaseScale: vec3 | null = null;

    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => this.onStart());
    }

    private onStart(): void {
        this.applyCopy();
        this.showStartUi();
        this.cacheStartUiVisuals();
        this.setInitialEnabledState();
        this.bindContinueGesture();
        this.createEvent("UpdateEvent").bind(() => this.onUpdate());

        const isEditor = global.deviceInfoSystem && global.deviceInfoSystem.isEditor && global.deviceInfoSystem.isEditor();
        if (isEditor && this.enableEditorTapToContinue) {
            this.createEvent("TouchStartEvent").bind(() => {
                if (this.hasContinued || this.isLeaving) {
                    return;
                }
                if (!this.canAcceptContinueInput()) {
                    return;
                }
                print("[StartUIController] Editor tap/click detected (fallback).");
                this.continue("editor_tap");
            });
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

    private cacheStartUiVisuals(): void {
        this.cachedTexts = [];
        this.cachedTextRgb = [];
        this.cachedTextAlpha = [];
        this.startUiBaseScale = null;

        if (!this.startUiRoot) {
            return;
        }

        this.startUiBaseScale = this.startUiRoot.getTransform().getLocalScale();

        if (!this.fadeTextsOnLeave) {
            return;
        }

        this.collectTextsRecursive(this.startUiRoot);
        for (let i = 0; i < this.cachedTexts.length; i++) {
            const t = this.cachedTexts[i];
            const c = t.textFill.color;
            this.cachedTextRgb.push(new vec3(c.x, c.y, c.z));
            this.cachedTextAlpha.push(c.w);
        }
    }

    private collectTextsRecursive(root: SceneObject): void {
        const texts = root.getComponents("Component.Text") as Text[];
        for (let i = 0; i < texts.length; i++) {
            this.cachedTexts.push(texts[i]);
        }

        const childCount = root.getChildrenCount();
        for (let i = 0; i < childCount; i++) {
            this.collectTextsRecursive(root.getChild(i));
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
        // Prefer SIK pinch events (more consistent across Spectacles builds).
        try {
            const handProvider = HandInputData.getInstance();
            const rightHand = handProvider.getHand("right");
            const leftHand = handProvider.getHand("left");

            rightHand.onPinchDown.add(() => {
                if (this.hasContinued || this.isLeaving) {
                    return;
                }
                if (!this.canAcceptContinueInput()) {
                    return;
                }
                this.isUsingSikPinch = true;
                print("[StartUIController] SIK right pinch down.");
                this.continue("sik_right_pinch");
            });

            leftHand.onPinchDown.add(() => {
                if (this.hasContinued || this.isLeaving) {
                    return;
                }
                if (!this.canAcceptContinueInput()) {
                    return;
                }
                this.isUsingSikPinch = true;
                print("[StartUIController] SIK left pinch down.");
                this.continue("sik_left_pinch");
            });

            // If SIK is bound successfully, keep GestureModule as a backup but it shouldn't be necessary.
        } catch (e) {
            print("[StartUIController] SIK pinch bind failed, falling back to GestureModule. " + e);
        }

        const bindDown = (hand: any) => {
            const downEvent = this.useFilteredPinch
                ? this.gestureModule.getFilteredPinchDownEvent(hand)
                : this.gestureModule.getPinchDownEvent(hand);

            downEvent.add((args: PinchDownArgs) => {
                if (this.hasContinued || this.isLeaving) {
                    return;
                }
                if (!this.canAcceptContinueInput()) {
                    return;
                }

                // Some Lens Studio typings omit PinchDownArgs.confidence.
                // Use it when available at runtime, otherwise treat as fully confident.
                const anyArgs = args as any;
                const confidence = typeof anyArgs?.confidence === "number" ? anyArgs.confidence : 1.0;
                if (confidence < this.minConfidence) {
                    return;
                }

                print("[StartUIController] Pinch down detected.");
                this.continue("gesture_pinch");
            });
        };

        bindDown(GestureModule.HandType.Left);
        bindDown(GestureModule.HandType.Right);
    }

    private continue(source: string): void {
        if (this.hasContinued) {
            return;
        }
        this.hasContinued = true;

        // Start leaving animation (then we toggle objects when animation completes).
        this.isLeaving = true;
        this.leaveT = 0;

        print("[StartUIController] Continue triggered by: " + source);
    }

    private onUpdate(): void {
        this.timeSinceStart += getDeltaTime();
        if (!this.isLeaving) {
            return;
        }
        if (!this.startUiRoot) {
            this.finishContinue();
            return;
        }

        const dt = getDeltaTime();
        this.leaveT += dt;

        const duration = Math.max(this.leaveDurationSeconds, 0.001);
        const raw = Math.min(this.leaveT / duration, 1.0);
        const t = 1.0 - Math.pow(1.0 - raw, 3.0); // easeOutCubic

        // Scale down slightly (feels like "letting go" / dismiss).
        if (this.startUiBaseScale) {
            const endScale = Math.max(this.leaveEndScale, 0.01);
            const s = 1.0 + (endScale - 1.0) * t;
            const base = this.startUiBaseScale;
            this.startUiRoot.getTransform().setLocalScale(new vec3(base.x * s, base.y * s, base.z * s));
        }

        // Fade texts under StartUI.
        if (this.fadeTextsOnLeave) {
            const alphaMul = 1.0 - t;
            for (let i = 0; i < this.cachedTexts.length; i++) {
                const txt = this.cachedTexts[i];
                const rgb = this.cachedTextRgb[i];
                const a0 = this.cachedTextAlpha[i];
                txt.textFill.color = new vec4(rgb.x, rgb.y, rgb.z, a0 * alphaMul);
            }
        }

        if (raw >= 1.0) {
            this.finishContinue();
        }
    }

    private canAcceptContinueInput(): boolean {
        return this.timeSinceStart >= Math.max(this.ignoreInputsForSeconds, 0.0);
    }

    private finishContinue(): void {
        if (!this.isLeaving) {
            return;
        }
        this.isLeaving = false;

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

        print("[StartUIController] Continued.");
    }
}

