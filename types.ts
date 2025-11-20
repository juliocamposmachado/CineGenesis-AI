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