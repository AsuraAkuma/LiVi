# ElevenLabs Express Server

Simple Express API for batch sound effects generation and batch text-to-speech with a selected voice.

## 1) Setup

```bash
cd server
npm install
```

Create a local env file from the template:

```bash
cp .env.example .env
```

If you are on PowerShell:

```powershell
Copy-Item .env.example .env
```

Add your values in `.env`:

- `ELEVENLABS_API_KEY` (required for ElevenLabs calls)
- `ELEVENLABS_DEFAULT_VOICE_ID` (optional fallback voice)
- `PORT` (optional, default `3001`)
- `ELEVENLABS_BASE_URL` (optional, default `https://api.elevenlabs.io`)

Start server:

```bash
npm start
```

## 2) Endpoints

- `GET /health`
- `GET /api/voices`
- `POST /api/sfx`
- `GET /api/sfx/:id`
- `POST /api/tts`
- `GET /api/tts/:id`

## 3) Batch Sound Effects

`POST /api/sfx`

Body fields:

- `prompts`: string or string[] (required)
- `durationSeconds`: number between 0.5 and 22 (optional)
- `promptInfluence`: number between 0 and 1 (optional)
- `outputFormat`: string, default `mp3_44100_128` (optional)
- `includeBase64`: boolean, default `false` (optional)

Example:

```bash
curl -X POST http://localhost:3001/api/sfx \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": ["heavy rain on a tin roof", "retro UI click"],
    "durationSeconds": 4,
    "promptInfluence": 0.5
  }'
```

Response includes one item per prompt with an `id` and `downloadUrl`.

## 4) Batch Text-to-Speech (Chosen Voice)

`POST /api/tts`

Body fields:

- `texts`: string or string[] (required)
- `voiceId`: string (required unless `ELEVENLABS_DEFAULT_VOICE_ID` is set)
- `modelId`: string, default `eleven_multilingual_v2` (optional)
- `voiceSettings`: object (optional)
- `outputFormat`: string, default `mp3_44100_128` (optional)
- `includeBase64`: boolean, default `false` (optional)

Example:

```bash
curl -X POST http://localhost:3001/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "voiceId": "YOUR_VOICE_ID",
    "texts": ["Welcome to LiVi", "Loading complete"],
    "voiceSettings": {
      "stability": 0.45,
      "similarity_boost": 0.8
    }
  }'
```

## 5) Get Generated Audio by ID

- Sound effect: `GET /api/sfx/:id`
- Voice output: `GET /api/tts/:id`

Each generation call saves audio under `server/generated/` and returns IDs you can fetch later.
