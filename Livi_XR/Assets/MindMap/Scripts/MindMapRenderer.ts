import { MindMapData, MindMapNodeData, parseMindMap } from "./MindMapTypes";
import { MindMapNode } from "./MindMapNode";
import { TtsSpeaker } from "./TtsSpeaker";

@component
export class MindMapRenderer extends BaseScriptComponent {
    @input
    cardPrefab?: ObjectPrefab;
    @input
    linkPrefab?: ObjectPrefab;

    @input
    cameraObject?: SceneObject;

    @input
    speaker?: TtsSpeaker;

    @input
    jsonAsset: any = null; // Drop mindmap.json here in the Inspector.
    @input
    jsonFallback: string = "";

    @input
    distanceFromCamera: number = 120.0;
    @input
    radius: number = 45.0;
    @input
    cardScale: number = 1.0;
    @input
    linkThickness: number = 0.6;

    private rootContainer: SceneObject | null = null;
    private isVisible: boolean = false;

    onAwake() {
        // Renderer starts hidden. A SummaryButton (or any caller) invokes show() later.
    }

    public toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    public isShown(): boolean {
        return this.isVisible;
    }

    public show() {
        if (this.isVisible) {
            return;
        }

        if (!this.cardPrefab) {
            print("[MindMapRenderer] cardPrefab is not assigned.");
            return;
        }

        const data = this.loadData();
        if (!data) {
            return;
        }

        const anchor = this.computeAnchor();
        this.rootContainer = global.scene.createSceneObject("MindMapContainer");
        this.rootContainer.getTransform().setWorldPosition(anchor);

        const rootPos = anchor;
        const rootObject = this.spawnCard(data.root, rootPos);

        const childCount = data.children.length;
        for (let i = 0; i < childCount; i++) {
            const angle = (i / Math.max(1, childCount)) * Math.PI * 2;
            const offset = new vec3(
                Math.cos(angle) * this.radius,
                Math.sin(angle) * this.radius,
                0
            );
            const childPos = rootPos.add(offset);
            this.spawnCard(data.children[i], childPos);

            if (this.linkPrefab) {
                this.spawnLink(rootPos, childPos);
            }
        }

        if (rootObject) {
            // Slightly scale up the root card so the center reads as the topic.
            const tr = rootObject.getTransform();
            const s = tr.getLocalScale();
            tr.setLocalScale(s.uniformScale(1.2));
        }

        this.isVisible = true;
    }

    public hide() {
        if (this.rootContainer) {
            this.rootContainer.destroy();
            this.rootContainer = null;
        }
        this.isVisible = false;
    }

    private loadData(): MindMapData | null {
        let rawText: string = "";

        if (this.jsonAsset && typeof this.jsonAsset.text === "string") {
            rawText = this.jsonAsset.text;
        } else if (this.jsonFallback && this.jsonFallback.trim().length > 0) {
            rawText = this.jsonFallback;
        } else {
            print("[MindMapRenderer] No mind map JSON provided (jsonAsset or jsonFallback).");
            return null;
        }

        try {
            return parseMindMap(rawText);
        } catch (error) {
            print("[MindMapRenderer] Failed to parse mind map JSON: " + error);
            return null;
        }
    }

    private computeAnchor(): vec3 {
        if (!this.cameraObject) {
            print("[MindMapRenderer] cameraObject is not assigned. Placing mind map at world origin.");
            return new vec3(0, 0, 0);
        }

        const camTransform = this.cameraObject.getTransform();
        const camPos = camTransform.getWorldPosition();
        const camRot = camTransform.getWorldRotation();

        // Camera looks down its local -Z in Lens Studio's convention.
        const localForward = new vec3(0, 0, -1);
        const forward = camRot.multiplyVec3(localForward).normalize();

        return camPos.add(forward.uniformScale(this.distanceFromCamera));
    }

    private spawnCard(node: MindMapNodeData, worldPos: vec3): SceneObject | null {
        if (!this.cardPrefab || !this.rootContainer) {
            return null;
        }

        const obj = this.cardPrefab.instantiate(this.rootContainer);
        obj.name = "MindMapCard_" + node.id;

        const transform = obj.getTransform();
        transform.setWorldPosition(worldPos);
        transform.setLocalScale(new vec3(this.cardScale, this.cardScale, this.cardScale));

        const nodeScript = this.findMindMapNode(obj);
        if (nodeScript) {
            nodeScript.setup(node.title, node.description, this.speaker ?? null, this.cameraObject ?? null);
        } else {
            // Fall back to setting any Text component found inside the prefab.
            this.applyTitleFallback(obj, node.title);
        }

        return obj;
    }

    private spawnLink(fromPos: vec3, toPos: vec3) {
        if (!this.linkPrefab || !this.rootContainer) {
            return;
        }

        const link = this.linkPrefab.instantiate(this.rootContainer);
        link.name = "MindMapLink";

        const delta = toPos.sub(fromPos);
        const length = delta.length;
        if (length <= 0) {
            return;
        }

        const midpoint = fromPos.add(delta.uniformScale(0.5));
        const direction = delta.uniformScale(1 / length);

        // Assumes linkPrefab is a unit-length mesh oriented along +Y (typical for a
        // Cylinder primitive in Lens Studio). We rotate from vec3.up() to the link
        // direction and scale Y to the distance between the two points.
        const rotation = quat.lookAt(direction, vec3.up()).multiply(
            quat.angleAxis(Math.PI * 0.5, new vec3(1, 0, 0))
        );

        const transform = link.getTransform();
        transform.setWorldPosition(midpoint);
        transform.setWorldRotation(rotation);
        transform.setLocalScale(new vec3(this.linkThickness, length, this.linkThickness));
    }

    private findMindMapNode(obj: SceneObject): MindMapNode | null {
        const anyObj: any = obj as any;
        if (typeof anyObj.getComponents !== "function") {
            return null;
        }

        const scripts = anyObj.getComponents("Component.ScriptComponent");
        for (const script of scripts) {
            if (script instanceof MindMapNode) {
                return script as MindMapNode;
            }
        }
        return null;
    }

    private applyTitleFallback(obj: SceneObject, title: string) {
        this.visitChildren(obj, (child) => {
            const text = child.getComponent("Component.Text") as Text | null;
            if (text) {
                text.text = title;
            }
        });
    }

    private visitChildren(obj: SceneObject, visitor: (child: SceneObject) => void) {
        visitor(obj);
        const count = obj.getChildrenCount();
        for (let i = 0; i < count; i++) {
            this.visitChildren(obj.getChild(i), visitor);
        }
    }
}
