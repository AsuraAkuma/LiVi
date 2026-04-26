import { MindMapRenderer } from "./MindMapRenderer";

@component
export class SummaryButton extends BaseScriptComponent {
    @input
    renderer?: MindMapRenderer;

    // Drop any SIK component that exposes `onButtonPinched` or `onTriggerStart`
    // (PinchButton or Interactable). We duck-type on those event fields so this
    // script does not hard-depend on SIK being present at type-check time.
    @input
    button: any = null;

    onAwake() {
        this.createEvent("OnStartEvent").bind(() => this.bindButton());
    }

    private bindButton() {
        if (!this.renderer) {
            print("[SummaryButton] renderer is not assigned.");
            return;
        }

        if (!this.button) {
            print("[SummaryButton] button is not assigned. Assign a SIK PinchButton or Interactable.");
            return;
        }

        if (this.button.onButtonPinched && typeof this.button.onButtonPinched.add === "function") {
            this.button.onButtonPinched.add(() => this.handlePress());
            return;
        }

        if (this.button.onTriggerStart && typeof this.button.onTriggerStart.add === "function") {
            this.button.onTriggerStart.add(() => this.handlePress());
            return;
        }

        print("[SummaryButton] button input does not expose onButtonPinched or onTriggerStart.");
    }

    private handlePress() {
        if (!this.renderer) {
            return;
        }
        this.renderer.toggle();
    }
}
