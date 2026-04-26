import { TtsSpeaker } from "./TtsSpeaker";

@component
export class MindMapNode extends BaseScriptComponent {
    @input
    titleText?: Text;
    @input
    cameraObject?: SceneObject;

    private description: string = "";
    private speaker: TtsSpeaker | null = null;
    private cameraTransform: Transform | null = null;
    private selfTransform: Transform | null = null;

    onAwake() {
        this.selfTransform = this.getSceneObject().getTransform();

        if (this.cameraObject) {
            this.cameraTransform = this.cameraObject.getTransform();
        }

        this.createEvent("UpdateEvent").bind(() => this.onUpdate());
        this.bindPinch();
    }

    public setup(title: string, description: string, speaker: TtsSpeaker | null, camera: SceneObject | null) {
        this.description = description || "";

        if (this.titleText) {
            this.titleText.text = title || "";
        }

        if (speaker) {
            this.speaker = speaker;
        }

        if (camera) {
            this.cameraObject = camera;
            this.cameraTransform = camera.getTransform();
        }
    }

    private onUpdate() {
        if (!this.selfTransform || !this.cameraTransform) {
            return;
        }

        const selfPos = this.selfTransform.getWorldPosition();
        const camPos = this.cameraTransform.getWorldPosition();

        // Direction from card to camera. Flip sign below so the card front points at the user.
        const toCamera = camPos.sub(selfPos).normalize();
        const facing = toCamera.uniformScale(-1);

        const rotation = quat.lookAt(facing, vec3.up());
        this.selfTransform.setWorldRotation(rotation);
    }

    private bindPinch() {
        // We look up an SIK Interactable by string name so this file does not need
        // a hard import on SIK. If SIK is not installed, pinch just does nothing
        // and the rest of the mind map still renders.
        const so = this.getSceneObject();
        const interactable: any = so.getComponent("Component.ScriptComponent");

        // Walk all script components on this SceneObject and find one with SIK trigger events.
        const anyObj: any = so as any;
        const allScripts = typeof anyObj.getComponents === "function"
            ? anyObj.getComponents("Component.ScriptComponent")
            : [interactable];

        for (const candidate of allScripts) {
            if (candidate && candidate.onTriggerStart && typeof candidate.onTriggerStart.add === "function") {
                candidate.onTriggerStart.add(() => this.onPinchStart());
                return;
            }
        }
    }

    private onPinchStart() {
        if (!this.description) {
            return;
        }
        if (!this.speaker) {
            print("[MindMapNode] Pinched '" + this.description.slice(0, 40) + "...' but no TtsSpeaker is wired.");
            return;
        }
        this.speaker.speak(this.description);
    }
}
