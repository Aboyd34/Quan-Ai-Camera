
import React, { useState } from 'react';
import { LegionRole } from '../types';
import { legionService, ConnectivityProtocol } from '../services/legionService';

interface LegionHUDProps {
  onConnected: (role: LegionRole) => void;
  onCancel: () => void;
}

const LegionHUD: React.FC<LegionHUDProps> = ({ onConnected, onCancel }) => {
  const [role, setRole] = useState<LegionRole | null>(null);
  const [protocol, setProtocol] = useState<ConnectivityProtocol>('WIFI');
  const [ipAddress, setIpAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAsLegatus = async () => {
    try {
      setRole('LEGATUS');
      setIsConnecting(true);
      await legionService.initialize('LEGATUS', protocol);
      onConnected('LEGATUS');
    } catch (err) {
      setError('Failed to initialize commander node.');
      setIsConnecting(false);
    }
  };

  const startAsCenturion = async () => {
    if (!ipAddress) {
      setError('Please enter the commander IP address.');
      return;
    }
    
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipRegex.test(ipAddress)) {
      setError('Invalid IP address format.');
      return;
    }

    setIsConnecting(true);
    setError(null);
    
    try {
      await legionService.initialize('CENTURION', protocol, ipAddress);
      onConnected('CENTURION');
    } catch (err) {
      setError('Could not establish link. Ensure devices are on same network/range.');
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 sm:p-12 animate-in fade-in duration-300">
      <div className="w-full max-w-xl marble-glass p-8 sm:p-14 rounded-[4rem] border border-white/10 shadow-2xl flex flex-col items-center text-center">
        
        <div className="relative mb-10">
           <div className="absolute inset-0 bg-[#D4AF37]/20 blur-3xl rounded-full" />
           <div className="relative w-28 h-28 rounded-full border-2 border-[#D4AF37]/60 flex items-center justify-center bg-black/40 shadow-[0_0_40px_rgba(212,175,55,0.2)]">
              <span className="text-5xl">⚔️</span>
           </div>
        </div>

        <h2 className="roman text-3xl font-black tracking-[0.5em] uppercase mb-4 text-white">Legion Link</h2>
        <p className="text-[11px] mono text-white/50 mb-10 uppercase tracking-[0.3em] leading-relaxed max-w-sm">
          Multi-Node Synchronization Interface
        </p>

        {/* Protocol Selector */}
        <div className="w-full max-w-xs mb-10 p-1.5 glass rounded-2xl border border-white/5 flex gap-1">
          <button 
            onClick={() => setProtocol('WIFI')}
            className={`flex-1 py-3 rounded-xl text-[10px] roman font-black tracking-widest transition-all ${protocol === 'WIFI' ? 'bg-[#D4AF37] text-black shadow-lg' : 'text-white/40 hover:text-white/60'}`}
          >
            IMPERIAL WI-FI
          </button>
          <button 
            onClick={() => setProtocol('BLUETOOTH')}
            className={`flex-1 py-3 rounded-xl text-[10px] roman font-black tracking-widest transition-all ${protocol === 'BLUETOOTH' ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
          >
            TAC BLUETOOTH
          </button>
        </div>

        {error && (
          <div className="w-full mb-8 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] mono text-red-400 uppercase tracking-widest animate-shake">
            Node Error: {error}
          </div>
        )}

        {!role ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
            <button 
              onClick={startAsLegatus}
              className="flex flex-col items-center gap-5 p-10 glass rounded-[3rem] hover:bg-white/10 active:scale-95 transition-all group border border-white/5"
            >
              <span className="text-lg roman font-black tracking-widest group-hover:text-[#D4AF37]">LEGATUS</span>
              <div className="w-10 h-px bg-white/10 group-hover:bg-[#D4AF37]/40 transition-colors" />
              <span className="text-[9px] mono text-white/40 uppercase tracking-widest">Commander Node</span>
            </button>
            <button 
              onClick={() => setRole('CENTURION')}
              className="flex flex-col items-center gap-5 p-10 glass rounded-[3rem] hover:bg-white/10 active:scale-95 transition-all group border border-white/5"
            >
              <span className="text-lg roman font-black tracking-widest group-hover:text-emerald-400">CENTURION</span>
              <div className="w-10 h-px bg-white/10 group-hover:bg-emerald-400/40 transition-colors" />
              <span className="text-[9px] mono text-white/40 uppercase tracking-widest">Field Slave Node</span>
            </button>
          </div>
        ) : (
          <div className="w-full space-y-8">
             {role === 'CENTURION' && (
               <div className="space-y-6">
                 <div className="relative">
                   <input 
                     type="text" 
                     value={ipAddress}
                     onChange={(e) => { setIpAddress(e.target.value); setError(null); }}
                     placeholder="Enter Commander IP"
                     className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-6 text-center text-sm font-medium focus:outline-none focus:border-emerald-400 transition-all placeholder:text-white/20 italic"
                   />
                 </div>
                 <button 
                   onClick={startAsCenturion}
                   disabled={isConnecting}
                   className="w-full bg-emerald-500 text-black py-6 rounded-2xl font-black roman text-xs tracking-[0.4em] uppercase disabled:opacity-50 active:scale-95 transition-all shadow-[0_15px_30px_rgba(16,185,129,0.3)]"
                 >
                   {isConnecting ? 'Establishing Link...' : 'Sync Imperial Node'}
                 </button>
               </div>
             )}
             
             {role === 'LEGATUS' && isConnecting && (
               <div className="py-10 flex flex-col items-center gap-6">
                  <div className="w-14 h-14 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[11px] mono text-[#D4AF37] uppercase animate-pulse tracking-[0.3em]">Awaiting Remote Signals...</span>
               </div>
             )}

             <button 
               onClick={() => { setRole(null); setError(null); setIsConnecting(false); }} 
               className="px-8 py-3 text-[10px] mono text-white/30 uppercase tracking-[0.4em] hover:text-white transition-all"
             >
               Change Command Role
             </button>
          </div>
        )}

        <button 
          onClick={onCancel}
          className="mt-12 px-8 py-3 text-[11px] roman font-bold text-white/20 hover:text-white transition-all uppercase tracking-[0.5em] border-t border-white/5 w-full"
        >
          Abort Legion Initialization
        </button>
      </div>
    </div>
  );
};

export default LegionHUD;
