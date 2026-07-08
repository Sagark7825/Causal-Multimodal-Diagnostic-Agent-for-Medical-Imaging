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
    <div className="glass-panel p-5 rounded-xl flex flex-col h-full">
      {/* Title */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="font-semibold text-sm text-slate-200">Interactive Causal DAG</h3>
          <p className="text-[11px] text-slate-400">Backdoor adjustments to block non-causal bias & run counterfactuals</p>
        </div>
        <button onClick={handleReset} className="text-slate-400 hover:text-white transition p-1" title="Reset Simulation">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* SVG Canvas */}
      <div className="bg-slate-950 border border-brand-500/10 rounded-lg overflow-hidden flex items-center justify-center p-2 mb-4 h-[240px] relative">
        <svg viewBox="0 0 520 320" className="w-full h-full">
          {/* Arrow marker definition */}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 7 5 L 0 8.5 z" className="fill-slate-400" />
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
                      ? 'fill-brand-950 stroke-brand-400' 
                      : 'fill-slate-900 stroke-slate-800'
                  } stroke-2 transition duration-300`}
                />
                <text
                  textAnchor="middle"
                  dy="-2"
                  className="fill-slate-200 text-[8px] font-semibold font-sans select-none"
                >
                  {name.split('_')[0]}
                </text>
                <text
                  textAnchor="middle"
                  dy="12"
                  className={`${isIntervened ? 'fill-brand-400 font-bold' : 'fill-slate-500'} text-[7px] font-mono select-none`}
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
      <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
        <div className="bg-slate-900/60 p-3 rounded-lg border border-white/5">
          <div className="text-slate-400 mb-1">Baseline AI Prediction</div>
          <div className="text-lg font-bold text-slate-200 font-mono">{(baselineProb * 100).toFixed(1)}%</div>
          <div className="w-full bg-slate-800 h-1.5 rounded mt-2 overflow-hidden">
            <div className="bg-slate-400 h-full" style={{ width: `${baselineProb * 100}%` }}></div>
          </div>
        </div>

        <div className="bg-brand-950/20 p-3 rounded-lg border border-brand-500/20 relative">
          {loading && <span className="absolute top-2 right-2 text-[9px] text-brand-400 animate-pulse">Computing...</span>}
          <div className="text-brand-300 mb-1 flex items-center gap-1">
            <span>What-If Counterfactual</span>
            <HelpCircle size={10} className="text-brand-400" title="Simulated likelihood if variables were actively intervened on" />
          </div>
          <div className={`text-lg font-bold font-mono ${updatedProb < baselineProb ? 'text-emerald-400' : 'text-rose-400'}`}>
            {(updatedProb * 100).toFixed(1)}%
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded mt-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${updatedProb < baselineProb ? 'bg-emerald-500' : 'bg-rose-500'}`} 
              style={{ width: `${updatedProb * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Control Sliders */}
      <div className="space-y-3 bg-slate-900/40 p-3 rounded-lg border border-white/5 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-slate-300 font-medium">do(Opacity) - Visual Marker</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleSliderChange('Opacity', 0)}
              className={`px-2 py-0.5 rounded text-[10px] ${interventions.Opacity === 0 ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              Absent (0)
            </button>
            <button 
              onClick={() => handleSliderChange('Opacity', 1)}
              className={`px-2 py-0.5 rounded text-[10px] ${interventions.Opacity === 1 ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              Present (1)
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-300 font-medium">do(Fever) - Symptom</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleSliderChange('Fever', 0)}
              className={`px-2 py-0.5 rounded text-[10px] ${interventions.Fever === 0 ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              Absent (0)
            </button>
            <button 
              onClick={() => handleSliderChange('Fever', 1)}
              className={`px-2 py-0.5 rounded text-[10px] ${interventions.Fever === 1 ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              Present (1)
            </button>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span>do(Age) - Confounder</span>
            <span className="font-mono text-brand-400">{interventions.Age} years</span>
          </div>
          <input
            type="range"
            min="18"
            max="95"
            value={interventions.Age}
            onChange={(e) => handleSliderChange('Age', Number(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
          />
        </div>
      </div>

      {/* Causal explanation trace */}
      {explanations.length > 0 && (
        <div className="mt-3 bg-slate-950/60 p-2.5 rounded border border-white/5 text-[10px] text-slate-400 space-y-1.5 font-mono">
          <div className="text-brand-400 font-semibold uppercase text-[9px]">Simulation Reason:</div>
          {explanations.map((exp, i) => (
            <div key={i} className="flex gap-1.5 items-start">
              <span className="text-brand-500">•</span>
              <span>{exp}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
