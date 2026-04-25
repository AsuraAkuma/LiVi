# livi-tts-proxy

Simple Express proxy to generate and cache ElevenLabs TTS audio for Lens Studio.

Quick start

1. Copy `.env.example` → `.env` and set `ELEVENLABS_API_KEY` and optionally `DEFAULT_VOICE_ID`.
2. Install deps:

```powershell
cd server
npm install
```

3. Run server:

```powershell
npm start
```

4. Call the endpoint from Lens Studio (or curl):

POST /generate-tts
Body JSON: { "text": "Hello world", "voice": "voice-id" }

Response JSON: { "url": "https://your-host/public/tts/<hash>.mp3" }

Notes

- The proxy caches generated MP3s under `server/public/tts` and serves them at `/public/tts/<file>`.
- For production, put `public/tts` behind a CDN (S3 + CloudFront) and return the CDN URL after upload.
- Adjust the ElevenLabs request payload and headers to match the API version you're targeting.
