export interface MindMapNodeData {
    id: string;
    title: string;
    description: string;
}

export interface MindMapData {
    root: MindMapNodeData;
    children: MindMapNodeData[];
}

export function parseMindMap(rawJson: string): MindMapData {
    const parsed = JSON.parse(rawJson);

    if (!parsed || typeof parsed !== "object") {
        throw new Error("Mind map JSON is not an object.");
    }

    const root = parsed.root;
    if (!root || typeof root.title !== "string") {
        throw new Error("Mind map JSON is missing a root node with a title.");
    }

    const children = Array.isArray(parsed.children) ? parsed.children : [];

    return {
        root: {
            id: String(root.id ?? "root"),
            title: String(root.title ?? ""),
            description: String(root.description ?? "")
        },
        children: children.map((child: any, index: number) => ({
            id: String(child?.id ?? "child_" + index),
            title: String(child?.title ?? ""),
            description: String(child?.description ?? "")
        }))
    };
}
