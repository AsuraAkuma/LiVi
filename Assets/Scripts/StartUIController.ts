import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators";

@component
export class StartUIController extends BaseScriptComponent {

    // ── Scene Roots ───────────────────────────────────────────
    @ui.label("Scene Roots")
    @ui.group_start("Roots")

    @input
    @hint("StartUI SceneObject — visible at launch")
    startRoot: SceneObject;

    @input
    @hint("AppRoot SceneObject — hidden at launch, shown after START")
    appRoot: SceneObject;

    @ui.group_end

    // ── Text Components ───────────────────────────────────────
    @ui.separator
    @ui.label("Text Components")
    @ui.group_start("Text")

    @input
    @hint("Large LIVI title text")
    titleText: Text;

    @input
    @hint("Chinese poetry line below title")
    poetryText: Text;

    @input
    @hint("Top-left panel: lens version label")
    versionText: Text;

    @input
    @hint("Top-left panel: live clock (updates every frame)")
    clockText: Text;

    @input
    @hint("Bottom-right panel: active mode label")
    activeModeText: Text;

    @input
    @hint("Bottom center: developer credit")
    creditText: Text;

    @input
    @hint("Label inside the START button")
    @allowUndefined
    startLabel?: Text;

    @input
    @hint("Label inside the SETTINGS button")
    @allowUndefined
    settingsLabel?: Text;

    @ui.group_end

    // ── Pinch Buttons ─────────────────────────────────────────
    @ui.separator
    @ui.label("Pinch Buttons")
    @ui.group_start("Buttons")

    @input("Component.ScriptComponent")
    @hint("PinchButton component on the START button object")
    @allowUndefined
    startButton?: ScriptComponent;

    @input("Component.ScriptComponent")
    @hint("PinchButton component on the SETTINGS button object")
    @allowUndefined
    settingsButton?: ScriptComponent;

    @ui.group_end

    // ── Optional Panels ───────────────────────────────────────
    @ui.separator
    @ui.label("Optional Panels")
    @ui.group_start("Panels")

    @input
    @hint("Settings panel — hidden until SETTINGS is pinched")
    @allowUndefined
    settingsPanel?: SceneObject;

    @ui.group_end

    // ── Content ───────────────────────────────────────────────
    @ui.separator
    @ui.label("Content")
    @ui.group_start("Content")

    @input
    @hint("Classical Chinese poetry fragment shown under LIVI")
    poetry: string = "書山有路勤為徑，學海無涯苦作舟";

    @input
    @hint("Name shown in the developer credit line")
    developerName: string = "Pacino Song Lin";

    @input
    @hint("Version string displayed in the top-left panel")
    lensVersion: string = "LENS 5.15.4";

    @ui.group_end

    // ── Debug ─────────────────────────────────────────────────
    @ui.separator
    @input
    @hint("Enable debug logs in the console")
    enableLogging: boolean = false;

    // ── Private state ─────────────────────────────────────────
    private settingsOpen: boolean = false;
    private hasStarted: boolean = false;

    onAwake(): void {}

    @bindStartEvent
    private onStart(): void {
        this.log("onStart");

        if (!this.startRoot || !this.appRoot) {
            print("[LiVi] ERROR: Assign startRoot and appRoot in the Inspector.");
            return;
        }

        this.startRoot.enabled = true;
        this.appRoot.enabled = false;
        this.settingsOpen = false;

        if (this.settingsPanel) this.settingsPanel.enabled = false;

        this.refreshCopy();
        this.bindButtonsWithRetry(0);
    }

    @bindUpdateEvent
    private onUpdate(): void {
        if (this.clockText) {
            this.clockText.text = this.liveTime();
        }
    }

    // ── Public API ────────────────────────────────────────────

    public startReading(): void {
        if (this.hasStarted) return;
        this.hasStarted = true;
        this.log("startReading");
        this.startRoot.enabled = false;
        this.appRoot.enabled = true;
    }

    public returnToStart(): void {
        this.hasStarted = false;
        this.appRoot.enabled = false;
        this.startRoot.enabled = true;
        this.settingsOpen = false;
        if (this.settingsPanel) this.settingsPanel.enabled = false;
        this.log("returnToStart");
    }

    // ── Private ───────────────────────────────────────────────

    private refreshCopy(): void {
        if (this.titleText)      this.titleText.text      = "LIVI";
        if (this.poetryText)     this.poetryText.text      = this.poetry;
        if (this.versionText)    this.versionText.text     = this.lensVersion;
        if (this.activeModeText) this.activeModeText.text  = "ACTIVE MODE: READING AUGMENTATION";
        if (this.creditText)     this.creditText.text      = "Developed for " + this.developerName;
        if (this.startLabel)     this.startLabel.text      = "START";
        if (this.settingsLabel)  this.settingsLabel.text   = "SETTINGS";
    }

    private liveTime(): string {
        const d  = new Date();
        const hh = d.getHours().toString().padStart(2, "0");
        const mm = d.getMinutes().toString().padStart(2, "0");
        return hh + ":" + mm;
    }

    private bindButtonsWithRetry(attempt: number): void {
        const startOk    = this.tryBind(this.startButton,    () => this.startReading());
        const settingsOk = this.tryBind(this.settingsButton, () => this.toggleSettings());

        if ((!startOk || !settingsOk) && attempt < 20) {
            const e = this.createEvent("DelayedCallbackEvent");
            e.bind(() => { this.removeEvent(e); this.bindButtonsWithRetry(attempt + 1); });
            e.reset(0.05);
        } else if (!startOk && attempt >= 20) {
            print("[LiVi] Warning: START button not bound. Check SIK prefab is in the scene.");
        }
    }

    private tryBind(btn: ScriptComponent | undefined, fn: () => void): boolean {
        if (!btn) return true;
        const api: any = (btn as any).api ?? btn;
        if (api?.onButtonPinched && typeof api.onButtonPinched.add === "function") {
            api.onButtonPinched.add(fn);
            return true;
        }
        return false;
    }

    private toggleSettings(): void {
        this.settingsOpen = !this.settingsOpen;
        if (this.settingsPanel) this.settingsPanel.enabled = this.settingsOpen;
        this.log("settings panel: " + (this.settingsOpen ? "open" : "closed"));
    }

    private log(msg: string): void {
        if (this.enableLogging) print("[LiVi] " + msg);
    }
}
