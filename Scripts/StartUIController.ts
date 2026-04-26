/**
 * LiVi 2026
 * StartUIController – Start screen gate + reading-mode HUD for the LiVi book-immersion lens.
 *
 * Lens Studio wiring (drag in Inspector):
 *   References
 *     startRoot                    → StartUI SceneObject (visible at launch)
 *     appRoot                      → AppRoot SceneObject (disabled at launch)
 *     titleText                    → StartUI/TitleText (Component.Text)
 *     bodyText                     → StartUI/BodyText  (Component.Text)
 *     statusText                   → StartUI/StatusText (Component.Text)  [optional]
 *
 *   Buttons (PinchButton ScriptComponents)
 *     startButton                  → StartUI/StartButton
 *     ttsToggleButton              → StartUI/TTSToggleButton
 *     memoryToggleButton           → StartUI/MemoryToggleButton
 *     relationshipToggleButton     → StartUI/RelationshipToggleButton
 *     soundscapeToggleButton       → StartUI/SoundscapeToggleButton
 *     resumeButton                 → StartUI/ResumeButton                   [optional]
 *     relationshipHamburgerButton  → AppRoot/HUD/HamburgerButton            [optional]
 *
 *   Optional script links (other LiVi systems, looked up by api):
 *     memoryScript                 → ScriptComponent with MemoryAnchors.ts
 *     bookScannerScript            → ScriptComponent with BookSeenScanner.ts
 *     soundscapeScript             → ScriptComponent that plays story SFX
 *
 *   Panels
 *     relationshipPanelRoot        → AppRoot/HUD/RelationshipPanel SceneObject
 *
 * Behavior:
 *   • Launch → StartUI visible, AppRoot disabled, toggles default per Settings.
 *   • Start Reading → hides StartUI, enables AppRoot, fans out the chosen options
 *     to memoryScript / bookScannerScript / soundscapeScript via duck-typed api calls.
 *   • Pinch the hamburger inside reading mode → toggle relationship map panel.
 *   • Resume button (if present + lastSession exists) → starts with prior memory anchors.
 */

import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators";
import { HandInputData } from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData";

class SimpleLogger {
  constructor(private readonly name: string, private readonly enabled: boolean) {}
  debug(msg: string): void {
    if (this.enabled) print("[" + this.name + "] " + msg);
  }
  info(msg: string): void {
    if (this.enabled) print("[" + this.name + "] " + msg);
  }
  warn(msg: string): void {
    print("[" + this.name + "] WARN: " + msg);
  }
  error(msg: string): void {
    print("[" + this.name + "] ERROR: " + msg);
  }
}

@component
export class StartUIController extends BaseScriptComponent {
  @ui.label(
    '<span style="color: #8AB4FF;">StartUIController</span> &nbsp;·&nbsp; LiVi start UI + reading HUD' +
      '<br/><span style="color: #94A3B8; font-size: 11px;">Pinch <b>Start Reading</b> to enter reading mode. ' +
      'Toggle TTS, Memory, Relationship Map, and Soundscape from the start panel. ' +
      'Inside reading mode the hamburger reopens the Start UI.</span>'
  )
  @ui.separator

  // ─── References ───────────────────────────────────────────
  @ui.label('<span style="color: #8AB4FF;">References</span>')
  @ui.group_start("References")

  @input
  @hint("StartUI root SceneObject – visible at launch")
  startRoot: SceneObject;

  @input
  @hint("AppRoot root SceneObject – starts disabled, enabled on Start Reading")
  appRoot: SceneObject;

  @input
  @hint("Title text on the Start UI (e.g. 'LiVi')")
  titleText: Text;

  @input
  @hint("Body / instructions text on the Start UI")
  bodyText: Text;

  @input
  @hint("Status line for last session / book detected (optional)")
  @allowUndefined
  statusText?: Text;

  @input
  @hint("Relationship map panel root (lives under AppRoot)")
  @allowUndefined
  relationshipPanelRoot?: SceneObject;

  @ui.group_end

  // ─── Buttons (PinchButton ScriptComponents) ───────────────
  @ui.separator
  @ui.label('<span style="color: #8AB4FF;">Buttons</span>')
  @ui.group_start("Buttons")

  @input("Component.ScriptComponent")
  @hint('PinchButton: "Start Reading" – primary action')
  @allowUndefined
  startButton?: ScriptComponent;

