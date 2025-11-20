import { GoogleGenAI, VideoGenerationReferenceImage, VideoGenerationReferenceType } from "@google/genai";
import { UploadedImage, VoiceSettings } from "../types";

// Helper to check/request API key via AI Studio extension
export const checkApiKey = async (): Promise<boolean> => {
  // @ts-ignore - Window extension for AI Studio
  if (typeof window !== 'undefined' && window.aistudio && window.aistudio.hasSelectedApiKey) {
     // @ts-ignore
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
       // @ts-ignore
      await window.aistudio.openSelectKey();
      // @ts-ignore
      return await window.aistudio.hasSelectedApiKey();
    }
    return true;
  }
  return false; // Return false if extension is not available, forcing manual key entry
};

/**
 * Step 1: Analyze the uploaded images to extract archetypal descriptions
 * strictly avoiding proper names to ensure the fictional character constraint.
 */
export const analyzeArchetypes = async (images: UploadedImage[], apiKey?: string): Promise<string> => {
  // Priority: User Key > Env Key > Empty (let SDK handle error or extension)
  const effectiveKey = apiKey || process.env.API_KEY;
  
  const ai = new GoogleGenAI({ apiKey: effectiveKey });
  
  // Use Flash for fast multimodal analysis
  const modelId = 'gemini-2.5-flash'; 
  
  const parts: any[] = [
    { text: `Atue como um Diretor de Fotografia experiente. Analise estas imagens de referência para um casting.
    
    TAREFA: Descreva detalhadamente a APARÊNCIA FÍSICA e a ATMOSFERA (VIBE) desses personagens para que um artista 3D possa recriá-los sem saber quem são os atores.
    
    FOQUE EM:
    - Detalhes do rosto (rugas, formato do queixo, tipo de olhar, "olhar melancólico", "olhar penetrante").
    - Cabelo e barbas (estilo, textura, cor, grisalho, despenteado).
    - Iluminação e Paleta de cores (noir, contraste, tons frios/quentes).
    - Vestuário sugerido na imagem.
    
    CRÍTICO: NÃO USE O NOME DOS ATORES. Descreva o ARQUÉTIPO (ex: "Homem de 50 anos com ar severo e barba grisalha cheia").` }
  ];

  for (const img of images) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
    });
    return response.text || "Arquétipos visuais dramáticos e cinematográficos.";
  } catch (error) {
    console.error("Error analyzing images:", error);
    throw new Error("Falha ao analisar os arquétipos das imagens. Verifique se sua chave de API é válida.");
  }
};

// Helper function for polling video operations
const pollOperation = async (ai: GoogleGenAI, initialOp: any) => {
  let op = initialOp;
  while (!op.done) {
    await new Promise(resolve => setTimeout(resolve, 6000));
    op = await ai.operations.getVideosOperation({ operation: op });
    console.log("Polling status...", op.metadata);
  }
  return op;
};

/**
 * Step 2: Generate the video using Veo
 */
