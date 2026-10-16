import { DubbingSegment, AudioMixingOptions } from '../types/dubber';

export interface RenderProgress {
  progress: number; // 0 to 100
  currentTime: number;
  totalDuration: number;
  status: 'initializing' | 'rendering' | 'finalizing' | 'completed' | 'error';
  errorMessage?: string;
}

/**
 * Render and export dubbed video with original audio muted and Khmer audio mixed
 */
export async function renderDubbedVideo(
  videoElement: HTMLVideoElement,
  segments: DubbingSegment[],
  options: AudioMixingOptions,
  onProgress: (progress: RenderProgress) => void
): Promise<{ videoBlob: Blob; downloadUrl: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      onProgress({
        progress: 5,
        currentTime: 0,
        totalDuration: videoElement.duration || 10,
        status: 'initializing',
      });

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const destination = audioContext.createMediaStreamDestination();

      // Stem separation audio handling: Pre-fetch and decode isolated stems if available
      let bgmBuffer: AudioBuffer | null = null;
      let vocalsBuffer: AudioBuffer | null = null;

      if (options.bgmUrl && !options.muteOriginalBgm && (options.originalBgmVolume ?? 0.25) > 0) {
        try {
          const bgmRes = await fetch(options.bgmUrl);
          const bgmArrayBuf = await bgmRes.arrayBuffer();
          bgmBuffer = await audioContext.decodeAudioData(bgmArrayBuf);
        } catch (e) {
          console.warn('Could not decode BGM stem for mixing:', e);
        }
      }

      if (options.vocalsUrl && !options.muteOriginalVocal && (options.originalVocalVolume ?? 0.0) > 0) {
        try {
          const vocRes = await fetch(options.vocalsUrl);
          const vocArrayBuf = await vocRes.arrayBuffer();
          vocalsBuffer = await audioContext.decodeAudioData(vocArrayBuf);
        } catch (e) {
          console.warn('Could not decode Vocal stem for mixing:', e);
        }
      }

      // If stems are not separated, handle original video audio track
      if (!bgmBuffer && !vocalsBuffer) {
        let originalSourceNode: MediaElementAudioSourceNode | null = null;
        let originalGainNode: GainNode | null = null;

        try {
          originalSourceNode = audioContext.createMediaElementSource(videoElement);
          originalGainNode = audioContext.createGain();
          const effectiveOriginalVol = options.muteOriginal || options.muteOriginalVocal
            ? (options.muteOriginalBgm ? 0 : (options.originalBgmVolume ?? options.duckingVolume ?? 0.15))
            : (options.originalVocalVolume ?? 1.0);
          originalGainNode.gain.value = effectiveOriginalVol;
          originalSourceNode.connect(originalGainNode);
          originalGainNode.connect(destination);
        } catch (err) {
          console.warn('Original audio capture notice:', err);
        }
      }

      // Decode all Khmer audio segments into memory AudioBuffers
      const decodedSegments: Array<{ startTime: number; buffer: AudioBuffer; playbackRate: number }> = [];
      for (const seg of segments) {
        if (!seg.audioBase64) continue;
        try {
          const clean = seg.audioBase64.includes(',') ? seg.audioBase64.split(',')[1] : seg.audioBase64;
          const bin = atob(clean);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const buffer = await audioContext.decodeAudioData(bytes.buffer);
          const relativeRate = (seg.speed || 1.0) / (seg.appliedSpeed || 1.0);
          decodedSegments.push({ startTime: seg.startTime, buffer, playbackRate: relativeRate });
        } catch (e) {
          console.warn(`Could not prepare audio for seg ${seg.id}:`, e);
        }
      }

      // Set up canvas for video frame capture and optional burned-in Khmer subtitles
      const canvas = document.createElement('canvas');
      const width = videoElement.videoWidth || 1280;
      const height = videoElement.videoHeight || 720;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Could not get canvas context');

      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      // Detect supported mimeType
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      const selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: selectedMime,
        videoBitsPerSecond: 3000000, // 3 Mbps
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: selectedMime });
        const downloadUrl = URL.createObjectURL(finalBlob);
        onProgress({
          progress: 100,
          currentTime: videoElement.duration,
          totalDuration: videoElement.duration,
          status: 'completed',
        });
        audioContext.close();
        resolve({ videoBlob: finalBlob, downloadUrl });
      };

      // Rewind video to beginning
      videoElement.currentTime = 0;
      await new Promise((r) => {
        videoElement.onseeked = r;
      });

      mediaRecorder.start(200);

      // Start stem audio scheduling if present
      const audioStartContextTime = audioContext.currentTime;

      if (bgmBuffer) {
        const bgmSource = audioContext.createBufferSource();
        bgmSource.buffer = bgmBuffer;
        const bgmGain = audioContext.createGain();
        bgmGain.gain.value = options.muteOriginalBgm ? 0 : (options.originalBgmVolume ?? 0.25);
        bgmSource.connect(bgmGain);
        bgmGain.connect(destination);
        bgmSource.start(audioStartContextTime);
      }

      if (vocalsBuffer) {
        const vocSource = audioContext.createBufferSource();
        vocSource.buffer = vocalsBuffer;
        const vocGain = audioContext.createGain();
        vocGain.gain.value = options.muteOriginalVocal ? 0 : (options.originalVocalVolume ?? 0.0);
        vocSource.connect(vocGain);
        vocGain.connect(destination);
        vocSource.start(audioStartContextTime);
      }

      // Start Khmer dubbed audio scheduling
      for (const item of decodedSegments) {
        const sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = item.buffer;
        if (Math.abs(item.playbackRate - 1.0) > 0.01) {
          sourceNode.playbackRate.value = item.playbackRate;
        }
        const gainNode = audioContext.createGain();
        gainNode.gain.value = options.dubbedVolume;
        sourceNode.connect(gainNode);
        gainNode.connect(destination);
        sourceNode.start(audioStartContextTime + item.startTime);
      }

      const totalDuration = videoElement.duration || 10;
      let isRendering = true;

      const drawFrame = () => {
        if (!isRendering) return;

        // Draw current video frame
        ctx.drawImage(videoElement, 0, 0, width, height);

        // Burn Khmer subtitles if enabled
        if (options.burnSubtitles) {
          const currentTime = videoElement.currentTime;
          const currentSeg = segments.find(
            (s) => currentTime >= s.startTime && currentTime <= s.endTime
          );

          if (currentSeg && currentSeg.khmerText) {
            const fontSize = Math.max(24, Math.floor(height * 0.045));
            ctx.font = `600 ${fontSize}px 'Kantumruy Pro', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            const text = currentSeg.khmerText;
            const textMetrics = ctx.measureText(text);
            const paddingX = 24;
            const paddingY = 12;
            const boxWidth = textMetrics.width + paddingX * 2;
            const boxHeight = fontSize * 1.5 + paddingY;
            const posX = width / 2;
            const posY = height - 50;

            // Semi-transparent rounded backdrop
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.beginPath();
            ctx.roundRect(posX - boxWidth / 2, posY - boxHeight + 4, boxWidth, boxHeight, 8);
            ctx.fill();

            // Subtitle text with subtle shadow
            ctx.fillStyle = options.subtitleColor || '#FFFFFF';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(text, posX, posY - paddingY / 2);
            ctx.shadowBlur = 0;
          }
        }

        const pct = Math.min(98, Math.round((videoElement.currentTime / totalDuration) * 100));
        onProgress({
          progress: pct,
          currentTime: videoElement.currentTime,
          totalDuration,
          status: 'rendering',
        });

        if (videoElement.currentTime < totalDuration && !videoElement.ended) {
          requestAnimationFrame(drawFrame);
        }
      };

      videoElement.play();
      requestAnimationFrame(drawFrame);

      videoElement.onended = () => {
        isRendering = false;
        onProgress({
          progress: 99,
          currentTime: totalDuration,
          totalDuration,
          status: 'finalizing',
        });
        setTimeout(() => {
          mediaRecorder.stop();
        }, 500);
      };
    } catch (err: any) {
      console.error('Rendering error:', err);
      onProgress({
        progress: 0,
        currentTime: 0,
        totalDuration: 0,
        status: 'error',
        errorMessage: err.message || 'Error occurred during video rendering',
      });
      reject(err);
    }
  });
}
