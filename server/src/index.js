const express = require("express");
const dotenv = require("dotenv");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");

dotenv.config();

const ELEVENLABS_BASE_URL = process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io";
const GENERATED_ROOT = path.join(__dirname, "..", "generated");
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

function createHttpError(status, message, details) {
    const error = new Error(message);
    error.status = status;
    if (details !== undefined) {
        error.details = details;
    }
    return error;
}

function asyncRoute(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

function requireApiKey(_req, res, next) {
    if (!process.env.ELEVENLABS_API_KEY) {
        res.status(500).json({
            error: "Missing ELEVENLABS_API_KEY. Add it to server/.env before calling ElevenLabs endpoints."
        });
        return;
    }
    next();
}

function normalizeStringArray(value, fieldName) {
    let values;

    if (typeof value === "string") {
        values = [value];
    } else if (Array.isArray(value)) {
        values = value;
    } else {
        throw createHttpError(400, `${fieldName} must be a string or an array of strings.`);
    }

    if (values.length === 0) {
        throw createHttpError(400, `${fieldName} cannot be empty.`);
    }

    return values.map((entry, index) => {
        if (typeof entry !== "string") {
            throw createHttpError(400, `${fieldName}[${index}] must be a string.`);
        }

        const trimmed = entry.trim();
        if (!trimmed) {
            throw createHttpError(400, `${fieldName}[${index}] cannot be blank.`);
        }

        return trimmed;
    });
}

function normalizeOptionalNumber(value, fieldName, min, max) {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value !== "number" || Number.isNaN(value)) {
        throw createHttpError(400, `${fieldName} must be a number.`);
    }

    if (value < min || value > max) {
        throw createHttpError(400, `${fieldName} must be between ${min} and ${max}.`);
    }

    return value;
}

function normalizeOptionalString(value, fieldName) {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value !== "string") {
        throw createHttpError(400, `${fieldName} must be a string.`);
    }

    const trimmed = value.trim();
    if (!trimmed) {
        throw createHttpError(400, `${fieldName} cannot be blank.`);
    }

    return trimmed;
}

function normalizeId(value, fieldName) {
    if (typeof value !== "string" || !/^[A-Za-z0-9-]+$/.test(value)) {
        throw createHttpError(400, `${fieldName} is invalid.`);
    }

    return value;
}

function parseVoiceSettings(value) {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value !== "object" || Array.isArray(value)) {
        throw createHttpError(400, "voiceSettings must be an object when provided.");
    }

    return value;
}

function contentTypeToExtension(contentType, fallbackOutputFormat) {
    const normalized = (contentType || "").toLowerCase();

    if (normalized.includes("mpeg")) {
        return "mp3";
    }

    if (normalized.includes("wav")) {
        return "wav";
    }

    if (normalized.includes("ogg")) {
        return "ogg";
    }

    if (normalized.includes("flac")) {
        return "flac";
    }

    if (normalized.includes("pcm")) {
        return "pcm";
    }

    if (normalized.includes("x-m4a") || normalized.includes("mp4")) {
        return "m4a";
    }

    if (typeof fallbackOutputFormat === "string" && fallbackOutputFormat.trim()) {
        return fallbackOutputFormat.split("_")[0].toLowerCase();
    }

    return "bin";
}

async function buildUpstreamError(response) {
    let details;
    let rawBody;

    try {
        rawBody = await response.text();
        details = rawBody ? JSON.parse(rawBody) : undefined;
    } catch {
        details = rawBody;
    }

    return createHttpError(response.status, `ElevenLabs request failed (${response.status}).`, details);
}

