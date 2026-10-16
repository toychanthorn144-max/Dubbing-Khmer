import React, { useState } from 'react';
import { Mic2, Sparkles, Layers, Sliders, PlayCircle, Video, CheckCircle2, RotateCcw, Camera } from 'lucide-react';
import { DubbingStage } from '../types/dubber';
import { useLogo } from '../context/LogoContext';
import { LogoModal } from './LogoModal';

interface HeaderProps {
  currentStage: DubbingStage;
  onSelectStage: (stage: DubbingStage) => void;
  onReset: () => void;
  hasVideo: boolean;
  hasSegments: boolean;
  hasAudio: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentStage,
  onSelectStage,
  onReset,
  hasVideo,
  hasSegments,
  hasAudio,
}) => {
  const { logoUrl, creatorName } = useLogo();
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const stages = [
    {
      num: 1 as DubbingStage,
      title: 'បញ្ចូលវីដេអូ',
      enTitle: 'Upload Video',
      icon: Video,
      isAvailable: true,
      isComplete: hasVideo,
    },
    {
      num: 2 as DubbingStage,
      title: 'Gemini AI បកប្រែខ្មែរ',
      enTitle: 'Transcribe & Translate',
      icon: Sparkles,
      isAvailable: hasVideo,
      isComplete: hasSegments,
    },
    {
      num: 3 as DubbingStage,
      title: 'TTS Voice Engine',
      enTitle: 'Generate Voice (.mp3/.wav)',
      icon: Mic2,
      isAvailable: hasSegments,
      isComplete: hasAudio,
    },
    {
      num: 4 as DubbingStage,
      title: 'Mix & FFmpeg Webhook',
      enTitle: 'Mux Video & Download',
      icon: Layers,
      isAvailable: hasAudio || hasSegments,
      isComplete: false,
    },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & App Name & Creator */}
          <div className="flex items-center gap-3.5 w-full md:w-auto justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsLogoModalOpen(true)}
                className="relative group rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                title="ចុចដើម្បីមើល ឬផ្លាស់ប្តូរ Logo កម្មវិធី"
              >
                <img
                  src={logoUrl}
                  alt="Khmer Dubber AI Logo"
                  className="h-11 w-11 rounded-xl shadow-lg shadow-amber-500/20 border border-amber-500/40 object-cover p-0.5 bg-slate-900 group-hover:scale-105 transition-all"
                />
                <span className="absolute inset-0 rounded-xl bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-4 h-4 text-amber-300" />
                </span>
                <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-slate-950" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                    Khmer Dubber <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-semibold border border-indigo-500/30">AI Studio</span>
                  </h1>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-slate-400">
                    កម្មវិធីបញ្ចូលសំឡេងវីដេអូជាភាសាខ្មែរ
                  </p>
                  <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-600" />
                  <span
                    onClick={() => setIsLogoModalOpen(true)}
                    className="cursor-pointer inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/25 shadow-sm hover:bg-amber-500/20 transition-colors"
                    title="ចុចដើម្បីមើលព័ត៌មាន Logo & អ្នកបង្កើត"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                    អ្នកបង្កើតកម្មវិធី: <strong className="text-amber-200 font-bold">{creatorName}</strong>
                  </span>
                </div>
              </div>
            </div>

            {hasVideo && (
              <button
                onClick={onReset}
                className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs flex items-center gap-1.5"
                title="ចាប់ផ្តើមថ្មី"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 4-Stage Stepper Bar */}
          <nav className="flex items-center w-full md:w-auto overflow-x-auto pb-1 md:pb-0 gap-1 sm:gap-2">
            {stages.map((st) => {
              const Icon = st.icon;
              const isActive = currentStage === st.num;
              const isPast = st.isComplete;
              const isEnabled = st.isAvailable;

              return (
                <button
                  key={st.num}
                  disabled={!isEnabled}
                  onClick={() => onSelectStage(st.num)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                      : isPast
                      ? 'bg-slate-900 text-emerald-400 hover:bg-slate-800 border border-emerald-500/20'
                      : isEnabled
                      ? 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      : 'bg-slate-950 text-slate-600 border border-slate-900 cursor-not-allowed opacity-60'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      isActive
                        ? 'bg-white text-indigo-700'
                        : isPast
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : st.num}
                  </span>
                  <div className="text-left">
                    <div className="font-medium leading-none">{st.title}</div>
                    <div className="text-[10px] opacity-70 leading-tight mt-0.5 hidden lg:block">{st.enTitle}</div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Quick Reset & Actions */}
          <div className="hidden md:flex items-center gap-2">
            {hasVideo && (
              <button
                onClick={onReset}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 border border-slate-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>បង្កើតថ្មី</span>
              </button>
            )}
          </div>

        </div>
      </div>

      <LogoModal isOpen={isLogoModalOpen} onClose={() => setIsLogoModalOpen(false)} />
    </header>
  );
};
