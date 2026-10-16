import React, { useState, useRef, useEffect } from 'react';
import { DubbingStage, DubbingSegment, AudioMixingOptions } from './types/dubber';
import { SAMPLE_VIDEOS, TTS_VOICES } from './data/sampleVideos';
import { Header } from './components/Header';
import { VideoPlayerPreview } from './components/VideoPlayerPreview';
import { Stage1Upload } from './components/Stage1Upload';
import { Stage2TranscriptEditor } from './components/Stage2TranscriptEditor';
import { Stage3TTSStudio } from './components/Stage3TTSStudio';
import { Stage4MixAndExport } from './components/Stage4MixAndExport';
import { renderDubbedVideo, RenderProgress } from './utils/videoMixer';
import { base64ToBlobUrl } from './utils/audioUtils';
import { diagnoseBase64Audio } from './utils/audioDiagnostic';
import { AlertCircle, CheckCircle2, Sparkles, Activity } from 'lucide-react';
import { useLogo } from './context/LogoContext';
import { LogoModal } from './components/LogoModal';

const INITIAL_DEMO_SEGMENTS: DubbingSegment[] = [
  {
    id: 'seg-1',
    startTime: 0.5,
    endTime: 4.8,
    originalText: 'Artificial intelligence is evolving at an unprecedented pace, changing how we work.',
    khmerText: 'បច្ចេកវិទ្យាបញ្ញាសិប្បនិម្មិត AI កំពុងមានការរីកចម្រើនយ៉ាងលឿនអស្ចារ្យ និងផ្លាស់ប្តូររបៀបរស់នៅរបស់យើង។',
    speaker: 'អ្នករៀបរាប់',
    emotion: 'រស់រវើក',
    suggestedVoice: 'Kore',
  },
  {
    id: 'seg-2',
    startTime: 5.2,
    endTime: 9.6,
    originalText: 'Modern neural networks can understand complex patterns, speech, and multimodal data in real time.',
    khmerText: 'បណ្តាញ Neural Network ជំនាន់ថ្មី អាចយល់ដឹងពីទិន្នន័យស្មុគស្មាញ សំឡេង និងរូបភាពបានភ្លាមៗក្នុងពេលជាក់ស្តែង។',
    speaker: 'អ្នករៀបរាប់',
    emotion: 'វិជ្ជាជីវៈ',
    suggestedVoice: 'Zephyr',
  },
  {
    id: 'seg-3',
    startTime: 10.0,
    endTime: 14.5,
    originalText: 'This opens groundbreaking possibilities for creators, developers, and global communication.',
    khmerText: 'ការណ៍នេះបានបើកឱកាសដ៏អស្ចារ្យ សម្រាប់អ្នកបង្កើតមាតិកា អ្នកអភិវឌ្ឍន៍ និងការប្រាស្រ័យទាក់ទងទូទាំងពិភពលោក។',
    speaker: 'អ្នករៀបរាប់',
    emotion: 'រំភើប',
    suggestedVoice: 'Puck',
  },
];

