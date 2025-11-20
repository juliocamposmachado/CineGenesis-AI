import React, { useState, useEffect } from 'react';
import { Clapperboard, Sparkles, Loader2, AlertCircle, Play, Key, Eye, EyeOff, Linkedin, Github, Twitter, Facebook, Globe, Phone, BookOpen, ExternalLink, PlusCircle, Film } from 'lucide-react';
import ImageUploader from './components/ImageUploader';
import SafetyModal from './components/SafetyModal';
import { UploadedImage, AppStatus } from './types';
import { checkApiKey, analyzeArchetypes, generateCinematicVideo, extendCinematicVideo } from './services/geminiService';

const App: React.FC = () => {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [images, setImages] = useState<{ A: UploadedImage | null; B: UploadedImage | null }>({ A: null, B: null });
  const [prompt, setPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [lastVideoAsset, setLastVideoAsset] = useState<any>(null); // Store for extension
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [isExtensionMode, setIsExtensionMode] = useState(false);
  
  // API Key State
  const [userApiKey, setUserApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Splash Screen Timer
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 4000);

    // Check local storage for API Key
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setUserApiKey(storedKey);
    }

    // Initial environment check
    checkApiKey().catch(console.error);

    return () => clearTimeout(timer);
  }, []);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUserApiKey(val);
    localStorage.setItem('gemini_api_key', val);
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
    if (!isExtensionMode && (!images.A || !images.B)) return; // Normal mode needs images

    setErrorMsg(null);
    
    try {
      const activeKey = userApiKey || process.env.API_KEY;
      
      if (!activeKey) {
         const extensionAvailable = await checkApiKey();
         if (!extensionAvailable) {
            throw new Error("É necessário fornecer uma Chave de API do Google Gemini para usar esta ferramenta.");
         }
      }

      if (isExtensionMode && lastVideoAsset) {
        // --- EXTENSION FLOW ---
        setStatus(AppStatus.EXTENDING);
        setProgressMsg("Capturando frame final e gerando continuação (Consistência 100%)...");
        
        const result = await extendCinematicVideo(lastVideoAsset, prompt, userApiKey);
        
        setVideoUrl(result.videoUrl);
        setLastVideoAsset(result.videoAsset); // Update asset for next extension
        setStatus(AppStatus.COMPLETED);
        setIsExtensionMode(false); // Reset mode but keep video
        setPrompt(""); // Clear prompt for next action

      } else {
        // --- NEW GENERATION FLOW ---
        if (!images.A || !images.B) return;

        setStatus(AppStatus.ANALYZING);
        setProgressMsg("Extraindo identidade visual para o Projeto Piloto...");
        const uploadedImages = [images.A, images.B];
        const archetypes = await analyzeArchetypes(uploadedImages, userApiKey);
        
        setStatus(AppStatus.GENERATING);
        setProgressMsg("Rodando motor Veo AI (Adaptando para personagens originais)...");
        
        const result = await generateCinematicVideo(uploadedImages, prompt, archetypes, userApiKey);
        
        setVideoUrl(result.videoUrl);
        setLastVideoAsset(result.videoAsset);
        setStatus(AppStatus.COMPLETED);
      }

    } catch (err: any) {
      console.error(err);
      setStatus(AppStatus.ERROR);
      setErrorMsg(err.message || "Ocorreu um erro desconhecido durante a geração.");
    }
  };

  const handleEnterExtensionMode = () => {
    setIsExtensionMode(true);
    setPrompt("");
    // Focus logic could go here
  };

  const handleCancelExtension = () => {
    setIsExtensionMode(false);
  };

  // Social Links Component
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
          <div className="hidden md:flex items-center gap-4">
             <a href="https://www.amazon.com.br/s?k=Julio+Campos+Machado" target="_blank" className="text-xs text-amber-500 hover:underline flex items-center gap-1">
                <BookOpen size={12} />
                Ver Livros na Amazon
             </a>
             <div className="text-xs font-mono text-zinc-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                SYSTEM READY
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 flex-grow w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Inputs */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* API Key Section */}
            <section className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors shadow-lg">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Key size={14} className="text-amber-500" /> Configuração da API
              </h2>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={userApiKey}
                  onChange={handleApiKeyChange}
                  placeholder="Cole sua Gemini API Key aqui..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg py-3 pl-3 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                  title={showApiKey ? "Ocultar chave" : "Mostrar chave"}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <p className="text-[10px] text-zinc-500 flex items-center gap-1 leading-tight">
                  <Sparkles size={10} className="text-amber-500" /> Necessário para usar o modelo Veo 3.1.
                </p>
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] text-amber-600 hover:text-amber-400 transition-colors flex items-center gap-1 w-fit hover:underline"
                >
                  Obter Chave de API (Google AI Studio) <ExternalLink size={10} />
                </a>
              </div>
            </section>

            {/* Image Slots - Only show if NOT extending, or show as disabled */}
            <section className={isExtensionMode ? "opacity-50 pointer-events-none grayscale transition-all" : "transition-all"}>
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">1</span>
                Elenco do Piloto (Referências)
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <ImageUploader 
                  label="Protagonista" 
                  image={images.A} 
                  onUpload={(f) => handleImageUpload(f, 'A')}
                  onRemove={() => setImages(prev => ({ ...prev, A: null }))}
                />
                <ImageUploader 
                  label="Coadjuvante/Antagonista" 
                  image={images.B} 
                  onUpload={(f) => handleImageUpload(f, 'B')}
                  onRemove={() => setImages(prev => ({ ...prev, B: null }))}
                />
              </div>
              {!isExtensionMode && (
                <p className="text-xs text-zinc-500 mt-3 leading-relaxed border-l-2 border-amber-500 pl-3">
                  <strong className="text-zinc-300">Sistema Anti-Copyright:</strong> Se a IA detectar atores famosos, ela criará automaticamente "sósias" fictícios baseados no estilo.
                </p>
              )}
            </section>

            {/* Prompt Input */}
            <section>
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                    {isExtensionMode ? '+' : '2'}
                  </span>
                  {isExtensionMode ? 'Continuação da Cena' : 'Roteiro da Cena'}
                </div>
                {isExtensionMode && (
                  <button onClick={handleCancelExtension} className="text-xs text-red-500 hover:underline">
                    Cancelar Extensão
                  </button>
                )}
              </h2>
              
              {isExtensionMode && (
                <div className="mb-3 p-3 bg-amber-900/20 border border-amber-800/50 rounded-lg flex items-center gap-2 text-xs text-amber-200 animate-in fade-in">
                   <Film size={14} />
                   <span><strong>Modo Continuidade:</strong> O sistema usará o último frame para manter os personagens idênticos.</span>
                </div>
              )}

              <div className="relative">
                <textarea
                  className={`w-full h-40 bg-zinc-900/50 border rounded-xl p-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 transition-all resize-none
                    ${isExtensionMode 
                      ? 'border-amber-600/50 focus:ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]' 
                      : 'border-zinc-700 focus:ring-amber-500/50'
                    }
                  `}
                  placeholder={isExtensionMode 
                    ? "O que acontece IMEDIATAMENTE depois? Ex: Ele se levanta bruscamente e vai até a janela..." 
                    : "Descreva a ação para o piloto de Juliette Psicose. Ex: O homem de barba grisalha encara a mulher..."
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <Sparkles className={`absolute bottom-4 right-4 ${isExtensionMode ? "text-amber-500" : "text-zinc-700"}`} size={16} />
              </div>
            </section>

            {/* Action Button */}
            <button
              onClick={handleGenerate}
              disabled={(!isExtensionMode && (!images.A || !images.B)) || !prompt || isProcessing}
              className={`w-full py-4 rounded-xl font-bold uppercase tracking-wide text-sm transition-all flex items-center justify-center gap-3 shadow-xl
                ${(!prompt || (!isExtensionMode && (!images.A || !images.B)) || isProcessing) 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : isExtensionMode
                    ? 'bg-gradient-to-r from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-white shadow-amber-900/20 hover:scale-[1.02]'
                    : 'bg-gradient-to-r from-red-900 to-zinc-900 hover:from-red-800 hover:to-zinc-800 text-white hover:shadow-red-900/30 hover:scale-[1.02]'
                }
              `}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  {status === AppStatus.EXTENDING ? 'Estendendo...' : 'Produzindo...'}
                </>
              ) : isExtensionMode ? (
                <>
                   <PlusCircle fill="currentColor" className="text-black" size={16} />
                   Gerar Continuação (+5s)
                </>
              ) : (
                <>
                  <Play fill="currentColor" size={16} />
                  Gerar Visualização
                </>
              )}
            </button>

            {status === AppStatus.ERROR && (
              <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="text-red-500 shrink-0" size={20} />
                <p className="text-sm text-red-300 leading-relaxed">{errorMsg}</p>
              </div>
            )}
          </div>

          {/* Right Column: Preview/Result */}
          <div className="lg:col-span-8">
            <div className="h-full min-h-[500px] bg-zinc-900/30 rounded-2xl border border-zinc-800 flex flex-col overflow-hidden relative">
              
              {/* Top Bar */}
              <div className="h-12 border-b border-zinc-800 flex items-center px-4 bg-zinc-900/50 justify-between">
                <div className="flex gap-2">
                  <div className={`w-3 h-3 rounded-full ${isExtensionMode ? 'bg-amber-500 animate-pulse' : 'bg-red-900/50'}`}></div>
                  <div className="w-3 h-3 rounded-full bg-red-900/50"></div>
                  <div className="w-3 h-3 rounded-full bg-red-900/50"></div>
                </div>
                <div className="text-xs text-zinc-500 font-mono">JULIETTE PSICOSE / {isExtensionMode ? 'EXTENDING_SCENE' : 'PILOT_V1'}</div>
              </div>

              {/* Content Area */}
              <div className="flex-1 flex items-center justify-center p-8 relative">
                
                {status === AppStatus.IDLE && (
                  <div className="text-center space-y-4 opacity-50">
                    <div className="w-20 h-20 rounded-full bg-zinc-800 mx-auto flex items-center justify-center">
                      <Clapperboard size={32} className="text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 font-light">Aguardando direção de cena...</p>
                  </div>
                )}

                {isProcessing && (
                  <div className="text-center space-y-6 max-w-md animate-pulse z-10 relative">
                    <div className="relative w-24 h-24 mx-auto">
                      <div className="absolute inset-0 border-4 border-red-900/30 rounded-full"></div>
                      <div className="absolute inset-0 border-t-4 border-amber-600 rounded-full animate-spin"></div>
                    </div>
                    <div>
                      <h3 className="text-xl font-cinema text-white mb-2">Em Produção</h3>
                      <p className="text-amber-500/80 text-sm font-mono">{progressMsg}</p>
                    </div>
                  </div>
                )}
                
                {/* Blur background effect during processing if video exists */}
                {isProcessing && videoUrl && (
                   <div className="absolute inset-0 opacity-20 blur-lg pointer-events-none">
                      <video src={videoUrl} className="w-full h-full object-cover" />
                   </div>
                )}

                {status === AppStatus.COMPLETED && videoUrl && !isProcessing && (
                  <div className="w-full h-full flex flex-col animate-in fade-in zoom-in duration-500">
                    <video 
                      controls 
                      autoPlay 
                      loop 
                      className="w-full h-auto rounded-lg shadow-2xl ring-1 ring-white/10"
                      src={videoUrl}
                    />
                    <div className="mt-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-zinc-900/80 p-4 rounded-lg border border-zinc-700/50 backdrop-blur">
                      <div>
                        <h4 className="text-amber-500 text-xs font-bold uppercase mb-1">Cena Gerada</h4>
                        <p className="text-zinc-400 text-xs italic">Pronto para download ou extensão.</p>
                      </div>
                      
                      <div className="flex gap-3 w-full md:w-auto">
                        {!isExtensionMode && (
                          <button 
                            onClick={handleEnterExtensionMode}
                            className="flex-1 md:flex-none px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded transition-colors font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-zinc-600"
                          >
                            <PlusCircle size={14} /> Estender Cena
                          </button>
                        )}
                        
                        <a 
                          href={videoUrl} 
                          download="juliette_psicose_scene.mp4"
                          className="flex-1 md:flex-none px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white text-xs rounded transition-colors font-bold uppercase tracking-wider flex items-center justify-center"
                        >
                          Download MP4
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
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