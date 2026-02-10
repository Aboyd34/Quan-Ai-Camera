
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { scoutScene, neuralStacking, generateAIImage, generateCinemaClip } from '../services/geminiService';
import { legionService } from '../services/legionService';
import { CameraFilter, CameraMode, CameraXTelemetry, CapturedImage, DeviceTelemetry, LegionMessage, LegionRole, LensProfile, ManualConfig, GroundingLabel } from '../types';
import BrandLogo from './BrandLogo';
import Histogram from './Histogram';

interface CameraInterfaceProps {
  mode: CameraMode;
  onCapture: (image: CapturedImage) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  activeLens: LensProfile;
  onLensChange: (lens: LensProfile) => void;
  legionRole: LegionRole | null;
}

export interface CameraInterfaceHandle {
  triggerCapture: (prompt?: string) => void;
  toggleGrid: () => void;
  setFilter: (filter: CameraFilter) => void;
}

const MODULAR_UNITS = [
  { id: 'optics', label: 'OPTICS', icon: '◈' },
  { id: 'filtrum', label: 'FILTER', icon: '✦' },
  { id: 'scout', label: 'SCOUT', icon: '⚲' },
  { id: 'neural', label: 'NEURAL', icon: '⌬' },
  { id: 'manual', label: 'M-PRO', icon: '⚙' }
];

const LEGION_UNITS = [
  { id: 'legion', label: 'FLEET', icon: '🛰️' },
  { id: 'optics', label: 'OPTICS', icon: '◈' },
  { id: 'filtrum', label: 'FILTER', icon: '✦' }
];

const FILTER_MAPPING: Record<CameraFilter, string> = {
  [CameraFilter.NONE]: 'none',
  [CameraFilter.VINTAGE_ROMA]: 'sepia(0.6) contrast(1.1) brightness(0.9) saturate(0.8)',
  [CameraFilter.IMPERIAL_MONO]: 'grayscale(1) contrast(1.2) brightness(1.1)',
  [CameraFilter.NEURAL_VIBRANCE]: 'saturate(1.8) contrast(1.1) brightness(1.05)',
  [CameraFilter.CYBER_LATIUM]: 'hue-rotate(180deg) saturate(1.4) contrast(1.2) brightness(0.8)',
  [CameraFilter.GLOAMING]: 'contrast(1.1) brightness(0.8) sepia(0.3) saturate(1.5)',
  [CameraFilter.MARBLE_STATUE]: 'grayscale(0.4) contrast(0.9) brightness(1.2) saturate(0.2)',
  [CameraFilter.AURELIUS]: 'contrast(1.1) saturate(1.2) brightness(1.05) sepia(0.1)',
};

