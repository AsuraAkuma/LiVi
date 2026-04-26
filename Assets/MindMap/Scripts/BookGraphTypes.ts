export interface CharacterRelationship {
    anchor_character_name: string;
    connections: string[];
}

export interface CharacterEdge {
    source_character_name: string;
    target_character_name: string;
    weight: number;
    color_hex?: string;
}

export interface ParsedBookGraph {
    title: string;
    subtitle: string;
    relationships: CharacterRelationship[];
    edges: CharacterEdge[];
}

function asString(value: any, fallback: string = ""): string {
    return typeof value === "string" ? value : fallback;
}

function normalizeConnections(value: any): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const deduped = new Set<string>();
    for (const entry of value) {
        if (typeof entry !== "string") {
            continue;
        }

        const trimmed = entry.trim();
        if (!trimmed) {
            continue;
        }

        deduped.add(trimmed);
    }

    return [...deduped];
}

function normalizeRelationships(value: any): CharacterRelationship[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const relationships: CharacterRelationship[] = [];

    for (const entry of value) {
        const anchor = asString(entry?.anchor_character_name).trim();
        if (!anchor) {
            continue;
        }

        relationships.push({
            anchor_character_name: anchor,
            connections: normalizeConnections(entry?.connections)
        });
    }

    return relationships;
}

function normalizeEdges(value: any): CharacterEdge[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const edges: CharacterEdge[] = [];

    for (const entry of value) {
        const source = asString(entry?.source_character_name).trim();
        const target = asString(entry?.target_character_name).trim();
        if (!source || !target || source === target) {
            continue;
        }

        const rawWeight = Number(entry?.weight);
        const safeWeight = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 1;

        edges.push({
            source_character_name: source,
            target_character_name: target,
            weight: safeWeight,
            color_hex: typeof entry?.color_hex === "string" ? entry.color_hex : undefined
        });
    }

    return edges;
}

function buildEdgesFromRelationships(relationships: CharacterRelationship[]): CharacterEdge[] {
    const deduped = new Map<string, CharacterEdge>();

    for (const relationship of relationships) {
        const source = relationship.anchor_character_name;

        for (const target of relationship.connections) {
            if (!target || source === target) {
                continue;
            }

            const keyParts = [source, target].sort();
            const key = keyParts[0] + "::" + keyParts[1];

            if (!deduped.has(key)) {
                deduped.set(key, {
                    source_character_name: keyParts[0],
                    target_character_name: keyParts[1],
                    weight: 1
                });
            }
        }
    }

    return [...deduped.values()];
}

export function parseBookGraphPayload(payload: any, preferredChapterIndex: number): ParsedBookGraph {
    const root = payload && payload.json ? payload.json : payload;
    const bookName = asString(root?.book_name, "Unknown Book").trim() || "Unknown Book";
    const authorName = asString(root?.author_name || root?.auther_name, "Unknown").trim() || "Unknown";

    const chapterData = root?.chapter && typeof root.chapter === "object" ? root.chapter : undefined;
    const chapterRelationships = normalizeRelationships(chapterData?.relationships || root?.relationships);
    const chapterEdges = normalizeEdges(chapterData?.edges || root?.edges);

    let title = bookName;
    let subtitle = "Character Relationship Graph";

    if (chapterData) {
        const chapterTitle = asString(chapterData.chapter_title, `Chapter ${preferredChapterIndex || "?"}`).trim();
        title = `${bookName} - ${chapterTitle}`;
        subtitle = `Author: ${authorName}`;
    } else if (preferredChapterIndex > 0 && Array.isArray(root?.chapters)) {
        const match = root.chapters.find((entry: any) => Number(entry?.chapter_index) === preferredChapterIndex);
        if (match) {
            const selectedRelationships = normalizeRelationships(match.relationships);
            const selectedEdges = normalizeEdges(match.edges);
            return {
                title: `${bookName} - ${asString(match.chapter_title, `Chapter ${preferredChapterIndex}`)}`,
                subtitle: `Author: ${authorName}`,
                relationships: selectedRelationships,
                edges: selectedEdges.length > 0 ? selectedEdges : buildEdgesFromRelationships(selectedRelationships)
            };
        }
    }

    return {
        title,
        subtitle,
        relationships: chapterRelationships,
        edges: chapterEdges.length > 0 ? chapterEdges : buildEdgesFromRelationships(chapterRelationships)
    };
}
