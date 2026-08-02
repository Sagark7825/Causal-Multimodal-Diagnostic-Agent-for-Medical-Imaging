import React from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Clock, Upload, Cpu, ArrowRight, FileText, CheckCircle, AlertCircle, FileUp, Sparkles } from 'lucide-react';
import StatCard from '../UI/StatCard.jsx';
import DICOMViewer from '../DICOMViewer.jsx';
import CausalDAGViewer from '../CausalDAGViewer.jsx';

export default function RadiologistDashboard({
  activeTab, setActiveTab,
  cases, selectedCase, setSelectedCase,
  selectedReport, setSelectedReport,
  uploadFile, setUploadFile,
  radiologistObservation, setRadiologistObservation,
  obsAction, setObsAction,
  loading,
  
  // Handlers
  handleUploadImaging,
  handleRunAIAnalysis,
  handleRadiologistSubmitReport,
  
  // Badges & helpers
  getPriorityBadgeClass,
  getStatusBadgeClass,
  auth
}) {

  // React Dropzone integration
  const onDrop = React.useCallback((acceptedFiles) => {
    if (acceptedFiles && acceptedFiles[0]) {
      setUploadFile(acceptedFiles[0]);
    }
  }, [setUploadFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.dcm', '.dicom']
    }
  });

  return (
    <div className="space-y-6">
      
      {/* ==================== TAB: OVERVIEW QUEUE ==================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6 font-sans">
          {/* Telemetry Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Awaiting Scan Request" 
              value={cases.filter(c => c.status === 'Awaiting Imaging').length} 
              icon={Clock} 
              colorClass="text-cyan-400"
              sparklineColor="#00c6ff"
            />
            <StatCard 
              title="Scans Ingested Today" 
              value={cases.filter(c => c.status !== 'Awaiting Imaging' && c.status !== 'New Case').length} 
              icon={CheckCircle} 
              colorClass="text-brand-400"
              sparklineColor="#3A86FF"
            />
            <StatCard 
              title="AI Inference Accuracy" 
              value="94.2%" 
              icon={Cpu} 
              colorClass="text-emerald-400"
              sparklineColor="#10B981"
            />
            <StatCard 
              title="Avg Diagnostic Speed" 
              value="18m" 
              icon={Sparkles} 
              colorClass="text-cyan-400"
              sparklineColor="#00c6ff"
            />
          </div>

          {/* Imaging Queue Table */}
          <div className="glass-panel p-6 rounded-2xl space-y-4 relative overflow-hidden">
            <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-3 flex items-center gap-2 font-display">
              <Clock className="text-cyan-400 animate-pulse" size={14} />
              Assigned Clinical Scan Requests Queue
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-3 px-4">Case ID</th>
                    <th className="py-3 px-4">Patient Record</th>
                    <th className="py-3 px-4">Modality</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Case Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.filter(c => c.status === 'Awaiting Imaging' || c.status === 'Imaging Uploaded' || c.status === 'AI Analysis Completed').map(c => (
                    <tr key={c._id} className="border-b border-white/5 hover:bg-[#102a43]/20 transition duration-150">
                      <td className="py-4 px-4 font-mono text-cyan-400 font-bold">{c.caseId}</td>
                      <td className="py-4 px-4 font-semibold text-white font-display">
                        {c.patient?.name} <span className="text-[10px] text-slate-400 font-mono font-medium ml-1">({c.patient?.age}y / {c.patient?.gender})</span>
                      </td>
                      <td className="py-4 px-4 text-slate-300 font-mono font-medium">{c.modality}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded-[5px] text-[8px] font-bold font-mono tracking-wider ${getPriorityBadgeClass(c.priorityLevel)}`}>
                          {c.priorityLevel}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded-[5px] text-[8px] font-bold font-mono tracking-wider ${getStatusBadgeClass(c.status)}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => { setSelectedCase(c); setSelectedReport(c.radiologyReport); setActiveTab('workstation'); }}
                          className="glass-btn-primary text-[10px] py-1.5 px-3 flex items-center gap-1 hover:bg-cyan-500 cursor-pointer ml-auto shadow-md"
                        >
                          Ingest Case <ArrowRight size={10} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cases.filter(c => c.status === 'Awaiting Imaging' || c.status === 'Imaging Uploaded' || c.status === 'AI Analysis Completed').length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-500 italic font-display">No clinical scans pending in queue.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB: WORKSTATION ==================== */}
      {activeTab === 'workstation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
          
          {/* Left panel: file dropzone & AI trigger (Sticky & Constrained) */}
          <div className="lg:col-span-4 space-y-6 sticky top-20">
            {selectedCase ? (
              <div className="glass-panel p-5 rounded-2xl space-y-5 text-xs border border-white/5">
                <div className="border-b border-white/5 pb-2.5 flex justify-between items-center">
                  <h3 className="font-bold text-xs uppercase text-slate-300 font-display flex items-center gap-2">
                    <FileUp size={14} className="text-cyan-400" />
                    DICOM Ingestion Workspace
                  </h3>
                  <button 
                    type="button"
                    onClick={() => { setSelectedCase(null); setUploadFile(null); setSelectedReport(null); }}
                    className="glass-btn-secondary px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase cursor-pointer hover:bg-white/10"
                  >
                    ← Cancel
                  </button>
                </div>
                
                <div className="bg-[#061826]/60 p-3.5 rounded-xl border border-white/5 space-y-1">
                  <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 font-bold">
                    <span>CASE ID: {selectedCase.caseId}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] ${getStatusBadgeClass(selectedCase.status)}`}>{selectedCase.status}</span>
                  </div>
                  <div className="font-bold text-white text-base font-display">{selectedCase.patient?.name}</div>
                  <div className="text-slate-400 font-semibold text-[11px]">Modality: <span className="text-cyan-400">{selectedCase.modality}</span></div>
                </div>

                {/* Drag and Drop Scan file upload using React Dropzone */}
                <form onSubmit={handleUploadImaging} className="space-y-4">
                  <div 
                    {...getRootProps()} 
                    className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-200 relative overflow-hidden flex flex-col items-center justify-center min-h-[140px] ${
                      isDragActive 
                        ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/10' 
                        : uploadFile 
                          ? 'border-emerald-500/40 bg-emerald-500/5' 
                          : 'border-white/10 bg-white/2 hover:border-cyan-500/30'
                    }`}
                  >
                    <input {...getInputProps()} />
                    
                    {/* Laser scanning laser element when file is dragged or uploading */}
                    {isDragActive && <div className="scanning-laser" />}
                    
                    <FileUp size={28} className={`mb-2.5 ${uploadFile ? 'text-emerald-400' : 'text-cyan-400 animate-pulse'}`} />
                    
                    {uploadFile ? (
                      <div className="space-y-1">
                        <span className="text-emerald-400 font-bold block">Scan File Selected</span>
                        <span className="text-slate-300 text-[10px] font-mono break-all block max-w-[200px]">{uploadFile.name}</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-slate-200 font-bold block mb-1">Drag scan file here</span>
                        <span className="text-slate-500 text-[10px]">or click to browse PACS disk</span>
                      </div>
                    )}
                  </div>
                  
                  <button type="submit" className="w-full glass-btn-primary py-3 font-semibold shadow-lg shadow-cyan-500/10 cursor-pointer">
                    Ingest Scan to PACS Server
                  </button>
                </form>

                {/* AI Inference triggers */}
                {selectedReport && (
                  <div className="pt-4 border-t border-white/5 space-y-3">
                    <span className="text-slate-400 text-[10px] uppercase font-mono font-bold block tracking-wider">
                      Neural Inference Control
                    </span>
                    <button
                      onClick={handleRunAIAnalysis} 
                      disabled={loading}
                      className="w-full glass-btn-secondary py-3 flex items-center justify-center gap-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 cursor-pointer shadow-md font-semibold transition-all"
                    >
                      <Cpu size={14} className={loading ? 'animate-spin' : ''} />
                      {loading ? 'Running Neural AI Engine...' : 'Run Diagnostic AI Analysis'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-panel p-12 text-center text-slate-500 text-xs rounded-2xl italic font-display flex flex-col items-center justify-center gap-3 border border-white/5">
                <AlertCircle size={26} className="text-cyan-400/60 animate-bounce" />
                <span>Select a case file from the <button onClick={() => setActiveTab('overview')} className="text-cyan-400 underline font-bold cursor-pointer hover:text-cyan-300">Queue Overview</button> to begin ingestion.</span>
              </div>
            )}
          </div>

          {/* Right panel: PACS viewer & diagnostic workspace (Pure Vertical Expansion Stream) */}
          <div className="lg:col-span-8 vertical-workspace-stream">
            {selectedCase && selectedReport ? (
              <div className="vertical-workspace-stream report-expanded-card">
                
                {/* PACS View and Causal DAG */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                  <DICOMViewer 
                    scanUrl={selectedReport.scanUrl}
                    boundingBoxes={selectedCase.aiPrediction?.boundingBoxes || []}
                    dicomMetadata={selectedReport.dicomMetadata || {}}
                  />
                  {selectedCase.aiPrediction && (
                    <CausalDAGViewer 
                      baselineDisease={selectedCase.aiPrediction.predictedDisease}
                      baselineProb={selectedCase.aiPrediction.confidenceScore}
                      dagNodes={selectedCase.aiPrediction.causalReasoning?.dagNodes || []}
                      dagEdges={selectedCase.aiPrediction.causalReasoning?.dagEdges || []}
                    />
                  )}
                </div>

                {/* AI Draft output details (Expands downwards vertically) */}
                {selectedCase.aiPrediction && (
                  <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20 space-y-4 text-xs w-full shadow-lg shadow-cyan-500/5">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                      <h3 className="font-bold text-xs uppercase text-cyan-400 flex items-center gap-2 font-display">
                        <Cpu size={14} className="text-cyan-400 animate-pulse" />
                        Neural Diagnostic Inference Results
                      </h3>
                      <span className="text-[9px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/20">
                        Inference Ready
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#061826]/80 p-4 rounded-xl border border-white/5">
                      <div>
                        <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider mb-0.5">Predicted Disease:</span>
                        <div className="text-base font-bold text-white font-display text-cyan-300">{selectedCase.aiPrediction.predictedDisease} ({(selectedCase.aiPrediction.confidenceScore * 100).toFixed(1)}%)</div>
                      </div>
                      <div className="sm:text-right">
                        <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider mb-0.5">Anatomical Focus Region:</span>
                        <div className="text-base font-bold text-slate-200 font-display">{selectedCase.aiPrediction.affectedRegion}</div>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Suggested Findings Draft:</span>
                      <p className="text-slate-200 leading-relaxed italic bg-[#061826]/60 p-4 rounded-xl border border-white/5 font-mono text-[11px]">
                        "{selectedCase.aiPrediction.suggestedFindings}"
                      </p>
                    </div>

                    {/* 14 Pathology Vision Model Probabilities Spectrum (Expands downward vertically) */}
                    {selectedCase.aiPrediction.rawProbabilities && Object.keys(selectedCase.aiPrediction.rawProbabilities).length > 0 && (
                      <div className="pt-3.5 border-t border-white/5 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-cyan-400 text-[11px] font-bold font-display uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles size={12} className="text-cyan-400" />
                            DenseNet121 — 14 Pathology Disease Output (Raw Model Probabilities)
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">CUDA GPU Forward Pass</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                          {Object.entries(selectedCase.aiPrediction.rawProbabilities)
                            .sort((a, b) => b[1] - a[1])
                            .map(([diseaseName, probScore]) => {
                              const probPercent = (probScore * 100).toFixed(1);
                              const isHigh = probScore >= 0.70;
                              const isMod = probScore >= 0.40 && probScore < 0.70;
                              return (
                                <div key={diseaseName} className="p-2.5 bg-[#04121e]/80 rounded-xl border border-white/5 space-y-1.5">
                                  <div className="flex justify-between items-center text-[11px] font-semibold">
                                    <span className="text-slate-200 font-display">{diseaseName.replace(/_/g, ' ')}</span>
                                    <span className={`font-mono font-bold ${isHigh ? 'text-rose-400' : isMod ? 'text-amber-400' : 'text-slate-400'}`}>
                                      {probPercent}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        isHigh ? 'bg-gradient-to-r from-amber-500 to-rose-500' : isMod ? 'bg-gradient-to-r from-cyan-500 to-amber-500' : 'bg-cyan-500/40'
                                      }`}
                                      style={{ width: `${Math.min(100, Math.max(3, probScore * 100))}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {selectedCase.aiPrediction.indicators && Object.keys(selectedCase.aiPrediction.indicators).length > 0 && (
                      <div className="pt-3.5 border-t border-white/5">
                        <span className="text-slate-400 text-[10px] font-bold block mb-2 uppercase tracking-wider">Extracted Clinical Features:</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                          {Object.entries(selectedCase.aiPrediction.indicators).map(([key, val]) => (
                            <div key={key} className="bg-[#061826]/70 p-2.5 rounded-xl border border-white/5">
                              <span className="text-slate-500 capitalize block text-[9px] mb-0.5">{key.replace(/_/g, ' ')}</span>
                              <span className="text-cyan-400 font-bold text-xs">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Final Diagnostic submission form (Expands downwards vertically) */}
                <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20 space-y-4 text-xs shadow-lg shadow-cyan-500/5 w-full">
                  <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5 font-display flex items-center gap-2">
                    <FileText size={14} className="text-cyan-400" />
                    Submit Attending Diagnostic Report
                  </h3>
                  <form onSubmit={handleRadiologistSubmitReport} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-300 mb-1.5 font-semibold">Observation Decision Mode</label>
                        <select value={obsAction} onChange={e => setObsAction(e.target.value)} className="w-full glass-input">
                          <option value="Accept AI">Accept AI Suggested Observation</option>
                          <option value="Modify AI">Modify AI Findings</option>
                          <option value="Reject AI">Reject AI Suggested Findings</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1.5 font-semibold">Attending Radiologist Name</label>
                        <input type="text" disabled value={auth.user?.name} className="w-full glass-input opacity-60 font-semibold" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1.5 font-semibold">Final Radiology Diagnostic Note</label>
                      <textarea 
                        rows="3" 
                        required 
                        value={radiologistObservation} 
                        onChange={e => setRadiologistObservation(e.target.value)}
                        placeholder="Right lung console zone shows focal opacities. Corresponds to AI predicted atypical pneumonia." 
                        className="w-full glass-input text-xs"
                      />
                    </div>

                    <button type="submit" className="w-full glass-btn-primary py-3.5 font-bold text-xs tracking-wider cursor-pointer shadow-lg shadow-cyan-500/10">
                      Submit Diagnostic Observations & Route to Physician
                    </button>
                  </form>
                </div>

              </div>
            ) : (
              selectedCase && (
                <div className="glass-panel p-16 text-center text-slate-500 text-xs rounded-2xl italic font-display flex flex-col items-center justify-center gap-3 border border-white/5">
                  <Upload size={28} className="text-slate-500 animate-pulse" />
                  <span>Medical scan file not uploaded. Ingest scan file in the left panel to load the PACS workstation.</span>
                </div>
              )
            )}
          </div>

        </div>
      )}

      {/* ==================== TAB: COMPLETED REPORTS ==================== */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <FileText size={18} className="text-cyan-400" />
                Completed Radiology Reports Registry
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-sans font-medium">Archive registry of diagnostic case observation logs and submitted reports.</p>
            </div>
            <button 
              type="button"
              onClick={() => setActiveTab('overview')}
              className="glass-btn-secondary px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase cursor-pointer"
            >
              ← Back to Overview
            </button>
          </div>
          <div className="glass-panel p-5 rounded-2xl space-y-4 font-sans">
            <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5 font-display">
              Completed Radiology Reports Registry
            </h3>
          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
            {cases.filter(c => c.status === 'Doctor Review Pending' || c.status === 'Treatment Completed' || c.status === 'Case Closed').map(c => (
              <div key={c._id} className="p-4 bg-[#061826]/60 border border-white/5 rounded-2xl text-xs flex justify-between items-center hover:border-white/10 transition">
                <div>
                  <div className="font-mono text-[9px] text-cyan-400 font-bold">CASE: {c.caseId} ({c.modality})</div>
                  <div className="font-bold text-white mt-1.5 font-display">{c.patient?.name}</div>
                  {c.radiologyReport && <p className="text-slate-400 italic mt-1.5 leading-relaxed font-sans">"Observation findings: {c.radiologyReport.radiologistObservation}"</p>}
                </div>
                <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-3 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider font-display">
                  Report Logged
                </span>
              </div>
            ))}
            {cases.filter(c => c.status === 'Doctor Review Pending' || c.status === 'Treatment Completed' || c.status === 'Case Closed').length === 0 && (
              <div className="text-center text-slate-500 py-12 italic font-display">No completed reports in archive.</div>
            )}
          </div>
        </div>
      </div>
    )}

    </div>
  );
}
