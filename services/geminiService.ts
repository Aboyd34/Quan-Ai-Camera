
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const scoutScene = async (base64Image: string, lat?: number, lng?: number) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/jpeg' } },
        { text: "Analyze this camera frame using Quantum Precision. Provide a descriptive summary (max 30 words). Identify up to 3 key objects/landmarks and provide their approximate normalized coordinates (x, y) from 0-100. format: [Summary] labels: object1(x,y), object2(x,y). Use Google Search/Maps to provide real-world context if applicable." }
      ]
    },
    config: {
      tools: [{ googleSearch: {} }, { googleMaps: {} }],
      toolConfig: {
        retrievalConfig: lat && lng ? { latLng: { latitude: lat, longitude: lng } } : undefined
      }
    },
  });

  const grounding: any[] = [];
  response.candidates?.[0]?.groundingMetadata?.groundingChunks?.forEach((chunk: any) => {
    if (chunk.web) grounding.push({ title: chunk.web.title, uri: chunk.web.uri, type: 'web' });
    if (chunk.maps) grounding.push({ title: chunk.maps.title, uri: chunk.maps.uri, type: 'maps' });
  });

  const text = response.text || "Scene analyzed by Quan AI Core.";
  
  const labels: { text: string; x: number; y: number }[] = [];
  const labelMatch = text.match(/labels: (.*)/);
  if (labelMatch) {
    const parts = labelMatch[1].split(',');
    parts.forEach(p => {
      const match = p.match(/(.*)\((.*)\/(.*)\)/);
      if (match) labels.push({ text: match[1].trim(), x: parseInt(match[2]), y: parseInt(match[3]) });
    });
  }

  return {
    text: text.split('labels:')[0].trim(),
    grounding,
    labels
  };
};

export const enhanceImage = async (base64Image: string, instruction: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/jpeg' } },
        { text: `Quantum Enhancement Request: ${instruction}. Re-render the image with improved lighting, neural clarity, and artistic Roman aesthetic while maintaining structural integrity.` }
      ]
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return null;
};

export const generateCinemaClip = async (prompt: string, startImage?: string) => {
  const ai = getAI();
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    image: startImage ? {
      imageBytes: startImage.split(',')[1],
      mimeType: 'image/jpeg',
    } : undefined,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  const fetchRes = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await fetchRes.blob();
  return URL.createObjectURL(blob);
};

export const neuralStacking = async (images: string[], type: 'hdr' | 'night') => {
  const ai = getAI();
  const prompt = type === 'hdr' 
    ? "Perform professional Quantum HDR Fusion on these 3 frames. Ensure natural tone mapping and highlight recovery." 
    : "Perform Neural Night Stacking. De-noise the dark areas while preserving texture and details with Quantum precision.";

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        ...images.map(img => ({ inlineData: { data: img.split(',')[1], mimeType: 'image/jpeg' } })),
        { text: prompt }
      ]
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return null;
};

export const generateAIImage = async (prompt: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: prompt }] },
    config: { 
      imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
      tools: [{ googleSearch: {} }] 
    }
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return null;
};
