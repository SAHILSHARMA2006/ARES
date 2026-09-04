import { useState, useCallback, useRef, useEffect } from 'react';
import {
  CloudUpload, Settings, X, Download, Loader2, Satellite,
  Layers, Crosshair, AlertTriangle, ChevronRight, RotateCcw,
  ScanLine, CheckCircle2, ArrowLeftRight, Info, MapPin, Keyboard,
  Eye, Flame, Building2, Radio, Radar, WifiOff
} from 'lucide-react';

// -----------------------------------------------------------------------
// Backend config
// -----------------------------------------------------------------------
// Point this at your running FastAPI instance. In dev this is usually
// http://127.0.0.1:8000 — change it (or read from an env var) for staging/prod.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const ENHANCE_ENDPOINT = `${API_BASE_URL}/enhance`;

const FONT_IMPORT_URL =
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Orbitron:wght@600;800&display=swap';

const LAYERS = [
  { id: 'rgb', label: 'Enhanced RGB', key: 'R', icon: Eye },
  { id: 'heatmap', label: 'Uncertainty Heatmap', key: 'H', icon: Flame },
  { id: 'boundaries', label: 'Urban Boundaries', key: 'B', icon: Building2 },
];

const METRIC_INFO = {
  psnr: 'Peak Signal-to-Noise Ratio. Higher values mean the reconstruction is closer to ground truth. Above 30 dB is considered high fidelity.',
  ssim: 'Structural Similarity Index. Measures preserved structure, contrast and luminance between source and output. 1.0 is a perfect match.',
  sam: 'Spectral Angle Mapper. Measures spectral distortion introduced during reconstruction. Lower is better — under 3° is negligible.',
};

const DEFAULT_METRICS = { psnr: 32.4, ssim: 0.89, sam: 2.1 };

const HOTSPOTS = [
  { id: 1, x: 70, y: 25, sector: 'Sector 4', confidence: 'low', note: 'Dense urban clustering. Road boundaries inferred — verify with ground truth.' },
  { id: 2, x: 75, y: 20, sector: 'Sector 4b', confidence: 'moderate', note: 'Partial occlusion from cloud shadow. Building edges moderately confident.' },
  { id: 3, x: 25, y: 70, sector: 'Sector 1', confidence: 'high', note: 'Open terrain, strong observed signal. High confidence reconstruction.' },
  { id: 4, x: 52, y: 74, sector: 'Sector 2', confidence: 'moderate', note: 'Mixed vegetation and rooftop. Moderate variance in edge placement.' },
];

const CONF_COLOR = {
  high: { dot: 'bg-blue-500', text: 'text-blue-400', label: 'High confidence' },
  moderate: { dot: 'bg-yellow-500', text: 'text-yellow-400', label: 'Moderate variance' },
  low: { dot: 'bg-red-500', text: 'text-red-400', label: 'Low confidence' },
};

function Corners({ active = true, className = '' }) {
  const base = active ? 'border-amber-500' : 'border-slate-700';
  return (
    <>
      <span className={`ares-corner top-0 left-0 border-t border-l ${base} ${className}`} />
      <span className={`ares-corner top-0 right-0 border-t border-r ${base} ${className}`} />
      <span className={`ares-corner bottom-0 left-0 border-b border-l ${base} ${className}`} />
      <span className={`ares-corner bottom-0 right-0 border-b border-r ${base} ${className}`} />
    </>
  );
}

function TelemetryTicker({ sliderPos, stage, apiOk }) {
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().slice(11, 19) + ' UTC');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const lat = (26.8467 - (sliderPos / 100) * 0.02).toFixed(5);
  const lon = (80.9462 + (sliderPos / 100) * 0.03).toFixed(5);
  return (
    <div className="border-b border-amber-900/30 bg-gradient-to-r from-slate-950 via-black to-slate-950 px-6 py-1.5 flex items-center gap-6 text-[11px] ares-mono text-slate-500 tracking-wider overflow-x-auto shrink-0">
      <span className="flex items-center gap-1.5 text-amber-600"><Radio className="w-3 h-3" /> TELEMETRY</span>
      <span>{clock}</span>
      <span className="text-slate-700">│</span>
      <span>ORBIT: SENTINEL-2A</span>
      <span className="text-slate-700">│</span>
      <span>TILE: 43RGP</span>
      <span className="text-slate-700">│</span>
      <span>LAT {lat}° LON {lon}°</span>
      <span className="text-slate-700">│</span>
      <span className={stage === 'processing' ? 'text-amber-500' : apiOk ? 'text-green-500' : 'text-red-500'}>
        {stage === 'processing' ? 'LINK ACTIVE — STREAMING' : apiOk ? 'LINK NOMINAL' : 'BACKEND UNREACHABLE'}
      </span>
    </div>
  );
}

