export interface UploadedImage {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
  label: string; // e.g., "Personagem A"
}

export interface UploadedAudio {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
  label: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING', // Analyzing archetypes
  ANALYZING_AUDIO = 'ANALYZING_AUDIO', // New status for voice analysis
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
  timestamp: number; // Data e Hora
  prompt: string; // Texto inserido
  videoBlob: Blob; // Arquivo de vídeo
  videoAsset: any; // Objeto técnico da IA necessário para extensão (Novo)
  videoUrl: string; // URL para display
  type: 'SCENE' | 'EXTENSION' | 'EDIT'; // Added EDIT type
  
  // Novos Metadados Solicitados
  generationDuration: string; // Tempo de resposta (ex: "14.5s")
  referenceNames: string[]; // Nomes das fotos/arquivos usados
  voiceSettings?: VoiceSettings; // Config de voz usada
  productionSettings?: ProductionSettings; // Config de atmosfera usada
}

// --- EDITOR TYPES ---

export type ClipType = 'VIDEO' | 'IMAGE' | 'AUDIO';

export interface TimelineClip {
  id: string;
  type: ClipType;
  src: string; // Blob URL
  name: string;
  startOffset: number; // When does this clip start in the global timeline (seconds)
  duration: number; // How long it plays on timeline
  trimStart: number; // Trim from source start
  volume: number; // 0 to 1
  layer: number; // Z-index (0 is bottom)
  opacity: number;
  transitionIn?: 'FADE' | 'NONE';
  transitionOut?: 'FADE' | 'NONE';
}

export interface EditorProject {
  id: string;
  clips: TimelineClip[];
  duration: number; // Total project duration
}

// --- AUTH TYPES ---

export interface User {
  email: string;
  isAdmin: boolean;
  hasActiveSubscription: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}