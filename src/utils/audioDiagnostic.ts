/**
 * Audio Diagnostic Utility
 * Inspects audio Blobs/base64 returned from the TTS engine to verify format,
 * sample rate, channels, bit depth, duration, and signal amplitude.
 */

export interface AudioDiagnosticResult {
  isValid: boolean;
  sampleRate: number;
  duration: number; // in seconds
  channels: number;
  bitDepth: number;
  fileSizeBytes: number;
  format: string;
  peakAmplitude: number; // 0.0 to 1.0
  rmsVolumeDb: number;   // dBFS (e.g. -14 dB)
  isSilent: boolean;
  warnings: string[];
  errors: string[];
  timestamp: string;
}

/**
 * Parse RIFF / WAVE header directly from ArrayBuffer
 */
export function parseWavHeader(buffer: ArrayBuffer): {
  isWav: boolean;
  channels: number;
  sampleRate: number;
  bitDepth: number;
  dataLength: number;
  estimatedDuration: number;
} | null {
  if (buffer.byteLength < 44) return null;

  const view = new DataView(buffer);

  // Check "RIFF" and "WAVE"
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));

  if (riff !== 'RIFF' || wave !== 'WAVE') {
    return null;
  }

  // Find "fmt " subchunk
  let offset = 12;
  let channels = 1;
  let sampleRate = 24000;
  let bitDepth = 16;
  let dataLength = 0;

  while (offset + 8 <= buffer.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitDepth = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataLength = chunkSize;
    }

    offset += 8 + chunkSize;
  }

  const bytesPerSample = (bitDepth / 8) * channels;
  const estimatedDuration = bytesPerSample > 0 && sampleRate > 0 ? (dataLength || buffer.byteLength - 44) / (sampleRate * bytesPerSample) : 0;

  return {
    isWav: true,
    channels,
    sampleRate,
    bitDepth,
    dataLength: dataLength || buffer.byteLength - 44,
    estimatedDuration: Math.max(0, estimatedDuration),
  };
}

/**
 * Run full diagnostic on an audio Blob
 */
export async function diagnoseAudioBlob(blob: Blob): Promise<AudioDiagnosticResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fileSizeBytes = blob.size;

  if (fileSizeBytes === 0) {
    return {
      isValid: false,
      sampleRate: 0,
      duration: 0,
      channels: 0,
      bitDepth: 0,
      fileSizeBytes: 0,
      format: 'Unknown',
      peakAmplitude: 0,
      rmsVolumeDb: -Infinity,
      isSilent: true,
      warnings: [],
      errors: ['File size is 0 bytes (empty audio payload)'],
      timestamp: new Date().toISOString(),
    };
  }

  const arrayBuffer = await blob.arrayBuffer();
  const headerInfo = parseWavHeader(arrayBuffer);

  let sampleRate = headerInfo?.sampleRate || 24000;
  let channels = headerInfo?.channels || 1;
  let bitDepth = headerInfo?.bitDepth || 16;
  let duration = headerInfo?.estimatedDuration || 0;
  let format = headerInfo?.isWav ? 'RIFF/WAVE PCM' : blob.type || 'audio/wav';

  let peakAmplitude = 0;
  let rmsVolumeDb = -Infinity;
  let isSilent = false;

  // Use AudioContext to decode and measure signal properties
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const audioContext = new AudioCtx();
      const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

      duration = decodedBuffer.duration;
      sampleRate = decodedBuffer.sampleRate;
      channels = decodedBuffer.numberOfChannels;

      // Inspect audio samples for peak & RMS volume
      const channelData = decodedBuffer.getChannelData(0);
      let sumSquares = 0;

      for (let i = 0; i < channelData.length; i++) {
        const absVal = Math.abs(channelData[i]);
        if (absVal > peakAmplitude) {
          peakAmplitude = absVal;
        }
        sumSquares += channelData[i] * channelData[i];
      }

      const rms = Math.sqrt(sumSquares / (channelData.length || 1));
      rmsVolumeDb = rms > 0 ? Math.round(20 * Math.log10(rms)) : -100;
      isSilent = peakAmplitude < 0.005;

      await audioContext.close();
    }
  } catch (decodeErr: any) {
    warnings.push(`Web Audio decoder notice: ${decodeErr.message}`);
  }

  // Validate Sample Rate
  if (sampleRate < 8000 || sampleRate > 96000) {
    errors.push(`Invalid sample rate: ${sampleRate}Hz (expected between 8,000Hz and 48,000Hz)`);
  } else if (sampleRate !== 24000 && sampleRate !== 44100 && sampleRate !== 48000 && sampleRate !== 16000) {
    warnings.push(`Non-standard sample rate detected: ${sampleRate}Hz`);
  }

  // Validate Duration
  if (duration <= 0.05) {
    errors.push(`Invalid duration: ${duration.toFixed(2)}s (audio is too short or empty)`);
  } else if (duration > 60) {
    warnings.push(`Segment duration is unusually long: ${duration.toFixed(1)}s`);
  }

  // Validate Audio Content
  if (isSilent) {
    errors.push('Audio is completely silent (peak amplitude < 0.005)');
  } else if (rmsVolumeDb < -45) {
    warnings.push(`Audio signal level is very low (${rmsVolumeDb} dB)`);
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    sampleRate,
    duration: Number(duration.toFixed(2)),
    channels,
    bitDepth,
    fileSizeBytes,
    format,
    peakAmplitude: Number(peakAmplitude.toFixed(3)),
    rmsVolumeDb,
    isSilent,
    warnings,
    errors,
    timestamp: new Date().toLocaleTimeString(),
  };
}

/**
 * Quick base64 diagnostic helper
 */
export async function diagnoseBase64Audio(base64: string, mimeType = 'audio/wav'): Promise<AudioDiagnosticResult> {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return diagnoseAudioBlob(blob);
}
