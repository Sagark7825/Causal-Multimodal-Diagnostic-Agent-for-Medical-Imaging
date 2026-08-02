import React, { useRef, useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, Move, Maximize, RefreshCw, Ruler } from 'lucide-react';

export default function DICOMViewer({ scanUrl, boundingBoxes = [], dicomMetadata = {} }) {
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [windowCenter, setWindowCenter] = useState(128); // Brightness
  const [windowWidth, setWindowWidth] = useState(256);   // Contrast
  const [mode, setMode] = useState('pan'); // 'pan', 'measure'
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [measurement, setMeasurement] = useState(null); // { start: {x,y}, end: {x,y} }
  const [showOverlays, setShowOverlays] = useState(true);

  const imageRef = useRef(null);

  // Load image
  useEffect(() => {
    if (!scanUrl) return;
    const img = new Image();
    img.src = scanUrl.startsWith('http') ? scanUrl : `http://localhost:5000${scanUrl}`;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      resetViewer();
    };
  }, [scanUrl]);

  // Redraw Canvas when states change
  useEffect(() => {
    draw();
  }, [zoom, pan, windowCenter, windowWidth, boundingBoxes, mode, measurement, showOverlays]);

  const resetViewer = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setWindowCenter(128);
    setWindowWidth(256);
    setMeasurement(null);
    draw();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply Windowing (Brightness & Contrast filters)
    // Contrast standard: contrast = (255 / windowWidth)
    // Brightness standard: brightness = (128 - windowCenter)
    const contrast = Math.max(0.1, 256 / windowWidth);
    const brightness = (128 - windowCenter) * 0.5;

    ctx.save();

    // Set canvas filter
    ctx.filter = `contrast(${contrast * 100}%) brightness(${100 + (brightness / 255) * 100}%)`;

    // Apply Pan & Zoom transformations
    ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
    ctx.scale(zoom, zoom);

    // Draw centering the image
    const iw = img.width;
    const ih = img.height;
    // Fit image to canvas boundaries
    const scale = Math.min(canvas.width / iw, canvas.height / ih) * 0.9;
    const w = iw * scale;
    const h = ih * scale;
    
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();

    // Separate overlay draw (No contrast filters applied to borders/boxes)
    if (showOverlays) {
      ctx.save();
      ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
      ctx.scale(zoom, zoom);

      // Draw bounding boxes
      boundingBoxes.forEach(box => {
        const boxW = box.xMax - box.xMin;
        const boxH = box.yMax - box.yMin;
        const mappedX = (box.xMin - iw / 2) * scale;
        const mappedY = (box.yMin - ih / 2) * scale;
        const mappedW = boxW * scale;
        const mappedH = boxH * scale;

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2 / zoom;
        ctx.strokeRect(mappedX, mappedY, mappedW, mappedH);

        ctx.fillStyle = '#ef4444';
        ctx.font = `${12 / zoom}px Outfit, sans-serif`;
        ctx.fillText(box.label || 'Lesion', mappedX, mappedY - 5 / zoom);
      });

      // Draw measurement line
      if (measurement) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3 / zoom;
        ctx.beginPath();
        ctx.moveTo(measurement.start.x, measurement.start.y);
        ctx.lineTo(measurement.end.x, measurement.end.y);
        ctx.stroke();

        // Draw start/end nodes
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(measurement.start.x, measurement.start.y, 5 / zoom, 0, Math.PI * 2);
        ctx.arc(measurement.end.x, measurement.end.y, 5 / zoom, 0, Math.PI * 2);
        ctx.fill();

        // Calculate distance in mm (assume arbitrary scale factor 0.23mm/pixel)
        const dx = measurement.end.x - measurement.start.x;
        const dy = measurement.end.y - measurement.start.y;
        const pixels = Math.sqrt(dx * dx + dy * dy);
        const mm = (pixels * 0.23).toFixed(1);

        ctx.fillStyle = '#10b981';
        ctx.font = `${14 / zoom}px Outfit, sans-serif`;
        ctx.fillText(`${mm} mm`, (measurement.start.x + measurement.end.x) / 2, (measurement.start.y + measurement.end.y) / 2 - 10 / zoom);
      }

      ctx.restore();
    }
  };

  // Dragging event handlers
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDragging(true);
    setDragStart({ x, y });

    if (mode === 'measure') {
      // Convert screen coordinates to zoomed/panned coordinate space
      const canvasX = x - (canvas.width / 2 + pan.x);
      const canvasY = y - (canvas.height / 2 + pan.y);
      const pStart = { x: canvasX / zoom, y: canvasY / zoom };
      setMeasurement({ start: pStart, end: pStart });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - dragStart.x;
    const dy = y - dragStart.y;

    if (mode === 'pan') {
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x, y });
    } else if (mode === 'measure' && measurement) {
      const canvasX = x - (canvas.width / 2 + pan.x);
      const canvasY = y - (canvas.height / 2 + pan.y);
      setMeasurement(prev => ({
        ...prev,
        end: { x: canvasX / zoom, y: canvasY / zoom }
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const zoomIn = () => setZoom(z => Math.min(5, z + 0.2));
  const zoomOut = () => setZoom(z => Math.max(0.5, z - 0.2));

  return (
    <div className="glass-panel rounded-2xl overflow-hidden flex flex-col h-full border border-white/5 shadow-xl">
      {/* Control bar */}
      <div className="bg-[#102a43]/75 px-4 py-3 border-b border-white/5 flex items-center justify-between text-xs font-sans">
        <div className="flex items-center gap-3">
          <span className="font-bold text-cyan-400 tracking-wider">PACS WORKSTATION v1.2</span>
          {dicomMetadata && dicomMetadata["Manufacturer"] && (
            <span className="text-slate-400 font-mono">({dicomMetadata["Manufacturer"]})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => setMode('pan')}
            className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${mode === 'pan' ? 'bg-gradient-to-r from-cyan-500 to-brand-500 text-white shadow-md' : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'}`}
            title="Pan & Drag"
          >
            <Move size={14} />
          </button>
          <button 
            type="button"
            onClick={() => setMode('measure')}
            className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${mode === 'measure' ? 'bg-gradient-to-r from-cyan-500 to-brand-500 text-white shadow-md' : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'}`}
            title="Measurement Line (Ruler)"
          >
            <Ruler size={14} />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button type="button" onClick={zoomIn} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"><ZoomIn size={14} /></button>
          <button type="button" onClick={zoomOut} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"><ZoomOut size={14} /></button>
          <button type="button" onClick={resetViewer} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer" title="Reset"><RefreshCw size={14} /></button>
          <button 
            type="button"
            onClick={() => setShowOverlays(o => !o)} 
            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-wider uppercase transition cursor-pointer ${showOverlays ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-[#061826]/40 text-slate-400 border border-white/5'}`}
          >
            Overlays
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 bg-black/90 relative flex items-center justify-center min-h-[350px] scanning-container">
        {/* Subtle scan laser scanning effect */}
        {showOverlays && <div className="scanning-laser" />}

        <canvas
          ref={canvasRef}
          width={550}
          height={400}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-crosshair w-full h-full object-contain"
        />

        {/* Floating clinical overlays */}
        {showOverlays && (
          <div className="absolute top-4 left-4 pointer-events-none text-[9px] font-mono text-emerald-400 bg-black/75 p-3 rounded-xl border border-emerald-500/20 space-y-1 shadow-2xl">
            <div className="flex gap-1.5"><span className="text-slate-500">PATIENT:</span> <span>{dicomMetadata["Patient Name"] || "N/A"}</span></div>
            <div className="flex gap-1.5"><span className="text-slate-500">ID:</span> <span>{dicomMetadata["Patient ID"] || "N/A"}</span></div>
            <div className="flex gap-1.5"><span className="text-slate-500">DATE:</span> <span>{dicomMetadata["Study Date"] || "N/A"}</span></div>
            <div className="flex gap-1.5"><span className="text-slate-500">MODALITY:</span> <span>{dicomMetadata["Modality"] || "N/A"}</span></div>
            <div className="flex gap-1.5"><span className="text-slate-500">WINDOW:</span> <span>C {windowCenter} / W {windowWidth}</span></div>
          </div>
        )}
      </div>

      {/* Adjust Windowing sliders */}
      <div className="p-4 bg-[#102a43]/60 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
        <div>
          <div className="flex justify-between text-slate-400 mb-1.5">
            <span className="font-semibold">Window Center (Brightness)</span>
            <span className="font-mono text-cyan-400 font-bold">{windowCenter}</span>
          </div>
          <input
            type="range"
            min="0"
            max="255"
            value={windowCenter}
            onChange={(e) => setWindowCenter(Number(e.target.value))}
            className="w-full h-1 bg-[#061826] rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
        <div>
          <div className="flex justify-between text-slate-400 mb-1.5">
            <span className="font-semibold">Window Width (Contrast)</span>
            <span className="font-mono text-cyan-400 font-bold">{windowWidth}</span>
          </div>
          <input
            type="range"
            min="10"
            max="512"
            value={windowWidth}
            onChange={(e) => setWindowWidth(Number(e.target.value))}
            className="w-full h-1 bg-[#061826] rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>
    </div>
  );
}
