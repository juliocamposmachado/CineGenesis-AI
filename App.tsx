import React, { useState, useEffect } from 'react';
import { Clapperboard, Sparkles, Loader2, AlertCircle, Play } from 'lucide-react';
import ImageUploader from './components/ImageUploader';
import SafetyModal from './components/SafetyModal';
import { UploadedImage, AppStatus } from './types';
import { checkApiKey, analyzeArchetypes, generateCinematicVideo } from './services/geminiService';

const App: React.FC = () => {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [images, setImages] = useState<{ A: UploadedImage | null; B: UploadedImage | null }>({ A: null, B: null });
  const [prompt, setPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState('');

  useEffect(() => {
    // Initial API check
    checkApiKey().catch(console.error);
  }, []);

  const handleImageUpload = async (file: File, key: string) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      const newImage: UploadedImage = {
        file,
        previewUrl: URL.createObjectURL(file),
        base64,
        mimeType: file.type,
        label: key === 'A' ? 'Personagem A' : 'Personagem B'
      };
      setImages(prev => ({ ...prev, [key]: newImage }));
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!images.A || !images.B || !prompt.trim()) return;

    setStatus(AppStatus.ANALYZING);
    setErrorMsg(null);
    setVideoUrl(null);

    try {
      // Ensure key is selected
      await checkApiKey();

      // 1. Analyze Archetypes
      setProgressMsg("Analisando arquétipos visuais e extraindo estilo...");
      const uploadedImages = [images.A, images.B];
      const archetypes = await analyzeArchetypes(uploadedImages);
      console.log("Archetypes detected:", archetypes);

      // 2. Generate Video
      setStatus(AppStatus.GENERATING);
      setProgressMsg("Renderizando cena cinematográfica com Veo AI (isso pode levar alguns minutos)...");
      
      const url = await generateCinematicVideo(uploadedImages, prompt, archetypes);
      
      setVideoUrl(url);
      setStatus(AppStatus.COMPLETED);

    } catch (err: any) {
      console.error(err);
      setStatus(AppStatus.ERROR);
      setErrorMsg(err.message || "Ocorreu um erro desconhecido durante a geração.");
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-200 selection:bg-amber-500/30">
      {!disclaimerAccepted && <SafetyModal onAccept={() => setDisclaimerAccepted(true)} />}

      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg shadow-lg shadow-orange-900/20">
              <Clapperboard className="text-white" size={24} />
            </div>
            <div>
              <h1 className="font-cinema text-xl font-bold text-white tracking-wide">CineGenesis AI</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Character & Scene Generator</p>
            </div>
          </div>
          <div className="text-xs font-mono text-zinc-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            VEO 3.1 ACTIVE
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Inputs */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Image Slots */}
            <section>
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">1</span>
                Referências de Elenco (Arquétipos)
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <ImageUploader 
                  label="Personagem A (Ex: Maduro)" 
                  image={images.A} 
                  onUpload={(f) => handleImageUpload(f, 'A')}
                  onRemove={() => setImages(prev => ({ ...prev, A: null }))}
                />
                <ImageUploader 
                  label="Personagem B (Ex: Suave)" 
                  image={images.B} 
                  onUpload={(f) => handleImageUpload(f, 'B')}
                  onRemove={() => setImages(prev => ({ ...prev, B: null }))}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
                *As imagens são usadas apenas para capturar <span className="text-amber-500">estilo, iluminação e traços gerais</span>. A IA criará personagens originais baseados nesses atributos.
              </p>
            </section>

            {/* Prompt Input */}
            <section>
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">2</span>
                Roteiro da Cena
              </h2>
              <div className="relative">
                <textarea
                  className="w-full h-40 bg-zinc-900/50 border border-zinc-700 rounded-xl p-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all resize-none"
                  placeholder="Descreva a interação entre os personagens. Ex: Os dois conversam em uma cafeteria mal iluminada, expressando tensão e segredos não ditos..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <Sparkles className="absolute bottom-4 right-4 text-zinc-700" size={16} />
              </div>
            </section>

            {/* Action Button */}
            <button
              onClick={handleGenerate}
              disabled={!images.A || !images.B || !prompt || status === AppStatus.ANALYZING || status === AppStatus.GENERATING}
              className={`w-full py-4 rounded-xl font-bold uppercase tracking-wide text-sm transition-all flex items-center justify-center gap-3 shadow-xl
                ${(!images.A || !images.B || !prompt) 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : 'bg-amber-600 hover:bg-amber-500 text-white hover:shadow-amber-500/20 hover:scale-[1.02]'
                }
              `}
            >
              {(status === AppStatus.ANALYZING || status === AppStatus.GENERATING) ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Processando...
                </>
              ) : (
                <>
                  <Play fill="currentColor" size={16} />
                  Gerar Cena
                </>
              )}
            </button>

            {status === AppStatus.ERROR && (
              <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-red-500 shrink-0" size={20} />
                <p className="text-sm text-red-300">{errorMsg}</p>
              </div>
            )}
          </div>

          {/* Right Column: Preview/Result */}
          <div className="lg:col-span-8">
            <div className="h-full min-h-[500px] bg-zinc-900/30 rounded-2xl border border-zinc-800 flex flex-col overflow-hidden relative">
              
              {/* Top Bar */}
              <div className="h-12 border-b border-zinc-800 flex items-center px-4 bg-zinc-900/50">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                  <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                  <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                </div>
                <div className="ml-auto text-xs text-zinc-500 font-mono">OUTPUT: 720P / 16:9</div>
              </div>

              {/* Content Area */}
              <div className="flex-1 flex items-center justify-center p-8">
                
                {status === AppStatus.IDLE && (
                  <div className="text-center space-y-4 opacity-50">
                    <div className="w-20 h-20 rounded-full bg-zinc-800 mx-auto flex items-center justify-center">
                      <Clapperboard size={32} className="text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 font-light">Aguardando referências e roteiro...</p>
                  </div>
                )}

                {(status === AppStatus.ANALYZING || status === AppStatus.GENERATING) && (
                  <div className="text-center space-y-6 max-w-md animate-pulse">
                    <div className="relative w-24 h-24 mx-auto">
                      <div className="absolute inset-0 border-4 border-amber-500/30 rounded-full"></div>
                      <div className="absolute inset-0 border-t-4 border-amber-500 rounded-full animate-spin"></div>
                    </div>
                    <div>
                      <h3 className="text-xl font-cinema text-white mb-2">Criando Cena</h3>
                      <p className="text-amber-500/80 text-sm font-mono">{progressMsg}</p>
                      <p className="text-zinc-500 text-xs mt-4">A IA está interpretando os traços visuais e gerando personagens originais.</p>
                    </div>
                  </div>
                )}

                {status === AppStatus.COMPLETED && videoUrl && (
                  <div className="w-full h-full flex flex-col animate-in fade-in zoom-in duration-500">
                    <video 
                      controls 
                      autoPlay 
                      loop 
                      className="w-full h-auto rounded-lg shadow-2xl ring-1 ring-white/10"
                      src={videoUrl}
                    />
                    <div className="mt-6 p-4 bg-zinc-900/80 rounded-lg border border-zinc-700/50 backdrop-blur">
                      <h4 className="text-amber-500 text-xs font-bold uppercase mb-1">Prompt Otimizado Gerado</h4>
                      <p className="text-zinc-400 text-xs italic">"{prompt.slice(0, 100)}..."</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;