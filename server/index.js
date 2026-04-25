const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load server-local env first, then fall back to repo-root env for local development.
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
app.use(express.json());
app.use(require('cors')());

const PORT = process.env.PORT || 3000;
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVEN_ENDPOINT = process.env.ELEVENLABS_API_ENDPOINT || 'https://api.elevenlabs.io/v1';

const PUBLIC_DIR = path.join(__dirname, 'public');
const CACHE_DIR = path.join(PUBLIC_DIR, 'tts');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
app.use('/public', express.static(PUBLIC_DIR));

app.post('/generate-tts', async (req, res) => {
  try {
    const { text, voice } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Missing text' });
    if (!ELEVEN_KEY) return res.status(500).json({ error: 'Missing ELEVENLABS_API_KEY on server' });

    const voiceId = voice || process.env.DEFAULT_VOICE_ID || 'default';
    const hash = crypto.createHash('sha256').update(text + voiceId).digest('hex');
    const outPath = path.join(CACHE_DIR, `${hash}.mp3`);
    const publicUrl = `${req.protocol}://${req.get('host')}/public/tts/${hash}.mp3`;

    if (fs.existsSync(outPath)) {
      return res.json({ url: publicUrl, cached: true });
    }

    // Call ElevenLabs TTS API - this is a minimal example and may need adapting to ElevenLabs' latest API
    const apiUrl = `${ELEVEN_ENDPOINT}/text-to-speech/${voiceId}/stream`;
    const apiResp = await axios.post(apiUrl, { text }, {
      responseType: 'stream',
      headers: {
        'xi-api-key': ELEVEN_KEY,
        'Content-Type': 'application/json'
      }
    });

    const writer = fs.createWriteStream(outPath);
    apiResp.data.pipe(writer);
    writer.on('finish', () => res.json({ url: publicUrl, cached: false }));
    writer.on('error', (err) => {
      console.error('Writer error', err);
      res.status(500).json({ error: 'Failed to write file' });
    });
  } catch (err) {
    console.error('generate-tts error', err && err.toString());
    res.status(500).json({ error: err && err.toString() });
  }
});

app.listen(PORT, () => console.log('TTS proxy listening on', PORT));
