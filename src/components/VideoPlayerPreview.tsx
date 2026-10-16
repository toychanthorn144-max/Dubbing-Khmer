import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  RotateCcw,
  Sparkles,
  Subtitles,
  Headphones,
  Sliders,
  Zap,
  Mic2,
  Music,
  CheckCircle2,
  Layers,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DubbingSegment, AudioMixingOptions } from '../types/dubber';
import { formatTime } from '../utils/audioUtils';

interface VideoPlayerPreviewProps {
  videoUrl: string;
  videoTitle: string;
  segments: DubbingSegment[];
  activeSegmentId?: string | null;
  onSelectSegment?: (segmentId: string) => void;
  mixingOptions: AudioMixingOptions;
  onUpdateMixingOptions: (options: Partial<AudioMixingOptions>) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onSeparateStems?: () => Promise<void>;
}

export const VideoPlayerPreview: React.FC<VideoPlayerPreviewProps> = ({
  videoUrl,
  videoTitle,
  segments,
  activeSegmentId,
  onSelectSegment,
  mixingOptions,
  onUpdateMixingOptions,
  videoRef,
  onSeparateStems,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [showStemMixer, setShowStemMixer] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState<{ text: string; speed?: number } | null>(null);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);

  // Direct DOM references for 60fps buttery-smooth timeline updates without React re-render thrashing
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const currentTimeDisplayRef = useRef<HTMLSpanElement | null>(null);
  const scrubInputRef = useRef<HTMLInputElement | null>(null);

  // Stem Audio Elements for Isolated Vocals & BGM
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const vocalAudioRef = useRef<HTMLAudioElement | null>(null);

  // Audio elements pool for synchronized Khmer TTS playback
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioPoolRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const playedSegmentIdsRef = useRef<Set<string>>(new Set());
  const currentSubtitleIdRef = useRef<string | null>(null);

  // Animation frame request ID for smooth frame loop
  const rafIdRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const lastScrubUpdateRef = useRef(0);

  // Resolve stem URLs if available or auto-match sample video stems
  const effectiveBgmUrl =
    mixingOptions.bgmUrl ||
    (videoUrl.includes('ai-tech')
      ? '/stems/ai-tech_bgm.wav'
      : videoUrl.includes('coffee-craft')
      ? '/stems/coffee-craft_bgm.wav'
      : videoUrl.includes('nature-ocean')
      ? '/stems/nature-ocean_bgm.wav'
      : undefined);

  const effectiveVocalUrl =
    mixingOptions.vocalsUrl ||
    (videoUrl.includes('ai-tech')
      ? '/stems/ai-tech_vocals.wav'
      : videoUrl.includes('coffee-craft')
      ? '/stems/coffee-craft_vocals.wav'
      : videoUrl.includes('nature-ocean')
      ? '/stems/nature-ocean_vocals.wav'
      : undefined);

  const hasStems = Boolean(effectiveBgmUrl || effectiveVocalUrl);

  // Initialize and keep Stem Audio elements synced with mixing options
  useEffect(() => {
    if (effectiveBgmUrl) {
      if (!bgmAudioRef.current || bgmAudioRef.current.src !== effectiveBgmUrl) {
        bgmAudioRef.current = new Audio(effectiveBgmUrl);
        bgmAudioRef.current.preload = 'auto';
      }
      bgmAudioRef.current.volume = mixingOptions.muteOriginalBgm
        ? 0
        : Math.max(0, Math.min(1, mixingOptions.originalBgmVolume ?? 0.25));
    } else {
      bgmAudioRef.current = null;
    }

    if (effectiveVocalUrl) {
      if (!vocalAudioRef.current || vocalAudioRef.current.src !== effectiveVocalUrl) {
        vocalAudioRef.current = new Audio(effectiveVocalUrl);
        vocalAudioRef.current.preload = 'auto';
      }
      vocalAudioRef.current.volume = mixingOptions.muteOriginalVocal
        ? 0
        : Math.max(0, Math.min(1, mixingOptions.originalVocalVolume ?? 0.0));
    } else {
      vocalAudioRef.current = null;
    }

    // When stems are active, mute the video element's raw audio to avoid doubling
    if (videoRef.current) {
      if (hasStems) {
        videoRef.current.muted = true;
        videoRef.current.volume = 0;
      } else {
        // Fallback if stems are not separated yet
        const shouldMute = mixingOptions.muteOriginal || mixingOptions.muteOriginalVocal;
        videoRef.current.muted = shouldMute;
        videoRef.current.volume = shouldMute
          ? (mixingOptions.muteOriginalBgm ? 0 : (mixingOptions.originalBgmVolume ?? 0.15))
          : (mixingOptions.originalVocalVolume ?? 1.0);
      }
    }
  }, [
    effectiveBgmUrl,
    effectiveVocalUrl,
    mixingOptions.muteOriginalBgm,
    mixingOptions.originalBgmVolume,
    mixingOptions.muteOriginalVocal,
    mixingOptions.originalVocalVolume,
    mixingOptions.muteOriginal,
    hasStems,
    videoRef,
  ]);

  // Pre-load and pool Khmer audio objects so playback never hitches on the main thread
  useEffect(() => {
    const pool = audioPoolRef.current;
    segments.forEach((seg) => {
      if (seg.audioUrl) {
        let audio = pool.get(seg.id);
        if (!audio || audio.src !== seg.audioUrl) {
          audio = new Audio(seg.audioUrl);
          audio.preload = 'auto';
          pool.set(seg.id, audio);
        }
        audio.volume = Math.max(0, Math.min(1.0, mixingOptions.dubbedVolume));
        const relativeRate = (seg.speed || 1.0) / (seg.appliedSpeed || 1.0);
        if (relativeRate > 0 && Math.abs(relativeRate - 1.0) > 0.01) {
          audio.playbackRate = Math.max(0.5, Math.min(2.0, relativeRate));
          (audio as any).preservesPitch = true;
        } else {
          audio.playbackRate = 1.0;
        }
      }
    });

    // Cleanup unneeded audio elements
    const validIds = new Set(segments.map((s) => s.id));
    for (const [id, audio] of pool.entries()) {
      if (!validIds.has(id)) {
        audio.pause();
        pool.delete(id);
      }
    }
  }, [segments, mixingOptions.dubbedVolume]);

  // Handle video metadata loaded
  const handleLoadedMetadata = () => {
    setVideoLoadError(null);
    if (videoRef.current) {
      const dur = videoRef.current.duration || 0;
      setDuration(dur);
      if (currentTimeDisplayRef.current) {
        currentTimeDisplayRef.current.textContent = formatTime(0);
      }
    }
  };

  const handleVideoError = () => {
    console.warn('Video element reported error for source:', videoUrl);
    setVideoLoadError('មិនអាចផ្ទុកវីដេអូបានទេ។ សូមចុច "ផ្ទុកវីដេអូឡើងវិញ" ឬជ្រើសរើសវីដេអូគំរូ។');
  };

  // Safe and smooth toggle play/pause avoiding browser AbortError interruptions
  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        playPromiseRef.current = video.play();
        await playPromiseRef.current;
        isPlayingRef.current = true;
        setIsPlaying(true);

        // Synchronously play separated stems
        const curTime = video.currentTime;
        if (bgmAudioRef.current) {
          bgmAudioRef.current.currentTime = curTime;
          bgmAudioRef.current.play().catch(() => {});
        }
        if (vocalAudioRef.current) {
          vocalAudioRef.current.currentTime = curTime;
          vocalAudioRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Video playback notice:', err);
        }
      }
    } else {
      if (playPromiseRef.current) {
        await playPromiseRef.current.catch(() => {});
      }
      video.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);

      if (bgmAudioRef.current) bgmAudioRef.current.pause();
      if (vocalAudioRef.current) vocalAudioRef.current.pause();
      if (activeAudioRef.current) activeAudioRef.current.pause();
    }
  };

  // 60FPS Butter-Smooth Animation Frame Loop (Zero Main-Thread Layout Thrashing)
  useEffect(() => {
    let active = true;

    const renderLoop = () => {
      const video = videoRef.current;
      if (video && !video.paused) {
        const time = video.currentTime;
        const dur = video.duration || duration || 1;

        // 1. Direct hardware-accelerated style update for 60fps progress bar (no layout reflow)
        const pct = (time / dur) * 100;
        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${pct}%`;
        }
        if (currentTimeDisplayRef.current) {
          currentTimeDisplayRef.current.textContent = formatTime(time);
        }

        // Throttle scrub range input updates to 4 times per second to prevent DOM layout recalculation stutter
        const now = performance.now();
        if (now - lastScrubUpdateRef.current > 250) {
          lastScrubUpdateRef.current = now;
          if (scrubInputRef.current) {
            scrubInputRef.current.value = time.toString();
          }
        }

        // 2. Keep BGM and Vocal stems strictly locked to video playhead
        if (bgmAudioRef.current && !bgmAudioRef.current.paused) {
          const diff = Math.abs(bgmAudioRef.current.currentTime - time);
          if (diff > 0.25) {
            bgmAudioRef.current.currentTime = time;
          }
        }
        if (vocalAudioRef.current && !vocalAudioRef.current.paused) {
          const diff = Math.abs(vocalAudioRef.current.currentTime - time);
          if (diff > 0.25) {
            vocalAudioRef.current.currentTime = time;
          }
        }

        // 3. High-precision synchronized Khmer audio triggering
        if (mixingOptions.dubbedVolume > 0.01) {
          for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            if (
              seg.audioUrl &&
              time >= seg.startTime &&
              time < seg.startTime + 0.35 &&
              !playedSegmentIdsRef.current.has(seg.id)
            ) {
              playedSegmentIdsRef.current.add(seg.id);

              if (activeAudioRef.current) {
                activeAudioRef.current.pause();
              }

              const audio = audioPoolRef.current.get(seg.id);
              if (audio) {
                audio.currentTime = 0;
                audio.volume = Math.max(0, Math.min(1.0, mixingOptions.dubbedVolume));
                audio.play().catch((e) => console.warn('Dubbed audio play notice:', e));
                activeAudioRef.current = audio;
              }
            }
          }
        }

        // 4. Update subtitle only when segment ID actually changes
        let foundSeg: DubbingSegment | null = null;
        for (let i = 0; i < segments.length; i++) {
          if (time >= segments[i].startTime && time <= segments[i].endTime) {
            foundSeg = segments[i];
            break;
          }
        }

        const foundId = foundSeg ? foundSeg.id : null;
        if (foundId !== currentSubtitleIdRef.current) {
          currentSubtitleIdRef.current = foundId;
          if (foundSeg) {
            setCurrentSubtitle({ text: foundSeg.khmerText, speed: foundSeg.speed });
          } else {
            setCurrentSubtitle(null);
          }
        }
      }

      if (active) {
        rafIdRef.current = requestAnimationFrame(renderLoop);
      }
    };

    rafIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      active = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [segments, mixingOptions.dubbedVolume, duration, videoRef]);

  // Handle seeking smoothly across video and all audio stems
  const handleSeek = (newTime: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = newTime;
    const dur = video.duration || duration || 1;
    const pct = (newTime / dur) * 100;

    if (progressBarRef.current) {
      progressBarRef.current.style.width = `${pct}%`;
    }
    if (currentTimeDisplayRef.current) {
      currentTimeDisplayRef.current.textContent = formatTime(newTime);
    }
    if (scrubInputRef.current) {
      scrubInputRef.current.value = newTime.toString();
    }

    if (bgmAudioRef.current) bgmAudioRef.current.currentTime = newTime;
    if (vocalAudioRef.current) vocalAudioRef.current.currentTime = newTime;

    // Reset played segment markers
    playedSegmentIdsRef.current = new Set(
      segments.filter((s) => s.startTime < newTime).map((s) => s.id)
    );

    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
  };

  // Restart video from beginning
  const handleRestart = () => {
    handleSeek(0);
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {});
      isPlayingRef.current = true;
      setIsPlaying(true);
      if (bgmAudioRef.current) {
        bgmAudioRef.current.currentTime = 0;
        bgmAudioRef.current.play().catch(() => {});
      }
      if (vocalAudioRef.current) {
        vocalAudioRef.current.currentTime = 0;
        vocalAudioRef.current.play().catch(() => {});
      }
    }
  };

  // Quick Preset Mixers
  const applyPreset = (preset: 'clean_dub' | 'pure_khmer' | 'cinema' | 'original') => {
    if (preset === 'clean_dub') {
      // Mute original vocal 100%, keep natural BGM 20%, Khmer dub 100%
      onUpdateMixingOptions({
        muteOriginal: false,
        muteOriginalVocal: true,
        originalVocalVolume: 0.0,
        muteOriginalBgm: false,
        originalBgmVolume: 0.2,
        duckingVolume: 0.2,
        dubbedVolume: 1.0,
      });
    } else if (preset === 'pure_khmer') {
      // Mute both original speech and BGM
      onUpdateMixingOptions({
        muteOriginal: true,
        muteOriginalVocal: true,
        originalVocalVolume: 0.0,
        muteOriginalBgm: true,
        originalBgmVolume: 0.0,
        duckingVolume: 0.0,
        dubbedVolume: 1.0,
      });
    } else if (preset === 'cinema') {
      // Cinema balance: 35% BGM, muted vocals, 110% Khmer
      onUpdateMixingOptions({
        muteOriginal: false,
        muteOriginalVocal: true,
        originalVocalVolume: 0.0,
        muteOriginalBgm: false,
        originalBgmVolume: 0.35,
        duckingVolume: 0.35,
        dubbedVolume: 1.1,
      });
    } else if (preset === 'original') {
      // Original mix only
      onUpdateMixingOptions({
        muteOriginal: false,
        muteOriginalVocal: false,
        originalVocalVolume: 1.0,
        muteOriginalBgm: false,
        originalBgmVolume: 1.0,
        duckingVolume: 1.0,
        dubbedVolume: 0.0,
      });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      {/* Player Header / Status Bar */}
      <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2 truncate max-w-[50%]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="font-semibold text-slate-200 truncate">{videoTitle || 'វីដេអូសម្រាប់បញ្ចូលសំឡេង'}</span>
          {hasStems && (
            <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold text-teal-300 bg-teal-500/15 border border-teal-500/30 px-1.5 py-0.5 rounded">
              <CheckCircle2 className="w-3 h-3 text-teal-400" />
              Stems ញ៉ែករួច
            </span>
          )}
        </div>

        {/* Stem Quick Presets Bar */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => applyPreset('clean_dub')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
              mixingOptions.muteOriginalVocal && !mixingOptions.muteOriginalBgm
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="បិទសំឡេងនិយាយដើម + រក្សាភ្លេងដើម (Clean Khmer Dub + BGM)"
          >
            <Headphones className="w-3 h-3 text-emerald-300" />
            <span className="hidden sm:inline">បិទសំឡេងនិយាយ + រក្សាភ្លេង</span>
            <span className="sm:hidden">Dub + BGM</span>
          </button>

          <button
            onClick={() => applyPreset('pure_khmer')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
              mixingOptions.muteOriginalVocal && mixingOptions.muteOriginalBgm
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="សំឡេងខ្មែរសុទ្ធ (Pure Khmer Dub, All Original Muted)"
          >
            <Volume2 className="w-3 h-3 text-indigo-300" />
            <span className="hidden sm:inline">សំឡេងខ្មែរសុទ្ធ</span>
            <span className="sm:hidden">ខ្មែរសុទ្ធ</span>
          </button>

          <button
            onClick={() => applyPreset('original')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
              !mixingOptions.muteOriginalVocal && mixingOptions.dubbedVolume === 0
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="ចាក់សំឡេងដើមសុទ្ធ (Original Audio Only)"
          >
            <Volume1 className="w-3 h-3 text-slate-300" />
            <span className="hidden sm:inline">សំឡេងដើម</span>
            <span className="sm:hidden">ដើម</span>
          </button>

          <button
            onClick={() => setShowStemMixer(!showStemMixer)}
            className={`p-1 rounded text-xs transition-colors ${
              showStemMixer ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-white'
            }`}
            title="បើក/បិទ បន្ទះគ្រប់គ្រង Stem សំឡេង (Stem Mixer)"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Video Viewport - Optimized for 60FPS */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleVideoError}
          onPlay={() => {
            isPlayingRef.current = true;
            setIsPlaying(true);
            if (bgmAudioRef.current) bgmAudioRef.current.play().catch(() => {});
            if (vocalAudioRef.current) vocalAudioRef.current.play().catch(() => {});
          }}
          onPause={() => {
            isPlayingRef.current = false;
            setIsPlaying(false);
            if (bgmAudioRef.current) bgmAudioRef.current.pause();
            if (vocalAudioRef.current) vocalAudioRef.current.pause();
            if (activeAudioRef.current) activeAudioRef.current.pause();
          }}
          onWaiting={() => {
            // Pause stems when video buffers to prevent audio drift
            if (bgmAudioRef.current) bgmAudioRef.current.pause();
            if (vocalAudioRef.current) vocalAudioRef.current.pause();
          }}
          onPlaying={() => {
            // Resume stems seamlessly when video playback resumes
            if (bgmAudioRef.current && isPlayingRef.current) bgmAudioRef.current.play().catch(() => {});
            if (vocalAudioRef.current && isPlayingRef.current) vocalAudioRef.current.play().catch(() => {});
          }}
          playsInline
          preload="auto"
          disablePictureInPicture
          style={{ willChange: 'contents' }}
        />

        {/* Video Load Error Fallback Overlay */}
        {videoLoadError && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3 z-30">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <RotateCcw className="w-6 h-6 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-white max-w-sm">
              {videoLoadError}
            </p>
            <button
              onClick={() => {
                setVideoLoadError(null);
                if (videoRef.current) {
                  videoRef.current.src = '/videos/ai-tech.mp4';
                  videoRef.current.load();
                }
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow"
            >
              ប្តូរទៅវីដេអូគំរូក្នុងម៉ាស៊ីន (Local Video)
            </button>
          </div>
        )}

        {/* Big Center Play Overlay Button when paused */}
        {!isPlaying && !videoLoadError && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-xl backdrop-blur-sm transition-transform hover:scale-110 active:scale-95 group-hover:opacity-100 z-20 cursor-pointer"
            title="ចុចដើម្បីចាក់វីដេអូ"
          >
            <Play className="w-7 h-7 ml-1 fill-white" />
          </button>
        )}

        {/* Synchronized Khmer Subtitle Overlay with Live Speed Badge */}
        {showSubtitles && currentSubtitle && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 max-w-[85%] text-center pointer-events-none transition-all duration-150 z-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-700/50 shadow-2xl">
              <p className="text-white text-base sm:text-lg md:text-xl font-medium tracking-wide drop-shadow-md">
                {currentSubtitle.text}
              </p>
              {currentSubtitle.speed && currentSubtitle.speed !== 1.0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shrink-0">
                  ⚡ {currentSubtitle.speed}x
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stem Status Badge on Top Right */}
        <div className="absolute top-3 right-3 pointer-events-none opacity-90 z-10">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-700 text-[10px] font-mono text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                mixingOptions.muteOriginalVocal ? 'bg-rose-500' : 'bg-emerald-400'
              }`}
            />
            <span>
              {mixingOptions.muteOriginalVocal ? 'Vocals Muted' : `Vocals ${Math.round((mixingOptions.originalVocalVolume ?? 1) * 100)}%`}
            </span>
            <span className="text-slate-600">|</span>
            <span
              className={`w-2 h-2 rounded-full ${
                mixingOptions.muteOriginalBgm ? 'bg-slate-500' : 'bg-teal-400'
              }`}
            />
            <span>
              {mixingOptions.muteOriginalBgm ? 'BGM Muted' : `BGM ${Math.round((mixingOptions.originalBgmVolume ?? 0.25) * 100)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Scrub Bar & Timeline Track (Silky Smooth 60FPS) */}
      <div className="px-4 pt-3 pb-2 bg-slate-950 border-t border-slate-800/80">
        <div className="relative w-full h-3 group cursor-pointer flex items-center">
          {/* Background rail */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
            {/* Progress filled bar - Direct DOM, No CSS transition delay for instant butter-smooth tracking */}
            <div
              ref={progressBarRef}
              className="h-full bg-gradient-to-r from-indigo-500 via-teal-400 to-pink-500"
              style={{ width: '0%' }}
            />
          </div>

          {/* Segment Markers on Timeline */}
          {duration > 0 &&
            segments.map((seg) => {
              const leftPct = (seg.startTime / duration) * 100;
              const widthPct = Math.max(1.5, ((seg.endTime - seg.startTime) / duration) * 100);
              const hasAudio = !!seg.audioUrl;

              return (
                <div
                  key={seg.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeek(seg.startTime);
                    onSelectSegment?.(seg.id);
                  }}
                  className={`absolute top-0 bottom-0 rounded-sm cursor-pointer ${
                    hasAudio
                      ? 'bg-indigo-400/50 hover:bg-indigo-300 h-2'
                      : 'bg-slate-600/40 hover:bg-slate-500 h-1.5'
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                  title={`${seg.speaker}: ${seg.khmerText} (${formatTime(seg.startTime)} - ${formatTime(seg.endTime)})`}
                />
              );
            })}

          {/* Interactive Range Input */}
          <input
            ref={scrubInputRef}
            type="range"
            min={0}
            max={duration || 100}
            step={0.05}
            defaultValue={0}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
        </div>

        {/* Transport Controls & Options */}
        <div className="flex items-center justify-between text-xs text-slate-300 mt-2">
          {/* Left Controls: Play, Restart, Times */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-sm cursor-pointer"
              title={isPlaying ? 'ផ្អាក (Pause)' : 'ចាក់ (Play)'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
            </button>

            <button
              onClick={handleRestart}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="ចាក់ឡើងវិញពីដើម"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <span className="font-mono text-slate-400 text-xs">
              <span ref={currentTimeDisplayRef} className="text-slate-100 font-semibold">
                00:00.0
              </span>{' '}
              / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls: Subtitles Toggle, Stem Panel Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={`p-1.5 rounded-lg flex items-center gap-1 text-xs transition-colors cursor-pointer ${
                showSubtitles ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="បិទ/បើក អក្សររត់ (Subtitles)"
            >
              <Subtitles className="w-4 h-4" />
              <span className="hidden sm:inline">អក្សររត់</span>
            </button>

            {onSeparateStems && (
              <button
                onClick={onSeparateStems}
                disabled={mixingOptions.isSeparating}
                className="px-2.5 py-1.5 rounded-lg bg-teal-600/20 text-teal-300 hover:bg-teal-600/30 border border-teal-500/30 text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="ញ៉ែកសំឡេងនិយាយ និងភ្លេងផ្ទៃខាងក្រោយដោយស្វ័យប្រវត្តិ"
              >
                {mixingOptions.isSeparating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                    <span>កំពុងញ៉ែក Stems...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5 text-teal-400" />
                    <span>ញ៉ែកសំឡេងដើម (Stem Separation)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AUDIO STEMS MIXER PANEL (ញ៉ែក សំលេងនិយាយដើម និងភ្លេងដើម រួចអាចបិទ ឬបន្ថយ បាន) */}
      {showStemMixer && (
        <div className="p-3.5 bg-slate-950/90 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Stem 1: Original Vocals / Speech */}
          <div
            className={`p-2.5 rounded-xl border transition-all ${
              mixingOptions.muteOriginalVocal
                ? 'bg-rose-950/20 border-rose-900/40 opacity-75'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Mic2 className={`w-3.5 h-3.5 ${mixingOptions.muteOriginalVocal ? 'text-rose-400' : 'text-blue-400'}`} />
                <span>សំឡេងនិយាយដើម (Vocals)</span>
              </div>
              <button
                onClick={() =>
                  onUpdateMixingOptions({
                    muteOriginalVocal: !mixingOptions.muteOriginalVocal,
                  })
                }
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                  mixingOptions.muteOriginalVocal
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
                title={mixingOptions.muteOriginalVocal ? 'បើកសំឡេងនិយាយដើមវិញ' : 'បិទសំឡេងនិយាយដើម'}
              >
                {mixingOptions.muteOriginalVocal ? (
                  <>
                    <VolumeX className="w-3 h-3" />
                    <span>បិទ (Muted)</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3" />
                    <span>បើក (Active)</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                disabled={mixingOptions.muteOriginalVocal}
                value={mixingOptions.muteOriginalVocal ? 0 : (mixingOptions.originalVocalVolume ?? 0)}
                onChange={(e) =>
                  onUpdateMixingOptions({
                    originalVocalVolume: parseFloat(e.target.value),
                    muteOriginalVocal: parseFloat(e.target.value) === 0,
                  })
                }
                className={`w-full h-1.5 rounded-lg cursor-pointer ${
                  mixingOptions.muteOriginalVocal
                    ? 'bg-slate-800 accent-slate-600 cursor-not-allowed'
                    : 'bg-slate-800 accent-blue-500'
                }`}
              />
              <span className="font-mono text-[11px] text-slate-300 w-10 text-right">
                {mixingOptions.muteOriginalVocal
                  ? '0%'
                  : `${Math.round((mixingOptions.originalVocalVolume ?? 0) * 100)}%`}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {mixingOptions.muteOriginalVocal
                ? '🔒 បានបិទកុំឱ្យជាន់សំឡេងខ្មែរ'
                : 'បន្ថយ ឬបិទដើម្បីកុំឱ្យលឺសំឡេងបរទេស'}
            </p>
          </div>

          {/* Stem 2: Original Background Music & Ambiance */}
          <div
            className={`p-2.5 rounded-xl border transition-all ${
              mixingOptions.muteOriginalBgm
                ? 'bg-slate-900/40 border-slate-800 opacity-75'
                : 'bg-slate-900 border-teal-500/20'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Music className={`w-3.5 h-3.5 ${mixingOptions.muteOriginalBgm ? 'text-slate-500' : 'text-teal-400'}`} />
                <span>ភ្លេង & បរិយាកាស (BGM)</span>
              </div>
              <button
                onClick={() =>
                  onUpdateMixingOptions({
                    muteOriginalBgm: !mixingOptions.muteOriginalBgm,
                  })
                }
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                  mixingOptions.muteOriginalBgm
                    ? 'bg-slate-800 text-slate-400'
                    : 'bg-teal-600 text-white shadow-sm'
                }`}
                title={mixingOptions.muteOriginalBgm ? 'បើកភ្លេងដើមវិញ' : 'បិទភ្លេងដើម'}
              >
                {mixingOptions.muteOriginalBgm ? (
                  <>
                    <VolumeX className="w-3 h-3" />
                    <span>បិទ</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3" />
                    <span>បើក</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                disabled={mixingOptions.muteOriginalBgm}
                value={mixingOptions.muteOriginalBgm ? 0 : (mixingOptions.originalBgmVolume ?? 0.25)}
                onChange={(e) =>
                  onUpdateMixingOptions({
                    originalBgmVolume: parseFloat(e.target.value),
                    duckingVolume: parseFloat(e.target.value),
                    muteOriginalBgm: parseFloat(e.target.value) === 0,
                  })
                }
                className={`w-full h-1.5 rounded-lg cursor-pointer ${
                  mixingOptions.muteOriginalBgm
                    ? 'bg-slate-800 accent-slate-600 cursor-not-allowed'
                    : 'bg-slate-800 accent-teal-500'
                }`}
              />
              <span className="font-mono text-[11px] text-teal-300 w-10 text-right">
                {mixingOptions.muteOriginalBgm
                  ? '0%'
                  : `${Math.round((mixingOptions.originalBgmVolume ?? 0.25) * 100)}%`}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              រក្សាភ្លេង និង Sound Effects ដើមពី ១៥% - ៣០%
            </p>
          </div>

          {/* Stem 3: Khmer Dubbed Speech */}
          <div className="p-2.5 rounded-xl border border-indigo-500/30 bg-indigo-950/20">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>សំឡេងបញ្ចូលខ្មែរ (Khmer Dub)</span>
              </div>
              <span className="text-[10px] text-indigo-300 font-mono font-bold">
                {Math.round(mixingOptions.dubbedVolume * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={mixingOptions.dubbedVolume}
                onChange={(e) =>
                  onUpdateMixingOptions({
                    dubbedVolume: parseFloat(e.target.value),
                  })
                }
                className="w-full h-1.5 accent-indigo-500 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="font-mono text-[11px] text-indigo-300 w-10 text-right">
                {Math.round(mixingOptions.dubbedVolume * 100)}%
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              កម្រិតសំឡេងនិយាយខ្មែរច្បាស់ៗលើស៊ុមវីដេអូ
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
