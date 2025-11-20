import { GoogleGenAI, VideoGenerationReferenceImage, VideoGenerationReferenceType } from "@google/genai";
import { UploadedImage } from "../types";

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
    { text: `Analise estas imagens e descreva APENAS os traços visuais genéricos e arquétipos cinematográficos (ex: iluminação, idade aparente, estilo de cabelo, formato do rosto, expressão, atmosfera).
    
    REGRAS ESTRITAS:
    1. NÃO identifique os atores ou pessoas reais por nome.
    2. Use termos abstratos (ex: "homem de meia idade com barba", "mulher com olhar misterioso").
    3. O objetivo é criar um prompt para gerar personagens FICTÍCIOS inspirados neste estilo.
    4. Retorne um resumo descritivo para compor um prompt de geração de vídeo.` }
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

/**
 * Step 2: Generate the video using Veo
 */
export const generateCinematicVideo = async (
  images: UploadedImage[], 
  userPrompt: string, 
  archetypeDescription: string,
  apiKey?: string
): Promise<string> => {
  // Priority: User Key > Env Key
  const effectiveKey = apiKey || process.env.API_KEY;
  if (!effectiveKey && !process.env.API_KEY) {
      // If no key is provided, we might rely on the browser extension injection, 
      // but usually we need to pass something to the constructor.
      // If in AI Studio, process.env.API_KEY is injected.
  }

  const ai = new GoogleGenAI({ apiKey: effectiveKey });

  // Construct a rich prompt combining user intent and safe archetype analysis
  const fullPrompt = `
    Crie um vídeo cinematográfico realista.
    
    Contexto Visual (Estilo): ${archetypeDescription}
    
    Ação da Cena: ${userPrompt}
    
    Direção de Arte: Iluminação dramática, alta qualidade, 35mm, texturas detalhadas. Personagens fictícios originais.
  `.trim();

  // Prepare reference images for Veo
  const referenceImagesPayload: VideoGenerationReferenceImage[] = images.map(img => ({
    image: {
      imageBytes: img.base64,
      mimeType: img.mimeType,
    },
    referenceType: VideoGenerationReferenceType.ASSET, // Using as style/asset reference
  }));

  try {
    console.log("Starting Veo generation with prompt:", fullPrompt);

    // Using Veo Generate Preview (supports ref images)
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: fullPrompt,
      config: {
        numberOfVideos: 1,
        referenceImages: referenceImagesPayload.slice(0, 3), // Limit to 3
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    console.log("Operation started:", operation);

    // Polling loop
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 6000)); // Poll every 6s
      operation = await ai.operations.getVideosOperation({ operation: operation });
      console.log("Polling operation status...", operation.metadata);
    }

    // Check for specific operation errors (Standard API error)
    if (operation.error) {
      console.error("Veo Operation Error:", operation.error);
      const errorMsg = operation.error.message || "Erro desconhecido na operação de vídeo.";
      throw new Error(`Falha na geração do vídeo: ${errorMsg}`);
    }

    // SPECIFIC ERROR HANDLING FOR SAFETY FILTERS (RAI)
    // @ts-ignore - Accessing dynamic response properties for safety filters
    if (operation.response?.raiMediaFilteredReasons && operation.response.raiMediaFilteredReasons.length > 0) {
        // @ts-ignore
        const reason = operation.response.raiMediaFilteredReasons[0];
        console.error("Veo Safety Filter Triggered:", reason);
        
        let friendlyError = `Bloqueio de Segurança: "${reason}"`;
        
        if (typeof reason === 'string' && reason.toLowerCase().includes("celebrity")) {
            friendlyError = "Bloqueio de Segurança: A imagem contém semelhança com celebridades ou pessoas públicas. O Google Veo não permite gerar vídeos com pessoas famosas. Por favor, tente novamente usando imagens de pessoas desconhecidas ou geradas por IA.";
        } else if (typeof reason === 'string' && (reason.toLowerCase().includes("safety") || reason.toLowerCase().includes("sensitive"))) {
             friendlyError = "Bloqueio de Segurança: O conteúdo foi marcado como sensível pelos filtros da IA. Tente suavizar o prompt ou trocar as imagens de referência.";
        }

        throw new Error(friendlyError);
    }

    // Check if generatedVideos exists and has content
    if (!operation.response?.generatedVideos || operation.response.generatedVideos.length === 0) {
        console.error("Operation completed but no videos returned. Full Object:", JSON.stringify(operation, null, 2));
        throw new Error("O vídeo não foi gerado e nenhum motivo específico foi retornado. Isso geralmente indica um bloqueio silencioso de segurança ou falha temporária do servidor.");
    }

    const videoUri = operation.response.generatedVideos[0]?.video?.uri;
    if (!videoUri) {
        console.error("Operation finished, video array exists, but URI is undefined:", operation);
        throw new Error("A API concluiu o processo mas a URI do vídeo está vazia. Falha interna no processamento do arquivo.");
    }

    // Fetch the actual video blob using the key
    const fetchUrl = `${videoUri}&key=${effectiveKey}`;
    const response = await fetch(fetchUrl);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch video file:", errorText);
        throw new Error(`Falha ao baixar o arquivo de vídeo gerado (Status: ${response.status}).`);
    }
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error: any) {
    console.error("Video generation error stack:", error);
    // Propagate the specific error message
    throw new Error(error.message || "Erro na geração do vídeo.");
  }
};