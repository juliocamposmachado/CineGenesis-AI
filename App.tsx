import React, { useState, useEffect } from 'react';
import { Clapperboard, Sparkles, Loader2, AlertCircle, Play, Key, Eye, EyeOff, Linkedin, Github, Twitter, Facebook, Globe, Phone, BookOpen, ExternalLink, PlusCircle, Film, Mic2, Library, Trash2, Save, Download } from 'lucide-react';
import ImageUploader from './components/ImageUploader';
import SafetyModal from './components/SafetyModal';
import { UploadedImage, AppStatus, VoiceSettings, LibraryItem } from './types';
import { checkApiKey, analyzeArchetypes, generateCinematicVideo, extendCinematicVideo } from './services/geminiService';

// --- IndexedDB Helpers for Video Storage ---
const DB_NAME = 'CineGenesisDB';
const STORE_NAME = 'videos';
const DB_VERSION = 1;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const saveVideoToDB = async (item: LibraryItem) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getVideosFromDB = async (): Promise<LibraryItem[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deleteVideoFromDB = async (id: string) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- Main Component ---

const App: React.FC = () => {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [activeTab, setActiveTab] = useState<'CREATE' | 'LIBRARY'>('CREATE');
  
  // Generation State
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [images, setImages] = useState<{ A: UploadedImage | null; B: UploadedImage | null }>({ A: null, B: null });
  const [prompt, setPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
  const [lastVideoAsset, setLastVideoAsset] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [isExtensionMode, setIsExtensionMode] = useState(false);
  
  // Voice Consistency State
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    characterA: "Voz grave, autoritária, tom melancólico.",
    characterB: "Voz suave, misteriosa, levemente rouca."
  });

  // Library State
  const [library, setLibrary] = useState<LibraryItem[]>([]);

  // API Key State
  const [userApiKey, setUserApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 4000);
    
    // Load API Key
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) setUserApiKey(storedKey);

    // Load Voice Settings
    const storedVoices = localStorage.getItem('voice_settings');
    if (storedVoices) {
      try { setVoiceSettings(JSON.parse(storedVoices)); } catch (e) {}
    }

    // Load Library from IndexedDB
    loadLibrary();

    checkApiKey().catch(console.error);
    return () => clearTimeout(timer);
  }, []);

  const loadLibrary = async () => {
    try {
      const items = await getVideosFromDB();
      // Recreate URLs from Blobs
      const itemsWithUrls = items.map(item => ({
        ...item,
        videoUrl: URL.createObjectURL(item.videoBlob)
      }));
      // Sort by date desc
      setLibrary(itemsWithUrls.sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
      console.error("Failed to load library", err);
    }
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUserApiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  const handleVoiceChange = (char: 'characterA' | 'characterB', val: string) => {
    const newSettings = { ...voiceSettings, [char]: val };
    setVoiceSettings(newSettings);
    localStorage.setItem('voice_settings', JSON.stringify(newSettings));
  };

  const handleImageUpload = async (file: File, key: string) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      const newImage: UploadedImage = {
        file,
        previewUrl: URL.createObjectURL(file),
        base64,
        mimeType: file.type,
        label: key === 'A' ? 'Protagonista (Ref)' : 'Antagonista (Ref)'
      };
      setImages(prev => ({ ...prev, [key]: newImage }));
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!isExtensionMode && (!images.A || !images.B)) return;

    setErrorMsg(null);
    
    try {
      const activeKey = userApiKey || process.env.API_KEY;
      if (!activeKey) {
         const extensionAvailable = await checkApiKey();
         if (!extensionAvailable) throw new Error("Chave de API necessária.");
      }

      if (isExtensionMode && lastVideoAsset) {
        setStatus(AppStatus.EXTENDING);
        setProgressMsg("Capturando frame final e gerando continuação com áudio...");
        
        const result = await extendCinematicVideo(lastVideoAsset, prompt, voiceSettings, userApiKey);
        
        setVideoUrl(result.videoUrl);
        setCurrentBlob(result.blob);
        setLastVideoAsset(result.videoAsset);
        setStatus(AppStatus.COMPLETED);
        setIsExtensionMode(false); 
        setPrompt(""); 
        
        // Auto-save to library
        await saveToLibrary(result.blob, "Continuação: " + prompt, 'EXTENSION');

      } else {
        if (!images.A || !images.B) return;

        setStatus(AppStatus.ANALYZING);
        setProgressMsg("Extraindo identidade visual para o Projeto Piloto...");
        const uploadedImages = [images.A, images.B];
        const archetypes = await analyzeArchetypes(uploadedImages, userApiKey);
        
        setStatus(AppStatus.GENERATING);
        setProgressMsg("Rodando motor Veo AI + Sincronização Vocal...");
        
        const result = await generateCinematicVideo(uploadedImages, prompt, archetypes, voiceSettings, userApiKey);
        
        setVideoUrl(result.videoUrl);
        setCurrentBlob(result.blob);
        setLastVideoAsset(result.videoAsset);
        setStatus(AppStatus.COMPLETED);

        // Auto-save to library
        await saveToLibrary(result.blob, prompt, 'SCENE');
      }

    } catch (err: any) {
      console.error(err);
      setStatus(AppStatus.ERROR);
      setErrorMsg(err.message || "Ocorreu um erro desconhecido.");
    }
  };

  const saveToLibrary = async (blob: Blob, savedPrompt: string, type: 'SCENE' | 'EXTENSION') => {
    const newItem: LibraryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      prompt: savedPrompt,
      videoBlob: blob,
      videoUrl: '', // Placeholder, set on load
      voiceSettings: voiceSettings,
      type
    };
    
    try {
      await saveVideoToDB(newItem);
      await loadLibrary(); // Refresh UI
    } catch (e) {
      console.error("Failed to save to local library", e);
      setErrorMsg("Vídeo gerado, mas falha ao salvar na biblioteca local (Espaço cheio?).");
    }
  };

  const handleDeleteFromLibrary = async (id: string) => {
    if (window.confirm("Tem certeza? 'Se apagar já era' - não há backup na nuvem.")) {
      await deleteVideoFromDB(id);
      await loadLibrary();
    }
  };

  const handleEnterExtensionMode = () => {
    setIsExtensionMode(true);
    setPrompt("");
    setActiveTab('CREATE');
  };

  const handleCancelExtension = () => {
    setIsExtensionMode(false);
    setPrompt("");
  };

  // Social Links
  const SocialLinks = () => (
    <div className="flex gap-4 items-center justify-center flex-wrap">
      <a href="https://www.linkedin.com/in/juliocamposmachado/" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-amber-500 transition-colors"><Linkedin size={20} /></a>
      <a href="https://github.com/juliocamposmachado" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-amber-500 transition-colors"><Github size={20} /></a>
      <a href="https://x.com/julioscouter" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-amber-500 transition-colors"><Twitter size={20} /></a>
      <a href="https://www.facebook.com/juliocamposmachado/" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-amber-500 transition-colors"><Facebook size={20} /></a>
      <a href="https://likelook.wixsite.com/solutions" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-amber-500 transition-colors"><Globe size={20} /></a>
    </div>
  );

  // Splash Screen
  if (showSplash) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 text-center animate-out fade-out duration-1000 delay-[3500ms] fill-mode-forwards pointer-events-none">
        <div className="mb-8 animate-pulse">
          <div className="p-6 bg-gradient-to-br from-red-900 to-black rounded-2xl shadow-2xl shadow-red-900/50 inline-block mb-6 border border-red-800">
            <BookOpen className="text-white w-16 h-16" />
          </div>
          <h1 className="font-cinema text-4xl md:text-6xl font-bold text-white tracking-wide mb-2">JULIETTE PSICOSE</h1>
          <p className="text-red-500 uppercase tracking-[0.4em] text-sm font-bold">Série Original • Projeto Piloto</p>
        </div>
        <div className="space-y-4 max-w-md w-full bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 backdrop-blur-sm shadow-2xl">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Autor & Desenvolvedor</p>
            <h2 className="text-xl font-bold text-white">Julio Campos Machado</h2>
            <p className="text-amber-500 font-cinema text-sm mt-1">+100 Livros Publicados na Amazon</p>
          </div>
          <div className="h-px bg-zinc-800 w-full my-4"></div>
          <div className="flex flex-col gap-3 text-sm text-zinc-400">
             <div className="flex items-center justify-center gap-2 hover:text-white transition-colors">
              <Phone size={14} className="text-amber-500" />
              <span>+55 11 99294-6628</span>
            </div>
            <div className="flex items-center justify-center gap-2 hover:text-white transition-colors">
              <Phone size={14} className="text-amber-500" />
              <span>+55 11 97060-3441</span>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-zinc-800">
            <SocialLinks />
          </div>
        </div>
      </div>
    );
  }

  const isProcessing = status === AppStatus.ANALYZING || status === AppStatus.GENERATING || status === AppStatus.EXTENDING;

  return (
    <div className="min-h-screen bg-black text-zinc-200 selection:bg-amber-500/30 flex flex-col">
      {!disclaimerAccepted && <SafetyModal onAccept={() => setDisclaimerAccepted(true)} />}

      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-600 to-red-700 rounded-lg shadow-lg shadow-red-900/20">
              <Clapperboard className="text-white" size={24} />
            </div>
            <div>
              <h1 className="font-cinema text-xl font-bold text-white tracking-wide">JULIETTE PSICOSE</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Projeto Piloto - Visualização AI</p>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800">
             <button 
               onClick={() => setActiveTab('CREATE')}
               className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wide rounded transition-colors flex items-center gap-2 ${activeTab === 'CREATE' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               <Film size={14} /> Studio
             </button>
             <button 
               onClick={() => setActiveTab('LIBRARY')}
               className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wide rounded transition-colors flex items-center gap-2 ${activeTab === 'LIBRARY' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               <Library size={14} /> Biblioteca ({library.length})
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 flex-grow w-full">
        
        {/* --- LIBRARY TAB --- */}
        {activeTab === 'LIBRARY' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-cinema text-white flex items-center gap-2">
                <Save size={20} className="text-amber-500" /> Biblioteca Local
              </h2>
              <p className="text-xs text-red-400 bg-red-900/20 px-3 py-1 rounded border border-red-900/50">
                Aviso: Os vídeos são salvos no navegador. Se limpar os dados, "já era".
              </p>
            </div>
            
            {library.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                <Film size={48} className="mb-4 opacity-20" />
                <p>Nenhum vídeo salvo ainda.</p>
                <button onClick={() => setActiveTab('CREATE')} className="mt-4 text-amber-500 hover:underline text-sm">Criar novo vídeo</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {library.map(item => (
                  <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-lg hover:border-zinc-600 transition-colors">
                    <div className="aspect-video bg-black relative group">
                      <video src={item.videoUrl} controls className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-[10px] rounded backdrop-blur">
                        {item.type === 'EXTENSION' ? 'CONTINUAÇÃO' : 'CENA'}
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <p className="text-xs text-zinc-500 mb-2">{new Date(item.timestamp).toLocaleString()}</p>
                      <p className="text-sm text-zinc-200 line-clamp-3 mb-4 italic">"{item.prompt}"</p>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-zinc-800">
                        <a 
                          href={item.videoUrl} 
                          download={`juliette_psicose_${item.id}.mp4`}
                          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
                        >
                          <Download size={14} /> Salvar
                        </a>
                        <button 
                          onClick={() => handleDeleteFromLibrary(item.id)}
                          className="flex items-center gap-1 text-xs text-red-900 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} /> Apagar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- CREATE TAB --- */}
        {activeTab === 'CREATE' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 animate-in fade-in">
            
            {/* Left Column: Inputs */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* API Key */}
              <section className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-800">
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Key size={14} className="text-amber-500" /> Configuração da API
                </h2>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={userApiKey}
                    onChange={handleApiKeyChange}
                    placeholder="Gemini API Key..."
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg py-3 pl-3 pr-10 text-sm text-white placeholder-zinc-600 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                  <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-3 text-zinc-500 hover:text-white">
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-[10px] text-amber-600 mt-2 flex items-center gap-1 hover:underline">
                   Obter Chave <ExternalLink size={10} />
                </a>
              </section>

              {/* Images */}
              <section className={isExtensionMode ? "opacity-50 pointer-events-none grayscale" : ""}>
                <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">1</span>
                  Elenco (Visual)
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <ImageUploader label="Protagonista" image={images.A} onUpload={(f) => handleImageUpload(f, 'A')} onRemove={() => setImages(p => ({ ...p, A: null }))} />
                  <ImageUploader label="Antagonista" image={images.B} onUpload={(f) => handleImageUpload(f, 'B')} onRemove={() => setImages(p => ({ ...p, B: null }))} />
                </div>
              </section>

              {/* Voice Settings */}
              <section>
                <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">2</span>
                  Consistência Vocal
                </h2>
                <div className="space-y-3 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500 flex items-center gap-1"><Mic2 size={10} /> Voz Protagonista</label>
                    <input 
                      type="text" 
                      className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                      placeholder="Ex: Grave, autoritária, sotaque nordestino..."
                      value={voiceSettings.characterA}
                      onChange={(e) => handleVoiceChange('characterA', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500 flex items-center gap-1"><Mic2 size={10} /> Voz Antagonista</label>
                    <input 
                      type="text" 
                      className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                      placeholder="Ex: Suave, sussurrada, tom ameaçador..."
                      value={voiceSettings.characterB}
                      onChange={(e) => handleVoiceChange('characterB', e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* Prompt */}
              <section>
                <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                      {isExtensionMode ? '+' : '3'}
                    </span>
                    {isExtensionMode ? 'Continuação da Cena' : 'Roteiro da Cena'}
                  </div>
                  {isExtensionMode && (
                    <button onClick={handleCancelExtension} className="text-xs text-red-500 hover:underline">Cancelar Extensão</button>
                  )}
                </h2>
                
                <textarea
                  className={`w-full h-32 bg-zinc-900/50 border rounded-xl p-4 text-sm text-white placeholder-zinc-600 focus:outline-none resize-none
                    ${isExtensionMode ? 'border-amber-600/50 focus:ring-1 focus:ring-amber-500' : 'border-zinc-700 focus:ring-1 focus:ring-amber-500/50'}
                  `}
                  placeholder={isExtensionMode ? "Ação seguinte (mantendo voz e visual)..." : "Descreva a ação..."}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </section>

              <button
                onClick={handleGenerate}
                disabled={(!isExtensionMode && (!images.A || !images.B)) || !prompt || isProcessing}
                className={`w-full py-4 rounded-xl font-bold uppercase tracking-wide text-sm transition-all flex items-center justify-center gap-3 shadow-xl
                  ${(!prompt || (!isExtensionMode && (!images.A || !images.B)) || isProcessing) 
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                    : isExtensionMode
                      ? 'bg-amber-700 hover:bg-amber-600 text-white'
                      : 'bg-red-900 hover:bg-red-800 text-white'
                  }
                `}
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : isExtensionMode ? <PlusCircle size={16} /> : <Play size={16} />}
                {isProcessing ? (status === AppStatus.EXTENDING ? 'Estendendo...' : 'Produzindo...') : isExtensionMode ? 'Gerar Continuação' : 'Gerar Cena'}
              </button>

              {status === AppStatus.ERROR && (
                <div className="p-4 bg-red-900/20 border border-red-800/50 rounded text-sm text-red-300">
                  <AlertCircle className="inline mr-2" size={16} /> {errorMsg}
                </div>
              )}
            </div>

            {/* Right Column: Preview */}
            <div className="lg:col-span-8">
              <div className="h-full min-h-[500px] bg-zinc-900/30 rounded-2xl border border-zinc-800 flex flex-col relative overflow-hidden">
                <div className="h-12 border-b border-zinc-800 flex items-center px-4 bg-zinc-900/50 justify-between">
                  <div className="text-xs text-zinc-500 font-mono">MONITOR DE PRODUÇÃO</div>
                  <div className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
                    {isExtensionMode ? 'MODO: CONTINUIDADE ATIVO' : 'MODO: NOVA CENA'}
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center p-8">
                  {status === AppStatus.IDLE && (
                    <div className="text-center opacity-50">
                      <Clapperboard size={48} className="mx-auto mb-4 text-zinc-600" />
                      <p className="text-zinc-400">Pronto para iniciar produção.</p>
                    </div>
                  )}

                  {isProcessing && (
                    <div className="text-center z-10">
                      <Loader2 size={48} className="mx-auto mb-4 text-amber-500 animate-spin" />
                      <p className="text-white font-cinema">{progressMsg}</p>
                    </div>
                  )}

                  {status === AppStatus.COMPLETED && videoUrl && !isProcessing && (
                    <div className="w-full">
                      <video controls autoPlay loop className="w-full rounded-lg shadow-2xl border border-zinc-700" src={videoUrl} />
                      <div className="mt-4 flex justify-between items-center bg-zinc-900 p-4 rounded border border-zinc-800">
                        <span className="text-xs text-green-500 flex items-center gap-1"><Save size={12} /> Salvo automaticamente na Biblioteca</span>
                        {!isExtensionMode && (
                          <button onClick={handleEnterExtensionMode} className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white text-xs rounded font-bold flex items-center gap-2">
                            <PlusCircle size={14} /> Estender (+5s)
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      <footer className="border-t border-zinc-900 bg-zinc-950 py-8 mt-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="text-amber-500 font-cinema font-bold text-lg">Like Look Solutions</p>
            <p className="text-zinc-500 text-xs mt-1">Autor & Dev: <span className="text-zinc-300">Julio Campos Machado</span></p>
             <p className="text-zinc-600 text-[10px] mt-1 italic">Série Juliette Psicose - Todos os direitos reservados</p>
            <div className="flex flex-wrap gap-3 text-[10px] text-zinc-600 mt-2 justify-center md:justify-start">
              <span className="hover:text-zinc-400 transition-colors cursor-default">+55 11 99294-6628</span>
              <span className="text-zinc-800">•</span>
              <span className="hover:text-zinc-400 transition-colors cursor-default">+55 11 97060-3441</span>
            </div>
          </div>
          
          <SocialLinks />
        </div>
        <div className="text-center text-[10px] text-zinc-800 mt-6 border-t border-zinc-900/50 pt-4">
          &copy; {new Date().getFullYear()} CineGenesis AI para Like Look Solutions.
        </div>
      </footer>
    </div>
  );
};

export default App;