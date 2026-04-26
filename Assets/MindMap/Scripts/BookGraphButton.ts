import { BookRelationshipGraphRenderer } from "./BookRelationshipGraphRenderer";

@component
export class BookGraphButton extends BaseScriptComponent {
    @input
    @allowUndefined
    renderer?: BookRelationshipGraphRenderer;

    @input
    button: any = null;

    onAwake() {
        this.createEvent("OnStartEvent").bind(() => this.bindButton());
    }

    private bindButton() {
        if (!this.renderer) {
            print("[BookGraphButton] renderer is not assigned.");
            return;
        }

        if (!this.button) {
            print("[BookGraphButton] button is not assigned. Assign a SIK PinchButton or Interactable.");
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

        print("[BookGraphButton] button input does not expose onButtonPinched or onTriggerStart.");
    }

    private handlePress() {
        if (!this.renderer) {
            return;
        }

        this.renderer.toggle();
    }
}
