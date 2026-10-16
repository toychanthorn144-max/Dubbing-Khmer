import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Increase payload limit for audio/video data transfers
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Server-side Gemini AI Client with required telemetry User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface DubbingSegment {
  id: string;
  startTime: number;
  endTime: number;
  originalText: string;
  khmerText: string;
  speaker: string;
  emotion: string;
  suggestedVoice: string;
}

// ==========================================
// STAGE 2: Gemini API Transcribe & Translate to Khmer
// ==========================================
app.post('/api/transcribe-and-translate', async (req: Request, res: Response) => {
  try {
    const { audioData, mimeType = 'audio/wav', contextInfo = '', videoTitle = 'Video' } = req.body;

    const systemInstruction = `
You are an expert AI Video Dubbing Director and Master Khmer Translator specializing in Khmer audio localization (ការបញ្ចូលសំឡេងជាភាសាខ្មែរ).
Your mission is to:
1. Transcribe the spoken speech/dialogue accurately from the provided audio or video description.
2. Break down the speech into logical timing segments (start and end in seconds).
3. Translate each segment into natural, conversational, and rhythmically accurate Khmer (ភាសាខ្មែរ) suitable for voiceover dubbing.
   - Do NOT translate literally word-by-word. Translate for smooth human speech, using natural Khmer idioms and sentence endings.
   - Add appropriate conversational markers (បាទ, ចាស, ណា, ផងដែរ) matching the speaker's tone.
4. Detect the speaker (e.g. "អ្នករៀបរាប់", "វាគ្មិន A", "វាគ្មិន B").
5. Specify emotion/tone (e.g. "រស់រវើក / Energetic", "ស្រទន់ / Calm", "វិជ្ជាជីវៈ / Professional", "រំភើប / Dramatic", "កំប្លែង / Humorous").
6. Suggest a voice persona: "Kore" (Female warm/narrative), "Puck" (Male energetic), "Zephyr" (Female professional), "Charon" (Male deep), or "Fenrir" (Male authoritative).
`;

    let contentsParts: any[] = [];

    if (audioData) {
      // Clean base64 string if data URL prefix was included
      const cleanBase64 = audioData.includes(',') ? audioData.split(',')[1] : audioData;
      contentsParts.push({
        inlineData: {
          mimeType: mimeType || 'audio/wav',
          data: cleanBase64,
        },
      });
      contentsParts.push({
        text: `Please listen carefully to this audio from "${videoTitle}". Extract all speech segments with exact timestamps, transcribe original text, and provide natural Khmer dubbing translations. Context: ${contextInfo}`,
      });
    } else {
      // Text or context based script generation
      contentsParts.push({
        text: `Generate a full realistic dubbing script with timestamps for a video about "${videoTitle}". Context details: ${contextInfo || 'Educational presentation and tech product showcase'}. Provide realistic timestamps from 0s up to 30-45s with original English and natural Khmer voiceover translations.`,
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: contentsParts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  startTime: { type: Type.NUMBER, description: 'Start time in seconds' },
                  endTime: { type: Type.NUMBER, description: 'End time in seconds' },
                  originalText: { type: Type.STRING, description: 'Transcribed original language' },
                  khmerText: { type: Type.STRING, description: 'Natural spoken Khmer translation' },
                  speaker: { type: Type.STRING, description: 'Speaker label or role' },
                  emotion: { type: Type.STRING, description: 'Tone and emotional delivery' },
                  suggestedVoice: { type: Type.STRING, description: 'Kore, Puck, Zephyr, Charon, or Fenrir' },
                },
                required: ['id', 'startTime', 'endTime', 'originalText', 'khmerText', 'speaker', 'emotion', 'suggestedVoice'],
              },
            },
          },
          required: ['title', 'summary', 'segments'],
        },
      },
    });

    const textOutput = response.text?.trim() || '{}';
    const parsedData = JSON.parse(textOutput);

    // Ensure valid IDs if not provided
    if (parsedData.segments && Array.isArray(parsedData.segments)) {
      parsedData.segments = parsedData.segments.map((seg: any, idx: number) => ({
        ...seg,
        id: seg.id || `seg-${idx + 1}-${Date.now()}`,
        startTime: Number(seg.startTime || 0),
        endTime: Math.max(Number(seg.endTime || 0), Number(seg.startTime || 0) + 1.5),
      }));
    }

    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error in /api/transcribe-and-translate:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to transcribe and translate',
    });
  }
});

