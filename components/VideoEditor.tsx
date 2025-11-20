import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Download, Scissors, Plus, Trash2, Layers, Music, Film, Save, Wand2, Library, X, Eye } from 'lucide-react';
import { TimelineClip, LibraryItem } from '../types';

interface VideoEditorProps {
  clips: TimelineClip[];
  onClipsChange: (clips: TimelineClip[]) => void;
  library?: LibraryItem[];
  onSaveToLibrary: (blob: Blob, duration: number) => void;
}

const VideoEditor: React.FC<VideoEditorProps> = ({ clips = [], onClipsChange, library = [], onSaveToLibrary }) => {
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(10); // Default 10s
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [previewClipMode, setPreviewClipMode] = useState(false); // Mode to loop single clip

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const mediaElementsRef = useRef<Map<string, HTMLVideoElement | HTMLAudioElement | HTMLImageElement>>(new Map());
  
  // Initialize Media Elements when clips change
  useEffect(() => {
    clips.forEach(clip => {
      if (!mediaElementsRef.current.has(clip.id)) {
        let el: HTMLVideoElement | HTMLAudioElement | HTMLImageElement;
        
        if (clip.type === 'VIDEO') {
          el = document.createElement('video');
          el.src = clip.src;
          (el as HTMLVideoElement).muted = true; // Mute to handle audio via Web Audio API later
          (el as HTMLVideoElement).load();
        } else if (clip.type === 'AUDIO') {
          el = document.createElement('audio');
          el.src = clip.src;
        } else {
          el = new Image();
          el.src = clip.src;
        }
        mediaElementsRef.current.set(clip.id, el);
      }
    });
    
    // Cleanup removed clips
    const activeIds = new Set(clips.map(c => c.id));
    mediaElementsRef.current.forEach((_, id) => {
      if (!activeIds.has(id)) mediaElementsRef.current.delete(id);
    });

    // Calc total duration
    if (clips.length > 0) {
      const maxDur = Math.max(...clips.map(c => c.startOffset + c.duration), 10);
      setTotalDuration(maxDur);
    }

  }, [clips]);

  // Render Loop
  const renderFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Sort clips by layer
    const activeClips = clips
      .filter(c => {
        // If previewing specific clip, only show that one
        if (previewClipMode && selectedClipId) return c.id === selectedClipId;
        return currentTime >= c.startOffset && currentTime < c.startOffset + c.duration;
      })
      .sort((a, b) => a.layer - b.layer);

    // 3. Draw
    activeClips.forEach(clip => {
      const el = mediaElementsRef.current.get(clip.id);
      if (!el) return;

      // Calculate local time within the clip
      // If previewMode, currentTime is relative to 0 for the clip duration
      let clipLocalTime;
      
      if (previewClipMode) {
         clipLocalTime = currentTime + clip.trimStart;
      } else {
         clipLocalTime = currentTime - clip.startOffset + clip.trimStart;
      }

      // Sync Video
      if (clip.type === 'VIDEO' && el instanceof HTMLVideoElement) {
        if (Number.isFinite(clipLocalTime) && Math.abs(el.currentTime - clipLocalTime) > 0.2) {
           el.currentTime = clipLocalTime;
        }
        
        // Simple crossfade logic
        let alpha = clip.opacity;
        if (!previewClipMode && clip.transitionIn === 'FADE' && (currentTime - clip.startOffset) < 1) {
            alpha = (currentTime - clip.startOffset); // Fade in over 1s
        }
        
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        
        // Safe draw
        if (el.readyState >= 2) {
            ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        }
        ctx.globalAlpha = 1.0;
      }

      // Draw Image
      if (clip.type === 'IMAGE' && el instanceof HTMLImageElement) {
         ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
      }
    });

    // Loop logic
    if (isPlaying) {
      const now = performance.now();
      const deltaTime = (now - startTimeRef.current) / 1000;
      
      // Handle End of Playback
      let maxTime = totalDuration;
      if (previewClipMode && selectedClipId) {
         const clip = clips.find(c => c.id === selectedClipId);
         maxTime = clip ? clip.duration : 5;
      }

      if (deltaTime >= maxTime) {
        setIsPlaying(false);
        setCurrentTime(0); // Reset
        setPreviewClipMode(false); // Exit preview mode automatically
      } else {
        setCurrentTime(deltaTime);
        requestRef.current = requestAnimationFrame(renderFrame);
      }
    }
  };

  // Effect to trigger render when time changes manually or playing
  useEffect(() => {
    if (!isPlaying) {
       renderFrame(); // Draw static frame on scrub
    }
  }, [currentTime, clips, selectedClipId]);

  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = performance.now() - (currentTime * 1000);
      requestRef.current = requestAnimationFrame(renderFrame);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying]);

  const togglePlay = () => {
      setPreviewClipMode(false);
      setIsPlaying(!isPlaying);
  };

  const previewSelectedClip = () => {
      if (!selectedClipId) return;
      const clip = clips.find(c => c.id === selectedClipId);
      if (!clip) return;

      setIsPlaying(false);
      setPreviewClipMode(true);
      setCurrentTime(0);
      setTimeout(() => {
          setIsPlaying(true);
      }, 100);
  };

  const handleExport = () => {
    setExporting(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setPreviewClipMode(false);
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stream = canvas.captureStream(30); // 30 FPS
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      onSaveToLibrary(blob, totalDuration);
      setExporting(false);
    };

    recorder.start();

    // Simulate Playback for Export
    startTimeRef.current = performance.now();
    setIsPlaying(true);

    // Auto stop
    setTimeout(() => {
       recorder.stop();
       setIsPlaying(false);
    }, totalDuration * 1000);
  };

  const updateClip = (id: string, changes: Partial<TimelineClip>) => {
    onClipsChange(clips.map(c => c.id === id ? { ...c, ...changes } : c));
  };

  const deleteClip = (id: string) => {
    onClipsChange(clips.filter(c => c.id !== id));
    if (selectedClipId === id) setSelectedClipId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isVideo = file.type.startsWith('video');
      const isAudio = file.type.startsWith('audio');
      
      const newClip: TimelineClip = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type: isVideo ? 'VIDEO' : isAudio ? 'AUDIO' : 'IMAGE',
        src: URL.createObjectURL(file),
        name: file.name,
        startOffset: currentTime, // Add at cursor
        duration: 5, // Default
        trimStart: 0,
        volume: 1,
        layer: clips.length + 1,
        opacity: 1,
        transitionIn: 'NONE'
      };
      onClipsChange([...clips, newClip]);
      setSelectedClipId(newClip.id);
    }
  };

  const handleImportFromLibrary = (item: LibraryItem) => {
    const newClip: TimelineClip = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type: 'VIDEO',
      src: item.videoUrl,
      name: item.prompt.slice(0, 20) + "...",
      startOffset: currentTime,
      duration: 5, // Safety default
      trimStart: 0,
      volume: 1,
      layer: clips.length + 1,
      opacity: 1,
      transitionIn: 'NONE'
    };
    onClipsChange([...clips, newClip]);
    setSelectedClipId(newClip.id);
    
    // Auto seek to show the imported clip
    setCurrentTime(currentTime);
    
    setShowLibraryModal(false);
  };

  return (
    <div className="flex flex-col h-full gap-4 relative">
      
      {/* --- LIBRARY MODAL --- */}
      {showLibraryModal && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-4xl h-[80%] flex flex-col shadow-2xl">
             <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-lg font-cinema text-white flex items-center gap-2">
                   <Library size={20} className="text-amber-500" /> Importar da Biblioteca
                </h3>
                <button onClick={() => setShowLibraryModal(false)} className="text-zinc-400 hover:text-white">
                   <X size={24} />
                </button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {library.length === 0 ? (
                   <p className="col-span-full text-center text-zinc-500 py-10">Nenhum vídeo na biblioteca.</p>
                ) : (
                   library.map(item => (
                      <div key={item.id} onClick={() => handleImportFromLibrary(item)} className="group cursor-pointer bg-zinc-950 border border-zinc-800 hover:border-amber-500 rounded-lg overflow-hidden transition-all">
                         <div className="aspect-video bg-black relative">
                            <video src={item.videoUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                               <Plus size={32} className="text-amber-500" />
                            </div>
                         </div>
                         <div className="p-2">
                            <p className="text-xs text-white truncate font-medium">{item.prompt}</p>
                            <p className="text-[10px] text-zinc-500">{new Date(item.timestamp).toLocaleDateString()}</p>
                         </div>
                      </div>
                   ))
                )}
             </div>
          </div>
        </div>
      )}

      {/* --- VIEWER --- */}
      <div className="flex-1 bg-black rounded-xl border border-zinc-800 relative flex items-center justify-center overflow-hidden bg-[url('https://transparenttextures.com/patterns/carbon-fibre.png')]">
        <canvas 
          ref={canvasRef} 
          width={1280} 
          height={720} 
          className="max-w-full max-h-[60vh] aspect-video shadow-2xl border border-zinc-900"
        />
        
        {exporting && (
           <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
              <Wand2 className="text-amber-500 animate-pulse mb-4" size={48} />
              <h3 className="text-xl font-cinema text-white">Renderizando Edição...</h3>
              <p className="text-zinc-400 text-sm">Aguarde, estamos processando o vídeo final.</p>
           </div>
        )}

        {previewClipMode && (
           <div className="absolute top-4 right-4 bg-red-600 text-white text-xs px-3 py-1 rounded-full font-bold animate-pulse uppercase tracking-wider">
              Visualizando Clipe Isolado
           </div>
        )}
      </div>

      {/* --- TIMELINE CONTROLS --- */}
      <div className="h-16 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
           <button onClick={togglePlay} className={`p-3 rounded-full text-white transition-colors ${isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
             {isPlaying ? <Pause size={20} /> : <Play size={20} />}
           </button>
           <span className="font-mono text-amber-500 text-sm">
             {currentTime.toFixed(2)}s / {totalDuration.toFixed(2)}s
           </span>
        </div>

        <div className="flex items-center gap-2">
           <button onClick={() => setShowLibraryModal(true)} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded flex items-center gap-2 text-xs font-bold border border-zinc-700">
              <Library size={16} /> Biblioteca
           </button>
           <label className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded cursor-pointer text-zinc-300 hover:text-white transition-colors border border-zinc-700" title="Adicionar Arquivo Local">
              <Plus size={20} />
              <input type="file" className="hidden" accept="video/*,image/*,audio/*" onChange={handleFileUpload} />
           </label>
           <button onClick={handleExport} disabled={exporting} className="px-4 py-2 bg-zinc-200 hover:bg-white text-black font-bold rounded flex items-center gap-2 text-xs">
              <Download size={16} /> Exportar
           </button>
        </div>
      </div>

      {/* --- TIMELINE TRACKS --- */}
      <div className="h-64 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 overflow-y-auto overflow-x-hidden">
        <div className="relative min-h-full" style={{ width: '100%' }}>
           {/* Time Ruler */}
           <div className="h-6 border-b border-zinc-700 mb-2 flex text-[10px] text-zinc-500 select-none">
              {Array.from({ length: Math.ceil(totalDuration) }).map((_, i) => (
                 <div key={i} className="flex-1 border-l border-zinc-800 pl-1 cursor-pointer hover:bg-zinc-800" onClick={() => setCurrentTime(i)}>{i}s</div>
              ))}
           </div>

           {/* Clips */}
           {clips.map((clip) => {
             const isSelected = selectedClipId === clip.id;
             const widthPct = (clip.duration / totalDuration) * 100;
             const leftPct = (clip.startOffset / totalDuration) * 100;
             
             return (
               <div key={clip.id} className="mb-2 relative group">
                 {/* Track Row */}
                 <div 
                    className={`h-12 rounded-lg border-2 flex items-center px-3 cursor-pointer relative overflow-hidden transition-all
                      ${isSelected ? 'border-amber-500 bg-zinc-800' : 'border-zinc-700 bg-zinc-900'}
                    `}
                    style={{ 
                      width: `${widthPct}%`, 
                      marginLeft: `${leftPct}%` 
                    }}
                    onClick={() => {
                        setSelectedClipId(clip.id);
                        setCurrentTime(clip.startOffset); // Auto-seek start on select
                    }}
                 >
                    {clip.type === 'VIDEO' && <Film size={16} className="text-blue-400 mr-2" />}
                    {clip.type === 'AUDIO' && <Music size={16} className="text-green-400 mr-2" />}
                    {clip.type === 'IMAGE' && <Layers size={16} className="text-purple-400 mr-2" />}
                    <span className="text-xs text-white truncate">{clip.name}</span>
                    
                    {/* Handles */}
                    {isSelected && (
                       <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                          <button onClick={(e) => { e.stopPropagation(); deleteClip(clip.id); }} className="p-1 bg-red-500/20 text-red-500 rounded hover:bg-red-500 hover:text-white">
                             <Trash2 size={12} />
                          </button>
                       </div>
                    )}
                 </div>
               </div>
             );
           })}

           {/* Playhead */}
           <div 
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none transition-all duration-75"
              style={{ left: `${(currentTime / totalDuration) * 100}%` }}
           >
              <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 -mt-1.5 shadow-lg" />
           </div>
        </div>
      </div>

      {/* --- INSPECTOR (Selected Clip) --- */}
      {selectedClipId && (
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl grid grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2">
           {clips.find(c => c.id === selectedClipId) && (() => {
              const clip = clips.find(c => c.id === selectedClipId)!;
              return (
                 <>
                    <div className="col-span-4 flex items-center justify-between">
                        <div className="text-xs font-bold text-zinc-500 uppercase">Propriedades: <span className="text-white">{clip.name}</span></div>
                        <button onClick={previewSelectedClip} className="text-xs flex items-center gap-2 bg-zinc-800 hover:bg-amber-900 hover:text-amber-500 px-3 py-1 rounded transition-colors text-zinc-300">
                           <Eye size={14} /> Visualizar Só Este Clipe
                        </button>
                    </div>
                    
                    <div className="space-y-1">
                       <label className="text-[10px] text-zinc-400">Início (Timeline)</label>
                       <input 
                         type="range" min={0} max={totalDuration} step={0.1} 
                         value={clip.startOffset}
                         onChange={(e) => {
                             updateClip(clip.id, { startOffset: parseFloat(e.target.value) });
                             setCurrentTime(parseFloat(e.target.value)); // Visual feedback
                         }}
                         className="w-full accent-amber-500"
                       />
                       <span className="text-xs text-white">{clip.startOffset.toFixed(1)}s</span>
                    </div>

                    <div className="space-y-1">
                       <label className="text-[10px] text-zinc-400">Duração (Corte)</label>
                       <input 
                         type="number" min={0.5} max={20} step={0.5}
                         value={clip.duration}
                         onChange={(e) => updateClip(clip.id, { duration: parseFloat(e.target.value) })}
                         className="w-full bg-zinc-950 border border-zinc-700 rounded p-1 text-xs text-white"
                       />
                    </div>

                    <div className="space-y-1">
                       <label className="text-[10px] text-zinc-400 flex items-center gap-1"><Scissors size={10} /> Aparar Início (Trim)</label>
                       <input 
                         type="range" min={0} max={10} step={0.1}
                         value={clip.trimStart}
                         onChange={(e) => {
                             const val = parseFloat(e.target.value);
                             updateClip(clip.id, { trimStart: val });
                             // CRITICAL: Update currentTime to show the specific trimmed frame immediately
                             setCurrentTime(clip.startOffset); 
                         }}
                         className="w-full accent-amber-500"
                       />
                       <span className="text-xs text-white">+{clip.trimStart.toFixed(1)}s</span>
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                       <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                          <input 
                             type="checkbox" 
                             checked={clip.transitionIn === 'FADE'}
                             onChange={(e) => updateClip(clip.id, { transitionIn: e.target.checked ? 'FADE' : 'NONE' })}
                             className="accent-amber-500" 
                          />
                          Fade In (1s)
                       </label>
                    </div>
                 </>
              );
           })()}
        </div>
      )}
    </div>
  );
};

export default VideoEditor;