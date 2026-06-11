import { useEffect, useRef, useState } from 'react';
import { audio } from '../sound/AudioEngine';

interface Props {
  src: string;
  label: string;
}

/**
 * VISUAL LOG frame: animated CRT static by default; on hover the static
 * "tunes in" to the real screenshot (rolling sync band, static fades out).
 * If the image 404s (placeholder not swapped yet) the frame stays static.
 */
export default function StaticScreenshot({ src, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const tuneRef = useRef(0); // 0 = pure static, 1 = fully tuned in

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const W = (canvas.width = 192);
    const H = (canvas.height = 120);
    const noise = ctx.createImageData(W, H);
    let raf = 0;

    const tick = () => {
      // regenerate coarse static every frame; alpha fades as we tune in
      const target = hover && loaded ? 1 : 0;
      tuneRef.current += (target - tuneRef.current) * 0.12;
      const d = noise.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      ctx.putImageData(noise, 0, 0);
      // occasional bright interference band rolling through the static
      const band = (performance.now() / 16) % (H * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(0, band - 6, W, 12);
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [hover, loaded]);

  return (
    <div
      data-hot
      onMouseEnter={() => {
        setHover(true);
        if (loaded) audio.glitch();
      }}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        aspectRatio: '16 / 10',
        background: '#000',
        boxShadow: '0 0 0 2px var(--green-dim)',
        overflow: 'hidden',
        borderRadius: 4,
      }}
    >
      <img
        src={src}
        alt={label}
        onLoad={() => setLoaded(true)}
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: hover && loaded ? 1 : 0,
          filter: hover ? 'none' : 'saturate(0.4)',
          transition: 'opacity 320ms ease',
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
          opacity: hover && loaded ? 0.08 : 0.85,
          transition: 'opacity 320ms ease',
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: 6,
          bottom: 4,
          fontSize: 7,
          color: 'var(--green-dim)',
          textShadow: '0 0 4px #000',
          pointerEvents: 'none',
        }}
      >
        {`// ${label}`}
      </span>
    </div>
  );
}
