import { MindMapNode } from "./MindMapNode";
import { CharacterEdge, CharacterRelationship, ParsedBookGraph, parseBookGraphPayload } from "./BookGraphTypes";

@component
export class BookRelationshipGraphRenderer extends BaseScriptComponent {
    @input
    cardPrefab?: ObjectPrefab;
    @input
    linkPrefab?: ObjectPrefab;

    @input
    cameraObject?: SceneObject;
    @input
    internet_module?: InternetModule;

    @input
    backend_base_url: string = "https://localhost:3001";
    @input
    allow_insecure_http_for_debug: boolean = false;

    @input
    book_id: string = "";
    @input
    chapter_index: number = 0;
    @input
    auto_load_on_start: boolean = false;

    @input
    distanceFromCamera: number = 120.0;
    @input
    layerRadiusStep: number = 30.0;
    @input
    nodeSpacing: number = 14.0;
    @input
    cardScale: number = 1.0;
    @input
    linkThickness: number = 0.6;
    @input
    maxNodes: number = 48;

    private rootContainer: SceneObject | null = null;
    private fallbackObjects: SceneObject[] = [];
    private isVisible: boolean = false;
    private isLoading: boolean = false;

    onAwake() {
        if (!this.auto_load_on_start) {
            return;
        }

        this.createEvent("OnStartEvent").bind(() => {
            void this.loadAndShow();
        });
    }

    public toggle() {
        if (this.isVisible) {
            this.hide();
            return;
        }

        void this.loadAndShow();
    }

    public hide() {
        for (const fallbackObject of this.fallbackObjects) {
            fallbackObject.destroy();
        }
        this.fallbackObjects = [];

        if (this.rootContainer) {
            this.rootContainer.destroy();
            this.rootContainer = null;
        }
        this.isVisible = false;
    }

    public async loadAndShow(): Promise<void> {
        if (this.isLoading) {
            return;
        }

        const requestedBookId = (this.book_id || "").trim();

        this.isLoading = true;

        try {
            if (!requestedBookId) {
                print("[BookRelationshipGraphRenderer] book_id is empty. Rendering fallback graph.");
                this.renderPayload(this.buildFallbackPayload());
                return;
            }

            const payload = await this.fetchGraphPayload(requestedBookId);
            this.renderPayload(payload);
        } catch (error) {
            print("[BookRelationshipGraphRenderer] Failed to load graph. Rendering fallback graph. " + error);
            this.renderPayload(this.buildFallbackPayload());
        } finally {
            this.isLoading = false;
        }
    }

    private buildFallbackPayload(): ParsedBookGraph {
        return parseBookGraphPayload(
            {
                book_name: "Project Hail Mary",
                author_name: "Andy Weir",
                chapter: {
                    chapter_title: "Character Graph",
                    relationships: [
                        {
                            anchor_character_name: "Ryland Grace",
                            connections: ["Rocky", "Stratt"]
                        },
                        {
                            anchor_character_name: "Rocky",
                            connections: ["Ryland Grace", "Blip-A"]
                        },
                        {
                            anchor_character_name: "Stratt",
                            connections: ["Ryland Grace"]
                        },
                        {
                            anchor_character_name: "Blip-A",
                            connections: ["Rocky"]
                        }
                    ]
                }
            },
            Math.max(0, Math.floor(this.chapter_index))
        );
    }