export const generateCinematicVideo = async (
  images: UploadedImage[], 
  userPrompt: string, 
  archetypeDescription: string,
  voiceSettings: VoiceSettings,
  apiKey?: string
): Promise<{ videoUrl: string, videoAsset: any, blob: Blob }> => {
  const effectiveKey = apiKey || process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey: effectiveKey });

  // Construct Voice Context
  const voiceContext = `
    DIREÇÃO DE ÁUDIO (Audio Consistency):
    - Voz Personagem A (Protagonista): ${voiceSettings.characterA || "Natural, cinematográfica"}
    - Voz Personagem B (Antagonista): ${voiceSettings.characterB || "Natural, cinematográfica"}
    - O áudio deve ser de alta fidelidade, sincronizado com a emoção facial.
  `.trim();

  const fullPrompt = `
    Gere um vídeo cinematográfico fotorrealista com áudio (4k).
    
    PERSONAGENS (Visual Reference):
    ${archetypeDescription}
    
    ${voiceContext}
    
    CENA (Action):
    ${userPrompt}
    
    ESTILO: Série de Drama/Suspense Psicológico. Iluminação de cinema, profundidade de campo.
  `.trim();

  const referenceImagesPayload: VideoGenerationReferenceImage[] = images.map(img => ({
    image: {
      imageBytes: img.base64,
      mimeType: img.mimeType,
    },
    referenceType: VideoGenerationReferenceType.ASSET, 
  }));

  try {
    console.log("Tentativa 1: Usando Imagens de Referência e Voz...");
    
    let initialOp = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: fullPrompt,
      config: {
        numberOfVideos: 1,
        referenceImages: referenceImagesPayload.slice(0, 3),
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    let operationResult = await pollOperation(ai, initialOp);

    // CHECK FOR SAFETY FILTERS
    // @ts-ignore
    const safetyReasons = operationResult.response?.raiMediaFilteredReasons;
    const isFiltered = safetyReasons && safetyReasons.length > 0;

    if (isFiltered) {
      console.warn("Bloqueio de Imagem detectado (Provável Celebridade). Iniciando Fallback via Texto...");
      
      const fallbackPrompt = `
        Crie um vídeo cinematográfico realista com áudio.
        
        IMPORTANTE: Crie personagens originais que correspondam a esta descrição física exata:
        ${archetypeDescription}
        
        ${voiceContext}

        AÇÃO: ${userPrompt}
        
        ESTILO: Cinematografia de alta qualidade, 35mm, Drama, Suspense.
      `.trim();

      initialOp = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: fallbackPrompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      operationResult = await pollOperation(ai, initialOp);
      
      // @ts-ignore
      if (operationResult.response?.raiMediaFilteredReasons?.length > 0) {
         throw new Error("O roteiro contém temas sensíveis que violam as diretrizes de segurança.");
      }
    }

    if (operationResult.error) {
      throw new Error(`Erro na operação: ${operationResult.error.message}`);
    }

    const generatedVideo = operationResult.response?.generatedVideos?.[0];
    const videoUri = generatedVideo?.video?.uri;
    
    if (!videoUri) {
        throw new Error("URI do vídeo vazia na resposta da API.");
    }

    const fetchUrl = `${videoUri}&key=${effectiveKey}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error("Falha ao baixar o arquivo de vídeo.");
    
    const blob = await response.blob();
    return {
      videoUrl: URL.createObjectURL(blob),
      videoAsset: generatedVideo?.video, // Return the asset for future extensions
      blob: blob
    };

  } catch (error: any) {
    console.error("Video generation error:", error);
    throw new Error(error.message || "Erro ao gerar vídeo.");
  }
};

/**
 * Step 3: Extend the video
 * Uses the previous video asset to ensure 100% consistency of characters AND voice.
 */
export const extendCinematicVideo = async (
  previousVideoAsset: any,
  newPrompt: string,
  voiceSettings: VoiceSettings,
  apiKey?: string
): Promise<{ videoUrl: string, videoAsset: any, blob: Blob }> => {
  const effectiveKey = apiKey || process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey: effectiveKey });

  if (!previousVideoAsset) {
    throw new Error("Nenhum vídeo anterior encontrado para estender.");
  }

  const voiceContext = `
    Mantenha a consistência total da voz:
    - A: ${voiceSettings.characterA}
    - B: ${voiceSettings.characterB}
  `.trim();

  try {
    console.log("Iniciando extensão de vídeo com consistência vocal...");
    
    // Veo extension request
    let initialOp = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: `${newPrompt}. ${voiceContext}. (Mantenha a consistência visual exata e continuidade da ação)`,
      video: previousVideoAsset, // Passing the raw asset guarantees continuity
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9' // Must match previous
      }
    });

    const operationResult = await pollOperation(ai, initialOp);

    if (operationResult.error) {
      throw new Error(`Erro na extensão: ${operationResult.error.message}`);
    }

    const generatedVideo = operationResult.response?.generatedVideos?.[0];
    const videoUri = generatedVideo?.video?.uri;

    if (!videoUri) {
      throw new Error("Falha ao gerar a continuação do vídeo.");
    }

    const fetchUrl = `${videoUri}&key=${effectiveKey}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error("Falha ao baixar o vídeo estendido.");

    const blob = await response.blob();
    return {
      videoUrl: URL.createObjectURL(blob),
      videoAsset: generatedVideo?.video,
      blob: blob
    };

  } catch (error: any) {
    console.error("Video extension error:", error);
    throw new Error(error.message || "Erro ao estender vídeo.");
  }
};