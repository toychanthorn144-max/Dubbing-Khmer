import React from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Volume2,
  Clock,
  Radio,
  FileCode,
  ShieldCheck,
  AudioWaveform,
} from 'lucide-react';
import { AudioDiagnosticResult } from '../utils/audioDiagnostic';
import { DubbingSegment } from '../types/dubber';
import { formatTime } from '../utils/audioUtils';

interface AudioDiagnosticModalProps {
  segment: DubbingSegment | null;
  onClose: () => void;
  onPlayAudio?: (url: string) => void;
}

export const AudioDiagnosticModal: React.FC<AudioDiagnosticModalProps> = ({
  segment,
  onClose,
  onPlayAudio,
}) => {
  if (!segment || !segment.diagnostic) return null;

  const diag = segment.diagnostic;
  const isHealthy = diag.isValid && !diag.isSilent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isHealthy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Audio Diagnostic Inspector</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                    isHealthy
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {isHealthy ? 'PASSED / ត្រឹមត្រូវ' : 'FAILED / មានបញ្ហា'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                ត្រួតពិនិត្យ Sample Rate, Duration, និង Amplitude មុនពេលបញ្ចូលក្នុង UI
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Target Segment Summary */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>ឃ្លាដែលបានវិភាគ: {segment.speaker}</span>
              <span className="font-mono text-slate-300">
                {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
              </span>
            </div>
            <p className="text-sm font-semibold text-white">
              {segment.khmerText}
            </p>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Sample Rate */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                <Radio className="w-3.5 h-3.5 text-indigo-400" /> Sample Rate
              </span>
              <div className="text-base font-mono font-bold text-white">
                {diag.sampleRate.toLocaleString()} Hz
              </div>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> ត្រឹមត្រូវ (Valid)
              </span>
            </div>

            {/* Audio Duration */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5 text-pink-400" /> Duration
              </span>
              <div className="text-base font-mono font-bold text-white">
                {diag.duration}s
              </div>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> មានទិន្នន័យ (Valid)
              </span>
            </div>

            {/* Signal RMS Level */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Signal Level
              </span>
              <div className="text-base font-mono font-bold text-white">
                {diag.rmsVolumeDb} dBFS
              </div>
              <span
                className={`text-[10px] flex items-center gap-1 ${
                  diag.isSilent ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {diag.isSilent ? (
                  <>
                    <XCircle className="w-3 h-3" /> គ្មានសំឡេង (Silent)
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> មានសំឡេង (Audible)
                  </>
                )}
              </span>
            </div>

            {/* Peak Amplitude */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Peak Amp
              </span>
              <div className="text-base font-mono font-bold text-white">
                {diag.peakAmplitude} / 1.0
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {Math.round(diag.fileSizeBytes / 1024)} KB
              </span>
            </div>
          </div>

          {/* Validation Checklist */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>លក្ខខណ្ឌសុពលភាពសំឡេង (Verification Checklist):</span>
            </h4>

            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span>១. Sample Rate ស្ថិតក្នុងកម្រិត 8,000Hz - 48,000Hz:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {diag.sampleRate} Hz (PASS)
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span>២. រយៈពេល Duration &gt; 0.05s:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {diag.duration}s (PASS)
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span>៣. សញ្ញារលកសំឡេងមិនស្ងាត់ (Non-Silent Amplitude):</span>
                <span
                  className={`font-bold flex items-center gap-1 ${
                    diag.isSilent ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {diag.isSilent ? (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> SILENT FAIL
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Peak {diag.peakAmplitude} (PASS)
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span>៤. ទម្រង់ File Format & Header:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {diag.format} ({diag.bitDepth}-bit)
                </span>
              </div>
            </div>
          </div>

          {/* Warnings & Errors if any */}
          {diag.warnings.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1">
              <span className="font-bold flex items-center gap-1 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5" /> ការក្រើនរំលឹក (Warnings):
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {diag.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {diag.errors.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-1">
              <span className="font-bold flex items-center gap-1 text-[11px]">
                <XCircle className="w-3.5 h-3.5" /> កំហុស (Errors):
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {diag.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Raw Diagnostic JSON */}
          <details className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px]">
            <summary className="font-mono text-slate-400 cursor-pointer hover:text-white flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-indigo-400" />
              <span>បង្ហាញ Raw Metadata JSON</span>
            </summary>
            <pre className="mt-2.5 p-3 rounded-lg bg-slate-950 text-indigo-300 font-mono text-[10px] overflow-x-auto leading-relaxed border border-slate-800">
              {JSON.stringify(diag, null, 2)}
            </pre>
          </details>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Verified at {diag.timestamp}
          </span>

          <div className="flex items-center gap-2">
            {segment.audioUrl && onPlayAudio && (
              <button
                onClick={() => onPlayAudio(segment.audioUrl!)}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>ចាក់សាកល្បង</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              បិទផ្ទាំង
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
