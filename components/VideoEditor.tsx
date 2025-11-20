import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Download, Scissors, Plus, Trash2, Layers, Music, Film, Save, Wand2, Library, X, Eye, Volume2, FileAudio, Camera } from 'lucide-react';
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
  const [totalDuration, setTotalDuration] = useState(10);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [previewClipMode, setPreviewClipMode] = useState(false);
  
  // Resizing State
  const [viewerHeight, setViewerHeight] = useState(60); // vh
  const [isResizing, setIsResizing] = useState(false);
  
  // Thumbnails State
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());

  // Loading State
  const [loadingResources, setLoadingResources] = useState<Set<string>>(new Set());

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  
  // Media Elements (DOM nodes)
  const mediaElementsRef = useRef<Map<string, HTMLVideoElement | HTMLAudioElement | HTMLImageElement>>(new Map());
  
  // Web Audio API Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const sourceNodesRef = useRef<Map<string, MediaElementAudioSourceNode>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());

  // Initialize Audio Context
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const dest = ctx.createMediaStreamDestination();
    
    audioContextRef.current = ctx;
    audioDestRef.current = dest;

    return () => {
      ctx.close();
    };
  }, []);

  // Generate Thumbnail Helper
  const generateThumbnail = (clip: TimelineClip, el: HTMLVideoElement | HTMLImageElement) => {
    if (thumbnails.has(clip.id)) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160; // Thumbnail width
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (el instanceof HTMLVideoElement) {
           // Wait for ready state if needed or draw if ready
           if(el.readyState >= 2) {
              ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
              setThumbnails(prev => new Map(prev).set(clip.id, canvas.toDataURL()));
           } else {
              const onSeek = () => {
                 ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
                 setThumbnails(prev => new Map(prev).set(clip.id, canvas.toDataURL()));
                 el.removeEventListener('seeked', onSeek);
              };
              el.addEventListener('seeked', onSeek);
              el.currentTime = 0.5; // Capture at 0.5s
           }
        } else {
           ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
           setThumbnails(prev => new Map(prev).set(clip.id, canvas.toDataURL()));
        }
      }
    } catch (e) {
      console.warn("Thumbnail gen failed", e);
    }
  };

  // Initialize Media Elements & Audio Graph when clips change
  useEffect(() => {
    if (!audioContextRef.current || !audioDestRef.current) return;
    const ctx = audioContextRef.current;
    const dest = audioDestRef.current;

    clips.forEach(clip => {
      // 1. Create Element if missing
      if (!mediaElementsRef.current.has(clip.id)) {
        let el: HTMLVideoElement | HTMLAudioElement | HTMLImageElement;
        
        const handleCanPlay = () => {
           setLoadingResources(prev => {
              const newSet = new Set(prev);
              newSet.delete(clip.id);
              return newSet;
           });
           // Try generating thumbnail
           if (clip.type !== 'AUDIO') {
             generateThumbnail(clip, el as HTMLVideoElement | HTMLImageElement);
           }
        };

        const handleWaiting = () => {
           setLoadingResources(prev => new Set(prev).add(clip.id));
        };
        
        if (clip.type === 'VIDEO') {
          el = document.createElement('video');
          el.src = clip.src;
          el.crossOrigin = "anonymous"; 
          el.preload = "auto";
          el.oncanplay = handleCanPlay;
          el.onwaiting = handleWaiting;
          // Force load
          (el as HTMLVideoElement).load();
          // Initial loading state
          setLoadingResources(prev => new Set(prev).add(clip.id));
        } else if (clip.type === 'AUDIO') {
          el = document.createElement('audio');
          el.src = clip.src;
          el.crossOrigin = "anonymous";
          el.preload = "auto";
          el.oncanplay = handleCanPlay;
          el.onwaiting = handleWaiting;
        } else {
          el = new Image();
          el.src = clip.src;
          el.crossOrigin = "anonymous";
          // Image loads instantly usually, but trigger thumb gen
          el.onload = () => generateThumbnail(clip, el as HTMLImageElement);
        }
        mediaElementsRef.current.set(clip.id, el);

        // 2. Connect to Web Audio API (Video/Audio only)
        if (clip.type !== 'IMAGE' && (el instanceof HTMLVideoElement || el instanceof HTMLAudioElement)) {
           try {
             const source = ctx.createMediaElementSource(el);
             const gain = ctx.createGain();
             
             source.connect(gain);
             gain.connect(ctx.destination); // Connect to speakers
             gain.connect(dest); // Connect to recorder destination
             
             sourceNodesRef.current.set(clip.id, source);
             gainNodesRef.current.set(clip.id, gain);
           } catch (e) {
             console.warn("Audio Node creation skipped", e);
           }
        }
      }

      // 3. Update Volume
      const gainNode = gainNodesRef.current.get(clip.id);
      if (gainNode) {
         gainNode.gain.value = clip.volume;
      }
    });
    
    // Cleanup removed clips
    const activeIds = new Set(clips.map(c => c.id));
    mediaElementsRef.current.forEach((el, id) => {
      if (!activeIds.has(id)) {
         const gain = gainNodesRef.current.get(id);
         if (gain) gain.disconnect();
         
         // Remove listeners to avoid leaks
         el.oncanplay = null;
         el.onwaiting = null;

         mediaElementsRef.current.delete(id);
         sourceNodesRef.current.delete(id);
         gainNodesRef.current.delete(id);
         setLoadingResources(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
         });
      }
    });

    // Calc total duration
    if (clips.length > 0) {
      const maxDur = Math.max(...clips.map(c => c.startOffset + c.duration), 10);
      setTotalDuration(maxDur);
    }

  }, [clips]);

  // Playback Pre-Sync Logic (Avoids audio drift)
  useEffect(() => {
      if (isPlaying) {
          // Pre-sync all active media to current time before starting loop
          clips.forEach(clip => {
             const el = mediaElementsRef.current.get(clip.id);
             if (!el) return;
             const clipLocalTime = currentTime - clip.startOffset + clip.trimStart;
             const isActive = currentTime >= clip.startOffset && currentTime < clip.startOffset + clip.duration;
             
             if (isActive && (el instanceof HTMLVideoElement || el instanceof HTMLAudioElement)) {
                 el.currentTime = clipLocalTime;
                 el.play().catch(e => console.log("Play interrupted", e));
             }
          });
      }
  }, [isPlaying]);

  // Render Loop
  const renderFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Sort active clips
    const activeClips = clips
      .filter(c => {
        if (previewClipMode && selectedClipId) return c.id === selectedClipId;
        return currentTime >= c.startOffset && currentTime < c.startOffset + c.duration;
      })
      .sort((a, b) => a.layer - b.layer);

    // 3. Process Clips (Draw + Sync Audio)
    activeClips.forEach(clip => {
      const el = mediaElementsRef.current.get(clip.id);
      if (!el) return;

      // Calculate local time
      let clipLocalTime;
      if (previewClipMode) {
         clipLocalTime = currentTime + clip.trimStart;
      } else {
         clipLocalTime = currentTime - clip.startOffset + clip.trimStart;
      }

      // Handle Video Drawing & Sync
      if (clip.type === 'VIDEO' && el instanceof HTMLVideoElement) {
        // Sync Time (Tight tolerance)
        if (Number.isFinite(clipLocalTime) && Math.abs(el.currentTime - clipLocalTime) > 0.1) {
           // Only seek if drift is significant to avoid audio glitches
           el.currentTime = clipLocalTime;
        }
        
        if (isPlaying && el.paused && el.readyState >= 2) {
             const playPromise = el.play();
             if (playPromise !== undefined) {
                playPromise.catch(() => {});
             }
        }
        if (!isPlaying && !el.paused) el.pause();

        // Draw
        let alpha = clip.opacity;
        // Fade In Logic
        if (!previewClipMode && clip.transitionIn === 'FADE' && (currentTime - clip.startOffset) < 1) {
            alpha = (currentTime - clip.startOffset); 
        }
        
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        if (el.readyState >= 2) {
            ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        }
        ctx.globalAlpha = 1.0;
      }

      // Handle Audio Sync
      if (clip.type === 'AUDIO' && el instanceof HTMLAudioElement) {
        if (Number.isFinite(clipLocalTime) && Math.abs(el.currentTime - clipLocalTime) > 0.1) {
           el.currentTime = clipLocalTime;
        }
        if (isPlaying && el.paused && el.readyState >= 2) {
             const playPromise = el.play();
             if (playPromise !== undefined) playPromise.catch(() => {});
        }
        if (!isPlaying && !el.paused) el.pause();
      }

      // Draw Image
      if (clip.type === 'IMAGE' && el instanceof HTMLImageElement) {
         ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
      }
    });

    // 4. Pause inactive media
    clips.forEach(clip => {
        const el = mediaElementsRef.current.get(clip.id);
        const isActive = activeClips.find(c => c.id === clip.id);
        
        if (!isActive && el) {
           if (el instanceof HTMLVideoElement || el instanceof HTMLAudioElement) {
              if (!el.paused) el.pause();
           }
        }
    });

    // Loop logic
    if (isPlaying) {
      const now = performance.now();
      const deltaTime = (now - startTimeRef.current) / 1000;
      
      let maxTime = totalDuration;
      if (previewClipMode && selectedClipId) {
         const clip = clips.find(c => c.id === selectedClipId);
         maxTime = clip ? clip.duration : 5;
      }

      if (deltaTime >= maxTime) {
        setIsPlaying(false);
        setCurrentTime(0); 
        setPreviewClipMode(false); 
      } else {
        setCurrentTime(deltaTime);
        requestRef.current = requestAnimationFrame(renderFrame);
      }
    }
  };

  useEffect(() => {
    if (!isPlaying) {
       renderFrame(); // Scrub update
    }
  }, [currentTime, clips, selectedClipId]);

  useEffect(() => {
    if (isPlaying) {
      // Resume Audio Context if suspended (browser policy)
      if (audioContextRef.current?.state === 'suspended') {
         audioContextRef.current.resume();
      }
      
      startTimeRef.current = performance.now() - (currentTime * 1000);
      requestRef.current = requestAnimationFrame(renderFrame);
    } else {
      cancelAnimationFrame(requestRef.current);
      // Pause all media
      mediaElementsRef.current.forEach(el => {
          if (el instanceof HTMLVideoElement || el instanceof HTMLAudioElement) el.pause();
      });
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying]);

  const togglePlay = () => {
      setPreviewClipMode(false);
      setIsPlaying(!isPlaying);
  };

  const previewSelectedClip = () => {
      if (!selectedClipId) return;
      setIsPlaying(false);
      setPreviewClipMode(true);
      setCurrentTime(0);
      setTimeout(() => setIsPlaying(true), 100);
  };

  const handleSaveFrame = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `cinegenesis_frame_${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const handleExport = () => {
    setExporting(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setPreviewClipMode(false);
    
    const canvas = canvasRef.current;
    const audioDest = audioDestRef.current;
    if (!canvas || !audioDest) return;

    // Combine Canvas Video Stream + Web Audio Stream
    const canvasStream = canvas.captureStream(30); // 30 FPS
    const audioStream = audioDest.stream;
    
    const combinedTracks = [
        ...canvasStream.getVideoTracks(),
        ...audioStream.getAudioTracks()
    ];
    
    const combinedStream = new MediaStream(combinedTracks);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus' });

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, forceType?: 'AUDIO') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isVideo = file.type.startsWith('video');
      const isAudio = file.type.startsWith('audio') || forceType === 'AUDIO';
      
      const newClip: TimelineClip = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type: isVideo ? 'VIDEO' : isAudio ? 'AUDIO' : 'IMAGE',
        src: URL.createObjectURL(file),
        name: file.name,
        startOffset: currentTime, 
        duration: 5, 
        trimStart: 0,
        volume: 1,
        layer: isAudio ? 99 : clips.length + 1, // Audio on top logic visually
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
      duration: 5,
      trimStart: 0,
      volume: 1,
      layer: clips.length + 1,
      opacity: 1,
      transitionIn: 'NONE'
    };
    onClipsChange([...clips, newClip]);
    setSelectedClipId(newClip.id);
    setCurrentTime(currentTime);
    setShowLibraryModal(false);
  };

  // Resizing Handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newHeight = (e.clientY / window.innerHeight) * 100;
      setViewerHeight(Math.max(30, Math.min(newHeight, 85)));
    };
    const handleMouseUp = () => setIsResizing(false);
    
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

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
                         </div>
                      </div>
                   ))
                )}
             </div>
          </div>
        </div>
      )}

      {/* --- VIEWER --- */}
      <div 
        className="bg-black rounded-xl border border-zinc-800 relative flex items-center justify-center overflow-hidden bg-[url('https://transparenttextures.com/patterns/carbon-fibre.png')] flex-shrink-0"
        style={{ height: `${viewerHeight}vh`, minHeight: '300px' }}
      >
        <canvas 
          ref={canvasRef} 
          width={1280} 
          height={720} 
          className="max-w-full max-h-full aspect-video shadow-2xl border border-zinc-900"
        />
        
        {/* Resize Handle */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-4 bg-zinc-800/50 hover:bg-amber-500/50 cursor-row-resize flex items-center justify-center transition-colors z-50"
          onMouseDown={() => setIsResizing(true)}
        >
           <div className="w-12 h-1 bg-zinc-500 rounded-full"></div>
        </div>
        
        {/* Loading Overlay */}
        {loadingResources.size > 0 && (
           <div className="absolute top-4 right-4 bg-black/80 backdrop-blur px-3 py-1.5 rounded-full border border-amber-500/30 flex items-center gap-2 z-40">
               <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></div>
               <span className="text-[10px] text-amber-500 font-mono uppercase">Carregando Mídia...</span>
           </div>
        )}

        {exporting && (
           <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
              <Wand2 className="text-amber-500 animate-pulse mb-4" size={48} />
              <h3 className="text-xl font-cinema text-white">Renderizando Edição...</h3>
              <p className="text-zinc-400 text-sm">Capturando vídeo e áudio mixado.</p>
           </div>
        )}
      </div>

      {/* --- PREMIUM CONTROLS --- */}
      <div className="h-20 bg-zinc-950 border-t border-zinc-800 flex items-center px-6 justify-between backdrop-blur-sm bg-opacity-90 flex-shrink-0">
        <div className="flex items-center gap-6">
           {/* Play/Pause with Glow */}
           <button onClick={togglePlay} className={`p-4 rounded-full text-white transition-all shadow-xl transform hover:scale-105 ${isPlaying ? 'bg-gradient-to-r from-amber-600 to-orange-600 shadow-amber-500/20' : 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700'}`}>
             {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
           </button>
           
           {/* Time Display */}
           <div className="flex flex-col">
              <span className="font-cinema text-2xl text-white font-bold tracking-widest">
                {currentTime.toFixed(2)}<span className="text-zinc-600 text-base">s</span>
              </span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Duração Total: {totalDuration.toFixed(2)}s</span>
           </div>
        </div>

        <div className="flex items-center gap-3">
           {/* Library */}
           <button onClick={() => setShowLibraryModal(true)} className="group px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 hover:border-amber-500/30 text-zinc-400 hover:text-white transition-all flex items-center gap-2">
              <Library size={18} className="group-hover:text-amber-500 transition-colors" />
              <span className="text-xs font-bold uppercase tracking-wide">Biblioteca</span>
           </button>
           
           {/* Add Audio */}
           <label className="group px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 hover:border-green-500/30 text-zinc-400 hover:text-white cursor-pointer transition-all flex items-center gap-2">
              <Music size={18} className="group-hover:text-green-500 transition-colors" />
              <span className="text-xs font-bold uppercase tracking-wide">Áudio</span>
              <input type="file" className="hidden" accept="audio/*" onChange={(e) => handleFileUpload(e, 'AUDIO')} />
           </label>

           {/* Add Media */}
           <label className="group px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 hover:border-blue-500/30 text-zinc-400 hover:text-white cursor-pointer transition-all flex items-center gap-2">
              <Plus size={18} className="group-hover:text-blue-500 transition-colors" />
              <span className="text-xs font-bold uppercase tracking-wide">Mídia</span>
              <input type="file" className="hidden" accept="video/*,image/*" onChange={handleFileUpload} />
           </label>

           <div className="h-8 w-px bg-zinc-800 mx-2"></div>
           
           {/* Save Frame */}
           <button onClick={handleSaveFrame} className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg border border-zinc-700 hover:border-zinc-600 shadow-lg flex items-center gap-2 transition-all" title="Salvar Frame PNG">
              <Camera size={18} />
              <span className="hidden md:inline text-xs uppercase tracking-wide">Frame</span>
           </button>

           {/* Export */}
           <button onClick={handleExport} disabled={exporting} className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold rounded-lg shadow-lg shadow-amber-900/20 flex items-center gap-2 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <Download size={18} />
              <span className="text-xs uppercase tracking-wide">{exporting ? 'Renderizando...' : 'Exportar'}</span>
           </button>
        </div>
      </div>

      {/* --- TIMELINE TRACKS --- */}
      <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-[150px]">
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
             const thumbUrl = thumbnails.get(clip.id);
             
             return (
               <div key={clip.id} className="mb-2 relative group">
                 <div 
                    className={`h-16 rounded-lg border-2 flex items-center px-3 cursor-pointer relative overflow-hidden transition-all bg-cover bg-center
                      ${isSelected ? 'border-amber-500' : 'border-zinc-700'}
                      ${clip.type === 'AUDIO' ? 'bg-green-900/20 border-green-800/50' : 'bg-zinc-900'}
                    `}
                    style={{ 
                      width: `${widthPct}%`, 
                      marginLeft: `${leftPct}%`,
                      backgroundImage: clip.type !== 'AUDIO' && thumbUrl ? `url(${thumbUrl})` : 'none'
                    }}
                    onClick={() => {
                        setSelectedClipId(clip.id);
                        setCurrentTime(clip.startOffset); 
                    }}
                 >
                    <div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition-colors"></div>
                    
                    <div className="relative z-10 flex items-center">
                       {clip.type === 'VIDEO' && <Film size={16} className="text-blue-400 mr-2 drop-shadow-md" />}
                       {clip.type === 'AUDIO' && <FileAudio size={16} className="text-green-400 mr-2 drop-shadow-md" />}
                       {clip.type === 'IMAGE' && <Layers size={16} className="text-purple-400 mr-2 drop-shadow-md" />}
                       <span className="text-xs text-white truncate font-bold drop-shadow-md">{clip.name}</span>
                    </div>
                    
                    {isSelected && (
                       <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 z-20">
                          <button onClick={(e) => { e.stopPropagation(); deleteClip(clip.id); }} className="p-1 bg-red-500/80 text-white rounded hover:bg-red-600 shadow-sm">
                             <Trash2 size={12} />
                          </button>
                       </div>
                    )}
                 </div>
               </div>
             );
           })}
           
           {/* Playhead */}
           <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.8)]" style={{ left: `${(currentTime / totalDuration) * 100}%` }} />
        </div>
      </div>

      {/* --- INSPECTOR --- */}
      {selectedClipId && clips.find(c => c.id === selectedClipId) && (() => {
          const clip = clips.find(c => c.id === selectedClipId)!;
          return (
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl grid grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2 flex-shrink-0">
                <div className="col-span-4 flex items-center justify-between">
                    <div className="text-xs font-bold text-zinc-500 uppercase">Propriedades: <span className="text-white">{clip.name}</span></div>
                    <button onClick={previewSelectedClip} className="text-xs flex items-center gap-2 bg-zinc-800 hover:bg-amber-900 hover:text-amber-500 px-3 py-1 rounded transition-colors text-zinc-300">
                       <Eye size={14} /> Visualizar Clipe
                    </button>
                </div>
                
                <div className="space-y-1">
                   <label className="text-[10px] text-zinc-400">Início</label>
                   <input type="range" min={0} max={totalDuration} step={0.1} value={clip.startOffset} onChange={(e) => { updateClip(clip.id, { startOffset: parseFloat(e.target.value) }); setCurrentTime(parseFloat(e.target.value)); }} className="w-full accent-amber-500" />
                   <span className="text-xs text-white">{clip.startOffset.toFixed(1)}s</span>
                </div>

                <div className="space-y-1">
                   <label className="text-[10px] text-zinc-400">Duração</label>
                   <input type="number" min={0.5} max={20} step={0.5} value={clip.duration} onChange={(e) => updateClip(clip.id, { duration: parseFloat(e.target.value) })} className="w-full bg-zinc-950 border border-zinc-700 rounded p-1 text-xs text-white" />
                </div>

                {(clip.type === 'VIDEO' || clip.type === 'AUDIO') && (
                   <div className="space-y-1">
                       <label className="text-[10px] text-zinc-400 flex items-center gap-1"><Volume2 size={10} /> Volume</label>
                       <input type="range" min={0} max={1} step={0.1} value={clip.volume} onChange={(e) => updateClip(clip.id, { volume: parseFloat(e.target.value) })} className="w-full accent-green-500" />
                       <span className="text-xs text-white">{(clip.volume * 100).toFixed(0)}%</span>
                   </div>
                )}
                
                <div className="space-y-1">
                   <label className="text-[10px] text-zinc-400 flex items-center gap-1"><Scissors size={10} /> Aparar (Trim)</label>
                   <input type="range" min={0} max={10} step={0.1} value={clip.trimStart} onChange={(e) => { updateClip(clip.id, { trimStart: parseFloat(e.target.value) }); setCurrentTime(clip.startOffset); }} className="w-full accent-amber-500" />
                </div>
            </div>
          );
      })()}
    </div>
  );
};

export default VideoEditor;