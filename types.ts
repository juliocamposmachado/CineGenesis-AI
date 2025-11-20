export interface UploadedImage {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
  label: string; // e.g., "Personagem A"
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING', // Analyzing archetypes
  GENERATING = 'GENERATING', // Generating video
  EXTENDING = 'EXTENDING', // Extending video
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface VideoResult {
  videoUrl: string;
  videoAsset: any; // The internal Google GenAI video object needed for extension
  promptUsed: string;
}

export interface VoiceSettings {
  characterA: string; // Voice description for Protagonist
  characterB: string; // Voice description for Antagonist
}

export interface ProductionSettings {
  transitionStart: 'NONE' | 'FADE_IN' | 'BLUR_IN';
  transitionEnd: 'NONE' | 'FADE_OUT' | 'HARD_CUT';
  audioFadeIn: boolean;
  audioFadeOut: boolean;
  ambientSound: string; // e.g., "Chuva forte", "Cidade distante"
}

export interface LibraryItem {
  id: string;
  timestamp: number;
  prompt: string;
  videoBlob: Blob; // Stored in IndexedDB
  videoUrl: string; // Generated URL for display
  voiceSettings: VoiceSettings;
  type: 'SCENE' | 'EXTENSION';
}