    private async fetchGraphPayload(bookId: string): Promise<ParsedBookGraph> {
        if (!this.internet_module) {
            throw new Error("internet_module input is required.");
        }

        const endpointPath = this.chapter_index > 0
            ? `/api/books/${encodeURIComponent(bookId)}/chapters/${Math.floor(this.chapter_index)}`
            : `/api/books/${encodeURIComponent(bookId)}`;

        const endpoint = this.getValidatedBackendBaseUrl() + endpointPath;
        const response = await this.internet_module.fetch(endpoint, {
            method: "GET",
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            const details = await this.safeReadResponseText(response);
            throw new Error(`Backend returned status ${response.status}. ${details}`);
        }

        const parsed = await response.json();
        const payload = parsed && parsed.json ? parsed.json : parsed;

        return parseBookGraphPayload(payload, Math.max(0, Math.floor(this.chapter_index)));
    }

    private renderPayload(payload: ParsedBookGraph) {
        this.hide();

        const filtered = this.filterGraph(payload.relationships, payload.edges);
        if (filtered.nodes.length === 0) {
            print("[BookRelationshipGraphRenderer] No characters were found in graph data.");
            return;
        }

        const anchor = this.computeAnchor();
        this.rootContainer = global.scene.createSceneObject("BookGraphContainer");

        const rootTransform = this.rootContainer.getTransform();
        rootTransform.setWorldPosition(anchor);

        const positions = this.computeLayout(filtered.nodes, filtered.edges);
        const descriptions = this.buildNodeDescriptions(filtered.relationships);

        for (const nodeName of filtered.nodes) {
            const localPos = positions.get(nodeName) || new vec3(0, 0, 0);
            const description = descriptions.get(nodeName) || `${nodeName} appears in this chapter graph.`;
            this.spawnCard(nodeName, description, localPos);
        }

        for (const edge of filtered.edges) {
            const fromPos = positions.get(edge.source_character_name);
            const toPos = positions.get(edge.target_character_name);
            if (!fromPos || !toPos) {
                continue;
            }

            this.spawnLink(fromPos, toPos, edge.color_hex);
        }

        print(`[BookRelationshipGraphRenderer] Rendered ${filtered.nodes.length} nodes and ${filtered.edges.length} edges.`);
        this.isVisible = true;
    }

    private filterGraph(relationships: CharacterRelationship[], edges: CharacterEdge[]): {
        nodes: string[];
        relationships: CharacterRelationship[];
        edges: CharacterEdge[];
    } {
        const nodeSet = new Set<string>();

        for (const relationship of relationships) {
            nodeSet.add(relationship.anchor_character_name);
            for (const connection of relationship.connections) {
                nodeSet.add(connection);
            }
        }

        for (const edge of edges) {
            nodeSet.add(edge.source_character_name);
            nodeSet.add(edge.target_character_name);
        }

        const allNodes = [...nodeSet];
        if (allNodes.length <= this.maxNodes) {
            return {
                nodes: allNodes,
                relationships,
                edges
            };
        }

        const degree = new Map<string, number>();
        for (const edge of edges) {
            degree.set(edge.source_character_name, (degree.get(edge.source_character_name) || 0) + 1);
            degree.set(edge.target_character_name, (degree.get(edge.target_character_name) || 0) + 1);
        }

        const cappedNodeList = allNodes
            .sort((a, b) => {
                const degreeDelta = (degree.get(b) || 0) - (degree.get(a) || 0);
                if (degreeDelta !== 0) {
                    return degreeDelta;
                }
                return a.localeCompare(b);
            })
            .slice(0, Math.max(2, this.maxNodes));

        const allowedNodes = new Set(cappedNodeList);

        const filteredRelationships = relationships
            .filter((entry) => allowedNodes.has(entry.anchor_character_name))
            .map((entry) => ({
                anchor_character_name: entry.anchor_character_name,
                connections: entry.connections.filter((name) => allowedNodes.has(name))
            }))
            .filter((entry) => entry.connections.length > 0);

        const filteredEdges = edges.filter(
            (edge) => allowedNodes.has(edge.source_character_name) && allowedNodes.has(edge.target_character_name)
        );

        return {
            nodes: cappedNodeList,
            relationships: filteredRelationships,
            edges: filteredEdges
        };
    }

    private computeLayout(nodes: string[], edges: CharacterEdge[]): Map<string, vec3> {
        const adjacency = this.buildAdjacency(nodes, edges);
        const positions = new Map<string, vec3>();

        const unvisited = new Set(nodes);
        let startNode = this.pickHighestDegreeNode(nodes, adjacency);

        while (startNode) {
            const layers = this.bfsLayers(startNode, adjacency, unvisited);
            for (const [layerIndex, layerNodes] of layers.entries()) {
                const radius = this.computeLayerRadius(layerIndex, layerNodes.length);
                const angleOffset = layerIndex * 0.45;

                if (layerIndex === 0 && layerNodes.length === 1) {
                    positions.set(layerNodes[0], new vec3(0, 0, 0));
                    continue;
                }

                for (let i = 0; i < layerNodes.length; i += 1) {
                    const angle = angleOffset + (i / Math.max(1, layerNodes.length)) * Math.PI * 2;
                    positions.set(
                        layerNodes[i],
                        new vec3(
                            Math.cos(angle) * radius,
                            Math.sin(angle) * radius,
                            0
                        )
                    );
                }
            }

            startNode = this.pickHighestDegreeNode([...unvisited], adjacency);
        }

        return positions;
    }

    private computeLayerRadius(layerIndex: number, nodeCount: number): number {
        if (layerIndex <= 0) {
            return 0;
        }

        const baseRadius = layerIndex * Math.max(1, this.layerRadiusStep);
        const circumferenceTarget = Math.max(1, nodeCount) * Math.max(1, this.nodeSpacing);
        const spacingRadius = circumferenceTarget / (2 * Math.PI);

        return Math.max(baseRadius, spacingRadius + this.nodeSpacing);
    }

    private bfsLayers(
        start: string,
        adjacency: Map<string, string[]>,
        unvisited: Set<string>
    ): string[][] {
        const queue: string[] = [start];
        const depth = new Map<string, number>();
        depth.set(start, 0);
        unvisited.delete(start);

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }

            const currentDepth = depth.get(current) || 0;
            const neighbors = adjacency.get(current) || [];

            for (const neighbor of neighbors) {
                if (depth.has(neighbor)) {
                    continue;
                }

                depth.set(neighbor, currentDepth + 1);
                queue.push(neighbor);
                unvisited.delete(neighbor);
            }
        }