  @input("Component.ScriptComponent")
  @hint("PinchButton: Text-to-Speech on/off")
  @allowUndefined
  ttsToggleButton?: ScriptComponent;

  @input("Component.ScriptComponent")
  @hint("PinchButton: Memory Anchor on/off")
  @allowUndefined
  memoryToggleButton?: ScriptComponent;

  @input("Component.ScriptComponent")
  @hint("PinchButton: Relationship Map on/off")
  @allowUndefined
  relationshipToggleButton?: ScriptComponent;

  @input("Component.ScriptComponent")
  @hint("PinchButton: Story Soundscape on/off")
  @allowUndefined
  soundscapeToggleButton?: ScriptComponent;

  @input("Component.ScriptComponent")
  @hint("PinchButton: Resume last session (only enabled if lastSession exists)")
  @allowUndefined
  resumeButton?: ScriptComponent;

  @input("Component.ScriptComponent")
  @hint("PinchButton: Hamburger that reopens StartUI from inside AppRoot")
  @allowUndefined
  relationshipHamburgerButton?: ScriptComponent;

  @ui.group_end

  // ─── Optional integrations (other LiVi scripts) ───────────
  @ui.separator
  @ui.label('<span style="color: #8AB4FF;">Optional integrations</span>')
  @ui.group_start("Integrations")

  @input("Component.ScriptComponent")
  @hint("MemoryAnchors.ts – will receive setEnabled(bool) and resume() if present")
  @allowUndefined
  memoryScript?: ScriptComponent;

  @input("Component.ScriptComponent")
  @hint("BookSeenScanner.ts – will receive setEnabled(bool) if present")
  @allowUndefined
  bookScannerScript?: ScriptComponent;

  @input("Component.ScriptComponent")
  @hint("Soundscape script – will receive setEnabled(bool) and setTtsEnabled(bool) if present")
  @allowUndefined
  soundscapeScript?: ScriptComponent;

  @ui.group_end

  // ─── Settings ─────────────────────────────────────────────
  @ui.separator
  @ui.label('<span style="color: #8AB4FF;">Settings</span>')
  @ui.group_start("Settings")

  @input
  @hint("Default: Text-to-Speech enabled at launch")
  defaultTtsEnabled: boolean = false;

  @input
  @hint("Default: Memory Anchor enabled at launch")
  defaultMemoryEnabled: boolean = true;

  @input
  @hint("Default: Relationship Map enabled at launch")
  defaultRelationshipEnabled: boolean = true;

  @input
  @hint("Default: Story Soundscape enabled at launch")
  defaultSoundscapeEnabled: boolean = true;

  @input
  @hint("Show the Relationship Map panel as soon as Start Reading is pressed")
  showRelationshipPanelOnStart: boolean = false;

  @input
  @hint("Ignore pinches for this many seconds after launch (avoids accidental auto-start)")
  startArmingDelaySec: number = 1.25;

  @input
  @hint("If no Start button is wired, allow a pinch-anywhere fallback to start")
  allowPinchAnywhereFallback: boolean = false;

  @ui.group_end

  // ─── Logging ──────────────────────────────────────────────
  @ui.separator
  @ui.label('<span style="color: #8AB4FF;">Logging</span>')
  @input
  @hint("Enable general logging")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle event logging")
  enableLoggingLifecycle: boolean = false;

  // ─── Public state (read by other scripts) ────────────────
  public ttsEnabled: boolean = false;
  public memoryEnabled: boolean = true;
  public relationshipEnabled: boolean = true;
  public soundscapeEnabled: boolean = true;
  public hasStarted: boolean = false;
  public resumeRequested: boolean = false;

  // ─── Private ──────────────────────────────────────────────
  private logger: SimpleLogger;
  private handProvider: HandInputData;
  private relationshipPanelVisible: boolean = false;
  private lastFallbackPinchTimeSec: number = -999;
  private acceptStartInputAfterTimeSec: number = 0;

  // ────────────────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────────────────
  onAwake(): void {
    this.logger = new SimpleLogger(
      "StartUIController",
      this.enableLogging || this.enableLoggingLifecycle
    );
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onAwake()");
    this.handProvider = HandInputData.getInstance();
  }

