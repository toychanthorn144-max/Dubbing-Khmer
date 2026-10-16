import { AudioDiagnosticResult } from '../utils/audioDiagnostic';

export interface DubbingSegment {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  originalText: string;
  khmerText: string;
  speaker: string;
  emotion: string;
  suggestedVoice: string; // 'Kore' | 'Puck' | 'Zephyr' | 'Charon' | 'Fenrir'
  audioBase64?: string;   // Generated WAV base64
  audioUrl?: string;      // Blob URL
  audioDuration?: number; // Detected audio duration
  speed?: number;         // Speech speed factor (0.5 to 2.0, default 1.0)
  appliedSpeed?: number;  // Speed factor already baked into audioBase64 (default 1.0)
  autoFitSpeed?: boolean; // Whether to automatically match video target duration
  isGeneratingAudio?: boolean;
  diagnostic?: AudioDiagnosticResult;
}

export type DubbingStage = 1 | 2 | 3 | 4;

export interface DubbingProject {
  title: string;
  videoUrl: string;
  videoDuration: number;
  originalFileName?: string;
  summary?: string;
  segments: DubbingSegment[];
  status: 'idle' | 'uploading' | 'analyzing' | 'tts_generating' | 'mixing' | 'ready';
}

export interface TTSVoiceOption {
  id: string;
  name: string;
  khmerName: string;
  gender: 'female' | 'male';
  description: string;
  tone: string;
  color: string;
}

export interface AudioMixingOptions {
  muteOriginal: boolean;
  duckingVolume: number; // 0 to 1 (e.g. 0.15 for 15%)
  dubbedVolume: number;  // 0 to 1.5 (e.g. 1.0 for 100%)
  
  // Audio Stem Separation Controls (ញ៉ែកសំឡេងនិយាយដើម និងភ្លេងដើម)
  originalVocalVolume: number; // 0 to 1.0 (default 0.0 - mute original speaker)
  muteOriginalVocal: boolean;  // whether original speaker vocal is muted
  originalBgmVolume: number;   // 0 to 1.0 (default 0.25 - background music/ambiance)
  muteOriginalBgm: boolean;    // whether background music is muted
  vocalsUrl?: string;          // Isolated original vocals WAV URL
  bgmUrl?: string;             // Isolated original background music WAV URL
  isSeparated?: boolean;       // Whether separation has been performed
  isSeparating?: boolean;      // Loading indicator for separation process

  burnSubtitles: boolean;
  subtitleFontSize: number;
  subtitleColor: string;
}

export interface SampleVideo {
  id: string;
  titleKhmer: string;
  titleEn: string;
  duration: number;
  category: string;
  videoUrl: string;
  thumbnailUrl: string;
  description: string;
  initialContext: string;
}
