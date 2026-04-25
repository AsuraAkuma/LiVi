ElevenLabs TTS — quick proxy guide

This project expects a small backend proxy that accepts a POST containing { text, voice } and returns JSON { url } where the generated MP3 is hosted (CDN or static file server).

Minimal notes:

- Use `ELEVENLABS_API_KEY` as an environment variable on the server; never embed it in the Lens project.
- Cache generated audio by hashing `text + voice` and reuse the cached file when present.
- Serve cached files from a stable public URL (CDN or simple static file host) so Lens Studio can play them as Remote Audio assets.

Example (outline) Express handler:

```js
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json());

app.post("/generate-tts", async (req, res) => {
  const { text, voice } = req.body;
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing API key" });

  const hash = crypto
    .createHash("sha256")
    .update(text + (voice || ""))
    .digest("hex");
  const outDir = path.join(__dirname, "cache");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, hash + ".mp3");

  if (fs.existsSync(outPath)) {
    // return a public URL for the cached file (adjust to your hosting)
    return res.json({ url: `https://cdn.example.com/tts/${hash}.mp3` });
  }

  // Call ElevenLabs TTS API (endpoint and payload may vary; consult their docs)
  const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream`;
  const resp = await axios.post(
    apiUrl,
    { text },
    {
      responseType: "stream",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
    },
  );
  const writer = fs.createWriteStream(outPath);
  resp.data.pipe(writer);
  writer.on("finish", () => {
    // Upload to CDN or serve from public static path; return the public URL
    res.json({ url: `https://cdn.example.com/tts/${hash}.mp3` });
  });
  writer.on("error", (err) => res.status(500).json({ error: err.message }));
});

app.listen(3000, () => console.log("TTS proxy listening on :3000"));
```

Security & Ops:

- Protect the server with basic auth or IP allowlist if needed.
- Use short TTLs for cached content if you plan to re-generate frequently.
- Consider S3/CloudFront or similar for serving cached MP3s.