  @bindStartEvent
  private onStart(): void {
    print("[StartUIController] onStart()");
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onStart()");

    if (!this.startRoot || !this.appRoot) {
      this.logger.error("startRoot and appRoot must be assigned in the Inspector!");
      return;
    }
    if (!this.titleText || !this.bodyText) {
      this.logger.error("titleText and bodyText must be assigned in the Inspector!");
      return;
    }

    // Initial gate state.
    this.startRoot.enabled = true;
    this.appRoot.enabled = false;

    // Apply defaults.
    this.ttsEnabled = this.defaultTtsEnabled;
    this.memoryEnabled = this.defaultMemoryEnabled;
    this.relationshipEnabled = this.defaultRelationshipEnabled;
    this.soundscapeEnabled = this.defaultSoundscapeEnabled;
    this.relationshipPanelVisible = false;

    this.refreshStartUiCopy();
    this.setRelationshipPanelVisible(false);

    // Arm input.
    this.acceptStartInputAfterTimeSec = getTime() + Math.max(0, this.startArmingDelaySec);

    // Bind buttons (with retry – SIK ScriptComponent.api can wake up late).
    this.bindButtonsWithRetry();
  }

  @bindUpdateEvent
  private onUpdate(): void {
    // Reserved for future hover/visual state polling; intentionally light.
  }

  // ────────────────────────────────────────────────────────
  // Public API – callable from other scripts
  // ────────────────────────────────────────────────────────
  public startReading(resume: boolean = false): void {
    if (getTime() < this.acceptStartInputAfterTimeSec) return;
    if (this.hasStarted) return;

    this.hasStarted = true;
    this.resumeRequested = resume;
    this.startRoot.enabled = false;
    this.appRoot.enabled = true;

    // Fan out chosen options to integration scripts (duck-typed; safe if missing).
    this.applyOptionsToIntegrations();

    if (this.showRelationshipPanelOnStart && this.relationshipEnabled) {
      this.setRelationshipPanelVisible(true);
    }

    this.logger.info(
      "Started reading. tts=" +
        this.ttsEnabled +
        " memory=" +
        this.memoryEnabled +
        " relationship=" +
        this.relationshipEnabled +
        " soundscape=" +
        this.soundscapeEnabled +
        " resume=" +
        this.resumeRequested
    );
  }

  public stopReadingShowStartUi(): void {
    this.hasStarted = false;
    this.appRoot.enabled = false;
    this.startRoot.enabled = true;
    this.setRelationshipPanelVisible(false);
    this.refreshStartUiCopy();
    this.acceptStartInputAfterTimeSec = getTime() + Math.max(0, this.startArmingDelaySec);
  }

  // ────────────────────────────────────────────────────────
  // Toggles
  // ────────────────────────────────────────────────────────
  private toggleTts(): void {
    this.ttsEnabled = !this.ttsEnabled;
    this.refreshStartUiCopy();
  }

  private toggleMemory(): void {
    this.memoryEnabled = !this.memoryEnabled;
    this.refreshStartUiCopy();
  }

  private toggleRelationship(): void {
    this.relationshipEnabled = !this.relationshipEnabled;
    this.refreshStartUiCopy();
  }

  private toggleSoundscape(): void {
    this.soundscapeEnabled = !this.soundscapeEnabled;
    this.refreshStartUiCopy();
  }

  private toggleRelationshipPanel(): void {
    if (!this.hasStarted) return;
    if (!this.relationshipEnabled) return;
    this.setRelationshipPanelVisible(!this.relationshipPanelVisible);
  }

  // ────────────────────────────────────────────────────────
  // Integration fan-out (duck-typed, never throws)
  // ────────────────────────────────────────────────────────
  private applyOptionsToIntegrations(): void {
    this.callApi(this.memoryScript, "setEnabled", [this.memoryEnabled]);
    if (this.resumeRequested) {
      this.callApi(this.memoryScript, "resume", []);
    }
    this.callApi(this.bookScannerScript, "setEnabled", [true]);
    this.callApi(this.soundscapeScript, "setEnabled", [this.soundscapeEnabled]);
    this.callApi(this.soundscapeScript, "setTtsEnabled", [this.ttsEnabled]);
  }