async function callElevenLabsAudio({ endpoint, body, query = {} }) {
    if (typeof fetch !== "function") {
        throw createHttpError(500, "Global fetch is unavailable. Use Node.js 18 or later.");
    }

    const url = new URL(endpoint, ELEVENLABS_BASE_URL);
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
        }
    }

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
            Accept: "audio/mpeg"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw await buildUpstreamError(response);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    return { audioBuffer, contentType };
}

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function saveGeneratedAudio({ kind, audioBuffer, contentType, outputFormat, metadata }) {
    const id = crypto.randomUUID();
    const extension = contentTypeToExtension(contentType, outputFormat);
    const kindDir = path.join(GENERATED_ROOT, kind);

    await ensureDir(kindDir);

    const fileName = `${id}.${extension}`;
    const filePath = path.join(kindDir, fileName);
    const metadataPath = path.join(kindDir, `${id}.json`);

    const metadataDocument = {
        id,
        kind,
        fileName,
        contentType,
        sizeBytes: audioBuffer.length,
        createdAt: new Date().toISOString(),
        ...metadata
    };

    await fs.writeFile(filePath, audioBuffer);
    await fs.writeFile(metadataPath, JSON.stringify(metadataDocument, null, 2), "utf8");

    return {
        id,
        filePath,
        metadata: metadataDocument
    };
}

async function resolveGeneratedAudio(kind, id) {
    const safeId = normalizeId(id, "id");
    const kindDir = path.join(GENERATED_ROOT, kind);

    await ensureDir(kindDir);

    const entries = await fs.readdir(kindDir);
    const fileName = entries.find((entry) => entry.startsWith(`${safeId}.`) && !entry.endsWith(".json"));

    if (!fileName) {
        throw createHttpError(404, `${kind.toUpperCase()} audio with id ${safeId} was not found.`);
    }

    const filePath = path.join(kindDir, fileName);
    const metadataPath = path.join(kindDir, `${safeId}.json`);
    let metadata;

    if (fsSync.existsSync(metadataPath)) {
        const metadataRaw = await fs.readFile(metadataPath, "utf8");
        metadata = JSON.parse(metadataRaw);
    }

    return { filePath, metadata };
}

function formatGenerateResponse({
    id,
    kind,
    contentType,
    bytes,
    prompt,
    text,
    voiceId,
    includeBase64,
    audioBuffer
}) {
    const payload = {
        id,
        kind,
        contentType,
        bytes,
        downloadUrl: `/api/${kind}/${id}`
    };

    if (prompt) {
        payload.prompt = prompt;
    }

    if (text) {
        payload.text = text;
    }

    if (voiceId) {
        payload.voiceId = voiceId;
    }

    if (includeBase64) {
        payload.base64Audio = audioBuffer.toString("base64");
    }

    return payload;
}