export default function App() {
  const { logoUrl, creatorName } = useLogo();
  const [isFooterLogoModalOpen, setIsFooterLogoModalOpen] = useState(false);
  const [currentStage, setCurrentStage] = useState<DubbingStage>(1);
  const [videoUrl, setVideoUrl] = useState<string>(SAMPLE_VIDEOS[0].videoUrl);
  const [videoTitle, setVideoTitle] = useState<string>(SAMPLE_VIDEOS[0].titleKhmer);
  const [videoDuration, setVideoDuration] = useState<number>(SAMPLE_VIDEOS[0].duration);
  const [audioBase64, setAudioBase64] = useState<string | undefined>(undefined);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/wav');
  const [contextInfo, setContextInfo] = useState<string>(SAMPLE_VIDEOS[0].initialContext);

  const [segments, setSegments] = useState<DubbingSegment[]>(INITIAL_DEMO_SEGMENTS);
  const [summary, setSummary] = useState<string>(
    'វីដេអូបទបង្ហាញអំពីការអភិវឌ្ឍន៍នៃបញ្ញាសិប្បនិម្មិត AI និងឥទ្ធិពលលើពិភពលោក។'
  );

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const [mixingOptions, setMixingOptions] = useState<AudioMixingOptions>({
    muteOriginal: false,
    duckingVolume: 0.2,
    dubbedVolume: 1.0,
    originalVocalVolume: 0.0,
    muteOriginalVocal: true,
    originalBgmVolume: 0.25,
    muteOriginalBgm: false,
    vocalsUrl: '/stems/ai-tech_vocals.wav',
    bgmUrl: '/stems/ai-tech_bgm.wav',
    isSeparated: true,
    isSeparating: false,
    burnSubtitles: true,
    subtitleFontSize: 28,
    subtitleColor: '#FFFFFF',
  });

  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Pre-load audio for initial demo segments on startup so audio is immediately audible
  useEffect(() => {
    let isMounted = true;
    const preloadDemoAudio = async () => {
      const currentSegments = [...INITIAL_DEMO_SEGMENTS];
      let changed = false;

      for (let i = 0; i < currentSegments.length; i++) {
        if (!currentSegments[i].audioUrl && isMounted) {
          try {
            const res = await fetch('/api/tts/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: currentSegments[i].khmerText,
                voice: currentSegments[i].suggestedVoice || 'Kore',
              }),
            });
            const resData = await res.json();
            if (resData.success && resData.audioBase64 && isMounted) {
              const diagnostic = await diagnoseBase64Audio(resData.audioBase64);
              if (diagnostic.isValid) {
                const blobUrl = base64ToBlobUrl(resData.audioBase64, 'audio/wav');
                currentSegments[i] = {
                  ...currentSegments[i],
                  audioBase64: resData.audioBase64,
                  audioUrl: blobUrl,
                  audioDuration: diagnostic.duration,
                  diagnostic,
                };
                changed = true;
              }
            }
          } catch (err) {
            console.warn('Demo audio preload error:', err);
          }
        }
      }

      if (changed && isMounted) {
        setSegments([...currentSegments]);
      }
    };

    preloadDemoAudio();
    return () => {
      isMounted = false;
    };
  }, []);

  // Stage 1: Video selection handler
  const handleVideoSelected = (data: {
    videoUrl: string;
    videoTitle: string;
    videoDuration: number;
    audioBase64?: string;
    audioMimeType?: string;
    contextInfo?: string;
    isSample?: boolean;
  }) => {
    setVideoUrl(data.videoUrl);
    setVideoTitle(data.videoTitle);
    setVideoDuration(data.videoDuration);
    setAudioBase64(data.audioBase64);
    if (data.audioMimeType) setAudioMimeType(data.audioMimeType);
    if (data.contextInfo) setContextInfo(data.contextInfo);

    if (!data.isSample) {
      setSegments([]);
      setSummary('');
    } else {
      setSegments(INITIAL_DEMO_SEGMENTS);
    }

    // Auto link pre-generated sample stems or reset for uploaded video
    let stemVocal: string | undefined = undefined;
    let stemBgm: string | undefined = undefined;
    if (data.videoUrl.includes('coffee-craft')) {
      stemVocal = '/stems/coffee-craft_vocals.wav';
      stemBgm = '/stems/coffee-craft_bgm.wav';
    } else if (data.videoUrl.includes('nature-ocean')) {
      stemVocal = '/stems/nature-ocean_vocals.wav';
      stemBgm = '/stems/nature-ocean_bgm.wav';
    } else if (data.videoUrl.includes('ai-tech')) {
      stemVocal = '/stems/ai-tech_vocals.wav';
      stemBgm = '/stems/ai-tech_bgm.wav';
    }

    setMixingOptions((prev) => ({
      ...prev,
      vocalsUrl: stemVocal,
      bgmUrl: stemBgm,
      isSeparated: !!stemVocal,
      muteOriginalVocal: true,
      originalVocalVolume: 0.0,
      originalBgmVolume: 0.25,
      muteOriginalBgm: false,
    }));

    setRenderedVideoUrl(null);
    showToast(`បានជ្រើសរើសវីដេអូ: "${data.videoTitle}"`, 'success');
  };

  // Stem separation handler (ញ៉ែក សំលេងនិយាយដើម និងភ្លេងដើម)
  const handleSeparateStems = async () => {
    setMixingOptions((prev) => ({ ...prev, isSeparating: true }));
    showToast('កំពុងដំណើរការញ៉ែកសំឡេងនិយាយដើម (Vocals) និងភ្លេងដើម (BGM)...', 'info');
    try {
      const res = await fetch('/api/audio/separate-stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl,
          videoTitle,
          audioBase64,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMixingOptions((prev) => ({
          ...prev,
          isSeparated: true,
          isSeparating: false,
          vocalsUrl: data.vocalsUrl,
          bgmUrl: data.bgmUrl,
          muteOriginalVocal: true,
          originalVocalVolume: 0.0,
          originalBgmVolume: 0.25,
          muteOriginalBgm: false,
        }));
        showToast('ញ៉ែកសំឡេងនិយាយដើម និងភ្លេងដើម បានជោគជ័យ! (Stems Ready)', 'success');
      } else {
        throw new Error(data.error || 'Failed to separate stems');
      }
    } catch (err: any) {
      console.error('Stem separation error:', err);
      setMixingOptions((prev) => ({ ...prev, isSeparating: false }));
      showToast(`ការញ៉ែកសំឡេងបរាជ័យ: ${err.message}`, 'error');
    }
  };

  // Stage 2: Gemini API Transcribe & Translate
  const handleAnalyzeWithGemini = async () => {
    setIsAnalyzing(true);
    showToast('កំពុងដំណើរការ Gemini 3.8 Flash ដើម្បីស្រង់ពាក្យ និងបកប្រែជាភាសាខ្មែរ...', 'info');

    try {
      const response = await fetch('/api/transcribe-and-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: audioBase64,
          mimeType: audioMimeType,
          contextInfo: contextInfo,
          videoTitle: videoTitle,
        }),
      });

      const resData = await response.json();

      if (!resData.success) {
        throw new Error(resData.error || 'Failed to analyze video');
      }

      const { data } = resData;
      setSummary(data.summary || '');
      if (data.segments && Array.isArray(data.segments)) {
        setSegments(data.segments);
      }

      showToast(`ការវិភាគបានជោគជ័យ! បានស្រង់ ${data.segments?.length || 0} ឃ្លា។`, 'success');
    } catch (err: any) {
      console.error('Gemini analysis error:', err);
      showToast(`ការវិភាគមានបញ្ហា: ${err.message}`, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Segment editing
  const handleUpdateSegment = (segmentId: string, updated: Partial<DubbingSegment>) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segmentId ? { ...s, ...updated } : s))
    );
  };

  const handleAddSegment = () => {
    const lastSeg = segments[segments.length - 1];
    const newStart = lastSeg ? lastSeg.endTime + 0.5 : 0;
    const newEnd = newStart + 3.0;

    const newSeg: DubbingSegment = {
      id: `seg-${Date.now()}`,
      startTime: Number(newStart.toFixed(1)),
      endTime: Number(newEnd.toFixed(1)),
      originalText: 'New dialogue sentence',
      khmerText: 'ឃ្លានិយាយភាសាខ្មែរថ្មី',
      speaker: 'អ្នករៀបរាប់',
      emotion: 'រស់រវើក',
      suggestedVoice: 'Kore',
    };

    setSegments((prev) => [...prev, newSeg]);
  };

  const handleRemoveSegment = (segmentId: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== segmentId));
  };

  // Stage 3: Batch TTS generation with optional auto-fit duration
  const handleGenerateBatchTTS = async (defaultVoice: string, autoFitAll = false) => {
    if (segments.length === 0) return;

    setIsGeneratingBatch(true);
    setBatchProgress({ current: 0, total: segments.length });
    showToast('កំពុងដំណើរការ TTS Engine បង្កើតសំឡេង និងតម្រឹមល្បឿន...', 'info');

    const updatedSegments = [...segments];

    for (let i = 0; i < updatedSegments.length; i++) {
      const seg = updatedSegments[i];
      setBatchProgress({ current: i + 1, total: updatedSegments.length });

      try {
        const targetDuration = autoFitAll || seg.autoFitSpeed ? Math.max(0.5, seg.endTime - seg.startTime) : undefined;
        const speed = seg.speed || 1.0;

        const response = await fetch('/api/tts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: seg.khmerText,
            voice: seg.suggestedVoice || defaultVoice || 'Kore',
            style: `Natural Khmer dubbing, ${seg.emotion || 'clear and expressive'}`,
            speed,
            targetDuration,
          }),
        });

        const resData = await response.json();
        if (resData.success && resData.audioBase64) {
          // Audio Diagnostic Inspection before applying to UI
          const diagnostic = await diagnoseBase64Audio(resData.audioBase64);

          if (!diagnostic.isValid) {
            console.error(`Audio diagnostic rejected segment ${seg.id}:`, diagnostic.errors);
            showToast(`សំឡេងមិនត្រឹមត្រូវ (${seg.speaker}): ${diagnostic.errors.join(', ')}`, 'error');
            continue;
          }

          const blobUrl = base64ToBlobUrl(resData.audioBase64, 'audio/wav');
          updatedSegments[i] = {
            ...seg,
            audioBase64: resData.audioBase64,
            audioUrl: blobUrl,
            audioDuration: diagnostic.duration,
            speed,
            appliedSpeed: speed,
            diagnostic,
          };
          setSegments([...updatedSegments]);
        }
      } catch (err: any) {
        console.warn(`TTS error for segment ${seg.id}:`, err);
      }

      // Respect rate limit quota by pacing requests
      if (i < updatedSegments.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    setIsGeneratingBatch(false);
    setBatchProgress(null);
    showToast('ការបង្កើតសំឡេងនិយាយជាភាសាខ្មែរទាំងអស់បានរួចរាល់ និងតម្រឹមល្បឿនជោគជ័យ!', 'success');
  };

  // Stage 3: Single segment TTS generation with speed & target duration controls
  const handleGenerateSingleTTS = async (
    segmentId: string,
    voice: string,
    style?: string,
    speed?: number,
    targetDuration?: number
  ) => {
    const seg = segments.find((s) => s.id === segmentId);
    if (!seg) return;

    handleUpdateSegment(segmentId, { isGeneratingAudio: true });

    try {
      const segSpeed = speed !== undefined ? speed : (seg.speed || 1.0);
      const effectiveTargetDuration = targetDuration !== undefined 
        ? targetDuration 
        : (seg.autoFitSpeed ? Math.max(0.5, seg.endTime - seg.startTime) : undefined);

      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: seg.khmerText,
          voice: voice || seg.suggestedVoice || 'Kore',
          style: style || `Natural Khmer voice, ${seg.emotion || 'warm and clear'}`,
          speed: segSpeed,
          targetDuration: effectiveTargetDuration,
        }),
      });

      const resData = await response.json();
      if (!resData.success || !resData.audioBase64) {
        throw new Error(resData.error || 'TTS generation failed');
      }

      // Audio Diagnostic inspection before applying to UI
      const diagnostic = await diagnoseBase64Audio(resData.audioBase64);
      if (!diagnostic.isValid) {
        throw new Error(`Audio Diagnostic Check Failed: ${diagnostic.errors.join('; ')}`);
      }

      const blobUrl = base64ToBlobUrl(resData.audioBase64, 'audio/wav');
      handleUpdateSegment(segmentId, {
        audioBase64: resData.audioBase64,
        audioUrl: blobUrl,
        audioDuration: diagnostic.duration,
        speed: segSpeed,
        appliedSpeed: segSpeed,
        diagnostic,
        isGeneratingAudio: false,
      });

      showToast(`បានកែសម្រួលល្បឿន (${segSpeed}x • ${diagnostic.duration}s): "${seg.khmerText.slice(0, 18)}..."`, 'success');
    } catch (err: any) {
      console.error('Single TTS error:', err);
      handleUpdateSegment(segmentId, { isGeneratingAudio: false });
      showToast(`ការបង្កើតសំឡេងបរាជ័យ: ${err.message}`, 'error');
    }
  };

  // Auto-fit all speeds to match original video duration for every segment
  const handleAutoFitAllSpeeds = () => {
    let updatedCount = 0;
    setSegments((prev) =>
      prev.map((seg) => {
        const targetDuration = Math.max(0.2, seg.endTime - seg.startTime);
        const audioDuration = seg.audioDuration || seg.diagnostic?.duration || 0;
        if (audioDuration > 0) {
          const ratio = audioDuration / targetDuration;
          const optimalSpeed = Math.max(0.6, Math.min(1.85, Math.round(ratio * 100) / 100));
          updatedCount++;
          return { ...seg, speed: optimalSpeed, autoFitSpeed: true };
        }
        return seg;
      })
    );
    showToast(`បានគណនា និងបន្ស៊ីល្បឿនស្វ័យប្រវត្តិសម្រាប់ ${updatedCount} ឃ្លា!`, 'success');
  };

  // Reset all speeds to 1.0x
  const handleResetAllSpeeds = () => {
    setSegments((prev) => prev.map((seg) => ({ ...seg, speed: 1.0, autoFitSpeed: false })));
    showToast('បានកំណត់ល្បឿនទាំងអស់ត្រឡប់មកធម្មតា 1.0x!', 'info');
  };

  // Stage 4: Render Dubbed Video
  const handleStartRenderVideo = async () => {
    if (!videoRef.current) return;

    try {
      const result = await renderDubbedVideo(
        videoRef.current,
        segments,
        mixingOptions,
        (progress) => setRenderProgress(progress)
      );

      setRenderedVideoUrl(result.downloadUrl);
      showToast('វីដេអូបញ្ចូលសំឡេងខ្មែររួចរាល់! ចាប់ផ្តើមទាញយក...', 'success');

      // Auto trigger download
      const a = document.createElement('a');
      a.href = result.downloadUrl;
      a.download = `${videoTitle || 'video'}_khmer_dubbed.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Video rendering error:', err);
      showToast(`ការ Render វីដេអូមានបញ្ហា: ${err.message}`, 'error');
    }
  };

  const handleResetProject = () => {
    setVideoUrl(SAMPLE_VIDEOS[0].videoUrl);
    setVideoTitle(SAMPLE_VIDEOS[0].titleKhmer);
    setVideoDuration(SAMPLE_VIDEOS[0].duration);
    setSegments(INITIAL_DEMO_SEGMENTS);
    setCurrentStage(1);
    setRenderedVideoUrl(null);
    showToast('បានកំណត់គម្រោងឡើងវិញជាថ្មី', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Navigation */}
      <Header
        currentStage={currentStage}
        onSelectStage={(stage) => setCurrentStage(stage)}
        onReset={handleResetProject}
        hasVideo={!!videoUrl}
        hasSegments={segments.length > 0}
        hasAudio={segments.some((s) => !!s.audioUrl)}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Video Player Preview (Always visible on top for real-time monitoring) */}
        <VideoPlayerPreview
          videoUrl={videoUrl}
          videoTitle={videoTitle}
          segments={segments}
          mixingOptions={mixingOptions}
          onUpdateMixingOptions={(opts) => setMixingOptions((prev) => ({ ...prev, ...opts }))}
          videoRef={videoRef}
          onSeparateStems={handleSeparateStems}
        />

        {/* Dynamic Stage Workflow View */}
        <div className="pt-2">
          {currentStage === 1 && (
            <Stage1Upload
              onVideoSelected={handleVideoSelected}
              onProceedToStage2={() => {
                setCurrentStage(2);
                if (segments.length === 0) {
                  handleAnalyzeWithGemini();
                }
              }}
              currentVideoUrl={videoUrl}
              currentVideoTitle={videoTitle}
            />
          )}

          {currentStage === 2 && (
            <Stage2TranscriptEditor
              segments={segments}
              summary={summary}
              isAnalyzing={isAnalyzing}
              onAnalyzeWithGemini={handleAnalyzeWithGemini}
              onUpdateSegment={handleUpdateSegment}
              onAddSegment={handleAddSegment}
              onRemoveSegment={handleRemoveSegment}
              onProceedToStage3={() => setCurrentStage(3)}
              onPreviewSegmentAudio={(seg) => {
                if (seg.audioUrl) {
                  const audio = new Audio(seg.audioUrl);
                  audio.play();
                }
              }}
            />
          )}

          {currentStage === 3 && (
            <Stage3TTSStudio
              segments={segments}
              isGeneratingBatch={isGeneratingBatch}
              batchProgress={batchProgress}
              onGenerateBatchTTS={handleGenerateBatchTTS}
              onGenerateSingleTTS={handleGenerateSingleTTS}
              onUpdateSegment={handleUpdateSegment}
              onAutoFitAllSpeeds={handleAutoFitAllSpeeds}
              onResetAllSpeeds={handleResetAllSpeeds}
              onProceedToStage4={() => setCurrentStage(4)}
            />
          )}

          {currentStage === 4 && (
            <Stage4MixAndExport
              segments={segments}
              videoDuration={videoDuration}
              mixingOptions={mixingOptions}
              onUpdateMixingOptions={(opts) => setMixingOptions((prev) => ({ ...prev, ...opts }))}
              onStartRenderVideo={handleStartRenderVideo}
              renderProgress={renderProgress}
              renderedVideoUrl={renderedVideoUrl}
              videoTitle={videoTitle}
              onSeparateStems={handleSeparateStems}
            />
          )}
        </div>
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 transition-all animate-bounce">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-medium border backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
                : toastMessage.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-500/40'
                : 'bg-indigo-950/90 text-indigo-200 border-indigo-500/40'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-xs text-slate-400 mt-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsFooterLogoModalOpen(true)}
              className="relative group rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
              title="ចុចដើម្បីមើល ឬផ្លាស់ប្តូរ Logo កម្មវិធី"
            >
              <img
                src={logoUrl}
                alt="Khmer Dubber Logo"
                className="w-10 h-10 rounded-xl border border-amber-500/40 object-cover p-0.5 bg-slate-900 shadow-md group-hover:scale-105 transition-all"
              />
            </button>
            <div className="text-left">
              <p className="font-semibold text-slate-200 text-sm">Khmer AI Video Dubber</p>
              <p className="text-[11px] text-slate-500">ដំណើរការដោយ Gemini 3.8 Flash, Speech TTS Engine & Web Audio Muxer</p>
            </div>
          </div>

          <div
            onClick={() => setIsFooterLogoModalOpen(true)}
            className="cursor-pointer flex items-center gap-2.5 bg-slate-900/90 hover:bg-slate-800/90 border border-amber-500/30 px-4 py-2 rounded-xl shadow-inner transition-colors"
            title="ចុចដើម្បីមើល Logo & ព័ត៌មានអ្នកបង្កើត"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="text-slate-300 text-xs">
              អ្នកបង្កើតកម្មវិធី: <span className="font-bold text-amber-300">{creatorName}</span>
            </span>
          </div>

          <p className="text-[11px] text-slate-500">© 2026 Khmer Dubber AI • រក្សាសិទ្ធិគ្រប់យ៉ាង</p>
        </div>
      </footer>

      <LogoModal isOpen={isFooterLogoModalOpen} onClose={() => setIsFooterLogoModalOpen(false)} />
    </div>
  );
}