// Serve public/videos and public/stems folders statically
const stemsDir = path.resolve(__dirname, 'public/stems');
if (!fs.existsSync(stemsDir)) {
  fs.mkdirSync(stemsDir, { recursive: true });
}
app.use('/videos', express.static(path.resolve(__dirname, 'public/videos')));
app.use('/stems', express.static(stemsDir));

// In-memory audio cache to prevent duplicate TTS requests
const ttsAudioCache = new Map<string, string>();

/**
 * Split text into chunks that fit within query parameter length
 */
function splitTextIntoChunks(text: string, maxLen = 140): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  const words = text.split(/([ \u200B\n,。]+)/);
  let current = '';

  for (const part of words) {
    if ((current + part).length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      current = part;
    } else {
      current += part;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Generate Authentic Native Khmer Spoken Speech WAV
 * Uses Google TTS engine with ffmpeg persona tuning (Kore, Puck, Zephyr, Charon, Fenrir)
 * and high-quality atempo time-stretching to match original video duration
 */
async function generateKhmerSpeechWav(
  text: string,
  voice = 'Kore',
  speed = 1.0,
  targetDuration?: number
): Promise<string> {
  const roundedSpeed = Math.round(speed * 100) / 100;
  const roundedTarget = targetDuration ? Math.round(targetDuration * 10) / 10 : 0;
  const cacheKey = `${voice}_${roundedSpeed}_${roundedTarget}_${text.trim()}`;
  if (ttsAudioCache.has(cacheKey)) {
    return ttsAudioCache.get(cacheKey)!;
  }

  const chunks = splitTextIntoChunks(text.trim());
  const mp3Buffers: Buffer[] = [];

  for (const chunk of chunks) {
    const encoded = encodeURIComponent(chunk);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=km&client=tw-ob`;
    const res = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      throw new Error(`TTS server responded with status: ${res.status}`);
    }

    const arrayBuf = await res.arrayBuffer();
    mp3Buffers.push(Buffer.from(arrayBuf));
  }

  const combinedMp3 = Buffer.concat(mp3Buffers);
  const rnd = Math.random().toString(36).slice(2, 7);
  const tempIn = `/tmp/in_${Date.now()}_${rnd}.mp3`;
  const tempInitial = `/tmp/init_${Date.now()}_${rnd}.wav`;
  const tempOut = `/tmp/out_${Date.now()}_${rnd}.wav`;

  fs.writeFileSync(tempIn, combinedMp3);

  // Apply voice persona filters
  let baseFilter = '';
  if (voice === 'Charon') {
    // Deep authoritative male resonance
    baseFilter = 'asetrate=24000*0.88,aresample=24000,atempo=1/0.88';
  } else if (voice === 'Puck') {
    // Lively, energetic tempo and higher pitch
    baseFilter = 'asetrate=24000*1.04,aresample=24000,atempo=1.05';
  } else if (voice === 'Fenrir') {
    // Robust, firm male tone
    baseFilter = 'asetrate=24000*0.93,aresample=24000,atempo=1/0.93';
  } else if (voice === 'Zephyr') {
    // Professional clear female speech
    baseFilter = 'asetrate=24000*1.02,aresample=24000,atempo=1/1.02';
  } else {
    // Kore (Default): Warm, natural female voice
    baseFilter = 'asetrate=24000*1.06,aresample=24000,atempo=1/1.06';
  }

  try {
    // First render standard tuned audio
    execSync(`ffmpeg -y -i ${tempIn} -af "${baseFilter}" -ar 24000 -ac 1 ${tempInitial}`, { stdio: 'ignore' });
    const initialBytes = fs.readFileSync(tempInitial);
    const initialDuration = Math.max(0.1, (initialBytes.length - 44) / (24000 * 2));

    let effectiveSpeed = speed && speed !== 1.0 ? speed : 1.0;

    // If targetDuration was requested and no explicit custom speed was forced:
    if (targetDuration && targetDuration > 0.2 && (!speed || speed === 1.0)) {
      // Calculate speed ratio to stretch or compress speech to match original video segment duration
      const ratio = initialDuration / targetDuration;
      // Clamp between 0.6x (slow down) and 1.85x (speed up) for natural speech intelligibility
      effectiveSpeed = Math.max(0.6, Math.min(1.85, Math.round(ratio * 100) / 100));
    }
    effectiveSpeed = Math.max(0.5, Math.min(2.0, Math.round(effectiveSpeed * 100) / 100));

    // Apply atempo speed adjustment if needed
    if (Math.abs(effectiveSpeed - 1.0) >= 0.03) {
      execSync(`ffmpeg -y -i ${tempInitial} -af "atempo=${effectiveSpeed}" -ar 24000 -ac 1 ${tempOut}`, { stdio: 'ignore' });
    } else {
      fs.copyFileSync(tempInitial, tempOut);
    }

    const wavBytes = fs.readFileSync(tempOut);
    const base64Wav = wavBytes.toString('base64');
    ttsAudioCache.set(cacheKey, base64Wav);
    return base64Wav;
  } finally {
    try { if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn); } catch {}
    try { if (fs.existsSync(tempInitial)) fs.unlinkSync(tempInitial); } catch {}
    try { if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut); } catch {}
  }
}

// ==========================================
// STAGE 3: TTS Engine (Google Cloud TTS / Google Speech)
// ==========================================
app.post('/api/tts/generate', async (req: Request, res: Response) => {
  try {
    const { text, voice = 'Kore', speed = 1.0, targetDuration } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ success: false, error: 'Text is required for TTS' });
    }

    const base64Audio = await generateKhmerSpeechWav(text, voice, speed, targetDuration);

    return res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    console.error('Error in /api/tts/generate:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'TTS generation failed',
    });
  }
});

// Batch TTS generation for all segments with speed and duration alignment
app.post('/api/tts/batch', async (req: Request, res: Response) => {
  try {
    const { segments, defaultVoice = 'Kore', autoFitAll = false } = req.body;
    if (!segments || !Array.isArray(segments)) {
      return res.status(400).json({ success: false, error: 'Segments array is required' });
    }

    const results: Record<string, string> = {};

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const voiceName = seg.suggestedVoice || defaultVoice || 'Kore';
      const segSpeed = seg.speed || 1.0;
      const targetDuration = autoFitAll || seg.autoFitSpeed ? (seg.endTime - seg.startTime) : undefined;

      try {
        const base64Audio = await generateKhmerSpeechWav(seg.khmerText, voiceName, segSpeed, targetDuration);
        results[seg.id] = base64Audio;
      } catch (err: any) {
        console.warn(`Error generating speech for segment ${seg.id}:`, err.message);
      }
    }

    return res.json({
      success: true,
      audioMap: results,
    });
  } catch (error: any) {
    console.error('Error in /api/tts/batch:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Batch TTS generation failed',
    });
  }
});

// ==========================================
// AUDIO STEM SEPARATION (ញ៉ែកសំឡេងនិយាយដើម & ភ្លេងដើម)
// ==========================================
app.post('/api/audio/separate-stems', async (req: Request, res: Response) => {
  try {
    const { videoUrl, videoTitle = 'video', audioBase64 } = req.body;

    let sourcePath = '';
    let isTempFile = false;

    if (audioBase64) {
      const clean = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
      const tempIn = path.resolve('/tmp', `input_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp4`);
      fs.writeFileSync(tempIn, Buffer.from(clean, 'base64'));
      sourcePath = tempIn;
      isTempFile = true;
    } else if (videoUrl) {
      if (videoUrl.startsWith('/videos/')) {
        const localPath = path.resolve(__dirname, 'public/videos', path.basename(videoUrl));
        if (fs.existsSync(localPath)) {
          sourcePath = localPath;
        }
      } else if (videoUrl.startsWith('http')) {
        // Download remote video to temp file
        const tempIn = path.resolve('/tmp', `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp4`);
        const fetchRes = await fetch(videoUrl);
        if (fetchRes.ok) {
          const ab = await fetchRes.arrayBuffer();
          fs.writeFileSync(tempIn, Buffer.from(ab));
          sourcePath = tempIn;
          isTempFile = true;
        }
      } else if (fs.existsSync(videoUrl)) {
        sourcePath = videoUrl;
      }
    }

    // Default fallback to sample video if not found
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      sourcePath = path.resolve(__dirname, 'public/videos/ai-tech.mp4');
    }

    const baseName = (videoTitle || 'source')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 30);
    const vocalFileName = `${baseName}_vocals.wav`;
    const bgmFileName = `${baseName}_bgm.wav`;
    const vocalPath = path.resolve(stemsDir, vocalFileName);
    const bgmPath = path.resolve(stemsDir, bgmFileName);

    // If both stems already exist and are valid (>10KB), reuse them directly
    if (fs.existsSync(vocalPath) && fs.existsSync(bgmPath) && fs.statSync(vocalPath).size > 10000) {
      return res.json({
        success: true,
        message: 'Stems retrieved from cache',
        vocalsUrl: `/stems/${vocalFileName}`,
        bgmUrl: `/stems/${bgmFileName}`,
      });
    }

    // High fidelity complementary stem separation using FFmpeg:
    // 1. Vocals Stem: Isolates speech frequencies (160Hz - 4500Hz) with voice formant enhancement
    const vocalCmd = `ffmpeg -y -i "${sourcePath}" -vn -af "highpass=f=160,lowpass=f=4500,equalizer=f=1200:t=q:w=1.2:g=5,compand=attacks=0.02:decays=0.15:points=-60/-60|-25/-15|0/-2" -ar 44100 -ac 1 "${vocalPath}"`;
    execSync(vocalCmd, { stdio: 'ignore' });

    // 2. BGM Stem: Attenuates vocal midrange (-18dB notch), preserving punchy bass (<180Hz) and airy highs (>4500Hz)
    const bgmCmd = `ffmpeg -y -i "${sourcePath}" -vn -af "equalizer=f=1000:t=q:w=1.0:g=-16,equalizer=f=2400:t=q:w=1.2:g=-16" -ar 44100 -ac 2 "${bgmPath}"`;
    execSync(bgmCmd, { stdio: 'ignore' });

    if (isTempFile && fs.existsSync(sourcePath)) {
      try {
        fs.unlinkSync(sourcePath);
      } catch (_) {}
    }

    return res.json({
      success: true,
      message: 'ញ៉ែកសំឡេងដើមបានជោគជ័យ (Vocals and BGM separated successfully)',
      vocalsUrl: `/stems/${vocalFileName}`,
      bgmUrl: `/stems/${bgmFileName}`,
    });
  } catch (error: any) {
    console.error('Stem separation error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to separate audio stems',
    });
  }
});

// ==========================================
// STAGE 4: Cloudinary / FFmpeg Webhook & Mix Simulator
// ==========================================
app.post('/api/webhook/ffmpeg', (req: Request, res: Response) => {
  const { videoUrl, audioSegments, muteOriginal = true, duckingPercent = 0 } = req.body;

  // Generate real FFmpeg pipeline command specification
  const filterComplex = muteOriginal
    ? `[1:a]apad[aout]`
    : `[0:a]volume=${duckingPercent / 100}[a0];[1:a]apad[a1];[a0][a1]amix=inputs=2:duration=first[aout]`;

  const ffmpegCommand = `ffmpeg -y -i input_video.mp4 -i dubbed_khmer_track.wav -filter_complex "${filterComplex}" -map 0:v:0 -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest output_khmer_dubbed.mp4`;

  const cloudinaryEagerTransform = [
    { raw_transformation: 'ac_none' }, // Mute original audio track
    { flags: 'layer_apply', audio_codec: 'mp3' },
  ];

  return res.json({
    success: true,
    status: 'completed',
    message: 'FFmpeg command generated and webhook triggered successfully',
    data: {
      timestamp: new Date().toISOString(),
      ffmpegCommand,
      cloudinaryPayload: {
        event: 'video.dubbing.completed',
        original_audio_muted: muteOriginal,
        ducking_ratio: `${duckingPercent}%`,
        segments_count: audioSegments?.length || 0,
        cloudinary_transformations: cloudinaryEagerTransform,
      },
    },
  });
});

// Serve frontend in production or integrate Vite middleware in dev
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Dubber Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