function createApp() {
    const app = express();

    app.use(express.json({ limit: "2mb" }));

    app.get("/", (_req, res) => {
        res.json({
            name: "ElevenLabs Express Server",
            endpoints: [
                "GET /health",
                "GET /api/voices",
                "POST /api/sfx",
                "GET /api/sfx/:id",
                "POST /api/tts",
                "GET /api/tts/:id"
            ]
        });
    });

    app.get("/health", (_req, res) => {
        res.json({
            ok: true,
            timestamp: new Date().toISOString()
        });
    });

    app.get(
        "/api/voices",
        requireApiKey,
        asyncRoute(async (_req, res) => {
            const url = new URL("/v1/voices", ELEVENLABS_BASE_URL);
            const response = await fetch(url, {
                headers: {
                    "xi-api-key": process.env.ELEVENLABS_API_KEY,
                    Accept: "application/json"
                }
            });

            if (!response.ok) {
                throw await buildUpstreamError(response);
            }

            const voices = await response.json();
            res.json(voices);
        })
    );

    app.post(
        "/api/sfx",
        requireApiKey,
        asyncRoute(async (req, res) => {
            const prompts = normalizeStringArray(req.body.prompts ?? req.body.prompt, "prompts");
            const includeBase64 = Boolean(req.body.includeBase64);
            const outputFormat =
                normalizeOptionalString(req.body.outputFormat, "outputFormat") || DEFAULT_OUTPUT_FORMAT;
            const durationSeconds = normalizeOptionalNumber(
                req.body.durationSeconds ?? req.body.duration_seconds,
                "durationSeconds",
                0.5,
                22
            );
            const promptInfluence = normalizeOptionalNumber(
                req.body.promptInfluence ?? req.body.prompt_influence,
                "promptInfluence",
                0,
                1
            );

            const results = await Promise.all(
                prompts.map(async (prompt) => {
                    const requestBody = {
                        text: prompt
                    };

                    if (durationSeconds !== undefined) {
                        requestBody.duration_seconds = durationSeconds;
                    }

                    if (promptInfluence !== undefined) {
                        requestBody.prompt_influence = promptInfluence;
                    }

                    const { audioBuffer, contentType } = await callElevenLabsAudio({
                        endpoint: "/v1/sound-generation",
                        body: requestBody,
                        query: { output_format: outputFormat }
                    });

                    const saved = await saveGeneratedAudio({
                        kind: "sfx",
                        audioBuffer,
                        contentType,
                        outputFormat,
                        metadata: { prompt }
                    });

                    return formatGenerateResponse({
                        id: saved.id,
                        kind: "sfx",
                        contentType,
                        bytes: audioBuffer.length,
                        prompt,
                        includeBase64,
                        audioBuffer
                    });
                })
            );

            res.status(201).json({
                count: results.length,
                items: results
            });
        })
    );

    app.get(
        "/api/sfx/:id",
        asyncRoute(async (req, res) => {
            const { filePath, metadata } = await resolveGeneratedAudio("sfx", req.params.id);
            if (metadata?.contentType) {
                res.type(metadata.contentType);
            }
            res.sendFile(filePath);
        })
    );

    app.post(
        "/api/tts",
        requireApiKey,
        asyncRoute(async (req, res) => {
            const texts = normalizeStringArray(req.body.texts ?? req.body.text, "texts");
            const includeBase64 = Boolean(req.body.includeBase64);
            const outputFormat =
                normalizeOptionalString(req.body.outputFormat, "outputFormat") || DEFAULT_OUTPUT_FORMAT;
            const voiceId =
                normalizeOptionalString(req.body.voiceId ?? req.body.voice_id, "voiceId") ||
                process.env.ELEVENLABS_DEFAULT_VOICE_ID;

            if (!voiceId) {
                throw createHttpError(
                    400,
                    "voiceId is required in the request body or via ELEVENLABS_DEFAULT_VOICE_ID."
                );
            }

            const modelId =
                normalizeOptionalString(req.body.modelId ?? req.body.model_id, "modelId") || DEFAULT_MODEL_ID;
            const voiceSettings = parseVoiceSettings(req.body.voiceSettings ?? req.body.voice_settings);

            const results = await Promise.all(
                texts.map(async (text) => {
                    const requestBody = {
                        text,
                        model_id: modelId
                    };

                    if (voiceSettings) {
                        requestBody.voice_settings = voiceSettings;
                    }

                    const { audioBuffer, contentType } = await callElevenLabsAudio({
                        endpoint: `/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
                        body: requestBody,
                        query: { output_format: outputFormat }
                    });

                    const saved = await saveGeneratedAudio({
                        kind: "tts",
                        audioBuffer,
                        contentType,
                        outputFormat,
                        metadata: {
                            text,
                            voiceId,
                            modelId
                        }
                    });

                    return formatGenerateResponse({
                        id: saved.id,
                        kind: "tts",
                        contentType,
                        bytes: audioBuffer.length,
                        text,
                        voiceId,
                        includeBase64,
                        audioBuffer
                    });
                })
            );

            res.status(201).json({
                count: results.length,
                voiceId,
                modelId,
                items: results
            });
        })
    );

    app.get(
        "/api/tts/:id",
        asyncRoute(async (req, res) => {
            const { filePath, metadata } = await resolveGeneratedAudio("tts", req.params.id);
            if (metadata?.contentType) {
                res.type(metadata.contentType);
            }
            res.sendFile(filePath);
        })
    );

    app.use((err, _req, res, _next) => {
        const status = Number(err.status) || 500;
        const payload = {
            error: err.message || "Unexpected server error."
        };

        if (err.details !== undefined) {
            payload.details = err.details;
        }

        res.status(status).json(payload);
    });

    return app;
}

function startServer() {
    const app = createApp();
    const port = Number(process.env.PORT || 3001);

    app.listen(port, () => {
        console.log(`ElevenLabs server listening on http://localhost:${port}`);
    });

    return app;
}

if (require.main === module) {
    startServer();
}

module.exports = {
    createApp,
    startServer
};
