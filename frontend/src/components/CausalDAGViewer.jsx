import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { HelpCircle, RefreshCw } from 'lucide-react';

export default function CausalDAGViewer({ baselineDisease = "Pneumonia", baselineProb = 0.92, dagNodes = [], dagEdges = [] }) {
  const [interventions, setInterventions] = useState({
    Opacity: 1, // Present
    Fever: 1,   // Present
    Age: 55     // Middle aged
  });
  const [updatedProb, setUpdatedProb] = useState(baselineProb);
  const [loading, setLoading] = useState(false);
  const [explanations, setExplanations] = useState([]);

  // Default Node coordinate mapping inside the SVG viewport (500x300)
  const nodePositions = {
    "Age": { x: 50, y: 150 },
    "Pneumonia": { x: 200, y: 100 },
    "Hospital_Admission_Bias": { x: 200, y: 220 },
    "Opacity": { x: 380, y: 50 },
    "Fever": { x: 380, y: 150 },
    "Antibiotic_Treatment": { x: 320, y: 260 },
    "Recovery_Outcome": { x: 450, y: 200 }
  };

  useEffect(() => {
    runWhatIfSimulation();
  }, [interventions, baselineProb, baselineDisease]);

  const runWhatIfSimulation = async () => {
    setLoading(true);
    try {
      const aiBackendUrl = 'http://127.0.0.1:8000';
      const response = await axios.post(`${aiBackendUrl}/api/v1/causal/what-if`, {
        baseline_disease: baselineDisease,
        baseline_prob: baselineProb,
        interventions: {
          Opacity: interventions.Opacity,
          Fever: interventions.Fever,
          Age: interventions.Age
        }
      });
      if (response.data && response.data.success) {
        setUpdatedProb(response.data.counterfactual.updated_probability);
        setExplanations(response.data.counterfactual.explanations);
      }
    } catch (err) {
      // Fallback local logic if FastAPI is offline
      let prob = baselineProb;
      const logs = [];
      
      if (interventions.Opacity === 0) {
        prob -= 0.55;
        logs.push("do(Opacity = 0): Dropped probability by -55% (X-ray signs negative).");
      }
      if (interventions.Fever === 0) {
        prob -= 0.20;
        logs.push("do(Fever = 0): Reduced disease correlation by -20%.");
      }
      if (interventions.Age < 30) {
        prob -= 0.10;
        logs.push("do(Age < 30): Younger demographic reduces baseline risk by -10%.");
      } else if (interventions.Age > 70) {
        prob += 0.12;
        logs.push("do(Age > 70): Elder risk adjustment increases severity probability by +12%.");
      }
      
      prob = Math.max(0.01, Math.min(0.99, prob));
      setUpdatedProb(Number(prob.toFixed(3)));
      setExplanations(logs);
    } finally {
      setLoading(false);
    }
  };

  const handleSliderChange = (key, val) => {
    setInterventions(prev => ({ ...prev, [key]: val }));
  };

  const handleReset = () => {
    setInterventions({
      Opacity: 1,
      Fever: 1,
      Age: 55
    });
  };

  // Helper to draw clean paths with arrowhead markers
  const renderEdge = (edge, index) => {
    const fromPos = nodePositions[edge.from];
    const toPos = nodePositions[edge.to];
    if (!fromPos || !toPos) return null;

    // Shift coordinates slightly so arrows don't collide with node circles
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Node radius is ~25px
    const rStart = 28;
    const rEnd = 30;
    
    const startX = fromPos.x + (dx / dist) * rStart;
    const startY = fromPos.y + (dy / dist) * rStart;
    const endX = toPos.x + (dx / dist) * (dist - rEnd);
    const endY = toPos.y + (dy / dist) * (dist - rEnd);

    // Color based on edge weight
    const isPositive = edge.weight > 0;
    const edgeColor = isPositive ? 'stroke-emerald-500/60' : 'stroke-rose-500/60';

    return (
      <g key={index}>
        <path
          d={`M ${startX} ${startY} L ${endX} ${endY}`}
          className={`${edgeColor} fill-none`}
          strokeWidth={Math.abs(edge.weight) * 3}
          markerEnd="url(#arrow)"
        />
        <text
          x={(startX + endX) / 2}
          y={(startY + endY) / 2 - 5}
          className="fill-slate-400 text-[8px] font-mono select-none text-center"
        >
          {edge.weight > 0 ? `+${edge.weight}` : edge.weight}
        </text>
      </g>
    );
  };

  return (
    <div className="glass-panel p-5 rounded-2xl flex flex-col h-full border border-white/5 shadow-xl font-sans">
      {/* Title */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="font-bold text-xs uppercase text-slate-300 font-display">Interactive Causal DAG</h3>
          <p className="text-[10px] text-slate-500 font-medium">Backdoor adjustments to block non-causal bias & run counterfactuals</p>
        </div>
        <button onClick={handleReset} className="text-slate-400 hover:text-white transition-all duration-200 p-1 rounded-lg hover:bg-white/5 cursor-pointer" title="Reset Simulation">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* SVG Canvas */}
      <div className="bg-[#061826] border border-cyan-500/15 rounded-xl overflow-hidden flex items-center justify-center p-2 mb-4 h-[240px] relative shadow-inner">
        <svg viewBox="0 0 520 320" className="w-full h-full">
          {/* Arrow marker definition */}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 7 5 L 0 8.5 z" className="fill-slate-500" />
            </marker>
          </defs>

          {/* Render Causal Connections */}
          {dagEdges.length > 0 ? (
            dagEdges.map((edge, idx) => renderEdge(edge, idx))
          ) : (
            // Default Fallbacks
            [
              { from: "Age", to: "Pneumonia", weight: 0.35 },
              { from: "Age", to: "Recovery_Outcome", weight: -0.25 },
              { from: "Pneumonia", to: "Opacity", weight: 0.85 },
              { from: "Pneumonia", to: "Fever", weight: 0.72 },
              { from: "Pneumonia", to: "Recovery_Outcome", weight: -0.55 },
              { from: "Antibiotic_Treatment", to: "Recovery_Outcome", weight: 0.78 }
            ].map((edge, idx) => renderEdge(edge, idx))
          )}

          {/* Render Nodes */}
          {Object.entries(nodePositions).map(([name, pos]) => {
            const isIntervened = interventions[name] !== undefined;
            const nodeVal = interventions[name];
            
            return (
              <g key={name} transform={`translate(${pos.x}, ${pos.y})`}>
                <circle
                  r="24"
                  className={`${
                    isIntervened 
                      ? 'fill-cyan-500/10 stroke-cyan-400 shadow-[0_0_12px_rgba(0,198,255,0.25)]' 
                      : 'fill-[#102a43]/85 stroke-white/8'
                  } stroke-2 transition duration-300`}
                />
                <text
                  textAnchor="middle"
                  dy="-2"
                  className="fill-slate-200 text-[8px] font-bold font-sans select-none"
                >
                  {name.split('_')[0]}
                </text>
                <text
                  textAnchor="middle"
                  dy="12"
                  className={`${isIntervened ? 'fill-cyan-400 font-bold' : 'fill-slate-500'} text-[7px] font-mono select-none`}
                >
                  {isIntervened 
                    ? (name === 'Age' ? `${nodeVal}y` : (nodeVal === 1 ? 'Present' : 'Absent'))
                    : 'Observed'
                  }
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Probability comparison gauges */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-xs font-sans">
        <div className="bg-[#061826]/60 p-3 rounded-xl border border-white/5 shadow-inner">
          <div className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-1">Baseline AI Prediction</div>
          <div className="text-base font-bold text-white font-mono">{(baselineProb * 100).toFixed(1)}%</div>
          <div className="w-full bg-[#102a43] h-1.5 rounded-full mt-2 overflow-hidden border border-white/5">
            <div className="bg-slate-400 h-full" style={{ width: `${baselineProb * 100}%` }}></div>
          </div>
        </div>

        <div className="bg-cyan-500/5 p-3 rounded-xl border border-cyan-500/20 relative shadow-inner">
          {loading && <span className="absolute top-2.5 right-2.5 text-[8px] font-mono text-cyan-400 font-bold animate-pulse">COMPUTING...</span>}
          <div className="text-cyan-400 text-[9px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <span>What-If Counterfactual</span>
            <HelpCircle size={10} className="text-cyan-400" title="Simulated likelihood if variables were actively intervened on" />
          </div>
          <div className={`text-base font-bold font-mono ${updatedProb < baselineProb ? 'text-emerald-400' : 'text-rose-400'}`}>
            {(updatedProb * 100).toFixed(1)}%
          </div>
          <div className="w-full bg-[#102a43] h-1.5 rounded-full mt-2 overflow-hidden border border-white/5">
            <div 
              className={`h-full transition-all duration-300 ${updatedProb < baselineProb ? 'bg-emerald-400' : 'bg-rose-400'}`} 
              style={{ width: `${updatedProb * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Control Sliders */}
      <div className="space-y-3 bg-[#061826]/40 p-3.5 rounded-xl border border-white/5 text-xs font-sans">
        <div className="flex justify-between items-center">
          <span className="text-slate-300 font-semibold">do(Opacity) - Visual Marker</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleSliderChange('Opacity', 0)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${interventions.Opacity === 0 ? 'bg-gradient-to-r from-cyan-500 to-brand-500 text-white shadow-md' : 'bg-[#102a43] text-slate-400 border border-white/5 hover:text-slate-200'}`}
            >
              Absent (0)
            </button>
            <button 
              onClick={() => handleSliderChange('Opacity', 1)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${interventions.Opacity === 1 ? 'bg-gradient-to-r from-cyan-500 to-brand-500 text-white shadow-md' : 'bg-[#102a43] text-slate-400 border border-white/5 hover:text-slate-200'}`}
            >
              Present (1)
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-300 font-semibold">do(Fever) - Symptom</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleSliderChange('Fever', 0)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${interventions.Fever === 0 ? 'bg-gradient-to-r from-cyan-500 to-brand-500 text-white shadow-md' : 'bg-[#102a43] text-slate-400 border border-white/5 hover:text-slate-200'}`}
            >
              Absent (0)
            </button>
            <button 
              onClick={() => handleSliderChange('Fever', 1)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${interventions.Fever === 1 ? 'bg-gradient-to-r from-cyan-500 to-brand-500 text-white shadow-md' : 'bg-[#102a43] text-slate-400 border border-white/5 hover:text-slate-200'}`}
            >
              Present (1)
            </button>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-slate-300 mb-1.5">
            <span className="font-semibold">do(Age) - Confounder</span>
            <span className="font-mono text-cyan-400 font-bold">{interventions.Age} years</span>
          </div>
          <input
            type="range"
            min="18"
            max="95"
            value={interventions.Age}
            onChange={(e) => handleSliderChange('Age', Number(e.target.value))}
            className="w-full h-1 bg-[#061826] rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>

      {/* Causal explanation trace */}
      {explanations.length > 0 && (
        <div className="mt-3.5 bg-[#061826]/75 p-3 rounded-xl border border-white/5 text-[9px] text-slate-400 space-y-1.5 font-mono shadow-inner leading-relaxed">
          <div className="text-cyan-400 font-bold uppercase tracking-wider text-[8px]">Simulation Ledger Trace:</div>
          {explanations.map((exp, i) => (
            <div key={i} className="flex gap-1.5 items-start">
              <span className="text-cyan-400 font-bold">•</span>
              <span>{exp}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
