import React, { useState } from 'react';
import {
  Layers,
  VolumeX,
  Volume2,
  Sliders,
  Download,
  Terminal,
  Webhook,
  FileCode,
  FileText,
  Music,
  CheckCircle2,
  Copy,
  ExternalLink,
  Sparkles,
  Loader2,
  Play,
  Film,
  Mic2,
  Headphones,
} from 'lucide-react';
import { DubbingSegment, AudioMixingOptions } from '../types/dubber';
import { RenderProgress } from '../utils/videoMixer';
import { generateSrtContent, downloadFile, assembleCompleteDubbedAudioTrack } from '../utils/audioUtils';

interface Stage4MixAndExportProps {
  segments: DubbingSegment[];
  videoDuration: number;
  mixingOptions: AudioMixingOptions;
  onUpdateMixingOptions: (options: Partial<AudioMixingOptions>) => void;
  onStartRenderVideo: () => void;
  renderProgress: RenderProgress | null;
  renderedVideoUrl: string | null;
  videoTitle: string;
  onSeparateStems?: () => Promise<void>;
}

export const Stage4MixAndExport: React.FC<Stage4MixAndExportProps> = ({
  segments,
  videoDuration,
  mixingOptions,
  onUpdateMixingOptions,
  onStartRenderVideo,
  renderProgress,
  renderedVideoUrl,
  videoTitle,
  onSeparateStems,
}) => {
  const [copiedFfmpeg, setCopiedFfmpeg] = useState(false);
  const [webhookResponse, setWebhookResponse] = useState<any | null>(null);
  const [isCallingWebhook, setIsCallingWebhook] = useState(false);
  const [isExportingAudio, setIsExportingAudio] = useState(false);

  const isVocalMuted = mixingOptions.muteOriginalVocal || mixingOptions.muteOriginal;
  const vocalVol = isVocalMuted ? 0 : (mixingOptions.originalVocalVolume ?? 1.0);
  const isBgmMuted = mixingOptions.muteOriginalBgm;
  const bgmVol = isBgmMuted ? 0 : (mixingOptions.originalBgmVolume ?? mixingOptions.duckingVolume ?? 0.25);
  const dubVol = mixingOptions.dubbedVolume ?? 1.0;

  // Compute multi-stem FFmpeg command string
  const ffmpegCommand = `# Multi-Stem Professional Khmer Dubbing Pipeline
ffmpeg -y -i input_video.mp4 -i dubbed_khmer_track.wav \\
  -filter_complex "\\
  [0:a]equalizer=f=1000:t=q:w=1.0:g=-16,equalizer=f=2400:t=q:w=1.2:g=-16,volume=${bgmVol.toFixed(2)}[bgm];\\
  [0:a]highpass=f=160,lowpass=f=4500,volume=${vocalVol.toFixed(2)}[orig_vocal];\\
  [1:a]volume=${dubVol.toFixed(2)}[khmer_dub];\\
  [bgm][orig_vocal][khmer_dub]amix=inputs=3:duration=first[aout]" \\
  -map 0:v:0 -map "[aout]" \\
  -c:v copy -c:a aac -b:a 192k -shortest output_khmer_dubbed.mp4`;

  // Copy FFmpeg Command to clipboard
  const handleCopyFfmpeg = () => {
    navigator.clipboard.writeText(ffmpegCommand);
    setCopiedFfmpeg(true);
    setTimeout(() => setCopiedFfmpeg(false), 2000);
  };

  // Trigger real Webhook simulator
  const handleTestWebhook = async () => {
    setIsCallingWebhook(true);
    try {
      const res = await fetch('/api/webhook/ffmpeg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'https://cdn.example.com/source_video.mp4',
          audioSegments: segments,
          muteOriginalVocal: isVocalMuted,
          originalVocalVolume: vocalVol,
          muteOriginalBgm: isBgmMuted,
          originalBgmVolume: bgmVol,
          dubbedVolume: dubVol,
          stems: {
            vocals: mixingOptions.vocalsUrl || 'stem_vocals.wav',
            bgm: mixingOptions.bgmUrl || 'stem_bgm.wav',
          },
        }),
      });
      const data = await res.json();
      setWebhookResponse(data);
    } catch (e: any) {
      console.error('Webhook error:', e);
    } finally {
      setIsCallingWebhook(false);
    }
  };

  // Export full WAV audio track
  const handleDownloadFullAudio = async () => {
    setIsExportingAudio(true);
    try {
      const { blob } = await assembleCompleteDubbedAudioTrack(segments, videoDuration);
      downloadFile(blob, `${videoTitle || 'video'}_khmer_dubbed.wav`, 'audio/wav');
    } catch (e) {
      console.error('Audio assembly error:', e);
    } finally {
      setIsExportingAudio(false);
    }
  };

  // Export SRT Subtitle file
  const handleDownloadSrt = () => {
    const srt = generateSrtContent(segments);
    downloadFile(srt, `${videoTitle || 'video'}_khmer_subtitles.srt`, 'text/plain');
  };

  // Export Project JSON
  const handleDownloadJson = () => {
    const projectData = {
      title: videoTitle,
      exportedAt: new Date().toISOString(),
      duration: videoDuration,
      mixingOptions,
      segments,
    };
    downloadFile(
      JSON.stringify(projectData, null, 2),
      `${videoTitle || 'video'}_dubbing_project.json`,
      'application/json'
    );
  };

  // Preset helper
  const applyPreset = (preset: 'clean_dub' | 'pure_khmer' | 'cinema' | 'original') => {
    if (preset === 'clean_dub') {
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

  const isRendering = Boolean(
    renderProgress &&
      (renderProgress.status === 'initializing' ||
        renderProgress.status === 'rendering' ||
        renderProgress.status === 'finalizing')
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/20 rounded-2xl p-5 md:p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              ដំណាក់កាលទី ៤ • Stage 4: Stem Mixing & Full Export
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              ញ៉ែកសំឡេងដើម & បញ្ចូលសំឡេងខ្មែរ (Multi-Stem Mixing & Video Export)
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              ញ៉ែកសំឡេងនិយាយដើម (Vocals) និងភ្លេងដើម (BGM) ដាច់ដោយឡែកពីគ្នា។ អ្នកអាចបិទសំឡេងនិយាយដើមចោលទាំងស្រុង រក្សាភ្លេងផ្ទៃខាងក្រោយ និងលាយសំឡេងខ្មែរឱ្យមានតុល្យភាពល្អឥតខ្ចោះ។
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {onSeparateStems && (
              <button
                onClick={onSeparateStems}
                disabled={mixingOptions.isSeparating}
                className="px-4 py-3 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 font-semibold text-xs flex items-center gap-2 transition-all shadow cursor-pointer"
              >
                {mixingOptions.isSeparating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                    <span>កំពុងញ៉ែក Stems...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4 text-teal-400" />
                    <span>ញ៉ែកសំឡេងដើម (Stem Separation)</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={onStartRenderVideo}
              disabled={isRendering}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm shadow-xl transition-all cursor-pointer ${
                isRendering
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 hover:scale-[1.02]'
              }`}
            >
              {isRendering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>កំពុងបញ្ចូលសំឡេង ({renderProgress?.progress || 0}%)...</span>
                </>
              ) : (
                <>
                  <Film className="w-4 h-4" />
                  <span>Render & ទាញយកវីដេអូពេញលេញ</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Rendering Progress Bar */}
        {isRendering && renderProgress && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                កំពុងបញ្ចូលសំឡេងខ្មែរ និងថតយកស៊ុមវីដេអូ (Canvas Web Audio Engine)...
              </span>
              <span className="font-mono text-emerald-400 font-bold">{renderProgress.progress}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-150"
                style={{ width: `${renderProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {renderedVideoUrl && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="font-bold">វីដេអូបញ្ចូលសំឡេងរួចរាល់! (Video Render Completed)</span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  អ្នកអាចទាញយក file វីដេអូបានភ្លាមៗ ឬចាក់សាកល្បងក្នុង Player ខាងលើ។
                </p>
              </div>
            </div>

            <a
              href={renderedVideoUrl}
              download={`${videoTitle || 'video'}_khmer_dubbed.webm`}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ដោនឡូតវីដេអូ (.webm/.mp4)</span>
            </a>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Audio Mixing & Stem Mixer Controls */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>ឧបករណ៍លាយ Stem សំឡេង (3-Channel Stem Mixer)</span>
            </h3>

            {/* Quick preset selector */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => applyPreset('clean_dub')}
                className="px-2 py-1 rounded text-[10px] bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 transition-colors"
                title="បិទសំឡេងនិយាយដើម + រក្សាភ្លេង ២០%"
              >
                Dub + BGM
              </button>
              <button
                onClick={() => applyPreset('pure_khmer')}
                className="px-2 py-1 rounded text-[10px] bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 transition-colors"
                title="សំឡេងខ្មែរសុទ្ធ"
              >
                ខ្មែរសុទ្ធ
              </button>
            </div>
          </div>

          {/* Stem Channel 1: Original Vocals / Speech (សំឡេងនិយាយដើម) */}
          <div
            className={`p-4 rounded-xl border transition-all space-y-2.5 ${
              isVocalMuted ? 'bg-rose-950/20 border-rose-900/40' : 'bg-slate-950 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Mic2 className={`w-4 h-4 ${isVocalMuted ? 'text-rose-400' : 'text-blue-400'}`} />
                  <span>សំឡេងនិយាយដើម (Original Vocals / Speech)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {isVocalMuted
                    ? '🔒 បានបិទទាំងស្រុង - សំឡេងដើមមិនជ្រៀតជ្រែកជាមួយសំឡេងខ្មែរឡើយ'
                    : 'កម្រិតសំឡេងនិយាយភាសាដើម (អាចបន្ថយ ឬបិទ)'}
                </p>
              </div>

              <button
                onClick={() =>
                  onUpdateMixingOptions({
                    muteOriginalVocal: !isVocalMuted,
                    muteOriginal: !isVocalMuted,
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isVocalMuted
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {isVocalMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>បិទ (Muted)</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>បើក (Active)</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <span className="text-[11px] text-slate-400 w-16">កម្រិតសំឡេង:</span>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                disabled={isVocalMuted}
                value={isVocalMuted ? 0 : vocalVol}
                onChange={(e) =>
                  onUpdateMixingOptions({
                    originalVocalVolume: parseFloat(e.target.value),
                    muteOriginalVocal: parseFloat(e.target.value) === 0,
                    muteOriginal: parseFloat(e.target.value) === 0,
                  })
                }
                className={`w-full h-1.5 rounded-lg cursor-pointer ${
                  isVocalMuted
                    ? 'bg-slate-800 accent-slate-600 cursor-not-allowed'
                    : 'bg-slate-800 accent-blue-500'
                }`}
              />
              <span className="font-mono text-xs text-blue-300 font-bold w-12 text-right">
                {isVocalMuted ? '0%' : `${Math.round(vocalVol * 100)}%`}
              </span>
            </div>
          </div>

          {/* Stem Channel 2: Original Background Music & Ambiance (ភ្លេងដើម) */}
          <div
            className={`p-4 rounded-xl border transition-all space-y-2.5 ${
              isBgmMuted ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-950 border-teal-500/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Music className={`w-4 h-4 ${isBgmMuted ? 'text-slate-500' : 'text-teal-400'}`} />
                  <span>ភ្លេង & បរិយាកាសដើម (Original BGM & Ambiance)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {isBgmMuted
                    ? 'បានបិទភ្លេងដើម'
                    : 'រក្សាភ្លេង និង Sound Effects ដើមស្រាលៗពី ១៥% - ៣០% ដើម្បីឱ្យវីដេអូមានភាពរស់រវើក'}
                </p>
              </div>

              <button
                onClick={() =>
                  onUpdateMixingOptions({
                    muteOriginalBgm: !isBgmMuted,
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isBgmMuted
                    ? 'bg-slate-800 text-slate-400'
                    : 'bg-teal-600 text-white shadow-sm'
                }`}
              >
                {isBgmMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>បិទ</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>បើក</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <span className="text-[11px] text-slate-400 w-16">កម្រិតសំឡេង:</span>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                disabled={isBgmMuted}
                value={isBgmMuted ? 0 : bgmVol}
                onChange={(e) =>
                  onUpdateMixingOptions({
                    originalBgmVolume: parseFloat(e.target.value),
                    duckingVolume: parseFloat(e.target.value),
                    muteOriginalBgm: parseFloat(e.target.value) === 0,
                  })
                }
                className={`w-full h-1.5 rounded-lg cursor-pointer ${
                  isBgmMuted
                    ? 'bg-slate-800 accent-slate-600 cursor-not-allowed'
                    : 'bg-slate-800 accent-teal-500'
                }`}
              />
              <span className="font-mono text-xs text-teal-300 font-bold w-12 text-right">
                {isBgmMuted ? '0%' : `${Math.round(bgmVol * 100)}%`}
              </span>
            </div>
          </div>

          {/* Stem Channel 3: Dubbed Khmer Voice Volume */}
          <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-indigo-400" />
                <span>កម្រិតសំឡេងខ្មែរ (Khmer Dub Volume):</span>
              </span>
              <span className="font-mono text-indigo-300 font-bold">
                {Math.round(dubVol * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={dubVol}
              onChange={(e) => onUpdateMixingOptions({ dubbedVolume: parseFloat(e.target.value) })}
              className="w-full h-1.5 accent-indigo-500 bg-slate-800 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">
              សំឡេងនិយាយខ្មែរចេញតាម Timestamp នីមួយៗប្រកបដោយភាពច្បាស់ និងទាក់ទាញ។
            </p>
          </div>

          {/* Subtitle Burning Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-violet-400" />
                <span>បង្កប់អក្សររត់ខ្មែរក្នុងវីដេអូ (Burn Subtitles into Video)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                បង្ហាញអក្សររត់ភាសាខ្មែរនៅបាតក្រោមនៃវីដេអូជាប់ជាអចិន្ត្រៃយ៍
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={mixingOptions.burnSubtitles}
                onChange={(e) => onUpdateMixingOptions({ burnSubtitles: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
          </div>

          {/* Multi-Format Export Buttons */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-400">ទាញយកឯកសារ Stems & Assets ដាច់ដោយឡែក:</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={handleDownloadFullAudio}
                disabled={isExportingAudio}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="ទាញយកសំឡេងខ្មែរពេញលេញ (.wav)"
              >
                <Music className="w-3.5 h-3.5 text-pink-400" />
                <span>{isExportingAudio ? '...' : 'សំឡេងខ្មែរ (.wav)'}</span>
              </button>

              {mixingOptions.bgmUrl && (
                <a
                  href={mixingOptions.bgmUrl}
                  download={`${videoTitle || 'video'}_stem_bgm.wav`}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="ទាញយកភ្លេងដើម BGM (.wav)"
                >
                  <Music className="w-3.5 h-3.5 text-teal-400" />
                  <span>ភ្លេងដើម (.wav)</span>
                </a>
              )}

              <button
                onClick={handleDownloadSrt}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="ទាញយកអក្សររត់ខ្មែរ (.srt)"
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>អក្សររត់ (.srt)</span>
              </button>

              <button
                onClick={handleDownloadJson}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="ទាញយកទិន្នន័យគម្រោង (.json)"
              >
                <FileCode className="w-3.5 h-3.5 text-blue-400" />
                <span>គម្រោង (.json)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Cloudinary / FFmpeg Webhook Panel */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>FFmpeg & Cloudinary Multi-Stem Pipeline</span>
            </h3>

            <button
              onClick={handleTestWebhook}
              disabled={isCallingWebhook}
              className="px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Webhook className="w-3.5 h-3.5" />
              <span>{isCallingWebhook ? 'កំពុងតេស្ត...' : 'តេស្ត Webhook'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400">
            ខាងក្រោមនេះជាពាក្យបញ្ជា FFmpeg ពិតប្រាកដដែលដំណើរការញ៉ែក និងបញ្ចូល Stem សំឡេង (Khmer Dub + Background Music - Original Speech) ៖
          </p>

          {/* FFmpeg Code Box */}
          <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-3.5 font-mono text-[11px] text-emerald-400">
            <div className="flex items-center justify-between text-slate-500 border-b border-slate-800/80 pb-2 mb-2 font-sans text-[10px]">
              <span className="flex items-center gap-1">
                <Terminal className="w-3 h-3 text-slate-400" /> Multi-Stem FFmpeg Mixing Command:
              </span>
              <button
                onClick={handleCopyFfmpeg}
                className="hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedFfmpeg ? 'បានចម្លង!' : 'ចម្លង'}</span>
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {ffmpegCommand}
            </pre>
          </div>

          {/* Webhook Result Preview */}
          {webhookResponse && (
            <div className="bg-slate-950 border border-indigo-500/30 rounded-xl p-3.5 font-mono text-[11px] text-slate-300 space-y-2">
              <div className="flex items-center justify-between text-[10px] text-indigo-400 font-sans border-b border-slate-800/80 pb-1.5">
                <span className="flex items-center gap-1 font-bold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Webhook ឆ្លើយតបរួចរាល់:
                </span>
                <span>Status 200 OK</span>
              </div>
              <pre className="overflow-x-auto max-h-36 text-[10px] text-slate-300 leading-normal">
                {JSON.stringify(webhookResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
