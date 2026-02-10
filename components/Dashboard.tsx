
import React, { useState, useEffect } from 'react';
import { DeviceTelemetry, CameraMode, LensProfile } from '../types';
import { legionService } from '../services/legionService';
import BrandLogo from './BrandLogo';

interface DashboardProps {
  onBackToCamera: () => void;
  onSetMode: (mode: CameraMode) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onBackToCamera, onSetMode }) => {
  const [devices, setDevices] = useState<DeviceTelemetry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const protocol = legionService.getProtocol();

  useEffect(() => {
    legionService.onTelemetryUpdate(setDevices);
    setDevices(legionService.getConnectedDevices());
  }, []);

  const handleGlobalStart = () => {
    setIsSyncing(true);
    legionService.sendCommand('START_REC', { delay: 1000 });
    setTimeout(() => setIsSyncing(false), 2000);
  };

  const handleGlobalStop = () => {
    legionService.sendCommand('STOP_REC');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#030303] flex flex-col animate-in fade-in duration-500 overflow-hidden">
      {/* Dashboard Header */}
      <header className="px-10 py-8 border-b border-white/5 flex justify-between items-center backdrop-blur-3xl bg-black/40">
        <div className="flex items-center gap-6">
          <BrandLogo size={32} className="text-[#D4AF37]" />
          <div className="flex flex-col">
            <h2 className="roman text-xl font-black tracking-[0.2em] uppercase">Legion Command</h2>
            <span className="text-[9px] mono text-white/30 tracking-[0.4em] uppercase">Imperial Sync Dashboard v4.1</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-4">
            <span className="text-[8px] mono text-white/20 uppercase tracking-widest">Active Protocol</span>
            <span className={`text-[10px] mono font-bold uppercase ${protocol === 'WIFI' ? 'text-emerald-400' : 'text-indigo-400'}`}>
              {protocol === 'WIFI' ? 'Imperial Wi-Fi (P2P)' : 'Tactical Bluetooth'}
            </span>
          </div>
          <div className="glass px-6 py-2 rounded-2xl flex items-center gap-3 border border-white/10">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] mono text-white/60 font-bold uppercase tracking-widest">{devices.length} Nodes Active</span>
          </div>
          <button 
            onClick={onBackToCamera}
            className="px-8 py-3 bg-[#D4AF37] text-black roman font-black text-[10px] rounded-2xl tracking-widest uppercase hover:scale-105 transition-all shadow-lg"
          >
            Return to Lens
          </button>
        </div>
      </header>

      <main className="flex-1 p-10 grid grid-cols-12 gap-8 overflow-y-auto no-scrollbar">
        {/* Left: Device Fleet */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="flex justify-between items-end mb-4">
             <h3 className="roman text-sm font-black tracking-[0.3em] uppercase text-white/40">Remote Field Units</h3>
             <span className="text-[10px] mono text-[#D4AF37] uppercase">PTP Latency: 12ms avg</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {devices.map(device => (
              <div key={device.id} className="glass p-8 rounded-[3rem] border border-white/5 hover:border-[#D4AF37]/30 transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs roman font-black text-white uppercase tracking-widest">{device.name}</span>
                    <span className="text-[9px] mono text-white/30 uppercase">ID: {device.id.slice(0, 8)}</span>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[8px] mono font-black tracking-widest ${device.status === 'RECORDING' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {device.status}
                  </div>
                </div>
                
                <div className="aspect-video w-full rounded-3xl bg-zinc-900 mb-6 overflow-hidden relative border border-white/5">
                   {device.previewFrame ? (
                     <img src={device.previewFrame} className="w-full h-full object-cover opacity-60" alt="Remote Preview" />
                   ) : (
                     <div className="absolute inset-0 flex items-center justify-center opacity-20">
                        <BrandLogo size={40} className="animate-pulse" />
                     </div>
                   )}
                   <div className="absolute top-4 left-4 flex gap-2">
                     <span className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-[8px] mono font-bold">4K_LOG</span>
                     <span className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-[8px] mono font-bold">{device.currentLens}</span>
                   </div>
                </div>

                <div className="flex justify-between items-center">
                   <div className="flex gap-4">
                     <div className="flex flex-col">
                        <span className="text-[8px] mono text-white/20 uppercase">Battery</span>
                        <span className="text-[10px] mono font-bold text-emerald-400">92%</span>
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[8px] mono text-white/20 uppercase">Storage</span>
                        <span className="text-[10px] mono font-bold text-white">420GB</span>
                     </div>
                   </div>
                   <button className="text-[10px] roman font-black text-[#D4AF37] uppercase tracking-widest border border-[#D4AF37]/20 px-5 py-2 rounded-xl hover:bg-[#D4AF37]/10 transition-all">Configure</button>
                </div>
              </div>
            ))}
            
            {devices.length === 0 && (
              <div className="col-span-full py-24 flex flex-col items-center justify-center text-center opacity-30">
                <span className="text-4xl mb-6">📡</span>
                <p className="roman text-sm font-black tracking-widest uppercase">Scanning for Centurion Nodes...</p>
                <p className="text-[10px] mono mt-2">Check {protocol} status on field devices</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Master Controls */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
           <div className="glass p-10 rounded-[3.5rem] border border-white/5 shadow-2xl">
              <span className="text-[10px] roman text-[#D4AF37] font-black uppercase tracking-[0.4em] mb-8 block">Global Command</span>
              
              <div className="space-y-4 mb-10">
                <button 
                  onClick={handleGlobalStart}
                  className={`w-full py-6 rounded-3xl font-black roman text-xs tracking-[0.3em] uppercase transition-all shadow-xl ${isSyncing ? 'bg-amber-500 scale-95' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                >
                  {isSyncing ? 'Synchronizing...' : 'Trigger Imperial Sync'}
                </button>
                <button 
                  onClick={handleGlobalStop}
                  className="w-full py-5 border border-white/10 rounded-3xl font-black roman text-xs tracking-[0.3em] uppercase text-white/40 hover:text-white hover:bg-white/5 transition-all"
                >
                  Stop Fleet Recording
                </button>
              </div>

              <div className="space-y-6 border-t border-white/5 pt-8">
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] roman font-bold text-white/40 uppercase tracking-widest">Master FPS</span>
                    <select className="bg-transparent text-white text-[10px] mono font-bold focus:outline-none">
                      <option>23.976 fps</option>
                      <option>24.000 fps</option>
                      <option>30.000 fps</option>
                      <option>60.000 fps</option>
                    </select>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] roman font-bold text-white/40 uppercase tracking-widest">Neural Proxy</span>
                    <div className="w-10 h-5 bg-emerald-500/20 rounded-full flex items-center px-1 border border-emerald-500/30">
                       <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                    </div>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] roman font-bold text-white/40 uppercase tracking-widest">Sync Protocol</span>
                    <span className={`text-[10px] mono font-bold uppercase ${protocol === 'WIFI' ? 'text-emerald-400' : 'text-indigo-400'}`}>{protocol}</span>
                 </div>
              </div>
           </div>

           <div className="p-10 glass rounded-[3.5rem] border border-indigo-500/20">
              <span className="text-[10px] roman text-indigo-400 font-black uppercase tracking-[0.4em] mb-6 block">Legion Topology</span>
              <div className="flex flex-col gap-4">
                 <div className="h-12 w-full bg-indigo-500/5 rounded-2xl flex items-center px-6 justify-between border border-indigo-500/10">
                    <span className="text-[9px] mono text-indigo-300 uppercase font-bold tracking-widest">Controller ID</span>
                    <span className="text-[9px] mono text-white">CMD-77-ROM</span>
                 </div>
                 <div className="h-12 w-full bg-indigo-500/5 rounded-2xl flex items-center px-6 justify-between border border-indigo-500/10">
                    <span className="text-[9px] mono text-indigo-300 uppercase font-bold tracking-widest">Link Quality</span>
                    <span className="text-[9px] mono text-emerald-400 font-black tracking-widest">EXCELLENT</span>
                 </div>
              </div>
           </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
