# Livi

This project includes a Lens Studio audio flow that can:

- Generate and play text-to-speech (TTS) with ElevenLabs.
- Generate and play sound effects from a text prompt.
- Fall back to a locally assigned AudioTrack when generation fails.

## Lens Studio Audio Setup

The behavior is implemented by [Assets/playSound.ts](Assets/playSound.ts) and wired in [Assets/Scene.scene](Assets/Scene.scene).

In Lens Studio, select the object with the PlaySound script and configure these inputs:

- `sound` (AudioComponent): Required. Playback target.
- `loop_count` (number): Number of loops to play.
- `text` (string): If non-empty, TTS is generated and played.
- `tts_voice_id` (string): Optional ElevenLabs voice ID for TTS.
- `desired_sound_name` (string): Sound effect prompt (used when `text` is empty).
- `backend_base_url` (string): Backend URL (for example, `https://localhost:3001`).
- `allow_insecure_http_for_debug` (boolean): Allows `http://` backend only for local debug.
- `internet_module` (InternetModule): Required for backend requests.
- `remote_media_module` (RemoteMediaModule): Required to load remote audio into an AudioTrackAsset.

## Playback Rules

PlaySound chooses what to play in this order:

1. If `text` is non-empty, it calls backend `POST /api/tts`.
2. Else if `desired_sound_name` is non-empty, it calls backend `POST /api/sfx`.
3. Else it plays the currently assigned `sound.audioTrack`.

If remote generation/loading fails, it falls back to the currently assigned `sound.audioTrack`.

## Backend Requirements

The Express backend is under [server](server). API and env details are documented in [server/README.md](server/README.md).

Quick start:

```powershell
cd server
npm install
Copy-Item .env.example .env
# Fill in ELEVENLABS_API_KEY (and optional ELEVENLABS_DEFAULT_VOICE_ID)
npm start
```

Main routes used by the lens script:

- `POST /api/tts`
- `POST /api/sfx`
- Returned `downloadUrl` is loaded and played through the AudioComponent.

## HTTPS and Security Notes

Lens Studio may reject insecure `http://` URLs unless insecure experimental access is enabled.

Recommended:

- Use `https://` in `backend_base_url`.

Debug-only alternative:

- Set `allow_insecure_http_for_debug = true`.
- Enable the Lens Studio experimental setting for insecure URLs.

## Common Use Cases

### Play TTS

- Set `text` to your sentence.
- Set `tts_voice_id` (optional).
- Leave `desired_sound_name` empty.

### Play Sound Effect

- Leave `text` empty.
- Set `desired_sound_name` to a prompt (for example, `car horn`, `duck`, `retro click`).

### Use Local Fallback Audio

- Leave both `text` and `desired_sound_name` empty.
- Assign an AudioTrack to the `sound` AudioComponent.

## Troubleshooting

- `Missing required AudioComponent input: sound.`
	- Bind an AudioComponent to `sound`.

- `Missing internet_module or remote_media_module input.`
	- Bind both module inputs in the script inspector.

- `URL is not secure` / `Insecure backend URL blocked`
	- Use `https://` backend URL, or enable insecure debug path as described above.

- `Backend returned status ...`
	- Check server logs, API key in [server/.env.example](server/.env.example), and route availability.