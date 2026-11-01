import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { 
  Activity, Clock, Upload, Cpu, FileText, CheckCircle, 
  AlertCircle, Eye, RefreshCw, ShieldAlert, Sparkles, User, Search
} from 'lucide-react';
import StatCard from '../UI/StatCard.jsx';
import MedicalReportView from '../UI/MedicalReportView.jsx';
import mriService from '../../services/mriService.js';

export default function MRIDashboard({
  cases = [],
  selectedCase,
  setSelectedCase,
  selectedReport,
  setSelectedReport,
  loading,
  setLoading,
  auth,
  API_BASE,
  getPriorityBadgeClass,
  getStatusBadgeClass,
  fetchDashboardData
}) {
  const [mriCases, setMriCases] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [radiologistObservation, setRadiologistObservation] = useState('');
  const [obsAction, setObsAction] = useState('Accept AI');
  const [showFullReport, setShowFullReport] = useState(false);
  const [activeViewMode, setActiveViewMode] = useState('heatmap'); // 'heatmap' | 'original'

  const getImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Filter cases for MRI modality
  useEffect(() => {
    const filtered = cases.filter(
      c => c.modality === 'MRI' || c.modality === 'Brain MRI'
    );
    setMriCases(filtered);
  }, [cases]);

  // When a case is selected, setup observation and report if already available
  useEffect(() => {
    if (selectedCase && selectedCase.radiologyReport) {
      setSelectedReport(selectedCase.radiologyReport);
      if (selectedCase.radiologyReport.radiologistObservation) {
        setRadiologistObservation(selectedCase.radiologyReport.radiologistObservation);
      }
    }
  }, [selectedCase, setSelectedReport]);

  // Dropzone setup
  const onDrop = React.useCallback((acceptedFiles) => {
    if (acceptedFiles && acceptedFiles[0]) {
      const file = acceptedFiles[0];
      setUploadFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.dcm', '.dicom']
    }
  });

  // Filtered list based on search query
  const displayedCases = mriCases.filter(c => {
    const q = searchQuery.toLowerCase();
    const caseId = (c.caseId || '').toLowerCase();
    const patientName = (c.patient?.name || '').toLowerCase();
    const patientId = (c.patient?.patientId || '').toLowerCase();
    return caseId.includes(q) || patientName.includes(q) || patientId.includes(q);
  });

  // Handlers
  const handleUploadAndRunAI = async () => {
    if (!selectedCase) {
      alert('Please select an MRI case from the queue first.');
      return;
    }
    if (!uploadFile) {
      alert('Please select an MRI scan file (.jpg, .png, .dcm) to upload.');
      return;
    }

    try {
      setLoading(true);
      const res = await mriService.uploadMRIScan(API_BASE, auth.token, selectedCase._id, uploadFile);
      if (res.success) {
        setSelectedReport(res.report);
        if (res.clinicalCase) {
          setSelectedCase(res.clinicalCase);
        }
        if (res.aiPrediction && res.aiPrediction.suggestedObservation) {
          setRadiologistObservation(res.aiPrediction.suggestedObservation);
        }
        if (fetchDashboardData) fetchDashboardData();
        alert('MRI scan ingested and analyzed successfully.');
      } else {
        alert(res.message || 'MRI analysis failed.');
      }
    } catch (err) {
      alert('MRI Upload & Analysis error: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitObservation = async (e) => {
    e.preventDefault();
    const reportId = selectedReport?._id || selectedCase?.radiologyReport?._id;
    if (!reportId) {
      alert('No active radiology report found for this case.');
      return;
    }

    try {
      setLoading(true);
      const res = await mriService.submitObservation(
        API_BASE,
        auth.token,
        reportId,
        radiologistObservation,
        obsAction
      );
      if (res.success) {
        alert('MRI Radiologist Review submitted successfully to the attending physician.');
        setRadiologistObservation('');
        setUploadFile(null);
        setPreviewUrl('');
        if (fetchDashboardData) fetchDashboardData();
      }
    } catch (err) {
      alert('Review submission failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const aiPrediction = selectedCase?.aiPrediction || selectedReport?.aiPrediction || {};
  const probabilities = aiPrediction.rawProbabilities || aiPrediction.probabilities || {};

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner / Telemetry */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Activity size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white font-display flex items-center gap-2">
                MRI Laboratory Workstation
                <span className="text-[10px] font-mono uppercase bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                  Neuro-Oncology
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Decision-support platform for brain tumor classification (Glioma, Meningioma, Pituitary, No Tumor)
              </p>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient or case ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pending MRI Requests"
          value={mriCases.filter(c => c.status === 'Awaiting Imaging').length}
          icon={Clock}
          colorClass="text-purple-400"
          sparklineColor="#a855f7"
        />
        <StatCard
          title="MRI Scans Ingested"
          value={mriCases.filter(c => c.status !== 'Awaiting Imaging' && c.status !== 'New Case').length}
          icon={CheckCircle}
          colorClass="text-brand-400"
          sparklineColor="#3A86FF"
        />
        <StatCard
          title="Model Architecture"
          value="EfficientNet-B0"
          icon={Cpu}
          colorClass="text-cyan-400"
          sparklineColor="#06b6d4"
        />
        <StatCard
          title="Classification Task"
          value="4 Classes"
          icon={Sparkles}
          colorClass="text-emerald-400"
          sparklineColor="#10b981"
        />
      </div>

      {/* Two Column Layout: Left Queue, Right Study Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: MRI Studies Queue (5 cols) */}
        <div className="lg:col-span-5 glass-panel p-5 rounded-2xl space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <h3 className="font-bold text-xs uppercase text-slate-300 flex items-center gap-2 font-display">
              <Clock size={14} className="text-purple-400" />
              Assigned MRI Studies ({displayedCases.length})
            </h3>
            {fetchDashboardData && (
              <button 
                onClick={fetchDashboardData}
                className="text-slate-400 hover:text-white transition p-1 hover:bg-white/5 rounded"
                title="Refresh queue"
              >
                <RefreshCw size={13} />
              </button>
            )}
          </div>

          {displayedCases.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No MRI clinical cases found. Doctors can assign cases with modality "MRI".
            </div>
          ) : (
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {displayedCases.map(c => {
                const isSelected = selectedCase?._id === c._id;
                return (
                  <div
                    key={c._id}
                    onClick={() => {
                      setSelectedCase(c);
                      if (c.radiologyReport) setSelectedReport(c.radiologyReport);
                      setUploadFile(null);
                      setPreviewUrl('');
                    }}
                    className={`p-3.5 rounded-xl border transition cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-500/50 shadow-md shadow-purple-900/20'
                        : 'bg-white/3 border-white/5 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="font-mono text-purple-400 font-bold">{c.caseId}</span>
                      <span className={`px-2 py-0.5 rounded-[5px] text-[8px] font-bold font-mono tracking-wider ${getPriorityBadgeClass(c.priorityLevel)}`}>
                        {c.priorityLevel}
                      </span>
                    </div>

                    <div className="text-white font-semibold font-display">
                      {c.patient?.name || 'Unknown Patient'}
                      <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                        ({c.patient?.age}y / {c.patient?.gender})
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                      {c.chiefComplaint || 'No complaint specified'}
                    </p>

                    <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-white/5 text-[10px]">
                      <span className="text-slate-500 font-mono">
                        {c.patient?.patientId}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold font-mono ${getStatusBadgeClass(c.status)}`}>
                        {c.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: MRI Study Workstation (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {!selectedCase ? (
            <div className="glass-panel p-12 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/20">
                <Activity size={24} />
              </div>
              <h4 className="text-sm font-bold text-white font-display">No Study Selected</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Select an MRI clinical case from the queue to view patient clinical history, upload an MRI scan, and run decision-support analysis.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Patient & Case Summary Panel */}
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <User size={15} className="text-purple-400" />
                    <span className="font-bold text-xs uppercase text-slate-200 font-display">
                      Patient & Clinical Context
                    </span>
                  </div>
                  <span className="font-mono text-xs text-slate-400">
                    Case: <strong className="text-white">{selectedCase.caseId}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/3 border border-white/5">
                    <span className="text-[10px] text-slate-400 block font-mono">Patient Name</span>
                    <span className="font-bold text-white font-display truncate block">{selectedCase.patient?.name}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/3 border border-white/5">
                    <span className="text-[10px] text-slate-400 block font-mono">ID / Age / Sex</span>
                    <span className="font-bold text-white font-mono">{selectedCase.patient?.patientId} ({selectedCase.patient?.age}y / {selectedCase.patient?.gender})</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/3 border border-white/5">
                    <span className="text-[10px] text-slate-400 block font-mono">Modality</span>
                    <span className="font-bold text-purple-400 font-mono">Brain MRI</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/3 border border-white/5">
                    <span className="text-[10px] text-slate-400 block font-mono">Ordering Physician</span>
                    <span className="font-bold text-white truncate block">{selectedCase.createdBy?.name || 'Dr. Physician'}</span>
                  </div>
                </div>

                {/* Clinical Notes & History */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/2 border border-white/5 space-y-1">
                    <span className="text-[10px] text-purple-300 font-mono font-semibold uppercase block">Chief Complaint</span>
                    <p className="text-slate-300 leading-relaxed">{selectedCase.chiefComplaint || 'None provided'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/2 border border-white/5 space-y-1">
                    <span className="text-[10px] text-purple-300 font-mono font-semibold uppercase block">Reason for Imaging</span>
                    <p className="text-slate-300 leading-relaxed">{selectedCase.reasonForImaging || selectedCase.clinicalNotes || 'Brain tumor evaluation'}</p>
                  </div>
                </div>

                {selectedCase.patient?.medicalHistory && (
                  <div className="p-3 rounded-xl bg-white/2 border border-white/5 text-xs space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono font-semibold uppercase block">Medical History</span>
                    <p className="text-slate-300">{selectedCase.patient.medicalHistory}</p>
                  </div>
                )}
              </div>

              {/* MRI Scan Ingestion & Upload Panel */}
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Upload size={15} className="text-purple-400" />
                    <span className="font-bold text-xs uppercase text-slate-200 font-display">
                      MRI Scan Ingestion
                    </span>
                  </div>
                  {selectedReport?.scanUrl && (
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle size={12} /> Scan Ingested
                    </span>
                  )}
                </div>

                {/* Dropzone */}
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer ${
                    isDragActive
                      ? 'border-purple-500 bg-purple-500/10'
                      : uploadFile
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-white/10 hover:border-white/20 bg-white/2'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload size={28} className="mx-auto mb-2 text-slate-400" />
                  {uploadFile ? (
                    <div>
                      <p className="text-xs font-semibold text-emerald-400 font-mono">{uploadFile.name}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{(uploadFile.size / 1024).toFixed(1)} KB — Click or drag to replace</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-white">Drag & drop Brain MRI scan here, or click to browse</p>
                      <p className="text-[10px] text-slate-400 mt-1">Accepts DICOM (.dcm), PNG, JPG, JPEG</p>
                    </div>
                  )}
                </div>

                {/* Action button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleUploadAndRunAI}
                    disabled={loading || !uploadFile}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      loading || !uploadFile
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30'
                    }`}
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Running EfficientNet-B0 Analysis...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Ingest & Run AI Analysis
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* MRI Structured AI Findings Panel */}
              {aiPrediction && aiPrediction.predictedDisease && (
                <div className="glass-panel p-5 rounded-2xl space-y-4 border border-purple-500/30">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-purple-400" />
                      <span className="font-bold text-xs uppercase text-slate-200 font-display">
                        AI Model Classification Findings
                      </span>
                    </div>
                    <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                      Task: Brain Tumor Classification
                    </span>
                  </div>

                  {/* Primary Prediction Banner - Strictly Probabilistic Wording */}
                  <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-purple-300 font-semibold block">
                        Predicted Category
                      </span>
                      <div className="text-xl font-bold text-white font-display mt-0.5">
                        {aiPrediction.predictedDisease}
                      </div>
                      <p className="text-xs text-purple-200/80 mt-1 font-mono">
                        Model probability for {aiPrediction.predictedDisease}:{' '}
                        <strong>{((aiPrediction.confidenceScore || 0) * 100).toFixed(1)}%</strong>
                      </p>
                    </div>

                    <div className="text-right">
                      <button
                        onClick={() => setShowFullReport(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <FileText size={13} /> View AI Report
                      </button>
                    </div>
                  </div>

                  {/* 4-Class Probability Distribution */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold block">
                      Class Probabilities
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {['Glioma', 'Meningioma', 'No Tumor', 'Pituitary'].map(cName => {
                        const prob = probabilities[cName] ?? probabilities[cName.toLowerCase()] ?? 0;
                        const pct = (prob * 100).toFixed(1);
                        const isTop = cName.toLowerCase() === (aiPrediction.predictedDisease || '').toLowerCase();
                        return (
                          <div
                            key={cName}
                            className={`p-2.5 rounded-xl border ${
                              isTop
                                ? 'bg-purple-500/10 border-purple-500/40'
                                : 'bg-white/2 border-white/5'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1 text-[11px]">
                              <span className={`font-semibold ${isTop ? 'text-purple-300' : 'text-slate-300'}`}>
                                {cName}
                              </span>
                              <span className="font-mono text-slate-400">{pct}%</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isTop ? 'bg-purple-500' : 'bg-slate-600'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grad-CAM Visual Explainability */}
                  {(aiPrediction.explainabilityHeatmap || aiPrediction.heatmapBase64 || selectedReport?.scanUrl) && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
                          Model Attention (Grad-CAM)
                        </span>
                        <div className="flex gap-1 text-[10px] font-mono">
                          <button
                            onClick={() => setActiveViewMode('heatmap')}
                            className={`px-2 py-0.5 rounded cursor-pointer ${
                              activeViewMode === 'heatmap' ? 'bg-purple-600 text-white' : 'bg-white/5 text-slate-400'
                            }`}
                          >
                            Heatmap
                          </button>
                          <button
                            onClick={() => setActiveViewMode('original')}
                            className={`px-2 py-0.5 rounded cursor-pointer ${
                              activeViewMode === 'original' ? 'bg-purple-600 text-white' : 'bg-white/5 text-slate-400'
                            }`}
                          >
                            Original
                          </button>
                        </div>
                      </div>

                      <div className="relative rounded-xl overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center min-h-[260px]">
                        {activeViewMode === 'heatmap' && (aiPrediction.heatmapBase64 || aiPrediction.explainabilityHeatmap) ? (
                          <img
                            src={
                              aiPrediction.heatmapBase64
                                ? (aiPrediction.heatmapBase64.startsWith('data:') ? aiPrediction.heatmapBase64 : `data:image/png;base64,${aiPrediction.heatmapBase64}`)
                                : getImageUrl(aiPrediction.explainabilityHeatmap)
                            }
                            alt="Grad-CAM MRI Heatmap"
                            className="max-h-[340px] w-auto object-contain rounded-lg"
                          />
                        ) : (
                          <img
                            src={previewUrl || getImageUrl(selectedReport?.scanUrl || aiPrediction.explainabilityHeatmap)}
                            alt="Original MRI"
                            className="max-h-[340px] w-auto object-contain rounded-lg"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Medical Safety Disclaimer */}
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <strong className="block text-[11px] uppercase tracking-wider font-mono">
                        AI Decision Support Prototype
                      </strong>
                      <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                        This tool assists radiological review and does not constitute a clinical diagnosis. Model probabilities reflect statistical patterns, not clinical certainty. All findings must be clinically verified and confirmed by a licensed medical professional.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Radiologist Review & Final Decision Form */}
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-purple-400" />
                    <span className="font-bold text-xs uppercase text-slate-200 font-display">
                      Radiologist Review & Confirmation
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Status: <strong className="text-white">{selectedCase.status}</strong>
                  </span>
                </div>

                <form onSubmit={handleSubmitObservation} className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                      Radiologist Clinical Observation Notes
                    </label>
                    <textarea
                      rows={4}
                      value={radiologistObservation}
                      onChange={(e) => setRadiologistObservation(e.target.value)}
                      placeholder="Document verified anatomical observations, tumor location, margins, mass effect, or discrepancies with AI findings..."
                      className="w-full p-3 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono">Action:</span>
                      {['Accept AI', 'Modify AI', 'Reject AI'].map(action => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => setObsAction(action)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            obsAction === action
                              ? action === 'Reject AI'
                                ? 'bg-rose-500 text-white'
                                : 'bg-purple-600 text-white'
                              : 'bg-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          {action}
                        </button>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !radiologistObservation.trim()}
                      className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        loading || !radiologistObservation.trim()
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                      }`}
                    >
                      <CheckCircle size={14} />
                      Submit Radiologist Review
                    </button>
                  </div>
                </form>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Full Medical Report Modal */}
      {showFullReport && selectedCase && (
        <MedicalReportView
          patient={selectedCase.patient}
          caseData={selectedCase}
          reportData={selectedReport}
          onClose={() => setShowFullReport(false)}
        />
      )}
    </div>
  );
}
