import React, { useState, useRef } from 'react';
import { Upload, Video, Sparkles, Film, ArrowRight, Music, AlertCircle, FileText, CheckCircle2, Camera } from 'lucide-react';
import { SAMPLE_VIDEOS } from '../data/sampleVideos';
import { SampleVideo } from '../types/dubber';
import { extractAudioFromVideoFile } from '../utils/audioUtils';
import { useLogo } from '../context/LogoContext';
import { LogoModal } from './LogoModal';

interface Stage1UploadProps {
  onVideoSelected: (videoData: {
    videoUrl: string;
    videoTitle: string;
    videoDuration: number;
    audioBase64?: string;
    audioMimeType?: string;
    contextInfo?: string;
    isSample?: boolean;
  }) => void;
  onProceedToStage2: () => void;
  currentVideoUrl?: string;
  currentVideoTitle?: string;
}

export const Stage1Upload: React.FC<Stage1UploadProps> = ({
  onVideoSelected,
  onProceedToStage2,
  currentVideoUrl,
  currentVideoTitle,
}) => {
  const { logoUrl, creatorName } = useLogo();
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isExtractingAudio, setIsExtractingAudio] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>('ai-tech');
  const [contextInput, setContextInput] = useState('');
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{ name: string; size: string; duration?: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle local video file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setUploadedFileInfo({ name: file.name, size: `${sizeMb} MB` });
    setSelectedSampleId(null);
    setExtractError(null);
    setIsExtractingAudio(true);

    try {
      // Extract audio track for fast, high-accuracy Gemini API speech recognition
      const { base64, mimeType, duration } = await extractAudioFromVideoFile(file);
      setUploadedFileInfo((prev) => (prev ? { ...prev, duration } : null));

      onVideoSelected({
        videoUrl: fileUrl,
        videoTitle: file.name.replace(/\.[^/.]+$/, ''),
        videoDuration: duration,
        audioBase64: base64,
        audioMimeType: mimeType,
        contextInfo: contextInput,
        isSample: false,
      });
    } catch (err: any) {
      console.warn('Audio extraction warning:', err);
      setExtractError('មិនអាចស្រង់សំឡេងដោយផ្ទាល់ពីវីដេអូបានទេ ប៉ុន្តែអ្នកនៅតែអាចបន្តវិភាគបាន។');
      
      // Fallback: still load video URL
      const tempVideo = document.createElement('video');
      tempVideo.src = fileUrl;
      tempVideo.onloadedmetadata = () => {
        onVideoSelected({
          videoUrl: fileUrl,
          videoTitle: file.name.replace(/\.[^/.]+$/, ''),
          videoDuration: tempVideo.duration || 30,
          contextInfo: contextInput,
          isSample: false,
        });
      };
    } finally {
      setIsExtractingAudio(false);
    }
  };

  // Select sample video
  const handleSelectSample = (sample: SampleVideo) => {
    setSelectedSampleId(sample.id);
    setUploadedFileInfo(null);
    setContextInput(sample.initialContext);
    setExtractError(null);

    onVideoSelected({
      videoUrl: sample.videoUrl,
      videoTitle: sample.titleKhmer,
      videoDuration: sample.duration,
      contextInfo: sample.initialContext,
      isSample: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-gradient-to-r from-indigo-900/30 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-2xl p-5 md:p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              onClick={() => setIsLogoModalOpen(true)}
              className="relative group rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-400 shrink-0 hidden sm:block"
              title="ចុចដើម្បីមើល ឬផ្លាស់ប្តូរ Logo កម្មវិធី"
            >
              <img
                src={logoUrl}
                alt="Khmer AI Video Dubber"
                className="w-16 h-16 rounded-2xl border-2 border-amber-500/40 object-cover p-0.5 bg-slate-950/90 shadow-xl shadow-amber-500/10 group-hover:scale-105 transition-all"
              />
              <span className="absolute inset-0 rounded-2xl bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-5 h-5 text-amber-300" />
              </span>
              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow">
                LOGO
              </span>
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span>ដំណាក់កាលទី ១ • Stage 1</span>
                <span className="text-slate-600">•</span>
                <span
                  onClick={() => setIsLogoModalOpen(true)}
                  className="cursor-pointer text-amber-300 normal-case font-medium bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/25 hover:bg-amber-500/20 transition-colors shadow-sm"
                  title="ចុចដើម្បីមើល ឬផ្លាស់ប្តូរ Logo"
                >
                  អ្នកបង្កើតកម្មវិធី: <strong className="text-amber-200 font-bold">{creatorName}</strong>
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                បញ្ចូលវីដេអូ ឬជ្រើសរើសវីដេអូគំរូ
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                សូមជ្រើសរើសវីដេអូដែលអ្នកចង់បញ្ចូលសំឡេងជាភាសាខ្មែរ (គាំទ្រ MP4, WebM, MOV)។
              </p>
            </div>
          </div>

          {currentVideoUrl && (
            <button
              onClick={onProceedToStage2}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>បន្តទៅដំណាក់កាលទី ២ (Gemini AI)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload Dropzone */}
        <div className="lg:col-span-6 space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500/80 bg-slate-900/50 hover:bg-slate-900/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all group min-h-[260px]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/mov"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all flex items-center justify-center mb-4">
              <Upload className="w-8 h-8" />
            </div>

            <h3 className="text-base font-semibold text-white group-hover:text-indigo-300 transition-colors">
              ចុចទីនេះដើម្បីជ្រើសរើសវីដេអូរបស់អ្នក
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              ទម្លាក់ឯកសារវីដេអូ (MP4, WebM, MOV) មកទីនេះ។ ប្រព័ន្ធនឹងស្រង់សំឡេងដោយស្វ័យប្រវត្តិ។
            </p>

            {isExtractingAudio && (
              <div className="mt-4 flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20 animate-pulse">
                <Music className="w-3.5 h-3.5 animate-spin" />
                <span>កំពុងស្រង់សំឡេងចេញពីវីដេអូសម្រាប់ Gemini AI...</span>
              </div>
            )}

            {uploadedFileInfo && !isExtractingAudio && (
              <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>បានផ្ទុកឡើង: {uploadedFileInfo.name} ({uploadedFileInfo.size})</span>
              </div>
            )}
          </div>

          {extractError && (
            <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{extractError}</span>
            </div>
          )}

          {/* Optional context hint */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              ព័ត៌មានបន្ថែម ឬប្រភេទវីដេអូ (Context info for AI - Optional):
            </label>
            <input
              type="text"
              value={contextInput}
              onChange={(e) => setContextInput(e.target.value)}
              placeholder="ឧទាហរណ៍: វីដេអូព័ត៌មានបច្ចេកវិទ្យា, ភាពយន្តឯកសារ, ឬវីដេអូបង្រៀន..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Sample Videos Preset Selection */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Film className="w-4 h-4 text-indigo-400" />
              <span>ឬសាកល្បងជាមួយវីដេអូគំរូ (Demo Video Presets)</span>
            </h3>
            <span className="text-[11px] text-slate-500">សាកល្បងភ្លាមៗ</span>
          </div>

          <div className="space-y-2.5">
            {SAMPLE_VIDEOS.map((sample) => {
              const isSelected = selectedSampleId === sample.id;
              return (
                <div
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3.5 ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/40'
                      : 'bg-slate-900/50 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <img
                    src={sample.thumbnailUrl}
                    alt={sample.titleKhmer}
                    className="w-20 h-14 object-cover rounded-lg shrink-0 border border-slate-700"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 font-medium border border-slate-700">
                        {sample.category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {sample.duration}s
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white truncate mt-1">
                      {sample.titleKhmer}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {sample.titleEn}
                    </p>
                  </div>

                  <div className="shrink-0">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isSelected ? <CheckCircle2 className="w-4 h-4" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <LogoModal isOpen={isLogoModalOpen} onClose={() => setIsLogoModalOpen(false)} />
    </div>
  );
};
