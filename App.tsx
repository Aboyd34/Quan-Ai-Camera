
import React, { useState, useRef } from 'react';
import { CameraMode, CapturedImage, LensProfile, LegionRole, CameraFilter } from './types';
import CameraInterface, { CameraInterfaceHandle } from './components/CameraInterface';
import AIAssistant from './components/AIAssistant';
import LegionHUD from './components/LegionHUD';
import BrandLogo from './components/BrandLogo';
import Dashboard from './components/Dashboard';
import { enhanceImage } from './services/geminiService';

const App: React.FC = () => {
  const [mode, setMode] = useState<CameraMode>(CameraMode.PHOTO);
  const [lens, setLens] = useState<LensProfile>(LensProfile.STANDARD);
  const [gallery, setGallery] = useState<CapturedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<CapturedImage | null>(null);
  const [isLegionHUDOpen, setIsLegionHUDOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [legionRole, setLegionRole] = useState<LegionRole | null>(null);
  const cameraRef = useRef<CameraInterfaceHandle>(null);

  const handleCapture = (image: CapturedImage) => {
    setGallery(prev => [image, ...prev]);
    setSelectedImage(image);
  };

  const handleAIStatus = (status: boolean) => {
    setIsProcessing(status);
  };

  const handleEnhance = async (image: CapturedImage) => {
    if (image.mediaType !== 'image') return;
    setIsProcessing(true);
    try {
      const enhancedUrl = await enhanceImage(image.url, "Upscale resolution, balance lighting using Imperial Roma palettes, and sharpen edges with neural stacking.");
      if (enhancedUrl) {
        const newImage: CapturedImage = {
          ...image,
          id: crypto.randomUUID(),
          url: enhancedUrl,
          analysis: `Enhanced: ${image.analysis}`,
          metadata: { ...image.metadata, enhanced: true } as any
        };
        setGallery(prev => [newImage, ...prev]);
        setSelectedImage(newImage);
      }
    } catch (err) {
      console.error("Enhancement failed", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const checkProPermissions = async (targetMode: CameraMode) => {
    const proModes = [CameraMode.CINEMA, CameraMode.AI_GENERATE, CameraMode.M_PRO];
    if (proModes.includes(targetMode)) {
      const aistudio = (window as any).aistudio;
      if (typeof aistudio !== 'undefined') {
        const hasKey = await aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await aistudio.openSelectKey();
          return true;
        }
      }
    }
    return true;
  };

  const handleModeChange = async (newMode: CameraMode) => {
    const permitted = await checkProPermissions(newMode);
    if (!permitted) return;

    if (newMode === CameraMode.LEGION_LINK && !legionRole) {
      setIsLegionHUDOpen(true);
    } else {
      setMode(newMode);
    }
  };

  const onLegionConnected = (role: LegionRole) => {
    setLegionRole(role);
    setMode(CameraMode.LEGION_LINK);
    setIsLegionHUDOpen(false);
    if (role === 'LEGATUS') {
      setIsDashboardOpen(true);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#030303] select-none text-white font-sans">
      <header className="px-8 py-8 flex justify-between items-center z-[150] absolute top-0 left-0 right-0 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-4 group">
           <BrandLogo size={42} glow className="transition-transform duration-700 group-hover:rotate-180" />
           <div className="flex flex-col">
              <h1 className="roman text-2xl font-black tracking-[0.5em] uppercase leading-none">QUAN<span className="text-cyan-400">AI</span></h1>
              <span className="text-[7px] mono font-bold text-white/30 tracking-[0.7em] mt-2 uppercase">Quantum Imperial Imaging</span>
           </div>
        </div>
        
        <div className="flex gap-4 pointer-events-auto">
          {legionRole === 'LEGATUS' && (
            <button 
              onClick={() => setIsDashboardOpen(true)}
              className="glass px-8 py-4 rounded-2xl roman text-[10px] font-black uppercase tracking-widest border border-cyan-500/40 shadow-2xl hover:bg-cyan-500/10 transition-all active:scale-95"
            >
              Imperial Fleet Overview
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 relative">
        <AIAssistant 
          onTriggerCapture={p => cameraRef.current?.triggerCapture(p)} 
          onSetMode={handleModeChange} 
          onSetLens={(l: LensProfile) => setLens(l)} 
          onSetFilter={(f: CameraFilter) => cameraRef.current?.setFilter(f)}
          onToggleGrid={() => cameraRef.current?.toggleGrid()}
        />
        
        {isLegionHUDOpen && (
          <LegionHUD 
            onConnected={onLegionConnected} 
            onCancel={() => setIsLegionHUDOpen(false)} 
          />
        )}

        {isDashboardOpen && legionRole === 'LEGATUS' && (
          <Dashboard 
            onBackToCamera={() => setIsDashboardOpen(false)} 
            onSetMode={handleModeChange}
          />
        )}
        
        <CameraInterface 
          ref={cameraRef} 
          mode={mode} 
          onCapture={handleCapture} 
          isProcessing={isProcessing} 
          setIsProcessing={setIsProcessing} 
          activeLens={lens} 
          onLensChange={setLens}
          legionRole={legionRole}
        />

        <div className="absolute bottom-[280px] left-0 right-0 flex justify-center z-50 pointer-events-none px-4">
          <div className="flex gap-3 p-2.5 rounded-[2.5rem] glass border border-white/5 pointer-events-auto overflow-x-auto no-scrollbar scroll-smooth shadow-2xl max-w-[90vw]">
            {Object.values(CameraMode).map((m) => (
              <button 
                key={m} 
                onClick={() => handleModeChange(m)} 
                className={`px-7 py-3.5 rounded-2xl roman text-[9px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap active:scale-95 ${
                  mode === m 
                    ? 'bg-cyan-500 text-black shadow-[0_10px_30px_rgba(6,182,212,0.3)] scale-105' 
                    : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                }`}
              >
                {m.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="absolute bottom-12 left-10 z-50">
           <button 
            onClick={() => gallery.length > 0 && setSelectedImage(gallery[0])} 
            className="group w-16 h-16 rounded-[1.8rem] border-2 border-white/10 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all hover:scale-110 active:scale-90 bg-zinc-900 flex items-center justify-center p-0.5"
           >
             {gallery.length > 0 ? (
               <img src={gallery[0].url} className="w-full h-full object-cover rounded-[1.6rem]" alt="Recent Capture" />
             ) : (
               <div className="text-xl roman text-white/20 opacity-30">Q</div>
             )}
           </button>
        </div>
      </main>

      {selectedImage && (
        <div className="fixed inset-0 z-[300] bg-black/98 backdrop-blur-3xl flex flex-col animate-in zoom-in-95 fade-in duration-600 overflow-y-auto safe-area-pb">
           <div className="flex justify-between items-center px-10 py-10 border-b border-white/5 bg-black/60 sticky top-0 z-[310]">
              <div className="flex flex-col">
                <span className="text-[12px] roman font-black text-cyan-400 uppercase tracking-[0.5em]">
                  {selectedImage.metadata?.enhanced ? 'Quantum Enhanced Output' : selectedImage.metadata?.role ? `Legion Link: ${selectedImage.metadata.role}` : 'Imperial AI Capture'}
                </span>
                <span className="text-[9px] mono text-white/40 uppercase tracking-widest mt-2">
                  TS: {new Date(selectedImage.timestamp).toLocaleString()} // UUID: {selectedImage.id.split('-')[0].toUpperCase()}
                </span>
              </div>
              <button 
                onClick={() => setSelectedImage(null)} 
                className="text-[10px] roman font-black bg-white/5 border border-white/10 px-10 py-4 rounded-full uppercase tracking-[0.4em] hover:bg-white/15 transition-all active:scale-95"
              >
                Exit Light Table
              </button>
           </div>
           
           <div className="flex-1 flex flex-col lg:flex-row gap-10 p-10">
              <div className="flex-[3] flex items-center justify-center rounded-[4rem] overflow-hidden border border-white/10 shadow-2xl bg-black relative group min-h-[60vh]">
                 {selectedImage.mediaType === 'video' ? (
                   <video src={selectedImage.url} autoPlay loop muted playsInline className="max-w-full max-h-full" />
                 ) : (
                   <img src={selectedImage.url} className="max-w-full max-h-full object-contain" alt="Captured" />
                 )}
                 
                 <div className="absolute bottom-10 left-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    {selectedImage.mediaType === 'image' && !selectedImage.metadata?.enhanced && (
                      <button 
                        onClick={() => handleEnhance(selectedImage)}
                        className="glass px-8 py-3 rounded-2xl border border-cyan-500/40 text-[10px] roman font-black uppercase tracking-widest text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all"
                      >
                        Quantum Enhance
                      </button>
                    )}
                 </div>

                 <div className="absolute top-10 right-10 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                   <div className="glass px-5 py-3 rounded-2xl border border-white/10">
                     <span className="text-[11px] mono font-bold text-white uppercase tracking-widest">ISO {selectedImage.metadata?.iso || 'Auto'}</span>
                   </div>
                   <div className="glass px-5 py-3 rounded-2xl border border-white/10">
                     <span className="text-[11px] mono font-bold text-white uppercase tracking-widest">{selectedImage.metadata?.shutter || 'Auto'}</span>
                   </div>
                 </div>
              </div>

              <div className="flex-1 flex flex-col gap-8">
                <div className="glass p-12 rounded-[3.5rem] border border-white/5 shadow-2xl flex-1">
                  <span className="text-[10px] roman text-cyan-400 font-black uppercase tracking-[0.5em] mb-8 block">Quantum Analysis</span>
                  <p className="text-lg font-medium leading-relaxed italic text-white/95 roman mb-8">"{selectedImage.analysis}"</p>
                  
                  {selectedImage.grounding && selectedImage.grounding.length > 0 && (
                    <div className="space-y-4">
                      <span className="text-[9px] mono text-white/30 uppercase tracking-[0.2em] block mb-5 border-t border-white/5 pt-8">Tactical Grounding</span>
                      {selectedImage.grounding.map((g, i) => (
                        <a 
                          key={i} href={g.uri} target="_blank" rel="noreferrer"
                          className="flex items-center justify-between p-5 glass rounded-2xl border border-white/5 hover:border-cyan-500/50 transition-all group active:scale-98"
                        >
                          <span className="text-[11px] roman font-bold uppercase tracking-widest text-white/80 group-hover:text-cyan-400">{g.title}</span>
                          <span className="text-[9px] mono opacity-40 uppercase">{g.type}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="glass p-10 rounded-[3.5rem] border border-white/5">
                   <span className="text-[10px] roman text-white/40 font-black uppercase tracking-[0.5em] mb-8 block">Optical Signature</span>
                   <div className="grid grid-cols-2 gap-6">
                      <div className="p-5 bg-white/5 rounded-3xl flex flex-col gap-2">
                         <span className="text-[8px] mono text-white/20 uppercase tracking-widest">Lens Profile</span>
                         <span className="text-[11px] roman font-black uppercase text-white/90">{selectedImage.metadata?.lens || 'Standard'}</span>
                      </div>
                      <div className="p-5 bg-white/5 rounded-3xl flex flex-col gap-2">
                         <span className="text-[8px] mono text-white/20 uppercase tracking-widest">Digital Filter</span>
                         <span className="text-[11px] roman font-black uppercase text-white/90">{selectedImage.metadata?.filter || 'None'}</span>
                      </div>
                   </div>
                </div>
              </div>
           </div>

           {gallery.length > 1 && (
             <div className="px-10 pb-16">
               <span className="text-[9px] mono text-white/20 uppercase tracking-[0.4em] mb-6 block">Light Table Index</span>
               <div className="flex gap-5 overflow-x-auto no-scrollbar pb-6 scroll-smooth">
                 {gallery.map(img => (
                   <button 
                    key={img.id} onClick={() => setSelectedImage(img)}
                    className={`flex-shrink-0 w-28 h-28 rounded-3xl overflow-hidden border-2 transition-all active:scale-90 ${selectedImage.id === img.id ? 'border-cyan-500 scale-110 shadow-[0_10px_30px_rgba(34,211,238,0.2)]' : 'border-white/10 opacity-40 hover:opacity-100 hover:border-white/30'}`}
                   >
                     <img src={img.url} className="w-full h-full object-cover" alt="Gallery item" />
                   </button>
                 ))}
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default App;
