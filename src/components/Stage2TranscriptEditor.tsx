import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Plus,
  Trash2,
  Clock,
  User,
  Volume2,
  RotateCw,
  Check,
  Languages,
  Edit3,
  Bot,
  Play,
} from 'lucide-react';
import { DubbingSegment } from '../types/dubber';
import { formatTime } from '../utils/audioUtils';
import { TTS_VOICES } from '../data/sampleVideos';

interface Stage2TranscriptEditorProps {
  segments: DubbingSegment[];
  summary?: string;
  isAnalyzing: boolean;
  onAnalyzeWithGemini: () => void;
  onUpdateSegment: (segmentId: string, updated: Partial<DubbingSegment>) => void;
  onAddSegment: () => void;
  onRemoveSegment: (segmentId: string) => void;
  onProceedToStage3: () => void;
  onPreviewSegmentAudio?: (segment: DubbingSegment) => void;
}

export const Stage2TranscriptEditor: React.FC<Stage2TranscriptEditorProps> = ({
  segments,
  summary,
  isAnalyzing,
  onAnalyzeWithGemini,
  onUpdateSegment,
  onAddSegment,
  onRemoveSegment,
  onProceedToStage3,
  onPreviewSegmentAudio,
}) => {
  const [activeToneFilter, setActiveToneFilter] = useState<string>('all');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-violet-950/40 via-slate-900 to-slate-900 border border-violet-500/20 rounded-2xl p-5 md:p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-violet-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              ដំណាក់កាលទី ២ • Stage 2: Gemini API
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>ស្រង់អត្ថបទដើម + បកប្រែជាភាសាខ្មែរ + ចាប់ Timestamp</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Gemini 3.8 Flash ធ្វើការស្រង់ពាក្យនិយាយដើម បកប្រែជាភាសាខ្មែរសម្រាប់បញ្ចូលសំឡេង (Dubbing) យ៉ាងរលូន និងចាប់ម៉ោង Timestamp ជាក់លាក់។
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onAnalyzeWithGemini}
              disabled={isAnalyzing}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-md transition-all ${
                isAnalyzing
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/30'
              }`}
            >
              <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'កំពុងវិភាគដោយ Gemini...' : 'ដំណើរការវិភាគ Gemini AI'}</span>
            </button>

            {segments.length > 0 && (
              <button
                onClick={onProceedToStage3}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
              >
                <span>បន្តទៅដំណាក់កាលទី ៣ (TTS Engine)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {summary && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-300">
            <Bot className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-violet-300">សេចក្តីសង្ខេបខ្លឹមសារវីដេអូ: </span>
              {summary}
            </div>
          </div>
        )}
      </div>

      {/* Loading state indicator */}
      {isAnalyzing && (
        <div className="bg-slate-900/90 border border-violet-500/30 rounded-2xl p-8 text-center space-y-4 animate-pulse">
          <div className="w-14 h-14 rounded-2xl bg-violet-600/20 text-violet-400 mx-auto flex items-center justify-center">
            <Sparkles className="w-7 h-7 animate-spin" />
          </div>
          <h3 className="text-base font-bold text-white">កំពុងដំណើរការ Gemini Multimodal API</h3>
          <div className="max-w-md mx-auto space-y-2 text-xs text-slate-400">
            <p>១. កំពុងស្តាប់ និងស្រង់ពាក្យនិយាយដើមពីសាច់រឿង...</p>
            <p>២. កំពុងបកប្រែជាភាសាខ្មែរសម្រាប់បញ្ចូលសំឡេងបែបធម្មជាតិ...</p>
            <p>៣. កំពុងកំណត់ Timestamp និងចង្វាក់នៃការនិយាយ...</p>
          </div>
        </div>
      )}

      {/* Segments Script Editor */}
      {!isAnalyzing && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Languages className="w-4 h-4 text-violet-400" />
                <span>ឃ្លាដែលត្រូវបញ្ចូលសំឡេង ({segments.length} ឃ្លា)</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                (អ្នកអាចកែប្រែពាក្យបកប្រែខ្មែរ និងម៉ោង Timestamp បានដោយសេរី)
              </span>
            </div>

            <button
              onClick={onAddSegment}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              <span>បន្ថែមឃ្លាថ្មី</span>
            </button>
          </div>

          {segments.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
              <Languages className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400">មិនទាន់មានឃ្លាត្រូវបានស្រង់នៅឡើយទេ។</p>
              <button
                onClick={onAnalyzeWithGemini}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold shadow"
              >
                ចុចទីនេះដើម្បីចាប់ផ្តើមវិភាគជាមួយ Gemini AI
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {segments.map((seg, idx) => {
                return (
                  <div
                    key={seg.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 transition-all space-y-3"
                  >
                    {/* Top Row: Index, Timestamp, Speaker, Emotion */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 text-[11px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>

                        {/* Timing controls */}
                        <div className="flex items-center gap-1 text-xs text-slate-300 font-mono bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <input
                            type="number"
                            step="0.1"
                            value={seg.startTime}
                            onChange={(e) =>
                              onUpdateSegment(seg.id, { startTime: parseFloat(e.target.value) || 0 })
                            }
                            className="w-14 bg-transparent text-slate-100 text-center focus:outline-none focus:text-indigo-400"
                          />
                          <span className="text-slate-600">→</span>
                          <input
                            type="number"
                            step="0.1"
                            value={seg.endTime}
                            onChange={(e) =>
                              onUpdateSegment(seg.id, { endTime: parseFloat(e.target.value) || 0 })
                            }
                            className="w-14 bg-transparent text-slate-100 text-center focus:outline-none focus:text-indigo-400"
                          />
                          <span className="text-slate-500 text-[10px]">s</span>
                          <span className="text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {(Math.max(0.1, seg.endTime - seg.startTime)).toFixed(1)}s
                          </span>
                        </div>
                      </div>

                      {/* Speaker & Tone */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-md border border-slate-800 text-xs">
                          <User className="w-3 h-3 text-indigo-400" />
                          <input
                            type="text"
                            value={seg.speaker}
                            onChange={(e) => onUpdateSegment(seg.id, { speaker: e.target.value })}
                            className="w-20 bg-transparent text-slate-300 focus:outline-none"
                            placeholder="វាគ្មិន"
                          />
                        </div>

                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {seg.emotion}
                        </span>

                        {/* Voice persona picker */}
                        <select
                          value={seg.suggestedVoice}
                          onChange={(e) => onUpdateSegment(seg.id, { suggestedVoice: e.target.value })}
                          className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500"
                        >
                          {TTS_VOICES.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.tone})
                            </option>
                          ))}
                        </select>

                        {/* Delete button */}
                        <button
                          onClick={() => onRemoveSegment(seg.id)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                          title="លុបឃ្លានេះ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Original & Khmer Text Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Original Speech */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                          <span>អត្ថបទដើម (Original Speech):</span>
                        </label>
                        <textarea
                          rows={2}
                          value={seg.originalText}
                          onChange={(e) => onUpdateSegment(seg.id, { originalText: e.target.value })}
                          className="w-full bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:border-slate-600 resize-none"
                        />
                      </div>

                      {/* Spoken Khmer Translation */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-indigo-300 flex items-center justify-between">
                          <span>ការបកប្រែជាភាសាខ្មែរ (Khmer Dub Script):</span>
                          {seg.audioUrl && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                              <Check className="w-3 h-3" /> មានសំឡេងរួច
                            </span>
                          )}
                        </label>
                        <div className="relative">
                          <textarea
                            rows={2}
                            value={seg.khmerText}
                            onChange={(e) => onUpdateSegment(seg.id, { khmerText: e.target.value })}
                            className="w-full bg-indigo-950/20 border border-indigo-500/30 rounded-lg p-2.5 text-xs text-white font-medium focus:outline-none focus:border-indigo-400 resize-none pr-10"
                          />
                          {seg.audioUrl && onPreviewSegmentAudio && (
                            <button
                              onClick={() => onPreviewSegmentAudio(seg)}
                              className="absolute right-2 bottom-3 p-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                              title="ស្តាប់សំឡេងឃ្លានេះ"
                            >
                              <Play className="w-3 h-3 fill-white" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