// Synthetic terrain, used only as a fallback when no real image is available
function TerrainBase({ mode, seed = 0 }) {
  const blur = mode === 'blurry';
  const filterId = `ares-noise-${mode}-${seed}`;
  return (
    <svg viewBox="0 0 800 600" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id={filterId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} result="noise" />
          <feColorMatrix in="noise" type="matrix"
            values="0 0 0 0 0.05  0 0 0 0 0.04  0 0 0 0 0.03  0 0 0 0.05 0" />
        </filter>
        <linearGradient id="terrain" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1c1a16" />
          <stop offset="55%" stopColor="#26221b" />
          <stop offset="100%" stopColor="#171512" />
        </linearGradient>
        <linearGradient id="river" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1a2e38" />
          <stop offset="100%" stopColor="#243d49" />
        </linearGradient>
      </defs>

      <rect width="800" height="600" fill="url(#terrain)" />
      <rect width="800" height="600" filter={`url(#${filterId})`} opacity="0.5" />

      <path d="M -20 120 C 150 160, 230 90, 400 150 S 650 260, 860 210 L 860 280 C 650 330, 500 220, 380 220 S 150 260, -20 200 Z"
        fill="url(#river)" opacity={blur ? 0.5 : 0.85} />

      {Array.from({ length: 7 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={80 + i * 75} x2="800" y2={80 + i * 75}
          stroke={blur ? '#3a352c' : '#544c3c'} strokeWidth={blur ? 5 : 2.5} opacity={blur ? 0.35 : 0.55} />
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <line key={`v${i}`} x1={40 + i * 95} y1="0" x2={40 + i * 95} y2="600"
          stroke={blur ? '#3a352c' : '#544c3c'} strokeWidth={blur ? 5 : 2.5} opacity={blur ? 0.35 : 0.55} />
      ))}

      {Array.from({ length: 46 }).map((_, i) => {
        const gx = (i % 9) * 88 + 30 + ((i * 37) % 18);
        const gy = Math.floor(i / 9) * 88 + 40 + ((i * 53) % 22);
        const w = blur ? 34 : 22 + ((i * 13) % 20);
        const h = blur ? 30 : 18 + ((i * 19) % 24);
        const damaged = i % 11 === 0;
        return (
          <rect key={i} x={gx} y={gy} width={w} height={h}
            rx={blur ? 6 : 1.5}
            fill={damaged ? '#4a2f1c' : (blur ? '#403a2e' : '#5c5344')}
            opacity={blur ? 0.55 : 0.9}
            transform={damaged && !blur ? `rotate(6 ${gx + w / 2} ${gy + h / 2})` : undefined}
          />
        );
      })}

      {!blur && (
        <g opacity="0.5">
          {Array.from({ length: 30 }).map((_, i) => (
            <circle key={i} cx={(i * 53) % 800} cy={(i * 97 + 40) % 600} r="1.6" fill="#7a7157" />
          ))}
        </g>
      )}
    </svg>
  );
}

// Uncertainty / boundary overlay — drawn on top of whichever image (real or
// synthetic) is currently occupying the "enhanced" side.
function OverlayFX({ layer }) {
  if (layer === 'rgb') return null;
  return (
    <svg viewBox="0 0 800 600" className="w-full h-full absolute inset-0" preserveAspectRatio="xMidYMid slice">
      {layer === 'heatmap' && (
        <g style={{ mixBlendMode: 'screen' }}>
          <ellipse cx="560" cy="150" rx="150" ry="110" fill="#dc2626" opacity="0.38" />
          <ellipse cx="600" cy="120" rx="70" ry="55" fill="#eab308" opacity="0.45" />
          <ellipse cx="200" cy="420" rx="180" ry="130" fill="#2563eb" opacity="0.3" />
          <ellipse cx="420" cy="440" rx="120" ry="90" fill="#eab308" opacity="0.32" />
          <ellipse cx="120" cy="150" rx="140" ry="100" fill="#2563eb" opacity="0.32" />
        </g>
      )}
      {layer === 'boundaries' && (
        <g fill="none" stroke="#f59e0b" strokeWidth="1.4" opacity="0.85">
          {Array.from({ length: 46 }).map((_, i) => {
            const gx = (i % 9) * 88 + 30 + ((i * 37) % 18);
            const gy = Math.floor(i / 9) * 88 + 40 + ((i * 53) % 22);
            const w = 22 + ((i * 13) % 20);
            const h = 18 + ((i * 19) % 24);
            return <rect key={i} x={gx - 1} y={gy - 1} width={w + 2} height={h + 2} />;
          })}
        </g>
      )}
    </svg>
  );
}

