import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Activity, Server, FileText } from 'lucide-react';

const STEPS = [
  { text: "Analyzing Image Modality...", icon: Activity },
  { text: "Preprocessing Image & DICOM Headers...", icon: Server },
  { text: "Running DenseNet121 Deep Layer Inference...", icon: Cpu },
  { text: "Extracting Diagnostic Features...", icon: Activity },
  { text: "Computing Disease Correlation Probabilities...", icon: Cpu },
  { text: "Consulting MedVision LLM Reasoning Engine...", icon: Server },
  { text: "Generating Clinical Diagnosis Report...", icon: FileText },
  { text: "Finalizing Healthcare Records...", icon: FileText }
];

export default function AIAnalysisOverlay({ isOpen }) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      return;
    }
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const ActiveIcon = STEPS[currentStep].icon;

  return (
    <div className="fixed inset-0 bg-[#061826]/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-4">
      {/* Background glowing gradients */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative flex flex-col items-center max-w-lg w-full text-center space-y-8 z-10">
        
        {/* Rotating Medical Rings & Brain Graphic */}
        <div className="relative w-44 h-44 flex items-center justify-center">
          {/* Outer Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border border-dashed border-cyan-500/20 rounded-full"
          />
          {/* Middle Ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-4 border border-cyan-400/40 rounded-full border-t-transparent border-b-transparent"
          />
          {/* Inner ring */}
          <motion.div
            animate={{ rotate: 180 }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-8 border border-dashed border-brand-500/30 rounded-full"
          />
          {/* Glowing Center Core */}
          <motion.div
            animate={{ scale: [0.92, 1.08, 0.92] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-16 h-16 bg-gradient-to-tr from-cyan-400 to-brand-500 rounded-full flex items-center justify-center shadow-[0_0_35px_rgba(0,198,255,0.4)] border border-white/20"
          >
            <ActiveIcon size={28} className="text-white animate-pulse" />
          </motion.div>
        </div>

        {/* Text Analytics progress details */}
        <div className="space-y-3 w-full">
          <span className="text-cyan-400 font-mono font-bold text-xs uppercase tracking-widest block">
            MedVision AI Inference Queue
          </span>
          
          <div className="h-8 overflow-hidden flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="text-white font-display text-lg font-semibold tracking-tight"
              >
                {STEPS[currentStep].text}
              </motion.div>
            </AnimatePresence>
          </div>
          
          <p className="text-slate-400 text-xs font-medium max-w-sm mx-auto leading-relaxed">
            Crunching dense multimodal indicators against patient records & DenseNet121 matrices. Do not close this panel.
          </p>
        </div>

        {/* Diagnostic Loading bar */}
        <div className="w-full max-w-xs bg-white/5 border border-white/5 h-2 rounded-full overflow-hidden relative">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="h-full bg-gradient-to-r from-cyan-400 to-brand-500 shadow-[0_0_8px_rgba(0,198,255,0.5)]"
          />
        </div>

        {/* Matrix logs trace */}
        <div className="bg-[#0b253a]/60 border border-white/5 w-full p-4 rounded-xl text-left font-mono text-[10px] text-slate-500 space-y-1.5 h-32 overflow-y-auto max-h-32">
          <div className="text-cyan-400 font-bold uppercase tracking-wider text-[9px] mb-1">Inference Execution Ledger:</div>
          {STEPS.slice(0, currentStep + 1).map((s, idx) => (
            <div key={idx} className="flex gap-2 items-center text-slate-300">
              <span className="text-emerald-400">✓</span>
              <span>[SUCCESS] {s.text}</span>
            </div>
          ))}
          {currentStep < STEPS.length - 1 && (
            <div className="text-cyan-400 animate-pulse flex gap-2 items-center">
              <span>▶</span>
              <span>[PENDING] {STEPS[currentStep + 1].text}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