  private callApi(script: ScriptComponent | undefined, fn: string, args: any[]): void {
    if (!script) return;
    const api: any = (script as any).api ?? script;
    const target = api?.[fn];
    if (typeof target === "function") {
      try {
        target.apply(api, args);
      } catch (e) {
        this.logger.warn("api." + fn + " threw: " + e);
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // Button binding – PinchButton.api.onButtonPinched
  // ────────────────────────────────────────────────────────
  private tryBindPinchButton(buttonLike: any, handler: () => void): boolean {
    if (!buttonLike) return false;
    const api: any = buttonLike.api ?? buttonLike;
    const event = api?.onButtonPinched;
    if (event && typeof event.add === "function") {
      event.add(handler);
      return true;
    }
    return false;
  }

  private bindButtonsWithRetry(): void {
    let attempts = 0;
    const maxAttempts = 20;

    const tryOnce = () => {
      attempts++;

      const startBound = this.tryBindPinchButton(this.startButton, () => this.startReading(false));
      const resumeBound = this.resumeButton
        ? this.tryBindPinchButton(this.resumeButton, () => this.startReading(true))
        : true;
      const ttsBound = this.ttsToggleButton
        ? this.tryBindPinchButton(this.ttsToggleButton, () => this.toggleTts())
        : true;
      const memoryBound = this.memoryToggleButton
        ? this.tryBindPinchButton(this.memoryToggleButton, () => this.toggleMemory())
        : true;
      const relBound = this.relationshipToggleButton
        ? this.tryBindPinchButton(this.relationshipToggleButton, () => this.toggleRelationship())
        : true;
      const sndBound = this.soundscapeToggleButton
        ? this.tryBindPinchButton(this.soundscapeToggleButton, () => this.toggleSoundscape())
        : true;
      const burgerBound = this.relationshipHamburgerButton
        ? this.tryBindPinchButton(this.relationshipHamburgerButton, () =>
            this.toggleRelationshipPanel()
          )
        : true;

      const allBound =
        startBound &&
        resumeBound &&
        ttsBound &&
        memoryBound &&
        relBound &&
        sndBound &&
        burgerBound;

      if (allBound) {
        if (this.enableLogging) print("[StartUIController] All pinch buttons bound.");
        return;
      }

      if (attempts >= maxAttempts) {
        print(
          "[StartUIController] WARNING: Failed to bind one or more PinchButtons. " +
            "Check Inspector wiring and that the SIK prefab is in the scene."
        );
        if (!startBound && this.allowPinchAnywhereFallback) {
          print("[StartUIController] Using pinch-anywhere fallback to start.");
          this.bindFallbackPinchToStart();
        }
        return;
      }

      const e = this.createEvent("DelayedCallbackEvent");
      e.bind(() => {
        this.removeEvent(e);
        tryOnce();
      });
      e.reset(0.05);
    };

    tryOnce();
  }

  private bindFallbackPinchToStart(): void {
    const left = this.handProvider.getHand("left");
    const right = this.handProvider.getHand("right");

    const handler = () => {
      const now = getTime();
      if (now - this.lastFallbackPinchTimeSec < 0.35) return;
      this.lastFallbackPinchTimeSec = now;
      if (now < this.acceptStartInputAfterTimeSec) return;
      if (!this.hasStarted) {
        this.startReading(false);
      } else if (!this.relationshipHamburgerButton) {
        this.toggleRelationshipPanel();
      }
    };

    left.onPinchDown.add(handler);
    right.onPinchDown.add(handler);
  }

  // ────────────────────────────────────────────────────────
  // UI copy
  // ────────────────────────────────────────────────────────
  private setRelationshipPanelVisible(visible: boolean): void {
    this.relationshipPanelVisible = visible;
    if (this.relationshipPanelRoot) this.relationshipPanelRoot.enabled = visible;
  }

  private refreshStartUiCopy(): void {
    this.titleText.text = "LiVi";

    const onOff = (b: boolean) => (b ? "ON" : "OFF");
    const lines: string[] = [
      "Pinch Start Reading to begin.",
      "",
      "Text-to-Speech ............ " + onOff(this.ttsEnabled),
      "Memory Anchor ............ " + onOff(this.memoryEnabled),
      "Relationship Map ......... " + onOff(this.relationshipEnabled),
      "Story Soundscape ......... " + onOff(this.soundscapeEnabled),
      "",
      "Look at a book and hover under the line to be guided.",
    ];
    this.bodyText.text = lines.join("\n");

    if (this.statusText) {
      this.statusText.text = "Ready · v0.1";
    }
  }
}