const CameraInterface = forwardRef<CameraInterfaceHandle, CameraInterfaceProps>(({ 
  mode, onCapture, isProcessing, setIsProcessing, activeLens, onLensChange, legionRole 
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const prevModeRef = useRef<CameraMode>(mode);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [shutterPulse, setShutterPulse] = useState(false);
  const [activeUnit, setActiveUnit] = useState('optics');
  const [activeFilter, setActiveFilter] = useState<CameraFilter>(CameraFilter.NONE);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [aiPrompt, setAiPrompt] = useState('');
  const [burstCount, setBurstCount] = useState(0);
  const [devices, setDevices] = useState<DeviceTelemetry[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [gridType, setGridType] = useState<'3x3' | 'GOLDEN'>('3x3');
  const [manual, setManual] = useState<ManualConfig>({ iso: 400, shutter: '1/125', ev: 0, wb: 5600, zoom: 1, flashMode: 'off' });
  const [veoMessage, setVeoMessage] = useState('Generating Quantum Cinema...');
  const [groundingLabels, setGroundingLabels] = useState<GroundingLabel[]>([]);
  const [capabilities, setCapabilities] = useState<MediaTrackCapabilities | null>(null);

  const isLegionMode = mode === CameraMode.LEGION_LINK;
  const currentUnits = isLegionMode ? LEGION_UNITS : MODULAR_UNITS;
  const timerRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (prevModeRef.current !== mode) {
      if (isLegionMode) setActiveUnit('legion');
      else if (mode === CameraMode.SCOUT) setActiveUnit('scout');
      else if (mode === CameraMode.CINEMA) setActiveUnit('cinema');
      else if (mode === CameraMode.HDR_FUSION || mode === CameraMode.NIGHT_STACK) setActiveUnit('neural');
      else if (mode === CameraMode.M_PRO) setActiveUnit('manual');
      else setActiveUnit('optics');
      prevModeRef.current = mode;
      setGroundingLabels([]); 
    }
  }, [mode, isLegionMode]);

  useImperativeHandle(ref, () => ({
    triggerCapture: (prompt?: string) => {
      if (prompt) handlePromptCapture(prompt);
      else handleShutterAction();
    },
    toggleGrid: () => {
      if (!showGrid) setShowGrid(true);
      else if (gridType === '3x3') setGridType('GOLDEN');
      else setShowGrid(false);
    },
    setFilter: (f: CameraFilter) => setActiveFilter(f)
  }));

  useEffect(() => {
    const startCamera = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: true
        });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
        
        const track = s.getVideoTracks()[0];
        if (track && track.getCapabilities) {
          setCapabilities(track.getCapabilities());
        }
      } catch (err) { 
        console.error("Optics Engine initialization failed", err); 
      }
    };
    startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  useEffect(() => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && track.applyConstraints) {
      track.applyConstraints({
        advanced: [
          { zoom: manual.zoom } as any,
          { torch: manual.flashMode === 'torch' } as any
        ]
      }).catch(e => console.warn("Constraint application failed", e));
    }
  }, [manual.zoom, manual.flashMode, stream]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  useEffect(() => {
    if (isLegionMode) {
      const unsubTelemetry = legionService.onTelemetryUpdate(setDevices);
      setDevices(legionService.getConnectedDevices());
      const unsubMessages = legionService.onMessage((msg: LegionMessage) => {
        if (msg.senderId === legionService.getDeviceId()) return;
        if (msg.type === 'START_REC') {
          const delay = Math.max(0, (msg.timestamp + (msg.payload?.delay || 0)) - legionService.getSynchronizedTime());
          setTimeout(() => { if (!isRecordingRef.current) startRecording(false); }, delay);
        } else if (msg.type === 'STOP_REC') {
          if (isRecordingRef.current) stopRecording(false);
        }
      });
      return () => { unsubTelemetry(); unsubMessages(); };
    }
  }, [isLegionMode]);

  const handlePromptCapture = async (prompt: string) => {
    if (mode === CameraMode.AI_GENERATE) {
      setIsProcessing(true);
      const url = await generateAIImage(prompt);
      if (url) onCapture({ id: crypto.randomUUID(), url, timestamp: Date.now(), mediaType: 'image', analysis: prompt });
      setIsProcessing(false);
    } else if (mode === CameraMode.CINEMA) {
      handleCinema(prompt);
    }
  };

  const startRecording = (broadcast = true) => {
    if (!stream) return;
    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 15000000 });
    
    recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setIsProcessing(true);
      let analysisText = mode === CameraMode.LEGION_LINK ? `Fleet Sync [${legionRole}]` : "Quantum Cinematic Capture";
      
      if (videoRef.current && canvasRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.filter = FILTER_MAPPING[activeFilter];
          ctx.drawImage(videoRef.current, 0, 0);
          const thumb = canvasRef.current.toDataURL('image/jpeg');
          if (mode === CameraMode.SCOUT) {
             const result = await scoutScene(thumb);
             analysisText = result.text;
             setGroundingLabels(result.labels);
          }
        }
      }
      setIsProcessing(false);
      onCapture({ 
        id: crypto.randomUUID(), url, timestamp: Date.now(), mediaType: 'video', analysis: analysisText,
        metadata: { iso: 'Auto', shutter: 'Auto', lens: activeLens, mode, filter: activeFilter, role: legionRole || undefined, zoom: manual.zoom, flash: manual.flashMode }
      });
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    if (broadcast && isLegionMode && legionRole === 'LEGATUS') legionService.sendCommand('START_REC', { delay: 500 });
  };

  const stopRecording = (broadcast = true) => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (broadcast && isLegionMode && legionRole === 'LEGATUS') legionService.sendCommand('STOP_REC');
    }
  };

  const handleShutterAction = async () => {
    if (isProcessing) return;
    const isVideoMode = mode === CameraMode.VIDEO || mode === CameraMode.LEGION_LINK;
    if (isVideoMode) {
      if (isRecording) stopRecording(); else startRecording();
    } else {
      if (mode === CameraMode.SCOUT) await handleScout();
      else if (mode === CameraMode.CINEMA) handleCinema(aiPrompt);
      else if (mode === CameraMode.HDR_FUSION) await handleNeuralStack('hdr');
      else if (mode === CameraMode.NIGHT_STACK) await handleNeuralStack('night');
      else capturePhoto();
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setShutterPulse(true);
    
    // Virtual Flash Logic
    const useFlash = manual.flashMode === 'on';
    if (useFlash) {
      // Screen Flash Effect handled by shutterPulse brightness
    }

    setTimeout(() => setShutterPulse(false), 200);
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.filter = FILTER_MAPPING[activeFilter];
    ctx.drawImage(videoRef.current, 0, 0);
    const url = canvasRef.current.toDataURL('image/jpeg');
    onCapture({ 
      id: crypto.randomUUID(), url, timestamp: Date.now(), mediaType: 'image', 
      analysis: "Quantum Standard Capture", 
      metadata: { iso: manual.iso.toString(), shutter: manual.shutter, lens: activeLens, mode, filter: activeFilter, zoom: manual.zoom, flash: manual.flashMode } 
    });
  };

  const handleNeuralStack = async (type: 'hdr' | 'night') => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsProcessing(true);
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    const frames: string[] = [];
    const burstSize = 3;

    for (let i = 0; i < burstSize; i++) {
      setBurstCount(i + 1);
      setShutterPulse(true);
      ctx.filter = type === 'hdr' 
        ? `brightness(${0.5 + i * 0.5}) contrast(${1.0 + i * 0.1})` 
        : `brightness(${1.5 + i * 0.5}) contrast(0.9)`;
      ctx.drawImage(videoRef.current, 0, 0);
      frames.push(canvasRef.current.toDataURL('image/jpeg', 0.8));
      await new Promise(r => setTimeout(r, 150));
      setShutterPulse(false);
      await new Promise(r => setTimeout(r, 50));
    }
    setBurstCount(0);
    const resultUrl = await neuralStacking(frames, type);
    if (resultUrl) {
      onCapture({ id: crypto.randomUUID(), url: resultUrl, timestamp: Date.now(), mediaType: 'image', analysis: type === 'hdr' ? "Quantum HDR Fusion" : "Quantum Night Stack" });
    }
    setIsProcessing(false);
  };

  const handleScout = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsProcessing(true);
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvasRef.current.toDataURL('image/jpeg');
    const result = await scoutScene(dataUrl);
    onCapture({ id: crypto.randomUUID(), url: dataUrl, timestamp: Date.now(), mediaType: 'image', analysis: result.text, grounding: result.grounding });
    setGroundingLabels(result.labels || []);
    setIsProcessing(false);
  };

  const handleCinema = async (prompt: string) => {
    setIsProcessing(true);
    setVeoMessage('Calibrating Quantum Flux...');
    const messageSequence = ['Calibrating Quantum Flux...', 'Encoding Neural Frames...', 'Finalizing Cinematic Stream...'];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messageSequence.length;
      setVeoMessage(messageSequence[msgIdx]);
    }, 4000);

    let startFrame;
    if (videoRef.current && canvasRef.current) {
       canvasRef.current.width = videoRef.current.videoWidth;
       canvasRef.current.height = videoRef.current.videoHeight;
       const ctx = canvasRef.current.getContext('2d');
       if (ctx) { ctx.drawImage(videoRef.current, 0, 0); startFrame = canvasRef.current.toDataURL('image/jpeg'); }
    }
    const url = await generateCinemaClip(prompt || "Quantum cinematic motion", startFrame);
    clearInterval(msgInterval);
    onCapture({ id: crypto.randomUUID(), url, timestamp: Date.now(), mediaType: 'video', analysis: `Cinema: ${prompt}` });
    setIsProcessing(false);
  };

  const filterStyle = FILTER_MAPPING[activeFilter];

  return (
    <div className="relative w-full h-full bg-[#030303] flex flex-col overflow-hidden">
      <div className="absolute inset-0 z-40 pointer-events-none p-8">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
             <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-cyan-500'}`} />
                <span className="text-[11px] font-black mono uppercase tracking-[0.3em]">
                  {isRecording ? `CORE_REC_${recordingTime}s` : mode}
                </span>
             </div>
             <Histogram videoRef={videoRef} />
          </div>
          <div className="flex flex-col gap-4 items-end pointer-events-auto">
            <button 
              onClick={() => {
                if (!showGrid) setShowGrid(true);
                else if (gridType === '3x3') setGridType('GOLDEN');
                else setShowGrid(false);
              }} 
              className="glass w-12 h-12 rounded-full flex items-center justify-center text-[9px] roman border border-white/10 group active:scale-95 transition-all"
            >
              <div className="flex flex-col items-center">
                <span className="font-black text-cyan-400">{showGrid ? (gridType === '3x3' ? '3x3' : 'PHI') : 'OFF'}</span>
                <span className="opacity-40 text-[7px] uppercase tracking-tighter">Guide</span>
              </div>
            </button>
            
            <button 
              onClick={() => {
                const modes: ('off' | 'on' | 'torch')[] = ['off', 'on', 'torch'];
                const next = modes[(modes.indexOf(manual.flashMode) + 1) % modes.length];
                setManual({...manual, flashMode: next});
              }}
              className={`glass w-12 h-12 rounded-full flex items-center justify-center border transition-all active:scale-95 ${manual.flashMode !== 'off' ? 'border-amber-400 bg-amber-400/10' : 'border-white/10'}`}
            >
               <span className={`text-lg ${manual.flashMode === 'off' ? 'opacity-30' : 'animate-pulse'}`}>
                 {manual.flashMode === 'torch' ? '🔦' : '⚡'}
               </span>
            </button>
          </div>
        </div>
        
        {/* Zoom Slider (Vertical Left) */}
        <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 pointer-events-auto group">
           <span className="text-[8px] mono text-cyan-400 font-bold uppercase tracking-widest">{manual.zoom.toFixed(1)}x</span>
           <div className="relative h-48 w-1.5 bg-white/10 rounded-full flex flex-col items-center">
              <input 
                type="range" min="1" max="8" step="0.1" value={manual.zoom}
                onChange={(e) => setManual({...manual, zoom: parseFloat(e.target.value)})}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                style={{ appearance: 'slider-vertical', writingMode: 'bt-lr' } as any}
              />
              <div 
                className="absolute bottom-0 w-full bg-cyan-400 rounded-full transition-all duration-75"
                style={{ height: `${((manual.zoom - 1) / 7) * 100}%` }}
              />
              <div 
                className="absolute w-4 h-4 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.6)] border-2 border-white pointer-events-none"
                style={{ bottom: `calc(${((manual.zoom - 1) / 7) * 100}% - 8px)` }}
              />
           </div>
           <span className="text-[7px] mono text-white/30 uppercase tracking-widest">Zoom</span>
        </div>

        {showGrid && gridType === '3x3' && (
          <div className="absolute inset-0 flex">
            <div className="w-1/3 h-full border-r border-white/10" />
            <div className="w-1/3 h-full border-r border-white/10" />
            <div className="absolute inset-0 flex flex-col">
              <div className="h-1/3 w-full border-b border-white/10" />
              <div className="h-1/3 w-full border-b border-white/10" />
            </div>
          </div>
        )}

        {showGrid && gridType === 'GOLDEN' && (
          <div className="absolute inset-0 overflow-hidden opacity-30">
            <svg viewBox="0 0 100 100" className="w-full h-full stroke-white/40 fill-none" preserveAspectRatio="none">
              <rect x="0" y="0" width="61.8" height="100" strokeWidth="0.1" />
              <rect x="61.8" y="0" width="38.2" height="61.8" strokeWidth="0.1" />
              <path d="M0,100 C61.8,100 100,61.8 100,0" strokeWidth="0.1" />
            </svg>
          </div>
        )}

        {mode === CameraMode.SCOUT && groundingLabels.map((label, i) => (
          <div 
            key={i} 
            className="absolute transition-all duration-1000 animate-in zoom-in-50 fade-in"
            style={{ left: `${label.x}%`, top: `${label.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div className="relative">
              <div className="w-4 h-4 border-2 border-cyan-400 rounded-full animate-ping absolute inset-0" />
              <div className="w-4 h-4 border-2 border-cyan-400 rounded-full relative bg-black/40" />
              <div className="absolute top-6 left-1/2 -translate-x-1/2 glass px-3 py-1.5 rounded-lg border border-cyan-400/40 whitespace-nowrap">
                <span className="text-[10px] roman font-black text-white uppercase tracking-widest">{label.text}</span>
              </div>
            </div>
          </div>
        ))}

        {mode === CameraMode.M_PRO && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-12 pointer-events-auto">
             <div className="flex flex-col items-center gap-3 group">
                <span className="text-[8px] mono text-cyan-400 font-bold uppercase tracking-widest">ISO {manual.iso}</span>
                <div className="relative h-40 w-1.5 bg-white/10 rounded-full flex flex-col items-center">
                  <input 
                    type="range" min="50" max="3200" step="50" value={manual.iso}
                    onChange={(e) => setManual({...manual, iso: parseInt(e.target.value)})}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ appearance: 'slider-vertical', writingMode: 'bt-lr' } as any}
                  />
                  <div 
                    className="absolute bottom-0 w-full bg-cyan-400 rounded-full transition-all duration-75"
                    style={{ height: `${((manual.iso - 50) / 3150) * 100}%` }}
                  />
                  <div 
                    className="absolute w-4 h-4 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.6)] border-2 border-white pointer-events-none"
                    style={{ bottom: `calc(${((manual.iso - 50) / 3150) * 100}% - 8px)` }}
                  />
                </div>
             </div>
             
             {/* Exposure Slider (Prominent) */}
             <div className="flex flex-col items-center gap-3 group">
                <span className="text-[8px] mono text-amber-400 font-bold uppercase tracking-widest">EV {manual.ev > 0 ? `+${manual.ev}` : manual.ev}</span>
                <div className="relative h-40 w-1.5 bg-white/10 rounded-full flex flex-col items-center">
                  <input 
                    type="range" min="-3" max="3" step="0.1" value={manual.ev}
                    onChange={(e) => setManual({...manual, ev: parseFloat(e.target.value)})}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ appearance: 'slider-vertical', writingMode: 'bt-lr' } as any}
                  />
                  {/* EV Indicator Bar: Zero point is middle */}
                  <div 
                    className="absolute bottom-1/2 w-full bg-amber-400 rounded-full transition-all duration-75"
                    style={{ 
                      height: `${Math.abs(manual.ev / 3) * 50}%`,
                      bottom: manual.ev >= 0 ? '50%' : `calc(50% - ${Math.abs(manual.ev / 3) * 50}%)`
                    }}
                  />
                  <div 
                    className="absolute w-4 h-4 bg-amber-400 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.6)] border-2 border-white pointer-events-none"
                    style={{ bottom: `calc(${((manual.ev + 3) / 6) * 100}% - 8px)` }}
                  />
                </div>
             </div>
          </div>
        )}
      </div>

      <div className={`flex-1 relative transition-all duration-200 ${shutterPulse ? 'brightness-[2.0] saturate-[1.5] contrast-[1.5] scale-[1.02]' : ''}`}>
        <video 
          ref={videoRef} autoPlay playsInline muted 
          className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
          style={{ 
            filter: `${filterStyle} brightness(${1 + manual.ev * 0.3}) contrast(${1 + Math.abs(manual.ev) * 0.1})`,
            transform: activeLens.includes('ANAMORPHIC') ? 'scaleX(1.33)' : 'none'
          }}
        />
        
        {mode === CameraMode.CINEMA && (
          <div className="absolute inset-0 flex flex-col pointer-events-none">
            <div className="h-20 w-full bg-black/80 backdrop-blur-sm" />
            <div className="flex-1" />
            <div className="h-20 w-full bg-black/80 backdrop-blur-sm" />
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-3xl flex flex-col items-center justify-center z-50 animate-in fade-in">
             <BrandLogo size={120} glow className="animate-spin-slow mb-8 text-cyan-400" />
             <div className="flex flex-col items-center gap-2">
                <span className="text-[12px] roman font-black tracking-[1.2em] text-white uppercase animate-pulse">{veoMessage}</span>
                <span className="text-[8px] mono text-white/30 uppercase tracking-[0.4em]">Optimizing Quantum Matrix</span>
                <div className="w-48 h-1 bg-white/5 rounded-full mt-4 overflow-hidden">
                   <div className="h-full bg-cyan-400 animate-progress" style={{ width: '40%' }} />
                </div>
             </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className={`transition-all duration-700 marble-glass flex flex-col px-10 pt-8 safe-area-pb rounded-t-[4rem] border-t border-white/10 h-[21rem]`}>
        <div className="flex items-center justify-between mb-8 overflow-x-auto no-scrollbar gap-4 px-2">
           {currentUnits.map(u => (
             <button 
               key={u.id} onClick={() => setActiveUnit(u.id)}
               className={`flex flex-col items-center gap-2 transition-all duration-300 ${activeUnit === u.id ? 'opacity-100 scale-110 text-cyan-400' : 'opacity-20 hover:opacity-50'}`}
             >
               <span className="text-2xl">{u.icon}</span>
               <span className="text-[9px] roman font-black tracking-[0.2em] uppercase">{u.label}</span>
             </button>
           ))}
        </div>

        <div className="flex-1 overflow-hidden relative">
            {activeUnit === 'optics' && (
              <div className="flex gap-4 w-full overflow-x-auto no-scrollbar py-2">
                {Object.values(LensProfile).map(l => (
                   <button 
                    key={l} onClick={() => onLensChange(l)}
                    className={`h-12 px-8 border text-[9px] roman font-black rounded-2xl whitespace-nowrap transition-all uppercase ${activeLens === l ? 'border-cyan-400 text-cyan-400 bg-cyan-400/10 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'border-white/5 text-white/30 hover:bg-white/5'}`}
                   >
                     {l.replace('_', ' ')}
                   </button>
                ))}
              </div>
            )}
            {activeUnit === 'filtrum' && (
              <div className="flex gap-4 w-full overflow-x-auto no-scrollbar py-2">
                {Object.values(CameraFilter).map(f => (
                   <button 
                    key={f} onClick={() => setActiveFilter(f)}
                    className={`h-12 px-8 border text-[9px] roman font-black rounded-2xl whitespace-nowrap transition-all uppercase ${activeFilter === f ? 'border-cyan-400 text-cyan-400 bg-cyan-400/10 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'border-white/5 text-white/30 hover:bg-white/5'}`}
                   >
                     {f.replace('_', ' ')}
                   </button>
                ))}
              </div>
            )}
            {activeUnit === 'manual' && (
              <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-2">
                 <div className="flex justify-between items-center px-4">
                    <div className="flex flex-col">
                       <span className="text-[8px] mono text-white/40 uppercase">Quantum Control</span>
                       <span className="text-[10px] roman font-black text-white">MANUAL_PRECISION</span>
                    </div>
                    <div className="flex gap-2">
                       {['1/60', '1/125', '1/250', '1/500', '1/1000'].map(s => (
                         <button 
                          key={s} onClick={() => setManual({...manual, shutter: s})}
                          className={`px-4 py-2 border rounded-xl text-[9px] font-bold transition-all ${manual.shutter === s ? 'border-cyan-400 text-cyan-400 bg-cyan-400/10' : 'border-white/5 text-white/20'}`}
                         >
                           {s}
                         </button>
                       ))}
                    </div>
                 </div>
                 <div className="flex justify-between items-center px-4 mt-2">
                    <span className="text-[8px] mono text-white/30 uppercase tracking-widest">White Balance</span>
                    <div className="flex gap-1">
                      {[3200, 4000, 5600, 6500].map(temp => (
                         <button 
                          key={temp} onClick={() => setManual({...manual, wb: temp})}
                          className={`w-12 h-8 rounded-lg text-[8px] font-bold transition-all border ${manual.wb === temp ? 'border-cyan-400 bg-cyan-400/10 text-white' : 'border-white/5 text-white/20'}`}
                         >
                           {temp}K
                         </button>
                      ))}
                    </div>
                 </div>
              </div>
            )}
            {activeUnit === 'scout' && (
              <div className="flex flex-col gap-2 py-2 px-4 text-center">
                <span className="text-[10px] roman font-black text-cyan-400 uppercase tracking-[0.4em] animate-pulse">Quan Vision Active</span>
                <p className="text-[9px] mono text-white/40 uppercase tracking-widest leading-relaxed">AI scanning enabled. Trigger shutter to identify landmarks, architectural styles, and object coordinates in real-time.</p>
              </div>
            )}
        </div>

        <div className="h-28 flex items-center justify-center mt-2">
          <button 
            onClick={handleShutterAction}
            className={`w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 relative ${isRecording ? 'border-red-500' : 'border-white/20'}`}
          >
            <div className={`transition-all duration-500 shadow-2xl ${isRecording ? 'w-10 h-10 rounded-xl bg-red-600' : 'w-18 h-18 rounded-full bg-white'} ${shutterPulse ? 'scale-110' : ''}`} />
            {burstCount > 0 && (
              <div className="absolute -top-2 -right-2 bg-cyan-500 text-black w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] shadow-lg animate-bounce">
                {burstCount}
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default CameraInterface;
