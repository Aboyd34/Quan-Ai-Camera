
import { FunctionDeclaration, GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import React, { useEffect, useRef, useState } from 'react';
import { decode, decodeAudioData, encode } from '../utils/audioUtils';
import { CameraMode, LensProfile, CameraFilter } from '../types';
import BrandLogo from './BrandLogo';

interface AIAssistantProps {
  onTriggerCapture: (prompt?: string) => void;
  onSetMode: (mode: CameraMode) => void;
  onSetLens: (lens: LensProfile) => void;
  onSetFilter: (filter: CameraFilter) => void;
  onToggleGrid: () => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ onTriggerCapture, onSetMode, onSetLens, onSetFilter, onToggleGrid }) => {
  const [isActive, setIsActive] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const frameIntervalRef = useRef<number | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const activeSourcesCountRef = useRef<number>(0);

  const controlFunctions: FunctionDeclaration[] = [
    { name: 'trigger_shutter', description: 'Capture media or trigger AI action.', parameters: { type: Type.OBJECT, properties: {} } },
    { name: 'scout_area', description: 'Enable Scout mode for location analysis.', parameters: { type: Type.OBJECT, properties: {} } },
    { name: 'toggle_grid', description: 'Cycle through composition grids (3x3, Golden Ratio, Off).', parameters: { type: Type.OBJECT, properties: {} } },
    { 
      name: 'set_mode', 
      description: 'Switch camera mode.', 
      parameters: { 
        type: Type.OBJECT, 
        properties: { 
          mode: { type: Type.STRING, enum: Object.values(CameraMode) } 
        } 
      } 
    },
    { 
      name: 'set_filter', 
      description: 'Apply a visual filter.', 
      parameters: { 
        type: Type.OBJECT, 
        properties: { 
          filter: { type: Type.STRING, enum: Object.values(CameraFilter) } 
        } 
      } 
    },
    { 
      name: 'set_lens', 
      description: 'Switch optics/lens profile.', 
      parameters: { 
        type: Type.OBJECT, 
        properties: { 
          lens: { type: Type.STRING, enum: Object.values(LensProfile) } 
        } 
      } 
    }
  ];

  const startVisionStream = (sessionPromise: Promise<any>) => {
    const video = document.querySelector('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!video || !ctx) return;

    frameIntervalRef.current = window.setInterval(() => {
      canvas.width = 320; 
      canvas.height = 240;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
      sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } }));
    }, 1500); 
  };

  const toggleAssistant = async () => {
    if (isActive) {
      sessionRef.current?.close();
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
      sourcesRef.current.clear();
      activeSourcesCountRef.current = 0;
      setIsActive(false);
      setIsResponding(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
             startVisionStream(sessionPromise);
             const source = inputCtx.createMediaStreamSource(stream);
             const processor = inputCtx.createScriptProcessor(4096, 1, 1);
             processor.onaudioprocess = (e) => {
               const inputData = e.inputBuffer.getChannelData(0);
               const int16 = new Int16Array(inputData.length);
               for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
               sessionPromise.then(s => s.sendRealtimeInput({ 
                 media: { 
                   data: encode(new Uint8Array(int16.buffer)), 
                   mimeType: 'audio/pcm;rate=16000' 
                 } 
               }));
             };
             source.connect(processor);
             processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.interrupted) {
              for (const source of sourcesRef.current) { try { source.stop(); } catch (e) {} }
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              activeSourcesCountRef.current = 0;
              setIsResponding(false);
              return;
            }

            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'trigger_shutter') onTriggerCapture();
                if (fc.name === 'scout_area') onSetMode(CameraMode.SCOUT);
                if (fc.name === 'set_mode') onSetMode(fc.args.mode as CameraMode);
                if (fc.name === 'set_filter') onSetFilter(fc.args.filter as CameraFilter);
                if (fc.name === 'set_lens') onSetLens(fc.args.lens as LensProfile);
                if (fc.name === 'toggle_grid') onToggleGrid();
                
                sessionPromise.then(s => s.sendToolResponse({ 
                  functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } } 
                }));
              }
            }

            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              const ctx = audioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              
              activeSourcesCountRef.current++;
              setIsResponding(true);
              
              source.onended = () => {
                sourcesRef.current.delete(source);
                activeSourcesCountRef.current--;
                if (activeSourcesCountRef.current <= 0) {
                  activeSourcesCountRef.current = 0;
                  setIsResponding(false);
                }
              };

              sourcesRef.current.add(source);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
            }
          },
          onerror: (e) => { console.error("Live session error:", e); setIsActive(false); },
          onclose: (e) => { setIsActive(false); }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: controlFunctions }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: "You are Quan AI, the Quantum Core Intelligence. You are a Professional Cinematographer and Director. You monitor the user's vision stream and provide elite coaching on composition, lighting, and Roman-inspired aesthetics. Suggest specific filters like 'AURELIUS' or 'IMPERIAL_MONO' based on the mood. If you notice a landmark, encourage 'SCOUT' mode. Be authoritative, concise, and highly skilled in technical photography."
        }
      });

      sessionRef.current = await sessionPromise;
      setIsActive(true);
    } catch (err) { 
      console.error("Live AI Session Failed", err); 
      setIsActive(false);
    }
  };

  return (
    <div className="absolute top-6 left-6 z-50 flex items-center gap-3">
      <button 
        onClick={toggleAssistant} 
        className={`group relative px-6 py-4 rounded-full transition-all duration-700 flex items-center gap-4 overflow-hidden border ${
          isActive 
            ? isResponding 
              ? 'bg-cyan-900/60 border-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.4)] scale-105' 
              : 'bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.2)]' 
            : 'bg-white/5 border-white/10 hover:bg-white/15'
        }`}
      >
        <div className={`transition-transform duration-700 ${isResponding ? 'animate-spin-slow scale-110' : isActive ? 'scale-100' : 'opacity-40'}`}>
          <BrandLogo size={24} glow={isActive} />
        </div>
        <div className="flex flex-col items-start text-left">
          <span className={`text-[10px] roman font-black uppercase tracking-[0.2em] transition-all duration-500 ${isActive ? 'text-white' : 'text-white/40'}`}>
            {isActive ? (isResponding ? 'Core Active' : 'Director Unit') : 'QUAN AI'}
          </span>
          <span className={`text-[7px] mono font-bold uppercase tracking-[0.3em] transition-opacity duration-500 ${isActive ? 'opacity-60' : 'opacity-0'}`}>
            {isResponding ? 'Mastering Composition...' : 'Monitoring Optics'}
          </span>
        </div>
      </button>
    </div>
  );
};

export default AIAssistant;
