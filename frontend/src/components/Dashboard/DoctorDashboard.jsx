import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Calendar, FileText, Heart, Plus, Search, 
  UserPlus, Sliders, ChevronRight, Activity, Bell, Info,
  Trash2, RotateCcw, Archive, Cpu, Sparkles
} from 'lucide-react';
import StatCard from '../UI/StatCard.jsx';
import DICOMViewer from '../DICOMViewer.jsx';
import CausalDAGViewer from '../CausalDAGViewer.jsx';

export default function DoctorDashboard({
  activeTab, setActiveTab,
  patients, selectedPatient, setSelectedPatient,
  cases, selectedCase, setSelectedCase,
  appointments,
  caseNotes, newNote, setNewNote,
  searchQuery, setSearchQuery,
  casesFilter, setCasesFilter,
  
  // Register Patient states
  patName, setPatName, patAge, setPatAge, patGender, setPatGender,
  patContact, setPatContact, patAddress, setPatAddress, patEmergency, setPatEmergency,
  patHistory, setPatHistory, patSymptoms, setPatSymptoms, patTemp, setPatTemp,
  patPulse, setPatPulse, patBpSys, setPatBpSys, patBpDia, setPatBpDia, patSpo2, setPatSpo2,
  
  // Create Case states
  caseModality, setCaseModality, caseComplaint, setCaseComplaint,
  caseNotesText, setCaseNotesText, caseImagingReason, setCaseImagingReason,
  casePriority, setCasePriority,
  
  // Radiologist assignment states
  radiologistsList, selectedRadiologist, setSelectedRadiologist,
  radioSearchQuery, setRadioSearchQuery,
  
  // Final submit states
  docFinalDiagnosis, setDocFinalDiagnosis, docTreatmentPlan, setDocTreatmentPlan,
  docPrescription, setDocPrescription, docFollowUp, setDocFollowUp,
  
  // Handlers
  handleRegisterPatient,
  handleTemporaryDeletePatient,
  handleRestorePatient,
  handleCreateCase,
  handleAddDoctorNote,
  handleDoctorFinalSubmit,
  fetchCaseNotes,
  
  // Badges & helpers
  getPriorityBadgeClass,
  getStatusBadgeClass,
  timelineStages,
  getStageIndex,
  API_BASE,
  getAxiosConfig
}) {

  const [patientStatusFilter, setPatientStatusFilter] = useState('active'); // 'active' | 'archived' | 'all'

  const activePatientsCount = patients.filter(p => !p.isDeleted).length;
  const archivedPatientsCount = patients.filter(p => p.isDeleted).length;

  const filteredPatients = patients.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = p.name.toLowerCase().includes(q) || p.patientId.toLowerCase().includes(q);
    if (patientStatusFilter === 'active') return matchesQuery && !p.isDeleted;
    if (patientStatusFilter === 'archived') return matchesQuery && p.isDeleted;
    return matchesQuery;
  });

  const filteredCases = cases.filter(c => {
    if (casesFilter === 'All') return true;
    return c.status === casesFilter;
  });

  return (
    <div className="space-y-6">
      
      {/* ==================== TAB: OVERVIEW ==================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Telemetry Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Today's Active Patients" 
              value={patients.length} 
              icon={Users} 
              colorClass="text-cyan-400"
              sparklineColor="#00c6ff"
            />
            <StatCard 
              title="Consultations Booked" 
              value={appointments.length} 
              icon={Calendar} 
              colorClass="text-brand-400"
              sparklineColor="#3A86FF"
            />
            <StatCard 
              title="Pending Reviews" 
              value={cases.filter(c => c.status === 'Doctor Review Pending').length} 
              icon={Bell} 
              colorClass="text-rose-400"
              sparklineColor="#EF4444"
            />
            <StatCard 
              title="Registered Health Records" 
              value={patients.length} 
              icon={FileText} 
              colorClass="text-emerald-400"
              sparklineColor="#10B981"
            />
          </div>

          {/* Consultation lists and case registers */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Consultation calendar */}
            <div className="lg:col-span-5 glass-panel p-5 rounded-2xl space-y-4">
              <h3 className="font-bold text-xs uppercase text-slate-300 flex items-center gap-2 border-b border-white/5 pb-2.5 font-display">
                <Calendar size={14} className="text-cyan-400" />
                Scheduled Consultations ({appointments.length})
              </h3>
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {appointments.map(app => (
                  <div key={app._id} className="p-3.5 bg-[#061826]/60 rounded-xl border border-white/5 text-xs hover:border-white/10 transition">
                    <div className="flex justify-between font-mono text-[9px] text-slate-500">
                      <span>{new Date(app.appointmentDate).toLocaleString()}</span>
                      <span className="text-cyan-400 font-bold uppercase tracking-wider">{app.status}</span>
                    </div>
                    <div className="font-bold text-white mt-1.5 font-display">{app.patient?.name}</div>
                    <div className="text-slate-400 mt-1 leading-relaxed">Reason: {app.reason}</div>
                  </div>
                ))}
                {appointments.length === 0 && (
                  <div className="text-center text-slate-500 py-12 text-xs italic font-display">No consultations booked.</div>
                )}
              </div>
            </div>

            {/* Case Registry */}
            <div className="lg:col-span-7 glass-panel p-5 rounded-2xl space-y-4">
              <h3 className="font-bold text-xs uppercase text-slate-300 flex items-center gap-2 border-b border-white/5 pb-2.5 font-display">
                <Sliders size={14} className="text-cyan-400" />
                Attending Case Registry Queue
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {['All', 'Awaiting Imaging', 'Doctor Review Pending', 'Treatment Completed'].map(f => (
                  <button
                    key={f} 
                    onClick={() => setCasesFilter(f)}
                    className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all border ${
                      casesFilter === f 
                        ? 'bg-gradient-to-r from-cyan-500 to-brand-500 text-white border-cyan-500 shadow-md shadow-cyan-500/10' 
                        : 'bg-white/3 text-slate-400 border-white/5 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {filteredCases.map(c => (
                  <div 
                    key={c._id} 
                    onClick={() => { setSelectedCase(c); fetchCaseNotes(c._id); setActiveTab('workstation'); }}
                    className="p-4 bg-[#061826]/60 rounded-xl border border-white/5 hover:border-cyan-400/40 transition cursor-pointer flex justify-between items-center text-xs"
                  >
                    <div>
                      <div className="flex gap-3 text-[9px] font-mono text-slate-500">
                        <span>CASE: {c.caseId}</span>
                        <span>MODALITY: {c.modality}</span>
                      </div>
                      <div className="font-bold text-white mt-1 font-display">{c.patient?.name}</div>
                      <p className="text-slate-400 italic text-[11px] mt-1.5 leading-relaxed font-sans">
                        "{c.chiefComplaint}"
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-0.5 rounded-[6px] text-[9px] font-bold font-mono tracking-wider ${getPriorityBadgeClass(c.priorityLevel)}`}>
                        {c.priorityLevel}
                      </span>
                      <span className={`px-2 py-0.5 rounded-[6px] text-[9px] font-bold font-mono tracking-wider ${getStatusBadgeClass(c.status)}`}>
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
                {filteredCases.length === 0 && (
                  <div className="text-center text-slate-500 py-12 text-xs italic font-display">No cases matching filter in queue.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==================== TAB: REGISTER PATIENT ==================== */}
      {activeTab === 'register_patient' && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto glass-panel p-6 rounded-2xl space-y-6"
        >
          <div className="border-b border-white/5 pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <UserPlus size={18} className="text-cyan-400" />
                Register New Patient Record
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-sans font-medium">Create a new secure patient file including vital metrics.</p>
            </div>
            <button 
              type="button"
              onClick={() => setActiveTab('overview')}
              className="glass-btn-secondary px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase cursor-pointer"
            >
              ← Cancel
            </button>
          </div>

          <form onSubmit={handleRegisterPatient} className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">Patient Full Name</label>
                <input type="text" required value={patName} onChange={e => setPatName(e.target.value)} placeholder="Eleanor Vance" className="w-full glass-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1.5 font-semibold">Age</label>
                  <input type="number" required value={patAge} onChange={e => setPatAge(e.target.value)} placeholder="45" className="w-full glass-input" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1.5 font-semibold">Gender</label>
                  <select value={patGender} onChange={e => setPatGender(e.target.value)} className="w-full glass-input">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">Primary Contact Number</label>
                <input type="text" required value={patContact} onChange={e => setPatContact(e.target.value)} placeholder="+1-555-0199" className="w-full glass-input" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">Emergency Contact</label>
                <input type="text" value={patEmergency} onChange={e => setPatEmergency(e.target.value)} placeholder="Robert Vance (+1-555-0200)" className="w-full glass-input" />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5 font-semibold">Residential Address</label>
              <input type="text" value={patAddress} onChange={e => setPatAddress(e.target.value)} placeholder="742 Evergreen Terrace, Springfield" className="w-full glass-input" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">Medical History Notes</label>
                <textarea rows="3" value={patHistory} onChange={e => setPatHistory(e.target.value)} placeholder="Mild asthma, seasonal allergies." className="w-full glass-input" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">Current Symptoms</label>
                <textarea rows="3" value={patSymptoms} onChange={e => setPatSymptoms(e.target.value)} placeholder="Dry cough, mild dyspnea." className="w-full glass-input" />
              </div>
            </div>

            {/* Vitals */}
            <div className="p-4 bg-[#061826]/60 rounded-2xl border border-white/5">
              <div className="text-[10px] text-cyan-400 font-bold uppercase mb-3.5 tracking-widest font-mono">
                Patient Vitals Metrics Ingestion
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-[10px] font-mono">
                <div>
                  <span className="text-slate-400 block mb-1">Temp (°C)</span>
                  <input type="number" step="0.1" value={patTemp} onChange={e => setPatTemp(e.target.value)} className="w-full glass-input py-1.5 text-center" />
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Pulse (bpm)</span>
                  <input type="number" value={patPulse} onChange={e => setPatPulse(e.target.value)} className="w-full glass-input py-1.5 text-center" />
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">BP Systolic</span>
                  <input type="number" value={patBpSys} onChange={e => setPatBpSys(e.target.value)} className="w-full glass-input py-1.5 text-center" />
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">BP Diastolic</span>
                  <input type="number" value={patBpDia} onChange={e => setPatBpDia(e.target.value)} className="w-full glass-input py-1.5 text-center" />
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">SpO2 (%)</span>
                  <input type="number" value={patSpo2} onChange={e => setPatSpo2(e.target.value)} className="w-full glass-input py-1.5 text-center" />
                </div>
              </div>
            </div>

            <button type="submit" className="w-full glass-btn-primary py-3 font-semibold text-xs tracking-wider cursor-pointer shadow-lg shadow-cyan-500/10">
              Register Patient & Generate Digital ID
            </button>
          </form>
        </motion.div>
      )}

      {/* ==================== TAB: SEARCH PATIENTS ==================== */}
      {activeTab === 'search_patient' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <Search size={18} className="text-cyan-400" />
                Patient & Case Registry Search
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-sans font-medium">Lookup patient files, view medical charts, and allocate clinical case files.</p>
            </div>
            <button 
              type="button"
              onClick={() => setActiveTab('overview')}
              className="glass-btn-secondary px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase cursor-pointer"
            >
              ← Back to Overview
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left search directories */}
          <div className="lg:col-span-5 glass-panel p-5 rounded-2xl space-y-4">
            <div className="relative">
              <input 
                type="text" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by Patient Name or ID..." 
                className="w-full glass-input pl-10 py-2.5 text-xs focus:ring-1 focus:ring-cyan-400/40"
              />
              <Search className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
            </div>

            {/* Active vs Archived Filter Toggle */}
            <div className="flex gap-1.5 p-1 bg-[#040e17] rounded-xl border border-white/5 text-[10px]">
              <button
                type="button"
                onClick={() => setPatientStatusFilter('active')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  patientStatusFilter === 'active'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users size={12} /> Active ({activePatientsCount})
              </button>
              <button
                type="button"
                onClick={() => setPatientStatusFilter('archived')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  patientStatusFilter === 'archived'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Archive size={12} /> Deleted ({archivedPatientsCount})
              </button>
              <button
                type="button"
                onClick={() => setPatientStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  patientStatusFilter === 'all'
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {filteredPatients.map(p => (
                <div
                  key={p._id} 
                  onClick={() => setSelectedPatient(p)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer text-xs ${
                    selectedPatient?._id === p._id 
                      ? 'bg-cyan-950/15 border-cyan-500/40' 
                      : 'bg-[#061826]/60 border-white/5 hover:bg-[#102a43]/50'
                  }`}
                >
                  <div className="flex justify-between font-mono text-[9px] text-cyan-400 font-bold">
                    <span>ID: {p.patientId}</span>
                    <span className="flex items-center gap-1.5">
                      {p.isDeleted && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[8px] font-sans">
                          Deleted
                        </span>
                      )}
                      <span>{p.gender} • {p.age}y</span>
                    </span>
                  </div>
                  <div className="font-bold text-white mt-1.5 font-display flex items-center justify-between">
                    <span>{p.name}</span>
                    {p.isDeleted && <Trash2 size={11} className="text-amber-400" />}
                  </div>
                  <div className="text-slate-500 text-[10px] truncate mt-1">{p.address}</div>
                </div>
              ))}
              {filteredPatients.length === 0 && (
                <div className="text-center text-slate-500 py-12 italic font-display">
                  {patientStatusFilter === 'archived' ? 'No temporarily deleted patients.' : 'No patient records found.'}
                </div>
              )}
            </div>
          </div>

          {/* Right patient detail summary */}
          <div className="lg:col-span-7 glass-panel p-5 rounded-2xl space-y-4">
            {selectedPatient ? (
              <div className="space-y-6">
                {selectedPatient.isDeleted && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Archive size={16} className="text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold">Temporarily Deleted Record</span>
                        <p className="text-[10px] text-amber-300/80">Deleted on {selectedPatient.deletedAt ? new Date(selectedPatient.deletedAt).toLocaleDateString() : 'recent date'}. You can restore this patient record anytime.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestorePatient(selectedPatient._id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition"
                    >
                      <RotateCcw size={12} /> Restore Record
                    </button>
                  </div>
                )}

                <div className="border-b border-white/5 pb-4 flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-white font-display flex items-center gap-2">
                      {selectedPatient.name}
                      {selectedPatient.isDeleted && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Archived
                        </span>
                      )}
                    </h2>
                    <span className="text-[9px] font-mono text-cyan-400 font-bold tracking-wider">HEALTH ID: {selectedPatient.patientId}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!selectedPatient.isDeleted ? (
                      <>
                        <button 
                          onClick={() => setActiveTab('create_case')} 
                          className="glass-btn-primary py-2 text-[10px] font-semibold flex items-center gap-1.5 shadow-md cursor-pointer"
                        >
                          <Plus size={12} /> Create Clinical Case
                        </button>
                        <button
                          onClick={() => handleTemporaryDeletePatient(selectedPatient._id)}
                          className="px-3 py-2 rounded-xl text-[10px] font-semibold flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                          title="Temporarily delete patient record"
                        >
                          <Trash2 size={12} /> Temporarily Delete
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleRestorePatient(selectedPatient._id)}
                        className="px-3 py-2 rounded-xl text-[10px] font-semibold flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
                        title="Restore patient record"
                      >
                        <RotateCcw size={12} /> Restore Patient
                      </button>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                  <div>
                    <span className="text-slate-500 block font-semibold mb-0.5">Residential Address:</span>
                    <span className="text-slate-200">{selectedPatient.address}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-semibold mb-0.5">Contact Information:</span>
                    <span className="text-slate-200">{selectedPatient.contactNumber}</span>
                  </div>
                </div>

                {/* Vitals telemetry */}
                {selectedPatient.vitalSigns && (
                  <div className="p-3.5 bg-[#061826]/70 rounded-xl border border-white/5 text-[9px] font-mono text-slate-400 grid grid-cols-5 gap-2 text-center shadow-inner">
                    <div><span className="text-slate-500 block mb-0.5">TEMP</span> <span className="text-slate-200 font-bold">{selectedPatient.vitalSigns.temperature}°C</span></div>
                    <div><span className="text-slate-500 block mb-0.5">PULSE</span> <span className="text-slate-200 font-bold">{selectedPatient.vitalSigns.heartRate} bpm</span></div>
                    <div><span className="text-slate-500 block mb-0.5">SYS</span> <span className="text-slate-200 font-bold">{selectedPatient.vitalSigns.bpSystolic}</span></div>
                    <div><span className="text-slate-500 block mb-0.5">DIA</span> <span className="text-slate-200 font-bold">{selectedPatient.vitalSigns.bpDiastolic}</span></div>
                    <div><span className="text-slate-500 block mb-0.5">SPO2</span> <span className="text-cyan-400 font-bold">{selectedPatient.vitalSigns.spo2}%</span></div>
                  </div>
                )}

                {/* Case histories timeline */}
                <div className="space-y-3">
                  <span className="text-slate-500 text-[10px] uppercase font-mono tracking-widest font-bold block">
                    Clinical Cases Ledger
                  </span>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {cases.filter(c => c.patient?._id === selectedPatient._id).map(c => (
                      <div key={c._id} className="p-3.5 bg-[#061826]/40 rounded-xl border border-white/5 flex justify-between items-center text-xs hover:border-white/10 transition">
                        <div>
                          <div className="font-mono text-[9px] text-cyan-400 font-bold">{c.caseId} ({c.modality})</div>
                          <div className="text-white font-semibold mt-1 font-display">{c.chiefComplaint}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-[5px] text-[8px] font-bold font-mono tracking-wider ${getStatusBadgeClass(c.status)}`}>
                          {c.status}
                        </span>
                      </div>
                    ))}
                    {cases.filter(c => c.patient?._id === selectedPatient._id).length === 0 && (
                      <div className="text-center text-slate-500 py-6 text-xs italic font-display">No cases logged for this record.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-16 text-xs italic font-display flex flex-col items-center justify-center gap-2">
                <Info size={24} className="text-slate-600" />
                Select a patient record from the list to display health histories.
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {/* ==================== TAB: CREATE CASE ==================== */}
      {activeTab === 'create_case' && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto glass-panel p-6 rounded-2xl space-y-6"
        >
          {selectedPatient ? (
            <>
              <div className="border-b border-white/5 pb-3 flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2 font-display">
                    <Sliders size={18} className="text-cyan-400" />
                    Allocate Clinical Case File
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 font-sans font-medium">Creating medical case file for: <strong className="text-slate-200">{selectedPatient.name}</strong> ({selectedPatient.patientId})</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setActiveTab('search_patient')}
                  className="glass-btn-secondary px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase cursor-pointer"
                >
                  ← Back to Search
                </button>
              </div>

              <form onSubmit={handleCreateCase} className="space-y-4 text-xs font-sans">
                
                {/* Radiologist selection */}
                <div className="p-4 bg-[#061826]/60 rounded-2xl border border-white/5 space-y-3">
                  <label className="block text-slate-400 font-semibold mb-1">Search & Assign Radiologist / Diagnostic Lab</label>
                  <input 
                    type="text" 
                    value={radioSearchQuery} 
                    onChange={e => setRadioSearchQuery(e.target.value)} 
                    placeholder="Type radiologist name to filter..." 
                    className="w-full glass-input py-2 text-xs focus:ring-1 focus:ring-cyan-400/40"
                  />
                  <select 
                    value={selectedRadiologist} 
                    onChange={e => setSelectedRadiologist(e.target.value)} 
                    className="w-full glass-input text-xs"
                  >
                    <option value="">-- Select Radiologist / Diagnostic Lab --</option>
                    {radiologistsList
                      .filter(r => r.name.toLowerCase().includes(radioSearchQuery.toLowerCase()))
                      .map(rad => (
                        <option key={rad._id} value={rad._id}>{rad.name} ({rad.department || 'Radiology'})</option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-semibold">Modality Selection</label>
                    <select value={caseModality} onChange={e => setCaseModality(e.target.value)} className="w-full glass-input">
                      <option value="Chest X-ray">Chest X-ray</option>
                      <option value="CT Scan">CT Scan</option>
                      <option value="MRI">MRI Scan</option>
                      <option value="Ultrasound">Ultrasound</option>
                      <option value="Mammography">Mammography</option>
                      <option value="Dental X-ray">Dental X-ray</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-semibold">Triage Priority Level</label>
                    <select value={casePriority} onChange={e => setCasePriority(e.target.value)} className="w-full glass-input font-bold text-cyan-400">
                      <option value="Routine">Routine</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5 font-semibold">Chief Complaint</label>
                  <input type="text" required value={caseComplaint} onChange={e => setCaseComplaint(e.target.value)} placeholder="Chest congestion, dyspnea for 3 days" className="w-full glass-input" />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5 font-semibold">Imaging Observation Request Reason</label>
                  <textarea rows="3" required value={caseImagingReason} onChange={e => setCaseImagingReason(e.target.value)} placeholder="Check for right lower lobe opacities or consolidation." className="w-full glass-input" />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5 font-semibold">Clinical Admission Notes</label>
                  <textarea rows="2" value={caseNotesText} onChange={e => setCaseNotesText(e.target.value)} placeholder="Patient has lisinopril therapy, no recent cardiovascular reports." className="w-full glass-input" />
                </div>

                <button type="submit" className="w-full glass-btn-primary py-3 font-semibold text-xs cursor-pointer shadow-lg shadow-cyan-500/10">
                  Allocate Case & Set Status: "Awaiting Imaging"
                </button>
              </form>
            </>
          ) : (
            <div className="text-center text-slate-500 py-12 text-xs italic font-display flex flex-col items-center justify-center gap-4">
              <div className="flex flex-col items-center justify-center gap-2">
                <Info size={24} className="text-slate-600" />
                <span>No active patient selected. Go to <button onClick={() => setActiveTab('search_patient')} className="text-cyan-400 underline cursor-pointer font-bold">Search Patient</button> first.</span>
              </div>
              <button 
                type="button"
                onClick={() => setActiveTab('overview')}
                className="glass-btn-secondary px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase cursor-pointer"
              >
                ← Back to Overview
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* ==================== TAB: WORKSTATION ==================== */}
      {activeTab === 'workstation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Workstation Queue list (Sticky & Constrained) */}
          <div className="lg:col-span-3.5 lg:col-span-4 glass-panel p-5 rounded-2xl space-y-4 sticky top-20">
            <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
              <h3 className="font-bold text-xs uppercase text-slate-300 flex items-center gap-2 font-display">
                <Sliders size={14} className="text-cyan-400" />
                Workstation Queue
              </h3>
              <span className="text-[10px] font-mono text-cyan-400 font-bold px-2 py-0.5 rounded-md bg-cyan-950/40 border border-cyan-500/20">
                {cases.length} Active
              </span>
            </div>
            <div className="space-y-2.5 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
              {cases.map(c => (
                <button
                  key={c._id} 
                  onClick={() => { setSelectedCase(c); fetchCaseNotes(c._id); }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs flex flex-col gap-1.5 cursor-pointer ${
                    selectedCase?._id === c._id 
                      ? 'bg-cyan-950/25 border-cyan-400/60 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30' 
                      : 'bg-[#061826]/40 border-white/5 hover:border-white/15 hover:bg-[#061826]/70'
                  }`}
                >
                  <div className="flex justify-between w-full font-mono text-[8px] text-slate-500 font-bold">
                    <span>ID: {c.caseId}</span>
                    <span>{c.modality}</span>
                  </div>
                  <div className="font-bold text-white font-display truncate w-full">{c.patient?.name}</div>
                  <div className="flex justify-between items-center mt-1">
                    <span className={`inline-block px-2 py-0.5 rounded-[5px] text-[8px] font-bold font-mono tracking-wider ${getStatusBadgeClass(c.status)}`}>
                      {c.status}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono ${getPriorityBadgeClass(c.priorityLevel)}`}>
                      {c.priorityLevel}
                    </span>
                  </div>
                </button>
              ))}
              {cases.length === 0 && (
                <div className="text-center text-slate-500 py-12 italic font-display">Workstation queue empty.</div>
              )}
            </div>
          </div>

          {/* Right Column: Main Case Workspace (Pure Vertical Expansion Stream) */}
          <div className="lg:col-span-8.5 lg:col-span-8 vertical-workspace-stream">
            {selectedCase ? (
              <div className="vertical-workspace-stream report-expanded-card">
                
                {/* Back button and case header */}
                <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white font-display">Case Workspace: {selectedCase.patient?.name}</h2>
                      <span className={`px-2 py-0.5 rounded-[6px] text-[9px] font-bold font-mono tracking-wider ${getStatusBadgeClass(selectedCase.status)}`}>
                        {selectedCase.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">
                      Case ID: <span className="text-cyan-400 font-bold">{selectedCase.caseId}</span> • Modality: <span className="text-slate-200">{selectedCase.modality}</span> • Priority: <span className="text-amber-400">{selectedCase.priorityLevel}</span>
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setSelectedCase(null)}
                    className="glass-btn-secondary px-3.5 py-2 rounded-xl text-[10px] font-bold tracking-wider uppercase cursor-pointer flex items-center gap-1.5 hover:bg-white/10"
                  >
                    ← Close Case & Return
                  </button>
                </div>
                
                {/* Case Progression timeline */}
                <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3">
                  <h3 className="text-slate-400 text-[10px] uppercase font-mono tracking-wider font-bold">Case Progression Lifecycle</h3>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                    {timelineStages.map((stage, idx) => {
                      const activeStageIdx = getStageIndex(selectedCase.status);
                      const isCompleted = idx < activeStageIdx;
                      const isActive = idx === activeStageIdx;

                      return (
                        <div key={stage} className="flex flex-col items-center text-center relative">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center border font-mono text-[10px] font-bold z-10 transition duration-300 ${
                            isCompleted 
                              ? 'bg-emerald-500 border-emerald-400 text-white shadow-sm' 
                              : isActive 
                                ? 'bg-cyan-950 border-cyan-400 text-cyan-400 animate-pulse shadow-[0_0_14px_rgba(0,198,255,0.3)]' 
                                : 'bg-white/3 border-white/5 text-slate-500'
                          }`}>
                            {idx + 1}
                          </div>
                          <span className={`text-[8px] font-bold mt-2 max-w-[80px] leading-tight font-display ${
                            isActive ? 'text-cyan-400' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                          }`}>
                            {stage}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* DICOM viewer & DAG sliders */}
                {selectedCase.radiologyReport && selectedCase.radiologyReport.scanUrl && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    <DICOMViewer 
                      scanUrl={selectedCase.radiologyReport.scanUrl}
                      boundingBoxes={selectedCase.aiPrediction?.boundingBoxes || []}
                      dicomMetadata={selectedCase.radiologyReport.dicomMetadata || {}}
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
                )}

                {/* Clean Vertical Stack for Diagnostic Findings & AI Analysis */}
                <div className="vertical-workspace-stream">
                  
                  {/* Radiology report card */}
                  <div className="glass-panel p-5 rounded-2xl space-y-4 w-full">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                      <h3 className="font-bold text-xs uppercase text-slate-300 flex items-center gap-2 font-display">
                        <FileText size={14} className="text-cyan-400" />
                        Radiology Report Findings
                      </h3>
                      {selectedCase.radiologyReport && (
                        <span className="text-[10px] font-mono text-cyan-400 font-bold px-2 py-0.5 rounded-md bg-cyan-950/40 border border-cyan-500/20">
                          PACS Status: {selectedCase.radiologyReport.status}
                        </span>
                      )}
                    </div>
                    {selectedCase.radiologyReport ? (
                      <div className="space-y-3">
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Attending Observation Note:</span>
                          <p className="bg-[#061826]/75 p-4 rounded-xl border border-white/5 text-slate-200 text-xs italic leading-relaxed">
                            "{selectedCase.radiologyReport.radiologistObservation || 'No observation note logged yet.'}"
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-500 py-6 text-center italic font-display text-xs">
                        Awaiting scan ingestion and diagnostic observation from Radiology team.
                      </div>
                    )}
                  </div>

                  {/* AI Decision Support Draft */}
                  <div className="glass-panel p-5 rounded-2xl space-y-4 w-full">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                      <h3 className="font-bold text-xs uppercase text-cyan-400 flex items-center gap-2 font-display">
                        <Cpu size={14} className="text-cyan-400 animate-pulse" />
                        AI Decision Support Diagnostic Draft
                      </h3>
                      {selectedCase.aiPrediction && (
                        <span className="text-[10px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded-md bg-emerald-950/40 border border-emerald-500/20">
                          Inference Complete
                        </span>
                      )}
                    </div>

                    {selectedCase.aiPrediction ? (
                      <div className="space-y-4 text-xs font-sans">
                        
                        {/* Disease summary header row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#061826]/80 p-4 rounded-xl border border-white/5">
                          <div>
                            <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider block mb-0.5">Primary Predicted Condition</span>
                            <div className="font-bold text-white text-sm font-display text-cyan-300">{selectedCase.aiPrediction.predictedDisease}</div>
                          </div>
                          <div className="sm:text-right">
                            <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider block mb-0.5">Confidence Metric</span>
                            <div className="font-bold text-cyan-400 text-sm font-number">{(selectedCase.aiPrediction.confidenceScore * 100).toFixed(1)}%</div>
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">AI Findings Description:</span>
                          <p className="text-slate-300 leading-relaxed text-[11px] bg-[#061826]/50 p-3.5 rounded-xl border border-white/5 font-mono">
                            {selectedCase.aiPrediction.suggestedObservation}
                          </p>
                        </div>

                        {selectedCase.aiPrediction.reasoningNarrative && (
                          <div className="pt-2">
                            <span className="text-cyan-400 text-[10px] font-bold block font-display uppercase tracking-wider mb-1.5">
                              LLM Clinical Reasoning Narrative ({selectedCase.aiPrediction.llmModelUsed || selectedCase.aiPrediction.reasoningSource || 'Active Provider'}):
                            </span>
                            <div className="text-slate-200 leading-relaxed text-[11px] bg-[#04121e]/90 p-4 rounded-xl border border-cyan-500/20 font-sans whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                              {selectedCase.aiPrediction.reasoningNarrative}
                            </div>
                          </div>
                        )}

                        {/* 14 Pathology Vision Model Probabilities Spectrum (Expands downward vertically) */}
                        {selectedCase.aiPrediction.rawProbabilities && Object.keys(selectedCase.aiPrediction.rawProbabilities).length > 0 && (
                          <div className="pt-3.5 border-t border-white/5 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-cyan-400 text-[10px] font-bold font-display uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles size={12} className="text-cyan-400" />
                                DenseNet121 — 14 Pathology Disease Output (Raw Model Probabilities)
                              </span>
                              <span className="text-[9px] font-mono text-slate-400">CUDA Forward Pass</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                              {Object.entries(selectedCase.aiPrediction.rawProbabilities)
                                .sort((a, b) => b[1] - a[1])
                                .map(([diseaseName, probScore]) => {
                                  const probPercent = (probScore * 100).toFixed(1);
                                  const isHigh = probScore >= 0.70;
                                  const isMod = probScore >= 0.40 && probScore < 0.70;
                                  return (
                                    <div key={diseaseName} className="p-2.5 bg-[#04121e]/80 rounded-xl border border-white/5 space-y-1.5 text-[10px]">
                                      <div className="flex justify-between items-center font-semibold">
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

                        {selectedCase.aiPrediction.differentialDiagnosis && selectedCase.aiPrediction.differentialDiagnosis.length > 0 && (
                          <div className="pt-2">
                            <span className="text-slate-400 text-[10px] font-bold block mb-1.5 uppercase tracking-wider">Differential Diagnoses Spectrum:</span>
                            <div className="flex flex-wrap gap-2">
                              {selectedCase.aiPrediction.differentialDiagnosis.map((d, idx) => {
                                const label = typeof d === 'object' && d !== null ? (d.diagnosis || d.name || d.disease || JSON.stringify(d)) : String(d);
                                const prob = (typeof d === 'object' && d !== null && d.probability) ? ` (${(d.probability * 100).toFixed(0)}%)` : '';
                                return (
                                  <span key={idx} className="bg-[#061826] border border-white/10 px-3 py-1 rounded-xl text-[10px] text-slate-200 font-mono font-medium shadow-sm">
                                    {label}{prob}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {selectedCase.aiPrediction.indicators && Object.keys(selectedCase.aiPrediction.indicators).length > 0 && (
                          <div className="pt-3.5 border-t border-white/5">
                            <span className="text-slate-400 text-[10px] block font-bold mb-2 uppercase tracking-wider">Clinical Features & Telemetry Indicators:</span>
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
                    ) : (
                      <div className="text-slate-500 py-8 text-center italic font-display text-xs">
                        Neural network analysis has not run for this case.
                      </div>
                    )}
                  </div>

                </div>

                {/* Session Notes ledger */}
                <div className="glass-panel p-5 rounded-2xl space-y-4 text-xs font-sans w-full">
                  <h3 className="font-bold text-xs uppercase text-slate-300 font-display flex items-center gap-2 border-b border-white/5 pb-2.5">
                    <FileText size={14} className="text-cyan-400" />
                    Practitioner Session Notes Log
                  </h3>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {caseNotes.map(n => (
                      <div key={n._id} className="p-3.5 bg-[#061826]/60 rounded-xl border border-white/5 space-y-1">
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono font-semibold">
                          <span className="text-cyan-400">{n.doctor?.name}</span>
                          <span>{new Date(n.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-200 leading-relaxed">"{n.noteText}"</p>
                      </div>
                    ))}
                    {caseNotes.length === 0 && (
                      <div className="text-center text-slate-500 italic py-4 font-display">No clinical session notes logged yet.</div>
                    )}
                  </div>
                  <form onSubmit={handleAddDoctorNote} className="flex gap-2 pt-1">
                    <input 
                      type="text" 
                      value={newNote} 
                      onChange={e => setNewNote(e.target.value)}
                      placeholder="Add symptom progress, telemetry notes or clinical observations..." 
                      className="flex-1 glass-input text-xs"
                    />
                    <button type="submit" className="glass-btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap">
                      Add Note
                    </button>
                  </form>
                </div>

                {/* Doctor final treatment submission form (Expands downwards vertically) */}
                {selectedCase.status === 'Doctor Review Pending' && (
                  <div className="glass-panel p-6 rounded-2xl border border-cyan-500/30 space-y-5 text-xs font-sans shadow-xl shadow-cyan-500/5 w-full report-expanded-card">
                    <div className="border-b border-white/5 pb-3">
                      <h3 className="font-bold text-sm text-cyan-400 flex items-center gap-2 font-display">
                        <Heart size={16} className="text-rose-500 animate-pulse" />
                        Final Diagnostics & Practitioner Treatment Plan
                      </h3>
                      <p className="text-slate-400 text-[11px] mt-0.5">Finalize diagnosis, treatment instructions, and prescription schedule to resolve case file.</p>
                    </div>

                    <form onSubmit={handleDoctorFinalSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-slate-300 mb-1.5 font-semibold">Attending Diagnosis Definition</label>
                          <input type="text" required value={docFinalDiagnosis} onChange={e => setDocFinalDiagnosis(e.target.value)} placeholder="Confirmed Right Lower Lobe Atypical Pneumonia" className="w-full glass-input" />
                        </div>
                        <div>
                          <label className="block text-slate-300 mb-1.5 font-semibold">Follow-Up Instructions</label>
                          <input type="text" required value={docFollowUp} onChange={e => setDocFollowUp(e.target.value)} placeholder="Repeat chest X-ray in 4 weeks. Primary consult in 7 days." className="w-full glass-input" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-slate-300 mb-1.5 font-semibold">Prescription Dosage Schedule</label>
                          <textarea rows="3" required value={docPrescription} onChange={e => setDocPrescription(e.target.value)} placeholder="Azithromycin 250mg orally once daily for 5 days. Monitor for allergies." className="w-full glass-input" />
                        </div>
                        <div>
                          <label className="block text-slate-300 mb-1.5 font-semibold">Clinical Treatment Plan Summary</label>
                          <textarea rows="3" required value={docTreatmentPlan} onChange={e => setDocTreatmentPlan(e.target.value)} placeholder="Rest, hydration, empiric antibiotic therapy, trigger pulmonology referral if SpO2 drops below 92%." className="w-full glass-input" />
                        </div>
                      </div>

                      <button type="submit" className="w-full glass-btn-primary py-3.5 font-bold text-xs tracking-wider cursor-pointer shadow-lg bg-emerald-600 hover:bg-emerald-500 border-none transition-all duration-200">
                        Submit Final Care Plan & Close Case File
                      </button>
                    </form>
                  </div>
                )}

              </div>
            ) : (
              <div className="glass-panel p-16 text-center text-slate-500 text-xs rounded-2xl italic font-display flex flex-col items-center justify-center gap-3 border border-white/5">
                <Info size={28} className="text-cyan-400/60" />
                <span>No active clinical case loaded. Select a case from the workstation queue on the left to begin diagnosis.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB: APPOINTMENTS ==================== */}
      {activeTab === 'appointments' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <Calendar size={18} className="text-cyan-400" />
                Scheduled Consultations & Booking
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-sans font-medium">Manage booked clinic hours, view calendar agendas, and schedule follow-ups.</p>
            </div>
            <button 
              type="button"
              onClick={() => setActiveTab('overview')}
              className="glass-btn-secondary px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase cursor-pointer"
            >
              ← Back to Overview
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
          {/* Schedule form */}
          <div className="lg:col-span-5 glass-panel p-5 rounded-2xl space-y-4 text-xs">
            <h3 className="font-bold text-xs uppercase text-slate-300 flex items-center gap-2 border-b border-white/5 pb-2.5 font-display">
              <Calendar size={14} className="text-cyan-400" />
              Schedule Consultations
            </h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const targetPatId = e.target.patientSelect.value;
              const dateVal = e.target.appointmentDate.value;
              const reasonVal = e.target.reason.value;
              
              try {
                const res = await axios.post(`${API_BASE}/patients/appointments`, {
                  patientId: targetPatId,
                  appointmentDate: dateVal,
                  reason: reasonVal
                }, getAxiosConfig());
                if (res.data.success) {
                  alert('Appointment scheduled successfully!');
                  e.target.reset();
                  // Re-fetch handled by parent context
                }
              } catch (err) { alert(err.message); }
            }} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">Select Patient Record</label>
                <select name="patientSelect" required className="w-full glass-input">
                  {patients.map(p => (
                    <option key={p._id} value={p._id}>{p.name} ({p.patientId})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">Consultation Date & Time</label>
                <input type="datetime-local" name="appointmentDate" required className="w-full glass-input" />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">Reason for Consultation</label>
                <textarea rows="3" name="reason" required placeholder="Routine asthma checkup, diagnostic scan review..." className="w-full glass-input" />
              </div>

              <button type="submit" className="w-full glass-btn-primary py-3 font-semibold text-xs tracking-wider cursor-pointer shadow-lg shadow-cyan-500/10">
                Book Consultation Appointment
              </button>
            </form>
          </div>

          {/* Appointments list */}
          <div className="lg:col-span-7 glass-panel p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5 font-display">
              Consultations Schedule
            </h3>
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {appointments.map(app => (
                <div key={app._id} className="p-4 bg-[#061826]/60 border border-white/5 rounded-xl text-xs flex justify-between items-center hover:border-white/10 transition">
                  <div>
                    <span className="font-mono text-[9px] text-cyan-400 font-bold">{new Date(app.appointmentDate).toLocaleString()}</span>
                    <div className="font-bold text-white mt-1.5 font-display">{app.patient?.name}</div>
                    <div className="text-slate-400 mt-1 leading-relaxed">Reason: {app.reason}</div>
                  </div>
                  <span className="bg-cyan-950/20 text-cyan-400 border border-cyan-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-display uppercase tracking-wider">{app.status}</span>
                </div>
              ))}
              {appointments.length === 0 && (
                <div className="text-center text-slate-500 py-12 italic font-display">No scheduled consultations.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    </div>
  );
}
