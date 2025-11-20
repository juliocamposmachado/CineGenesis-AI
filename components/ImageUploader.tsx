import React, { ChangeEvent } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { UploadedImage } from '../types';

interface ImageUploaderProps {
  label: string;
  image: UploadedImage | null;
  onUpload: (file: File, label: string) => void;
  onRemove: () => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ label, image, onUpload, onRemove }) => {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0], label);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">{label}</span>
      
      {image ? (
        <div className="relative group w-full aspect-[3/4] bg-zinc-900 rounded-lg overflow-hidden border border-zinc-700 shadow-lg">
          <img 
            src={image.previewUrl} 
            alt={label} 
            className="w-full h-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
          />
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-red-500/80 text-white rounded-full transition-colors"
          >
            <X size={16} />
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
            <p className="text-xs text-zinc-300 truncate">{image.file.name}</p>
          </div>
        </div>
      ) : (
        <label className="cursor-pointer w-full aspect-[3/4] flex flex-col items-center justify-center bg-zinc-900/50 border-2 border-dashed border-zinc-700 rounded-lg hover:border-amber-500/50 hover:bg-zinc-800 transition-all group">
          <div className="p-3 rounded-full bg-zinc-800 group-hover:bg-zinc-700 transition-colors mb-3">
            <Upload className="text-gray-400 group-hover:text-amber-500" size={24} />
          </div>
          <span className="text-xs text-gray-500 group-hover:text-gray-300 text-center px-4">
            Clique para enviar referência
          </span>
          <input 
            type="file" 
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
          />
        </label>
      )}
    </div>
  );
};

export default ImageUploader;