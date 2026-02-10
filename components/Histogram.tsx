
import React, { useEffect, useRef } from 'react';

interface HistogramProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const Histogram: React.FC<HistogramProps> = ({ videoRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const process = () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.paused) {
        rafRef.current = requestAnimationFrame(process);
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const video = videoRef.current;

      if (ctx) {
        // Offscreen sampling
        const sampleWidth = 100;
        const sampleHeight = 100;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sampleWidth;
        tempCanvas.height = sampleHeight;
        const tempCtx = tempCanvas.getContext('2d');

        if (tempCtx) {
          tempCtx.drawImage(video, 0, 0, sampleWidth, sampleHeight);
          const imageData = tempCtx.getImageData(0, 0, sampleWidth, sampleHeight);
          const data = imageData.data;
          const bins = new Uint32Array(256);

          for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            bins[gray]++;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'rgba(212, 175, 55, 0.4)';
          const maxBin = Math.max(...Array.from(bins));
          const binWidth = canvas.width / 256;

          for (let i = 0; i < 256; i++) {
            const h = (bins[i] / maxBin) * canvas.height;
            ctx.fillRect(i * binWidth, canvas.height - h, binWidth, h);
          }
        }
      }
      rafRef.current = requestAnimationFrame(process);
    };

    rafRef.current = requestAnimationFrame(process);
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef]);

  return (
    <div className="flex flex-col gap-1 items-end opacity-60">
      <span className="text-[7px] mono text-white/40 uppercase tracking-widest">Luma Spectrum</span>
      <canvas 
        ref={canvasRef} 
        width={180} 
        height={40} 
        className="glass border border-white/10 rounded-lg overflow-hidden" 
      />
    </div>
  );
};

export default Histogram;
