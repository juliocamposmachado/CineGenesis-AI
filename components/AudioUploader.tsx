import React, { ChangeEvent, useRef, useEffect } from 'react';
import { Upload, X, Mic, Play, Pause } from 'lucide-react';
import { UploadedAudio } from '../types';

interface AudioUploaderProps {
  label: string;
  audio: UploadedAudio | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  isAnalyzing?: boolean;
}

const AudioUploader: React.FC<AudioUploaderProps> = ({ label, audio, onUpload, onRemove, isAnalyzing }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-2">
        <Mic size={12} /> {label}
      </span>
      
      {audio ? (
        <div className="relative w-full bg-zinc-900 rounded-lg border border-zinc-700 p-3 flex items-center gap-3 group">
          <div className="bg-zinc-800 p-2 rounded-full text-amber-500 shrink-0">
            <Mic size={16} />
          </div>
          
          <div className="flex-1 min-w-0">
             <p className="text-xs text-zinc-300 truncate mb-1">{audio.file.name}</p>
             <audio controls src={audio.previewUrl} className="w-full h-6 opacity-60 hover:opacity-100 transition-opacity" style={{ height: '24px' }} />
          </div>

          <button
            onClick={onRemove}
            className="p-1.5 hover:bg-red-900/30 text-zinc-500 hover:text-red-500 rounded-full transition-colors"
            title="Remover áudio"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <label className={`cursor-pointer w-full p-3 flex items-center justify-center gap-3 bg-zinc-900/30 border border-dashed border-zinc-700 rounded-lg hover:border-amber-500/50 hover:bg-zinc-900 transition-all group ${isAnalyzing ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload className="text-zinc-600 group-hover:text-amber-500" size={16} />
          <span className="text-xs text-zinc-500 group-hover:text-zinc-300">
            {isAnalyzing ? 'Analisando voz...' : 'Enviar Áudio (Ref)'}
          </span>
          <input 
            type="file" 
            className="hidden" 
            accept="audio/*"
            onChange={handleFileChange}
            disabled={isAnalyzing}
          />
        </label>
      )}
    </div>
  );
};

export default AudioUploader;