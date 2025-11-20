import { GoogleGenAI, VideoGenerationReferenceImage, VideoGenerationReferenceType } from "@google/genai";
import { UploadedImage } from "../types";

// Helper to check/request API key
export const checkApiKey = async (): Promise<boolean> => {
  // @ts-ignore - Window extension for AI Studio
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
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
  return true; // Fallback for local envs where env var might be present
};

/**
 * Step 1: Analyze the uploaded images to extract archetypal descriptions
 * strictly avoiding proper names to ensure the fictional character constraint.
 */
export const analyzeArchetypes = async (images: UploadedImage[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
    throw new Error("Falha ao analisar os arquétipos das imagens.");
  }
};

/**
 * Step 2: Generate the video using Veo
 */
export const generateCinematicVideo = async (
  images: UploadedImage[], 
  userPrompt: string, 
  archetypeDescription: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

    // Polling loop
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("URI do vídeo não retornada.");

    // Fetch the actual video blob using the key
    const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
    if (!response.ok) throw new Error("Falha ao baixar o vídeo gerado.");
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Video generation error:", error);
    throw error;
  }
};