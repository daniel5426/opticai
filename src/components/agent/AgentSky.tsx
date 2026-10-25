import React from 'react';
import sky from '@/assets/agent/pastel-sky.webp';

/** Draw the halftone once in image coordinates; CSS handles resizing and cropping. */
export function AgentSky() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const image = new Image();
    const sample = document.createElement('canvas');
    const sampleContext = sample.getContext('2d', { willReadFrequently: true });
    if (!sampleContext) return;
    let frame = 0;
    let disposed = false;
    const draw = () => {
      if (disposed || !image.naturalWidth) return;
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const step = 4;
      canvas.width = width;
      canvas.height = height;
      sample.width = Math.ceil(width / step);
      sample.height = Math.ceil(height / step);
      // Keep image and texture aligned without reading layout during transitions.
      sampleContext.drawImage(image, 0, 0, sample.width, sample.height);
      let pixels: Uint8ClampedArray | null = null;
      try {
        pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
      } catch {
        // Some file:// Electron policies disallow pixel reads. Keep the texture.
      }
      context.fillStyle = '#454379';
      for (let y = 0; y < sample.height; y++) {
        const fade = Math.max(0, 1 - Math.pow(y / sample.height / 0.82, 3));
        for (let x = 0; x < sample.width; x++) {
          const offset = (y * sample.width + x) * 4;
          const luminance = pixels ? (pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722) / 255 : 0.65;
          context.globalAlpha = (0.18 + (1 - luminance) * 0.55) * fade;
          const radius = 0.35 + (1 - luminance) * 1.35;
          context.beginPath();
          context.arc(x * step + step / 2, y * step + step / 2, radius, 0, Math.PI * 2);
          context.fill();
        }
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    image.onload = schedule;
    image.src = sky;
    return () => { disposed = true; cancelAnimationFrame(frame); image.onload = null; };
  }, []);

  return <>
    <div className="agent-workspace__canvas bg-canvas" aria-hidden="true" />
    <div className="agent-sky" aria-hidden="true">
      <img src={sky} alt="" className="agent-sky__image" fetchPriority="high" />
      <canvas ref={canvasRef} className="agent-sky__dither" />
      <div className="agent-sky__veil" />
    </div>
  </>;
}