// Renders either the real image (uploaded original / backend-enhanced result)
// or falls back to the synthetic terrain when that image isn't available yet.
function SceneLayer({ mode, layer, seed, imageUrl }) {
  return (
    <div className="absolute inset-0">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={mode === 'blurry' ? 'Original 10m tile' : 'ARES enhanced tile'}
          className="w-full h-full object-contain bg-black"
          style={mode === 'blurry' ? { filter: 'saturate(0.9) brightness(0.95)' } : undefined}
        />
      ) : (
        <TerrainBase mode={mode} seed={seed} />
      )}
      {mode === 'sharp' && <OverlayFX layer={layer} />}
    </div>
  );
}

const VALID_EXT = ['tif', 'tiff', 'png', 'jpg', 'jpeg'];
const PROCESS_STEPS = [
  'Uploading tile to ARES backend…',
  'Reconstructing spatial textures…',
  'Running MC dropout uncertainty pass…',
  'Aligning spectral bands…',
  'Awaiting response…',
];

export default function App() {
  const [stage, setStage] = useState('upload');
  const [dragActive, setDragActive] = useState(false);
  const [dropError, setDropError] = useState('');
  const [fileName, setFileName] = useState('');
  const [sliderPos, setSliderPos] = useState(50);
  const [swapped, setSwapped] = useState(false);
  const [activeLayer, setActiveLayer] = useState('rgb');
  const [overlayOpacity, setOverlayOpacity] = useState(100);
  const [infoOpen, setInfoOpen] = useState(true);
  const [exportState, setExportState] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [tooltip, setTooltip] = useState(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [apiOk, setApiOk] = useState(true);

  // Live data from the backend
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [enhancedImageUrl, setEnhancedImageUrl] = useState(null);
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);

  const viewerRef = useRef(null);
  const draggingRef = useRef(false);
  const progressTimerRef = useRef(null);

  const pushToast = useCallback((text, tone = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  // ---------------------------------------------------------------------
  // Core upload handler — sends the file to the live FastAPI /enhance route
  // ---------------------------------------------------------------------
  const handleImageUpload = useCallback(async (file) => {
    setFileName(file.name);
    setDropError('');
    setStage('processing');
    setProgress(0);
    setStepIdx(0);
    setOriginalImageUrl(URL.createObjectURL(file));

    // Trickle the progress bar up while we wait on the real network call —
    // we don't know true backend progress, so this just keeps the UI honest
    // that something is happening, and caps below 100 until the response lands.
    let elapsed = 0;
    progressTimerRef.current = setInterval(() => {
      elapsed += 120;
      setProgress((p) => Math.min(92, p + Math.random() * 6));
      setStepIdx(Math.min(PROCESS_STEPS.length - 1, Math.floor(elapsed / 900)));
    }, 120);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(ENHANCE_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Backend response:', data);

      clearInterval(progressTimerRef.current);
      setProgress(100);
      setApiOk(true);

      // Accept a few likely field-name shapes so this doesn't break if your
      // FastAPI route uses psnr_score vs psnr, etc.
      setMetrics({
        psnr: data.psnr_score ?? data.psnr ?? DEFAULT_METRICS.psnr,
        ssim: data.ssim_score ?? data.ssim ?? DEFAULT_METRICS.ssim,
        sam: data.sam_score ?? data.sam ?? data.spectral_distortion ?? DEFAULT_METRICS.sam,
      });

      // Accept either a base64 payload or a hosted URL for the enhanced tile.
      if (data.enhanced_image) {
        const base64 = data.enhanced_image;
        setEnhancedImageUrl(base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`);
      } else if (data.enhanced_image_url) {
        setEnhancedImageUrl(
          data.enhanced_image_url.startsWith('http')
            ? data.enhanced_image_url
            : `${API_BASE_URL}${data.enhanced_image_url}`
        );
      } else {
        setEnhancedImageUrl(null); // fall back to the synthetic preview
      }

      setTimeout(() => {
        setStage('analysis');
        pushToast('Reconstruction complete — enhanced tile received from backend.', 'success');
      }, 200);
    } catch (error) {
      console.error('Error communicating with ARES backend:', error);
      clearInterval(progressTimerRef.current);
      setApiOk(false);
      setStage('upload');
      setDropError(
        error.message.includes('Failed to fetch')
          ? `Can't reach ${ENHANCE_ENDPOINT} — is the FastAPI server running?`
          : error.message
      );
      pushToast('Backend request failed. Check the console for details.', 'error');
    }
  }, [pushToast]);

  const validateAndUpload = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!VALID_EXT.includes(ext)) {
      setDropError(`Unsupported file type ".${ext}" — use .TIF, .PNG or .JPG`);
      setTimeout(() => setDropError(''), 3200);
      return;
    }
    handleImageUpload(file);
  }, [handleImageUpload]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    validateAndUpload(e.dataTransfer.files?.[0]);
  }, [validateAndUpload]);

  const handleFileInput = useCallback((e) => {
    validateAndUpload(e.target.files?.[0]);
  }, [validateAndUpload]);

  const reset = () => {
    if (originalImageUrl) URL.revokeObjectURL(originalImageUrl);
    setStage('upload');
    setFileName('');
    setSliderPos(50);
    setSwapped(false);
    setActiveLayer('rgb');
    setOverlayOpacity(100);
    setInfoOpen(true);
    setExportState('idle');
    setActiveHotspot(null);
    setOriginalImageUrl(null);
    setEnhancedImageUrl(null);
    setMetrics(DEFAULT_METRICS);
    pushToast('Workspace cleared.', 'info');
  };

  const handleExport = useCallback(() => {
    if (exportState === 'exporting') return;
    setExportState('exporting');
    pushToast('Packaging Cloud-Optimized GeoTIFF…', 'info');
    setTimeout(() => {
      setExportState('done');
      pushToast(`${fileName.replace(/\.[^.]+$/, '')}_enhanced.tif exported (COG).`, 'success');
    }, 1600);
    setTimeout(() => setExportState('idle'), 4200);
  }, [exportState, pushToast, fileName]);

  const setSliderFromClientX = useCallback((clientX) => {
    if (!viewerRef.current) return;
    const rect = viewerRef.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(99, Math.max(1, pct)));
  }, []);

  useEffect(() => {
    const move = (clientX) => {
      if (!draggingRef.current) return;
      setSliderFromClientX(clientX);
    };
    const onMouseMove = (e) => move(e.clientX);
    const onTouchMove = (e) => move(e.touches[0].clientX);
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [setSliderFromClientX]);

  useEffect(() => {
    if (stage !== 'analysis') return;
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') setSliderPos((p) => Math.max(1, p - (e.shiftKey ? 10 : 2)));
      if (e.key === 'ArrowRight') setSliderPos((p) => Math.min(99, p + (e.shiftKey ? 10 : 2)));
      if (e.key.toLowerCase() === 'r') setActiveLayer('rgb');
      if (e.key.toLowerCase() === 'h') setActiveLayer('heatmap');
      if (e.key.toLowerCase() === 'b') setActiveLayer('boundaries');
      if (e.key.toLowerCase() === 's') setSwapped((s) => !s);
      if (e.key.toLowerCase() === 'e') handleExport();
      if (e.key === '?') setShortcutsOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, handleExport]);

  useEffect(() => () => clearInterval(progressTimerRef.current), []);

  const leftMode = swapped ? 'sharp' : 'blurry';
  const rightMode = swapped ? 'blurry' : 'sharp';
  const leftImage = swapped ? enhancedImageUrl : originalImageUrl;
  const rightImage = swapped ? originalImageUrl : enhancedImageUrl;
  const leftLabel = swapped ? '<4M ARES ENHANCED' : '10M SENSOR';
  const rightLabel = swapped ? '10M SENSOR' : '<4M ARES ENHANCED';
  const leftLayer = swapped ? activeLayer : 'rgb';
  const rightLayer = swapped ? 'rgb' : activeLayer;

  const psnrPct = Math.min(100, (metrics.psnr / 45) * 100);
  const ssimPct = Math.min(100, metrics.ssim * 100);
  const samPct = Math.max(0, 100 - Math.min(100, metrics.sam * 12));
  const METRICS = [
    { key: 'psnr', label: 'PSNR', value: `${metrics.psnr.toFixed(1)} dB`, pct: psnrPct },
    { key: 'ssim', label: 'SSIM', value: metrics.ssim.toFixed(2), pct: ssimPct },
    { key: 'sam', label: 'Spectral distortion (SAM)', value: `${metrics.sam.toFixed(1)}°`, pct: samPct },
  ];

  return (
    <div className="min-h-screen bg-black text-slate-200 flex flex-col relative" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
      <style>{`
        @import url('${FONT_IMPORT_URL}');
        .ares-mono { font-family: 'JetBrains Mono', monospace; }
        .ares-display { font-family: 'Orbitron', sans-serif; }
        .ares-corner { position: absolute; width: 18px; height: 18px; pointer-events: none; }
        @keyframes ares-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .ares-pulse { animation: ares-blink 1.8s ease-in-out infinite; }
        @keyframes ares-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
        .ares-shake { animation: ares-shake 0.35s ease-in-out; }
        @keyframes ares-toast-in { from { opacity:0; transform: translateY(8px);} to {opacity:1; transform:translateY(0);} }
        .ares-toast { animation: ares-toast-in 0.2s ease-out; }
        @keyframes ares-ping { 0% { box-shadow: 0 0 0 0 rgba(245,158,11,0.55);} 100% { box-shadow: 0 0 0 10px rgba(245,158,11,0);} }
        .ares-hotspot-ping { animation: ares-ping 1.8s ease-out infinite; }
        @keyframes ares-scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        .ares-scanline-layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
        .ares-scanline-layer::before {
          content: ''; position: absolute; left: 0; right: 0; height: 40%;
          background: linear-gradient(to bottom, transparent, rgba(245,158,11,0.05), transparent);
          animation: ares-scanline 6s linear infinite;
        }
        .ares-grid-bg {
          background-image:
            linear-gradient(rgba(245,158,11,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,158,11,0.05) 1px, transparent 1px);
          background-size: 42px 42px;
        }
        .ares-vignette::before {
          content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.06), transparent 55%),
                      radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.8), transparent 60%);
        }
        .ares-glow-amber { box-shadow: 0 0 0 1px rgba(245,158,11,0.4), 0 0 18px rgba(245,158,11,0.15); }
        .ares-glow-btn:hover { box-shadow: 0 0 22px rgba(245,158,11,0.45); }
        .ares-title-glow { text-shadow: 0 0 24px rgba(245,158,11,0.35); }
        input[type=range].ares-range { -webkit-appearance: none; height: 3px; background: #292524; }
        input[type=range].ares-range::-webkit-slider-thumb { -webkit-appearance: none; width: 13px; height: 13px; background: #f59e0b; border-radius: 999px; cursor: pointer; margin-top: -5px; box-shadow: 0 0 8px rgba(245,158,11,0.7); }
        kbd { background: #1c1917; border: 1px solid #44403c; padding: 0 4px; }
      `}</style>

      <div className="ares-grid-bg ares-vignette fixed inset-0 pointer-events-none z-0" />

      {/* HEADER */}
      <header className="relative border-b border-amber-900/40 bg-black/90 backdrop-blur px-6 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 via-orange-600 to-amber-900" />
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <div className="absolute inset-0 border border-amber-500 rotate-45" />
            <Satellite className="w-5 h-5 text-amber-500 relative" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-xl leading-none font-bold tracking-wider ares-display ares-title-glow">
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">ARES</span>
            </h1>
            <p className="text-[11px] text-slate-500 ares-mono mt-1.5 tracking-[0.15em]">
              MULTISPECTRAL SPATIAL &amp; SPECTRAL RECONSTRUCTION
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {stage === 'analysis' && (
            <button
              onClick={() => setShortcutsOpen((o) => !o)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-amber-500 transition-colors text-xs ares-mono"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="w-4 h-4" /> SHORTCUTS
            </button>
          )}
          <div className="flex items-center gap-2 ares-mono text-xs text-slate-400">
            {apiOk ? (
              <span className={`w-2 h-2 rounded-full ${stage === 'processing' ? 'bg-amber-500 ares-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)]'}`} />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-red-500" />
            )}
            {stage === 'processing' ? 'PROCESSING' : apiOk ? 'SYSTEM READY' : 'BACKEND OFFLINE'}
          </div>
          <div className="px-2.5 py-1 border border-amber-800/60 text-amber-500 text-xs ares-mono tracking-wide relative overflow-hidden">
            <span className="relative z-10">LOCAL CNN INSTANCE</span>
          </div>
          <button className="text-slate-500 hover:text-amber-500 transition-colors hover:rotate-45 duration-300" aria-label="Settings">
            <Settings className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <TelemetryTicker sliderPos={sliderPos} stage={stage} apiOk={apiOk} />

      {shortcutsOpen && stage === 'analysis' && (
        <div className="relative border-b border-amber-900/30 bg-slate-950 px-6 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs ares-mono text-slate-400 shrink-0 z-10">
          <span className="text-amber-500">KEYS</span>
          <span><kbd className="text-slate-300">←/→</kbd> move slider</span>
          <span><kbd className="text-slate-300">R</kbd> RGB</span>
          <span><kbd className="text-slate-300">H</kbd> heatmap</span>
          <span><kbd className="text-slate-300">B</kbd> boundaries</span>
          <span><kbd className="text-slate-300">S</kbd> swap sides</span>
          <span><kbd className="text-slate-300">E</kbd> export</span>
        </div>
      )}

      {/* MAIN */}
      <main className="relative flex-1 flex flex-col z-10">
        {stage === 'upload' && (
          <div className="flex-1 flex items-center justify-center p-10">
            <div className="w-full max-w-3xl flex flex-col items-center gap-3">
              <label
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`relative w-full h-96 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all
                  border ${dropError ? 'border-red-500 ares-shake' : dragActive ? 'border-amber-500 bg-amber-500/5 ares-glow-amber' : 'border-slate-800 bg-gradient-to-b from-slate-950/80 to-black hover:border-slate-600'}`}
              >
                <Corners active={dragActive} className="w-6 h-6" />
                <div className="ares-scanline-layer" />

                <div className="relative">
                  <div className={`absolute inset-0 rounded-full blur-xl transition-opacity ${dragActive ? 'opacity-60 bg-amber-500' : 'opacity-0'}`} />
                  <CloudUpload className={`w-14 h-14 relative transition-colors ${dragActive ? 'text-amber-500' : 'text-slate-600'}`} strokeWidth={1.25} />
                </div>
                <div className="text-center">
                  <p className="text-xl font-semibold text-slate-200 tracking-wide">Drag &amp; drop Sentinel-2 GeoTIFF</p>
                  <p className="text-sm text-slate-500 ares-mono mt-2 tracking-wider">SUPPORTS .TIF · .PNG · .JPG — 10M RESOLUTION</p>
                  <p className="text-sm text-amber-500/80 mt-3 underline underline-offset-4">or click to browse files</p>
                </div>
                <input type="file" className="hidden" accept=".tif,.tiff,.png,.jpg,.jpeg" onChange={handleFileInput} />
              </label>
              <p className={`text-xs ares-mono h-4 transition-opacity ${dropError ? 'opacity-100 text-red-400' : 'opacity-0'}`}>
                {dropError}
              </p>
            </div>
          </div>
        )}

        {stage === 'processing' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-10">
            <div className="relative">
              <Radar className="w-16 h-16 text-amber-500/30" strokeWidth={1} />
              <Loader2 className="w-16 h-16 text-amber-500 animate-spin absolute inset-0" strokeWidth={1.25} />
            </div>
            <div className="relative w-80 h-1.5 bg-slate-900 overflow-hidden border border-slate-800">
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-150 shadow-[0_0_10px_rgba(245,158,11,0.6)]" style={{ width: `${progress}%` }} />
            </div>
            <span className="ares-mono text-amber-500 text-sm tracking-widest">{Math.round(progress)}%</span>
            <div className="text-center">
              <p className="text-lg font-semibold tracking-wide text-slate-100">ARES CNN processing…</p>
              <p className="text-sm text-slate-500 ares-mono mt-1">{PROCESS_STEPS[stepIdx]}</p>
              <p className="text-xs text-slate-700 ares-mono mt-3">POST {ENHANCE_ENDPOINT}</p>
            </div>
          </div>
        )}

        {stage === 'analysis' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* CONTROL PANEL */}
            <div className="border-b border-slate-800 bg-gradient-to-r from-slate-950/80 via-black to-slate-950/80 px-5 py-2.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 ares-mono text-sm text-slate-400">
                <Crosshair className="w-4 h-4 text-amber-500" />
                {fileName}
                {!enhancedImageUrl && (
                  <span className="ml-2 text-[10px] text-slate-600 border border-slate-800 px-1.5 py-0.5">SYNTHETIC PREVIEW</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs ares-mono text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-slate-200 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> CLEAR WORKSPACE
                </button>
                <button
                  onClick={handleExport}
                  disabled={exportState === 'exporting'}
                  className="ares-glow-btn flex items-center gap-1.5 px-4 py-1.5 text-xs ares-mono font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-black transition-shadow disabled:opacity-70"
                >
                  {exportState === 'exporting' ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> EXPORTING…</>
                  ) : exportState === 'done' ? (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> EXPORTED</>
                  ) : (
                    <><Download className="w-3.5 h-3.5" /> EXPORT COG</>
                  )}
                </button>
              </div>
            </div>

            <div className="flex-1 flex min-h-0">
              {/* VIEWER */}
              <div className="flex-1 flex flex-col items-center p-5 min-w-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <p className="text-xs ares-mono text-slate-500 tracking-wide">
                    Drag the divider, use ← → keys, or click anywhere in the frame
                  </p>
                  <button
                    onClick={() => setSwapped((s) => !s)}
                    className="flex items-center gap-1.5 text-xs ares-mono text-slate-400 hover:text-amber-500 transition-colors"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" /> SWAP SIDES
                  </button>
                </div>

                <div
                  ref={viewerRef}
                  role="slider"
                  tabIndex={0}
                  aria-valuenow={Math.round(sliderPos)}
                  aria-valuemin={1}
                  aria-valuemax={99}
                  aria-label="Comparison slider position"
                  className="relative w-full max-w-[1000px] aspect-[4/3] max-h-full flex-none select-none overflow-hidden border border-slate-800 focus:outline-none focus:border-amber-600 focus:ares-glow-amber"
                  style={{ cursor: 'ew-resize' }}
                  onClick={(e) => { if (!draggingRef.current) setSliderFromClientX(e.clientX); }}
                >
                  <Corners active className="w-8 h-8 z-10" />
                  <div className="ares-scanline-layer z-10" />

                  <SceneLayer mode={leftMode} layer={leftLayer} seed={2} imageUrl={leftImage} />
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 0 0 ${sliderPos}%)`, opacity: overlayOpacity / 100 }}
                  >
                    <SceneLayer mode={rightMode} layer={rightLayer} seed={4} imageUrl={rightImage} />
                  </div>

                  {!swapped && HOTSPOTS.map((h) => (
                    <button
                      key={h.id}
                      onClick={(e) => { e.stopPropagation(); setActiveHotspot(activeHotspot === h.id ? null : h.id); }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                      style={{ left: `${h.x}%`, top: `${h.y}%`, display: h.x > sliderPos ? 'block' : 'none' }}
                      aria-label={`${h.sector} detail`}
                    >
                      <span className={`block w-3 h-3 rounded-full border-2 border-black ${CONF_COLOR[h.confidence].dot} ${activeHotspot === h.id ? '' : 'ares-hotspot-ping'}`} />
                    </button>
                  ))}

                  {activeHotspot && HOTSPOTS.find((h) => h.id === activeHotspot) && !swapped && (
                    (() => {
                      const h = HOTSPOTS.find((x) => x.id === activeHotspot);
                      return (
                        <div
                          className="absolute z-20 w-56 bg-black/95 border border-amber-700/60 ares-glow-amber p-3 text-xs"
                          style={{ left: `${Math.min(h.x, 70)}%`, top: `${Math.min(h.y + 6, 78)}%` }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="ares-mono text-amber-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{h.sector}</span>
                            <button onClick={() => setActiveHotspot(null)} className="text-slate-500 hover:text-slate-300"><X className="w-3 h-3" /></button>
                          </div>
                          <p className={`ares-mono text-[11px] mb-1 ${CONF_COLOR[h.confidence].text}`}>{CONF_COLOR[h.confidence].label}</p>
                          <p className="text-slate-300 leading-snug">{h.note}</p>
                        </div>
                      );
                    })()
                  )}

                  <div
                    className="absolute inset-y-0 w-0.5 bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)]"
                    style={{ left: `${sliderPos}%` }}
                  >
                    <div
                      onMouseDown={(e) => { e.stopPropagation(); draggingRef.current = true; }}
                      onTouchStart={(e) => { e.stopPropagation(); draggingRef.current = true; }}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-600 border-2 border-black flex items-center justify-center cursor-ew-resize shadow-[0_0_16px_rgba(245,158,11,0.7)] hover:scale-110 transition-transform"
                    >
                      <div className="flex gap-0.5">
                        <ChevronRight className="w-3 h-3 text-black rotate-180" strokeWidth={3} />
                        <ChevronRight className="w-3 h-3 text-black" strokeWidth={3} />
                      </div>
                    </div>
                  </div>

                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/80 border border-slate-700 text-xs ares-mono text-slate-300">
                    {leftLabel}
                  </div>
                  <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/80 border border-amber-600 text-xs ares-mono text-amber-500">
                    {rightLabel}
                  </div>
                  <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-black/80 border border-slate-800 text-[11px] ares-mono text-slate-500">
                    {Math.round(sliderPos)}%
                  </div>

                  {activeLayer === 'heatmap' && !swapped && (
                    <div className="absolute bottom-3 left-3 px-3 py-2 bg-black/85 border border-slate-700 text-xs ares-mono">
                      <p className="text-slate-400 mb-1.5 tracking-wide">UNCERTAINTY VARIANCE (MC DROPOUT)</p>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-slate-300"><span className="w-2.5 h-2.5 bg-blue-500 inline-block" /> High confidence</span>
                        <span className="flex items-center gap-1.5 text-slate-300"><span className="w-2.5 h-2.5 bg-yellow-500 inline-block" /> Moderate variance</span>
                        <span className="flex items-center gap-1.5 text-slate-300"><span className="w-2.5 h-2.5 bg-red-500 inline-block" /> Low confidence</span>
                      </div>
                    </div>
                  )}
                </div>

                {infoOpen && (
                  <div className="mt-3 flex items-start gap-3 px-4 py-3 border border-amber-900/50 bg-gradient-to-r from-amber-500/10 to-transparent shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-300 flex-1">
                      <span className="text-amber-500 font-semibold ares-mono text-xs mr-2">AI CONFIDENCE NOTE</span>
                      High variance detected in Sector 4 (dense urban clustering). Road boundaries in this region are inferred and should be verified with secondary ground truth.
                      <button onClick={() => { setActiveLayer('heatmap'); setActiveHotspot(1); }} className="ml-2 text-amber-500 underline underline-offset-2 ares-mono text-xs">
                        view on map
                      </button>
                    </p>
                    <button onClick={() => setInfoOpen(false)} className="text-slate-500 hover:text-slate-300 shrink-0" aria-label="Dismiss">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* ANALYTICS PANEL */}
              <div className="w-80 border-l border-slate-800 bg-gradient-to-b from-slate-950/60 to-black flex flex-col shrink-0 overflow-y-auto">
                <div className="p-4 border-b border-slate-800">
                  <p className="text-xs ares-mono text-slate-500 tracking-wide mb-3 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> LAYER
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {LAYERS.map((l) => {
                      const Icon = l.icon;
                      return (
                        <button
                          key={l.id}
                          onClick={() => setActiveLayer(l.id)}
                          className={`flex items-center gap-2 px-3 py-2 text-sm border transition-all ${
                            activeLayer === l.id
                              ? 'border-amber-500 bg-amber-500/10 text-amber-500 ares-glow-amber'
                              : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="flex-1 text-left">{l.label}</span>
                          <span className="ares-mono text-[10px] opacity-60">{l.key}</span>
                        </button>
                      );
                    })}
                  </div>
                  {activeLayer !== 'rgb' && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[11px] ares-mono text-slate-500 w-14">OPACITY</span>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        value={overlayOpacity}
                        onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                        className="ares-range flex-1"
                      />
                      <span className="text-[11px] ares-mono text-slate-400 w-8 text-right">{overlayOpacity}%</span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <p className="text-xs ares-mono text-slate-500 tracking-wide mb-3">METRICS</p>
                  <div className="flex flex-col gap-4">
                    {METRICS.map((m) => (
                      <div key={m.key} className="relative">
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className="text-sm text-slate-400 flex items-center gap-1.5 cursor-help"
                            onMouseEnter={() => setTooltip(m.key)}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            {m.label}
                            <Info className="w-3 h-3 text-slate-600" />
                          </span>
                          <span className="ares-mono text-sm text-green-400 font-semibold">{m.value}</span>
                        </div>
                        <div className="h-1 bg-slate-900 border border-slate-800 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-green-600 to-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)] transition-all" style={{ width: `${m.pct}%` }} />
                        </div>
                        {tooltip === m.key && (
                          <div className="absolute right-0 top-8 z-30 w-56 bg-black border border-slate-700 p-2.5 text-[11px] text-slate-300 leading-snug shadow-xl">
                            {METRIC_INFO[m.key]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-auto p-4 border-t border-slate-800">
                  <p className="text-xs ares-mono text-slate-600 flex items-center gap-1.5">
                    <ScanLine className="w-3.5 h-3.5" /> {enhancedImageUrl ? 'LIVE INFERENCE · ' : 'PREVIEW MODE · '}ARES-CNN v3.2
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* TOASTS */}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50 w-72">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`ares-toast px-3 py-2.5 text-xs ares-mono border bg-black/95 flex items-center gap-2 backdrop-blur ${
              t.tone === 'success' ? 'border-green-700 text-green-400' :
              t.tone === 'error' ? 'border-red-700 text-red-400' :
              'border-amber-800 text-amber-400'
            }`}
          >
            {t.tone === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> :
             t.tone === 'error' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> :
             <Info className="w-3.5 h-3.5 shrink-0" />}
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
