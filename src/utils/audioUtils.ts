import { DubbingSegment } from '../types/dubber';

/**
 * Format seconds into mm:ss.ms string
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}

/**
 * Convert base64 string to a Blob URL
 */
export function base64ToBlobUrl(base64: string, mimeType = 'audio/wav'): string {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteCharacters = atob(clean);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Extract audio track from a user-uploaded video file and downsample to 16kHz mono WAV for fast Gemini API ingestion
 */
export async function extractAudioFromVideoFile(file: File): Promise<{ base64: string; mimeType: string; duration: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Decode audio data from video container
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const duration = audioBuffer.duration;

  // Resample to 16kHz mono for optimal Gemini speech recognition and speed
  const targetSampleRate = 16000;
  const offlineContext = new OfflineAudioContext(1, Math.min(targetSampleRate * 120, Math.ceil(duration * targetSampleRate)), targetSampleRate);
  
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  const renderedBuffer = await offlineContext.startRendering();
  await audioContext.close();

  // Encode to 16-bit PCM WAV
  const wavBytes = encodeWAV(renderedBuffer);
  const base64 = uint8ArrayToBase64(wavBytes);

  return {
    base64,
    mimeType: 'audio/wav',
    duration,
  };
}

/**
 * Encode an AudioBuffer into 16-bit PCM WAV format
 */
export function encodeWAV(buffer: AudioBuffer): Uint8Array {
  const numChannels = 1; // mono
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const channelData = buffer.getChannelData(0);
  const numSamples = channelData.length;
  const blockAlign = numChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * (bitDepth / 8);
  const bufferLength = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // Write RIFF Header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk1size (16 for PCM)
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM Samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    // Clamp sample between -1 and 1
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(arrayBuffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Generate standard SRT subtitle content with Khmer translation
 */
export function generateSrtContent(segments: DubbingSegment[]): string {
  return segments
    .map((seg, idx) => {
      const sH = Math.floor(seg.startTime / 3600).toString().padStart(2, '0');
      const sM = Math.floor((seg.startTime % 3600) / 60).toString().padStart(2, '0');
      const sS = Math.floor(seg.startTime % 60).toString().padStart(2, '0');
      const sMs = Math.floor((seg.startTime % 1) * 1000).toString().padStart(3, '0');

      const eH = Math.floor(seg.endTime / 3600).toString().padStart(2, '0');
      const eM = Math.floor((seg.endTime % 3600) / 60).toString().padStart(2, '0');
      const eS = Math.floor(seg.endTime % 60).toString().padStart(2, '0');
      const eMs = Math.floor((seg.endTime % 1) * 1000).toString().padStart(3, '0');

      return `${idx + 1}\n${sH}:${sM}:${sS},${sMs} --> ${eH}:${eM}:${eS},${eMs}\n${seg.khmerText}\n`;
    })
    .join('\n');
}

/**
 * Trigger file download in browser
 */
export function downloadFile(content: Blob | string, filename: string, mimeType = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Detailed timing sync analysis comparing video segment duration vs spoken audio duration
 */
export interface TimingAnalysis {
  targetDuration: number;
  audioDuration: number;
  diff: number; // audioDuration - targetDuration (positive = audio is longer, needs speed up)
  ratio: number; // audioDuration / targetDuration
  recommendedSpeed: number; // clamped to [0.5, 2.0]
  status: 'in_sync' | 'too_long' | 'too_short' | 'no_audio';
}

export function analyzeSegmentTiming(seg: DubbingSegment): TimingAnalysis {
  const targetDuration = Math.max(0.2, Number((seg.endTime - seg.startTime).toFixed(2)));
  const audioDuration = Number((seg.audioDuration || seg.diagnostic?.duration || 0).toFixed(2));
  if (!audioDuration) {
    return {
      targetDuration,
      audioDuration: 0,
      diff: 0,
      ratio: 1.0,
      recommendedSpeed: 1.0,
      status: 'no_audio',
    };
  }
  const diff = Number((audioDuration - targetDuration).toFixed(2));
  const ratio = audioDuration / targetDuration;
  const recommendedSpeed = Math.max(0.6, Math.min(1.85, Math.round(ratio * 100) / 100));
  let status: 'in_sync' | 'too_long' | 'too_short' = 'in_sync';
  if (diff > 0.25) {
    status = 'too_long'; // Spoken audio is longer than video segment, needs speeding up
  } else if (diff < -0.3) {
    status = 'too_short'; // Spoken audio finishes earlier, can be slowed down
  }
  return {
    targetDuration,
    audioDuration,
    diff,
    ratio,
    recommendedSpeed,
    status,
  };
}

/**
 * Assemble all generated Khmer audio clips into one continuous full-length WAV audio track
 */
export async function assembleCompleteDubbedAudioTrack(
  segments: DubbingSegment[],
  totalDuration: number
): Promise<{ blob: Blob; url: string }> {
  const sampleRate = 24000;
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
  const finalDuration = Math.max(totalDuration, segments.length > 0 ? segments[segments.length - 1].endTime + 1 : 10);
  const offlineContext = new OfflineAudioContext(1, Math.ceil(finalDuration * sampleRate), sampleRate);

  for (const seg of segments) {
    if (!seg.audioBase64) continue;
    try {
      const clean = seg.audioBase64.includes(',') ? seg.audioBase64.split(',')[1] : seg.audioBase64;
      const bin = atob(clean);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const decodedBuffer = await audioContext.decodeAudioData(bytes.buffer);

      const source = offlineContext.createBufferSource();
      source.buffer = decodedBuffer;
      const relativeRate = (seg.speed || 1.0) / (seg.appliedSpeed || 1.0);
      if (Math.abs(relativeRate - 1.0) > 0.01) {
        source.playbackRate.value = relativeRate;
      }
      source.connect(offlineContext.destination);
      source.start(seg.startTime);
    } catch (e) {
      console.warn(`Could not decode audio for segment ${seg.id}:`, e);
    }
  }

  const renderedBuffer = await offlineContext.startRendering();
  await audioContext.close();

  const wavBytes = encodeWAV(renderedBuffer);
  const blob = new Blob([wavBytes as any], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  return { blob, url };
}
