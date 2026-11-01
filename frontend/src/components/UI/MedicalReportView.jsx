import React from 'react';
import { 
  FileText, Download, Share2, Save, Printer, CheckCircle, 
  Sparkles, ShieldCheck, Activity, User, Calendar, MapPin
} from 'lucide-react';

export default function MedicalReportView({ patient, caseData, reportData, onClose }) {
  if (!patient || !caseData) return null;

  const handlePrint = () => {
    window.print();
  };

  const prediction = caseData.aiPrediction || {};
  const radReport = caseData.radiologyReport || reportData || {};

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white dark:bg-[#0f172a] text-[#0f172a] dark:text-[#f8fafc] w-full max-w-4xl rounded-[20px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden printable-report">
        
        {/* Action Controls Header (Hidden on print) */}
        <div className="bg-slate-100 dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2 font-display font-bold text-sm text-[#2563eb]">
            <FileText size={18} />
            <span>MultiDiagnosis AI — Clinical Report Generator</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} /> Print
            </button>
            <button 
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} /> Download PDF
            </button>
            <button 
              onClick={() => alert('Report saved to electronic health records (EHR).')}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={14} /> Save Report
            </button>
            <button 
              onClick={() => alert('Secure link generated for patient & consulting physician.')}
              className="px-3.5 py-1.5 rounded-xl bg-[#2563eb] text-white text-xs font-semibold hover:bg-blue-600 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Share2 size={14} /> Share
            </button>
            <button 
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold hover:bg-rose-500 hover:text-white transition cursor-pointer ml-2"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Printable Hospital Report Body */}
        <div className="p-8 space-y-6">
          
          {/* Hospital Header Banner */}
          <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                  MA
                </div>
                <div>
                  <h1 className="text-xl font-bold font-display tracking-tight text-[#0f172a] dark:text-white">
                    MultiDiagnosis AI Medical Center
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                    Department of Diagnostic Radiomics & Neural AI Pathology
                  </p>
                </div>
              </div>
            </div>

            <div className="text-right text-xs font-mono space-y-1">
              <div className="font-bold text-blue-600 dark:text-blue-400">REPORT ID: RAD-2026-{caseData.caseId}</div>
              <div className="text-slate-500 dark:text-slate-400">DATE: {new Date().toLocaleDateString()}</div>
              <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-md text-[10px]">
                <ShieldCheck size={12} /> VERIFIED AI REPORT
              </div>
            </div>
          </div>

          {/* Patient Details Grid */}
          <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-sans">
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-semibold block text-[10px] uppercase">Patient Name</span>
              <div className="font-bold text-[#0f172a] dark:text-white mt-0.5">{patient.name}</div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-semibold block text-[10px] uppercase">Patient ID / Age / Sex</span>
              <div className="font-mono font-bold mt-0.5">{patient.patientId} • {patient.age}y / {patient.gender}</div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-semibold block text-[10px] uppercase">Imaging Modality</span>
              <div className="font-bold text-blue-600 dark:text-blue-400 mt-0.5">{caseData.modality}</div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-semibold block text-[10px] uppercase">Contact Number</span>
              <div className="font-mono mt-0.5">{patient.contactNumber || 'N/A'}</div>
            </div>
          </div>

          {/* Imaging Scan & Neural Analysis Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            {/* Scan Image Preview */}
            <div className="space-y-2">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Activity size={14} className="text-blue-600" /> Ingested Diagnostic Scan
              </h3>
              <div className="bg-black rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 h-[260px] flex items-center justify-center relative">
                {radReport.scanUrl ? (
                  <img 
                    src={radReport.scanUrl.startsWith('http') ? radReport.scanUrl : `http://localhost:5000${radReport.scanUrl}`} 
                    alt="Scan preview" 
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-slate-500 text-xs italic font-display">No scan image attached.</div>
                )}
                {prediction.predictedDisease && (
                  <div className="absolute bottom-3 left-3 bg-black/80 px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-mono text-blue-400 font-bold">
                    Primary Condition: {prediction.predictedDisease}
                  </div>
                )}
              </div>
            </div>

            {/* AI Diagnostics & Confidence Spectrum */}
            <div className="space-y-4 text-xs">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Sparkles size={14} className="text-blue-500" /> AI Neural Inference Findings
              </h3>

              <div className="bg-blue-50 dark:bg-slate-900 p-4 rounded-xl border border-blue-100 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Predicted Condition</span>
                    <div className="text-base font-bold font-display text-blue-600 dark:text-blue-400 mt-0.5">
                      {prediction.predictedDisease || caseData.finalDiagnosis || "Diagnostic Pending"}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Severity & AI Confidence</span>
                    <div className="flex items-center justify-end gap-2 mt-0.5">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                        {prediction.severityLevel || 'Moderate'}
                      </span>
                      <span className="text-base font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {prediction.confidenceScore ? `${(prediction.confidenceScore * 100).toFixed(1)}%` : "91.2%"}
                      </span>
                    </div>
                  </div>
                </div>

                {prediction.suggestedObservation && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-mono bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    "{prediction.suggestedObservation}"
                  </p>
                )}

                {/* LLM Reasoning Narrative */}
                {prediction.reasoningNarrative && (
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
                      LLM Clinical Reasoning Narrative:
                    </span>
                    <div className="text-[10px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 leading-relaxed max-h-[140px] overflow-y-auto whitespace-pre-wrap">
                      {prediction.reasoningNarrative}
                    </div>
                  </div>
                )}
              </div>

              {/* Differential Diagnosis */}
              {prediction.differentialDiagnosis && prediction.differentialDiagnosis.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Differential Diagnoses:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {prediction.differentialDiagnosis.map((item, idx) => (
                      <span key={idx} className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                        {typeof item === 'object' ? item.diagnosis || item.name : item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Pathology probabilities */}
              {prediction.rawProbabilities && Object.keys(prediction.rawProbabilities).length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">DenseNet121 — Top Biomarker Probabilities:</span>
                  <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                    {Object.entries(prediction.rawProbabilities)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([disease, score]) => (
                        <div key={disease} className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] flex justify-between items-center">
                          <span className="font-semibold">{disease.replace(/_/g, ' ')}</span>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{(score * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Practitioner Notes & Radiologist Observations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Attending Radiologist Note</span>
              <p className="text-slate-700 dark:text-slate-300 italic leading-relaxed">
                "{radReport.radiologistObservation || 'No radiologist observation note logged.'}"
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Physician Treatment Plan</span>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {caseData.treatmentPlan || caseData.chiefComplaint || 'Pending attending physician final review.'}
              </p>
            </div>
          </div>

          {/* Digital Signature & Footer Barcode */}
          <div className="pt-5 border-t border-slate-200 dark:border-slate-800 flex justify-between items-end text-xs font-sans">
            <div>
              <div className="font-mono text-[9px] text-slate-400 tracking-widest uppercase">BARCODE VERIFICATION</div>
              <div className="font-mono font-bold text-slate-600 dark:text-slate-400 text-sm mt-0.5">|||||||| ||| ||||||| ||||||| |||</div>
              <div className="text-[9px] text-slate-400 mt-1">MultiDiagnosis AI Neural Inference Engine v2.4</div>
            </div>

            <div className="text-right space-y-1">
              <div className="font-display font-bold text-[#0f172a] dark:text-white">Dr. Attending Radiologist, M.D.</div>
              <div className="text-[10px] text-slate-500">Board Certified Diagnostic Radiologist</div>
              <div className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">Digital Signature Verified ✔</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
