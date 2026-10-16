import React, { useState } from 'react';
import {
  Mic2,
  Play,
  Pause,
  RotateCw,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Volume2,
  Sliders,
  Wand2,
  Activity,
  ShieldCheck,
  Zap,
  Gauge,
  Clock,
  Plus,
  Minus,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { DubbingSegment } from '../types/dubber';
import { TTS_VOICES } from '../data/sampleVideos';
import { formatTime, analyzeSegmentTiming } from '../utils/audioUtils';
import { AudioDiagnosticModal } from './AudioDiagnosticModal';

interface Stage3TTSStudioProps {
  segments: DubbingSegment[];
  isGeneratingBatch: boolean;
  batchProgress: { current: number; total: number } | null;
  onGenerateBatchTTS: (defaultVoice: string, autoFitAll?: boolean) => void;
  onGenerateSingleTTS: (
    segmentId: string,
    voice: string,
    style?: string,
    speed?: number,
    targetDuration?: number
  ) => void;
  onUpdateSegment: (segmentId: string, updated: Partial<DubbingSegment>) => void;
  onAutoFitAllSpeeds: () => void;
  onResetAllSpeeds: () => void;
  onProceedToStage4: () => void;
}

export const Stage3TTSStudio: React.FC<Stage3TTSStudioProps> = ({
  segments,
  isGeneratingBatch,
  batchProgress,
  onGenerateBatchTTS,
  onGenerateSingleTTS,
  onUpdateSegment,
  onAutoFitAllSpeeds,
  onResetAllSpeeds,
  onProceedToStage4,
}) => {
  const [selectedDefaultVoice, setSelectedDefaultVoice] = useState('Kore');
  const [activeVoiceStyle, setActiveVoiceStyle] = useState('Clear, natural spoken Khmer dubbing');
  const [currentlyPlayingAudioId, setCurrentlyPlayingAudioId] = useState<string | null>(null);
  const [inspectingSegment, setInspectingSegment] = useState<DubbingSegment | null>(null);
  const audioPlayerRef = React.useRef<HTMLAudioElement | null>(null);

  const completedCount = segments.filter((s) => !!s.audioUrl).length;

  // Count how many segments need speed adjustment
  const syncStats = segments.reduce(
    (acc, seg) => {
      const timing = analyzeSegmentTiming(seg);
      if (timing.status === 'too_long') acc.tooLong++;
      else if (timing.status === 'too_short') acc.tooShort++;
      else if (timing.status === 'in_sync') acc.inSync++;
      return acc;
    },
    { inSync: 0, tooLong: 0, tooShort: 0 }
  );

  const playSegmentAudio = (
    segId: string,
    url: string,
    text: string,
    speed = 1.0,
    appliedSpeed = 1.0
  ) => {
    if (currentlyPlayingAudioId === segId && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setCurrentlyPlayingAudioId(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const audio = new Audio(url);
    audio.volume = 1.0;

    // Apply speed adjustment with pitch preservation so the user immediately hears the cadence!
    const relativeRate = speed / (appliedSpeed || 1.0);
    if (relativeRate > 0 && Math.abs(relativeRate - 1.0) > 0.01) {
      audio.playbackRate = Math.max(0.5, Math.min(2.0, relativeRate));
      (audio as any).preservesPitch = true;
    }

    audio.onended = () => setCurrentlyPlayingAudioId(null);
    audio.onerror = (e) => {
      console.warn('Audio tag failed, speaking with Web Speech API:', e);
      if ('speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'km-KH';
        utter.rate = Math.max(0.5, Math.min(2.0, relativeRate));
        utter.onend = () => setCurrentlyPlayingAudioId(null);
        window.speechSynthesis.speak(utter);
      }
    };

    audio.play().catch((e) => {
      console.warn('Audio play() rejected, speaking with Web Speech API:', e);
      if ('speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'km-KH';
        utter.rate = Math.max(0.5, Math.min(2.0, relativeRate));
        utter.onend = () => setCurrentlyPlayingAudioId(null);
        window.speechSynthesis.speak(utter);
      }
    });

    audioPlayerRef.current = audio;
    setCurrentlyPlayingAudioId(segId);
  };

  const handleStepSpeed = (segment: DubbingSegment, delta: number) => {
    const currentSpeed = segment.speed || 1.0;
    const newSpeed = Math.max(0.5, Math.min(2.0, Math.round((currentSpeed + delta) * 100) / 100));
    onUpdateSegment(segment.id, { speed: newSpeed });
  };

  const handleSetSpeed = (segment: DubbingSegment, targetSpeed: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, Math.round(targetSpeed * 100) / 100));
    onUpdateSegment(segment.id, { speed: clamped });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-pink-950/40 via-slate-900 to-slate-900 border border-pink-500/20 rounded-2xl p-5 md:p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-pink-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
              ដំណាក់កាលទី ៣ • Stage 3: TTS Engine & Audio Timing Sync
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>TTS Studio & តម្រឹមល្បឿនសំឡេង (Speed & Duration Alignment)</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              បង្កើតសំឡេងនិយាយជាភាសាខ្មែរ ហើយបន្ថែម/បន្ថយល្បឿននិយាយ (Audio Time-Stretching & Tempo) ឱ្យត្រូវនឹងរយះពេលនិយាយក្នុងវីដេអូដើម។
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onGenerateBatchTTS(selectedDefaultVoice, false)}
              disabled={isGeneratingBatch || segments.length === 0}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-md transition-all ${
                isGeneratingBatch
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-pink-600/30 hover:scale-[1.02]'
              }`}
            >
              <Wand2 className={`w-4 h-4 ${isGeneratingBatch ? 'animate-spin' : ''}`} />
              <span>
                {isGeneratingBatch
                  ? `កំពុងបង្កើតសំឡេង (${batchProgress?.current || 0}/${batchProgress?.total || segments.length})...`
                  : 'បង្កើតសំឡេងទាំងអស់'}
              </span>
            </button>

            <button
              onClick={() => onGenerateBatchTTS(selectedDefaultVoice, true)}
              disabled={isGeneratingBatch || segments.length === 0}
              title="បង្កើតសំឡេងទាំងអស់ និងតម្រឹមល្បឿនស្វ័យប្រវត្តិតាមវីដេអូដើម"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-md shadow-amber-600/20 transition-all hover:scale-[1.02]"
            >
              <Zap className="w-4 h-4" />
              <span>បង្កើត & បន្ស៊ីល្បឿនស្វ័យប្រវត្តិ</span>
            </button>

            {completedCount > 0 && (
              <button
                onClick={onProceedToStage4}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
              >
                <span>បន្តទៅដំណាក់កាលទី ៤ (Mix & FFmpeg)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Global Timing Sync Toolbar */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Gauge className="w-4 h-4 text-pink-400" />
              <span>ស្ថានភាពល្បឿនស៊ីសង្វាក់៖</span>
            </span>

            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
              ✅ ត្រូវគ្នា: {syncStats.inSync} ឃ្លា
            </span>

            {syncStats.tooLong > 0 && (
              <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>វែងជាងវីដេអូ (គួរបង្កើនល្បឿន): {syncStats.tooLong}</span>
              </span>
            )}

            {syncStats.tooShort > 0 && (
              <span className="px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20 font-medium">
                ℹ️ ខ្លីជាងវីដេអូ (អាចបន្ថយល្បឿន): {syncStats.tooShort}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onAutoFitAllSpeeds}
              className="px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              title="គណនាល្បឿនបង្កើន/បន្ថយដោយស្វ័យប្រវត្តិតាមរយះពេលវីដេអូដើមគ្រប់ឃ្លាទាំងអស់"
            >
              <Zap className="w-3.5 h-3.5 text-pink-400" />
              <span>⚡ បន្ស៊ីល្បឿនគ្រប់ឃ្លាស្វ័យប្រវត្តិ (Auto-Fit All)</span>
            </button>

            <button
              onClick={onResetAllSpeeds}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center gap-1 transition-colors"
              title="កំណត់ល្បឿនទាំងអស់ត្រលប់មក 1.0x (ធម្មតា)"
            >
              <RefreshCw className="w-3 h-3" />
              <span>1.0x ទាំងអស់</span>
            </button>
          </div>
        </div>

        {/* Progress Bar when batch generating */}
        {isGeneratingBatch && batchProgress && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1.5">
                <Mic2 className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                កំពុងបង្កើតសំឡេងឃ្លាទី {batchProgress.current} ក្នុងចំណោម {batchProgress.total} ឃ្លា...
              </span>
              <span className="font-mono text-pink-300">
                {Math.round((batchProgress.current / batchProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-300"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Voice Personas Showcase */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-pink-400" />
            <span>ជ្រើសរើសសំឡេងគំរូ (Select Voice Persona)</span>
          </h3>
          <span className="text-xs text-slate-400">
            បានបង្កើតរួចរាល់ {completedCount} ក្នុងចំណោម {segments.length} ឃ្លា
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {TTS_VOICES.map((v) => {
            const isSelected = selectedDefaultVoice === v.id;
            return (
              <div
                key={v.id}
                onClick={() => setSelectedDefaultVoice(v.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-900 border-pink-500/80 shadow-lg ring-1 ring-pink-500/50'
                    : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        v.gender === 'female'
                          ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {v.gender === 'female' ? 'ស្រី' : 'ប្រុស'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{v.id}</span>
                  </div>

                  <h4 className="text-xs font-bold text-white">{v.khmerName}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {v.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-pink-300 font-medium">{v.tone}</span>
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      isSelected ? 'bg-pink-500 text-white' : 'border border-slate-700'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Segment Audio Files List with Live Speed Controls */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-pink-400" />
            <span>បញ្ជីសំឡេងនិយាយ និងឧបករណ៍បន្ថែម/បន្ថយល្បឿនតាមឃ្លានីមួយៗ</span>
          </h3>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Audio Diagnostic: {segments.filter((s) => s.diagnostic?.isValid).length}/{segments.length} Verified (24kHz)</span>
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {segments.map((seg, idx) => {
            const hasAudio = !!seg.audioUrl;
            const isPlaying = currentlyPlayingAudioId === seg.id;
            const currentSpeed = seg.speed || 1.0;
            const timing = analyzeSegmentTiming(seg);

            return (
              <div
                key={seg.id}
                className={`bg-slate-900 border rounded-xl p-4 transition-all ${
                  timing.status === 'too_long'
                    ? 'border-amber-500/30 shadow-sm shadow-amber-950/20'
                    : timing.status === 'too_short'
                    ? 'border-sky-500/30'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Top Info Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] mb-1">
                        <span className="text-indigo-400 font-semibold">{seg.speaker}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-300 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>វីដេអូ: {formatTime(seg.startTime)} - {formatTime(seg.endTime)}</span>
                          <span className="text-indigo-300 font-bold bg-indigo-500/10 px-1 rounded">
                            ({timing.targetDuration}s)
                          </span>
                        </span>

                        {hasAudio && (
                          <>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-300 font-mono">
                              សំឡេង: <span className="text-pink-300 font-bold">{timing.audioDuration}s</span>
                            </span>
                          </>
                        )}

                        <span className="text-slate-500">•</span>
                        <span className="text-amber-400 text-[10px] bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                          {seg.emotion}
                        </span>
                      </div>

                      <p className="text-sm text-white font-medium leading-relaxed">
                        {seg.khmerText}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {seg.originalText}
                      </p>
                    </div>
                  </div>

                  {/* Timing sync status pill */}
                  <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                    {hasAudio ? (
                      timing.status === 'in_sync' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>ល្បឿនត្រូវគ្នា (In Sync)</span>
                        </span>
                      ) : timing.status === 'too_long' ? (
                        <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg text-xs text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>វែងជាងវីដេអូ +{timing.diff}s (គួរបង្កើនល្បឿន {timing.recommendedSpeed}x)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/30 px-2.5 py-1 rounded-lg text-xs text-sky-300">
                          <span>ខ្លីជាងវីដេអូ {timing.diff}s (អាចបន្ថយល្បឿន {timing.recommendedSpeed}x)</span>
                        </div>
                      )
                    ) : (
                      <span className="text-xs text-slate-500 italic">មិនទាន់បង្កើតសំឡេង</span>
                    )}

                    {/* Audio Diagnostic pill */}
                    {seg.diagnostic && (
                      <button
                        onClick={() => setInspectingSegment(seg)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1 transition-all border ${
                          seg.diagnostic.isValid
                            ? 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-500/30'
                        }`}
                        title="ពិនិត្យមើល Audio Diagnostic Metadata"
                      >
                        <Activity className="w-3 h-3 text-emerald-400" />
                        <span>{(seg.diagnostic.sampleRate / 1000).toFixed(0)}kHz • {seg.diagnostic.duration}s</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Control Section: Speed Controls & Action Buttons */}
                <div className="mt-3 pt-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Speed Adjustment Suite */}
                  <div className="flex-1 bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <Gauge className="w-4 h-4 text-pink-400" />
                      <span className="text-xs font-semibold text-slate-300">
                        ល្បឿននិយាយ:
                      </span>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          currentSpeed > 1.0
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : currentSpeed < 1.0
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {currentSpeed.toFixed(2)}x
                        {currentSpeed !== 1.0 && (
                          <span className="text-[10px] ml-1 opacity-80">
                            ({currentSpeed > 1.0 ? `+${Math.round((currentSpeed - 1) * 100)}%` : `-${Math.round((1 - currentSpeed) * 100)}%`})
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Stepper buttons [-] and [+] */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleStepSpeed(seg, -0.05)}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-colors"
                        title="បន្ថយល្បឿន 0.05x (Slower)"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      {/* Speed Slider */}
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.05"
                        value={currentSpeed}
                        onChange={(e) => handleSetSpeed(seg, parseFloat(e.target.value))}
                        className="w-24 sm:w-28 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                        title={`ល្បឿន: ${currentSpeed}x`}
                      />

                      <button
                        onClick={() => handleStepSpeed(seg, 0.05)}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-colors"
                        title="បន្ថែមល្បឿន 0.05x (Faster)"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-1 shrink-0">
                      {[0.8, 1.0, 1.15, 1.3].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handleSetSpeed(seg, preset)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-all ${
                            Math.abs(currentSpeed - preset) < 0.02
                              ? 'bg-pink-600 text-white font-bold'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                          }`}
                        >
                          {preset}x
                        </button>
                      ))}
                    </div>

                    {/* Auto-Fit Button for this segment */}
                    {timing.status !== 'in_sync' && timing.recommendedSpeed !== 1.0 && (
                      <button
                        onClick={() => handleSetSpeed(seg, timing.recommendedSpeed)}
                        className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-600/30 to-rose-600/30 hover:from-amber-600/40 hover:to-rose-600/40 text-amber-300 border border-amber-500/40 text-[11px] font-semibold flex items-center gap-1 transition-all ml-auto"
                        title={`តម្រឹមស្វ័យប្រវត្តិតាមវីដេអូដើម ${timing.recommendedSpeed}x`}
                      >
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>តម្រឹម {timing.recommendedSpeed}x</span>
                      </button>
                    )}
                  </div>

                  {/* Play & Generate Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {hasAudio && (
                      <button
                        onClick={() =>
                          playSegmentAudio(
                            seg.id,
                            seg.audioUrl!,
                            seg.khmerText,
                            currentSpeed,
                            seg.appliedSpeed || 1.0
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm ${
                          isPlaying
                            ? 'bg-rose-600 text-white shadow-rose-600/30'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                        title="ស្តាប់សំឡេងនិយាយជាមួយល្បឿនដែលបានកំណត់ភ្លាមៗ (Real-time Tempo Preview)"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5 fill-white" />
                            <span>ផ្អាក</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>ស្តាប់សំឡេង ({currentSpeed}x)</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() =>
                        onGenerateSingleTTS(
                          seg.id,
                          seg.suggestedVoice || selectedDefaultVoice,
                          activeVoiceStyle,
                          currentSpeed,
                          timing.targetDuration
                        )
                      }
                      disabled={seg.isGeneratingAudio || isGeneratingBatch}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                        hasAudio
                          ? 'bg-slate-800 hover:bg-pink-900/40 hover:text-pink-300 text-slate-300 border border-slate-700'
                          : 'bg-pink-600 hover:bg-pink-500 text-white shadow-pink-600/20'
                      }`}
                      title="បង្កើតសំឡេងគុណភាពខ្ពស់ 24kHz ដោយតម្រឹមល្បឿននេះជាអចិន្ត្រៃយ៍"
                    >
                      <RotateCw
                        className={`w-3.5 h-3.5 ${seg.isGeneratingAudio ? 'animate-spin' : ''}`}
                      />
                      <span>{hasAudio ? `កែសំឡេង (${currentSpeed}x)` : 'បង្កើតសំឡេង'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audio Diagnostic Inspector Modal */}
      {inspectingSegment && (
        <AudioDiagnosticModal
          segment={inspectingSegment}
          onClose={() => setInspectingSegment(null)}
          onPlayAudio={(url) =>
            playSegmentAudio(
              inspectingSegment.id,
              url,
              inspectingSegment.khmerText,
              inspectingSegment.speed || 1.0,
              inspectingSegment.appliedSpeed || 1.0
            )
          }
        />
      )}
    </div>
  );
};
