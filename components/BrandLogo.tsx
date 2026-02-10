
import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

const BrandLogo: React.FC<BrandLogoProps> = ({ className = "", size = 40, glow = false }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {glow && (
        <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-pulse" />
      )}
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
        {/* Outer Ring */}
        <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.2" />
        
        {/* The 'Q' Neural Arc */}
        <path 
          d="M50 20 A30 30 0 1 0 75 75 L85 85" 
          fill="none" 
          stroke="url(#quanGradient)" 
          strokeWidth="8" 
          strokeLinecap="round"
          className="drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]"
        />
        
        {/* Quantum Core Node */}
        <circle cx="50" cy="50" r="10" className="fill-cyan-400 animate-pulse" />
        <circle cx="50" cy="50" r="4" fill="white" />
        
        {/* Neural Activity Lines */}
        {[0, 90, 180, 270].map(deg => (
          <line 
            key={deg}
            x1="50" y1="25" x2="50" y2="30" 
            transform={`rotate(${deg} 50 50)`} 
            stroke="white" 
            strokeWidth="2" 
            strokeLinecap="round"
            strokeOpacity="0.6" 
          />
        ))}

        <defs>
          <linearGradient id="quanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default BrandLogo;