        const layers: string[][] = [];
        for (const [node, layer] of depth.entries()) {
            if (!layers[layer]) {
                layers[layer] = [];
            }
            layers[layer].push(node);
        }

        for (const layerNodes of layers) {
            layerNodes.sort();
        }

        return layers;
    }

    private pickHighestDegreeNode(nodes: string[], adjacency: Map<string, string[]>): string | undefined {
        if (nodes.length === 0) {
            return undefined;
        }

        return nodes
            .slice()
            .sort((a, b) => {
                const degreeDelta = (adjacency.get(b)?.length || 0) - (adjacency.get(a)?.length || 0);
                if (degreeDelta !== 0) {
                    return degreeDelta;
                }

                return a.localeCompare(b);
            })[0];
    }

    private buildAdjacency(nodes: string[], edges: CharacterEdge[]): Map<string, string[]> {
        const map = new Map<string, Set<string>>();

        for (const node of nodes) {
            map.set(node, new Set());
        }

        for (const edge of edges) {
            if (!map.has(edge.source_character_name) || !map.has(edge.target_character_name)) {
                continue;
            }

            map.get(edge.source_character_name).add(edge.target_character_name);
            map.get(edge.target_character_name).add(edge.source_character_name);
        }

        const adjacency = new Map<string, string[]>();
        for (const [node, neighbors] of map.entries()) {
            adjacency.set(node, [...neighbors].sort());
        }

        return adjacency;
    }

    private buildNodeDescriptions(relationships: CharacterRelationship[]): Map<string, string> {
        const descriptions = new Map<string, string>();

        for (const relationship of relationships) {
            const anchor = relationship.anchor_character_name;
            const text = relationship.connections.length > 0
                ? `${anchor} is connected to: ${relationship.connections.join(", ")}.`
                : `${anchor} has no detected direct links in this slice.`;

            descriptions.set(anchor, text);
        }

        for (const relationship of relationships) {
            for (const connection of relationship.connections) {
                if (!descriptions.has(connection)) {
                    descriptions.set(connection, `${connection} appears in this relationship graph.`);
                }
            }
        }

        return descriptions;
    }

    private spawnCard(characterName: string, description: string, localPos: vec3) {
        if (!this.rootContainer) {
            return;
        }

        if (!this.cardPrefab) {
            const fallbackNode = global.scene.createSceneObject("BookGraphFallbackNode_" + characterName.replace(/\s+/g, "_"));
            const fallbackTransform = fallbackNode.getTransform();
            const anchor = this.rootContainer.getTransform().getWorldPosition();
            const worldPos = anchor.add(localPos);
            fallbackTransform.setWorldPosition(worldPos);
            fallbackTransform.setLocalScale(new vec3(this.cardScale, this.cardScale, this.cardScale));

            if (this.cameraObject) {
                const cameraPos = this.cameraObject.getTransform().getWorldPosition();
                const direction = cameraPos.sub(worldPos).normalize().uniformScale(-1);
                fallbackTransform.setWorldRotation(quat.lookAt(direction, vec3.up()));
            }

            const text = fallbackNode.createComponent("Component.Text") as Text | null;
            if (text) {
                text.text = `${characterName}\n${description}`;
                text.size = 24;
            }

            this.fallbackObjects.push(fallbackNode);
            return;
        }

        const obj = this.cardPrefab.instantiate(this.rootContainer);
        obj.name = "BookGraphNode_" + characterName.replace(/\s+/g, "_");

        const transform = obj.getTransform();
        transform.setLocalPosition(localPos);
        transform.setLocalScale(new vec3(this.cardScale, this.cardScale, this.cardScale));

        const nodeScript = this.findMindMapNode(obj);
        if (nodeScript) {
            nodeScript.setup(characterName, description, null, this.cameraObject ?? null);
        } else {
            this.applyTitleFallback(obj, characterName);
        }
    }

    private spawnLink(fromPos: vec3, toPos: vec3, colorHex?: string) {
        if (!this.linkPrefab || !this.rootContainer) {
            return;
        }

        const link = this.linkPrefab.instantiate(this.rootContainer);
        link.name = "BookGraphLink";

        const delta = toPos.sub(fromPos);
        const length = delta.length;
        if (length <= 0) {
            return;
        }

        const midpoint = fromPos.add(delta.uniformScale(0.5));
        const direction = delta.uniformScale(1 / length);

        const rotation = quat.lookAt(direction, vec3.up()).multiply(
            quat.angleAxis(Math.PI * 0.5, new vec3(1, 0, 0))
        );

        const transform = link.getTransform();
        transform.setLocalPosition(midpoint);
        transform.setLocalRotation(rotation);
        transform.setLocalScale(new vec3(this.linkThickness, length, this.linkThickness));

        if (colorHex) {
            this.tintLink(link, colorHex);
        }
    }

    private tintLink(linkObject: SceneObject, colorHex: string) {
        const color = this.hexToColor(colorHex);
        if (!color) {
            return;
        }

        this.visitChildren(linkObject, (child) => {
            const image = child.getComponent("Component.Image") as any;
            if (image?.mainMaterial) {
                image.mainMaterial = this.withColor(image.mainMaterial, color);
            }

            const mesh = child.getComponent("Component.RenderMeshVisual") as any;
            if (mesh?.mainMaterial) {
                mesh.mainMaterial = this.withColor(mesh.mainMaterial, color);
            }
        });
    }

    private withColor(material: any, color: vec4): any {
        if (!material) {
            return material;
        }

        const clone = typeof material.clone === "function" ? material.clone() : material;

        try {
            if (clone.mainPass) {
                if ("baseColor" in clone.mainPass) {
                    clone.mainPass.baseColor = color;
                } else if ("color" in clone.mainPass) {
                    clone.mainPass.color = color;
                } else if ("tintColor" in clone.mainPass) {
                    clone.mainPass.tintColor = color;
                }
            }
        } catch {
            // Best-effort tinting only.
        }

        return clone;
    }

    private hexToColor(value: string): vec4 | undefined {
        const raw = (value || "").trim().replace(/^#/, "");
        if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
            return undefined;
        }

        const r = parseInt(raw.slice(0, 2), 16) / 255;
        const g = parseInt(raw.slice(2, 4), 16) / 255;
        const b = parseInt(raw.slice(4, 6), 16) / 255;

        return new vec4(r, g, b, 1);
    }

    private computeAnchor(): vec3 {
        if (!this.cameraObject) {
            return new vec3(0, 0, 0);
        }

        const camTransform = this.cameraObject.getTransform();
        const camPos = camTransform.getWorldPosition();
        const camRot = camTransform.getWorldRotation();
        const forward = camRot.multiplyVec3(new vec3(0, 0, -1)).normalize();

        return camPos.add(forward.uniformScale(this.distanceFromCamera));
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

        for (let i = 0; i < count; i += 1) {
            this.visitChildren(obj.getChild(i), visitor);
        }
    }

    private getBackendBaseUrl(): string {
        const value = (this.backend_base_url || "").trim();
        const sanitized = value.endsWith("/") ? value.slice(0, -1) : value;
        return sanitized || "https://localhost:3001";
    }

    private getValidatedBackendBaseUrl(): string {
        const baseUrl = this.getBackendBaseUrl();
        const isInsecure = baseUrl.startsWith("http://");

        if (isInsecure && !this.allow_insecure_http_for_debug) {
            throw new Error(
                "Insecure backend URL blocked. Set backend_base_url to https://..., or enable allow_insecure_http_for_debug and Experimental API insecure URLs."
            );
        }

        return baseUrl;
    }

    private async safeReadResponseText(response: Response): Promise<string> {
        try {
            return await response.text();
        } catch {
            return "";
        }
    }
}
