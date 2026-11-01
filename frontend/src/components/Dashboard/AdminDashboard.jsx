import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, UserCheck, ShieldCheck, Cpu, Settings, Trash, 
  RefreshCcw, ShieldCheck as SecureIcon, Clock, Plus, BarChart2, UserPlus 
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import StatCard from '../UI/StatCard.jsx';

export default function AdminDashboard({
  activeTab,
  setActiveTab,
  analytics,
  appointments,
  auditLogs,
  users,
  pendingUsers,
  gpuMetrics,
  deptList,
  setDeptList,
  resetPassUserId,
  setResetPassUserId,
  newPasswordValue,
  setNewPasswordValue,
  newDeptName,
  setNewDeptName,
  patients = [],
  cases = [],
  
  // Register patient props
  patName, setPatName, patAge, setPatAge, patGender, setPatGender,
  patContact, setPatContact, patAddress, setPatAddress, patEmergency, setPatEmergency,
  patHistory, setPatHistory, patSymptoms, setPatSymptoms, patTemp, setPatTemp,
  patPulse, setPatPulse, patBpSys, setPatBpSys, patBpDia, setPatBpDia, patSpo2, setPatSpo2,
  handleRegisterPatient,
  
  // Actions
  handleApproveClinician,
  handleSuspendUser,
  handleUnsuspendUser,
  handleResetPassword,
  handleAddDept,
  
  // Badge helpers
  getPriorityBadgeClass,
  getStatusBadgeClass
}) {

  // Recharts structured data for training curve
  const epochData = [
    { epoch: 'E1', accuracy: 62.4, loss: 0.85 },
    { epoch: 'E2', accuracy: 70.1, loss: 0.68 },
    { epoch: 'E3', accuracy: 78.5, loss: 0.51 },
    { epoch: 'E4', accuracy: 82.3, loss: 0.42 },
    { epoch: 'E5', accuracy: 86.8, loss: 0.33 },
    { epoch: 'E6', accuracy: 89.2, loss: 0.28 },
    { epoch: 'E7', accuracy: 91.5, loss: 0.22 },
    { epoch: 'E8', accuracy: 92.9, loss: 0.19 },
    { epoch: 'E9', accuracy: 93.8, loss: 0.16 },
    { epoch: 'E10', accuracy: 94.2, loss: 0.14 }
  ];

  return (
    <div className="space-y-6">
      
      {/* ==================== TAB: OVERVIEW & ANALYTICS ==================== */}
      {(activeTab === 'overview' || activeTab === 'analytics') && (
        <div className="space-y-6 font-sans">
          {/* Stats card grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Total Attended Patients" 
              value={analytics?.stats?.totalPatients || patients.length || 0} 
              icon={Users} 
              colorClass="text-cyan-400"
              sparklineColor="#00c6ff"
            />
            <StatCard 
              title="Registered Doctors" 
              value={analytics?.stats?.totalDoctors || users.filter(u => u.role === 'Doctor').length || 0} 
              icon={UserCheck} 
              colorClass="text-brand-400"
              sparklineColor="#3A86FF"
            />
            <StatCard 
              title="Clinical Radiologists" 
              value={analytics?.stats?.totalRadiologists || users.filter(u => u.role === 'Radiologist').length || 0} 
              icon={Cpu} 
              colorClass="text-indigo-400"
              sparklineColor="#7B61FF"
            />
            <StatCard 
              title="Today's Cases Allocated" 
              value={analytics?.stats?.todaysCases || cases.length || 0} 
              icon={Clock} 
              colorClass="text-cyan-400"
              sparklineColor="#00c6ff"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <StatCard 
              title="Completed Diagnoses" 
              value={analytics?.stats?.completedCasesCount || cases.filter(c => c.status === 'Treatment Completed').length || 0} 
              icon={CheckCircleIcon} 
              colorClass="text-emerald-400"
              sparklineColor="#10B981"
            />
            <StatCard 
              title="Avg AI Inference Accuracy" 
              value={(analytics?.modelMetrics?.aiSuccessRate * 100) || 98.4} 
              icon={SecureIcon} 
              colorClass="text-cyan-400"
              sparklineColor="#00c6ff"
            />
            <div className="glass-card p-5 flex flex-col justify-center items-center text-center h-[155px]">
              <span className="text-slate-400 text-[10px] uppercase font-mono tracking-wider font-semibold">Active System Uptime</span>
              <div className="text-xl font-mono font-bold text-cyan-400 mt-3 tracking-tight filter drop-shadow-[0_0_8px_rgba(0,198,255,0.2)]">
                {analytics?.modelMetrics?.systemUptime || '14d 6h 12m'}
              </div>
              <span className="text-[9px] text-slate-500 font-mono mt-1">PACS / API Synced</span>
            </div>
          </div>

          {/* Interactive Recharts graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Accuracy epochs plot */}
            <div className="lg:col-span-7 glass-panel p-5 rounded-2xl space-y-4">
              <h4 className="font-bold text-slate-300 text-xs uppercase font-mono tracking-wider">
                Model Loss & Accuracy Curves (10 Epoch Training Trace)
              </h4>
              <div className="h-[210px] w-full bg-[#061826]/40 rounded-xl p-2 border border-white/5">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={epochData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00c6ff" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#00c6ff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="epoch" stroke="#475569" fontSize={9} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={9} tickLine={false} domain={[50, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#0b253a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff' }} />
                    <Area type="monotone" dataKey="accuracy" name="Accuracy (%)" stroke="#00c6ff" strokeWidth={2} fillOpacity={1} fill="url(#colorAcc)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Confusion matrix */}
            <div className="lg:col-span-5 glass-panel p-5 rounded-2xl space-y-4">
              <h4 className="font-bold text-slate-300 text-xs uppercase font-mono tracking-wider">
                DenseNet121 Confusion Matrix (Validation Group)
              </h4>
              <div className="bg-[#061826]/50 border border-white/5 rounded-2xl p-4 h-[210px] flex items-center justify-center shadow-inner">
                <div className="grid grid-cols-2 gap-3 text-center w-full max-w-[280px] text-xs">
                  <div className="bg-[#102a43]/60 p-3.5 border border-white/5 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">True Pos (TP)</div>
                    <div className="text-xl font-bold text-cyan-400 font-number mt-1.5 filter drop-shadow-[0_0_6px_rgba(0,198,255,0.2)]">142</div>
                  </div>
                  <div className="bg-[#102a43]/60 p-3.5 border border-white/5 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">False Neg (FN)</div>
                    <div className="text-xl font-bold text-rose-400 font-number mt-1.5">8</div>
                  </div>
                  <div className="bg-[#102a43]/60 p-3.5 border border-white/5 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">False Pos (FP)</div>
                    <div className="text-xl font-bold text-rose-400 font-number mt-1.5">9</div>
                  </div>
                  <div className="bg-[#102a43]/60 p-3.5 border border-white/5 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">True Neg (TN)</div>
                    <div className="text-xl font-bold text-emerald-400 font-number mt-1.5">161</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==================== TAB: PATIENTS DIRECTORY ==================== */}
      {activeTab === 'patients' && (
        <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4 font-sans">
          <div className="border-b border-white/5 pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <Users className="text-cyan-400" size={18} />
                Hospital Master Patients Directory
              </h2>
              <p className="text-xs text-slate-400 mt-1">System-wide registry of registered patient records and clinical history files.</p>
            </div>
            {setActiveTab && (
              <button 
                onClick={() => setActiveTab('register_patient')} 
                className="glass-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <UserPlus size={14} /> Add New Patient
              </button>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                  <th className="py-3 px-3">Patient ID</th>
                  <th className="py-3 px-3">Full Name</th>
                  <th className="py-3 px-3">Age / Gender</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Emergency Contact</th>
                  <th className="py-3 px-3">Record Status</th>
                </tr>
              </thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p._id} className="border-b border-white/5 hover:bg-[#102a43]/20 transition">
                    <td className="py-3.5 px-3 text-cyan-400 font-mono font-bold text-[10px]">{p.patientId}</td>
                    <td className="py-3.5 px-3 text-white font-semibold font-display">{p.name}</td>
                    <td className="py-3.5 px-3 text-slate-300 font-mono">{p.age} yrs / {p.gender}</td>
                    <td className="py-3.5 px-3 text-slate-400 font-mono">{p.contactNumber}</td>
                    <td className="py-3.5 px-3 text-slate-400">{p.emergencyContact || 'N/A'}</td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider font-display ${
                        p.isDeleted ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {p.isDeleted ? 'ARCHIVED' : 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
                {patients.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-500 italic font-display">No patient records registered in database.</td>
                  </tr>
                )}
              </tbody>
            </table>
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
              onClick={() => setActiveTab('patients')}
              className="glass-btn-secondary px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase cursor-pointer"
            >
              ← Cancel
            </button>
          </div>

          {handleRegisterPatient ? (
            <form onSubmit={handleRegisterPatient} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1.5 font-semibold">Patient Full Name</label>
                  <input type="text" required value={patName || ''} onChange={e => setPatName(e.target.value)} placeholder="Eleanor Vance" className="w-full glass-input" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-semibold">Age</label>
                    <input type="number" required value={patAge || ''} onChange={e => setPatAge(e.target.value)} placeholder="45" className="w-full glass-input" />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-semibold">Gender</label>
                    <select value={patGender || 'Male'} onChange={e => setPatGender(e.target.value)} className="w-full glass-input">
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
                  <input type="text" required value={patContact || ''} onChange={e => setPatContact(e.target.value)} placeholder="+1-555-0199" className="w-full glass-input" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1.5 font-semibold">Emergency Contact</label>
                  <input type="text" value={patEmergency || ''} onChange={e => setPatEmergency(e.target.value)} placeholder="Robert Vance (+1-555-0200)" className="w-full glass-input" />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">Residential Address</label>
                <input type="text" value={patAddress || ''} onChange={e => setPatAddress(e.target.value)} placeholder="742 Evergreen Terrace, Springfield" className="w-full glass-input" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1.5 font-semibold">Medical History Notes</label>
                  <textarea rows="3" value={patHistory || ''} onChange={e => setPatHistory(e.target.value)} placeholder="Mild asthma, seasonal allergies." className="w-full glass-input" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1.5 font-semibold">Current Symptoms</label>
                  <textarea rows="3" value={patSymptoms || ''} onChange={e => setPatSymptoms(e.target.value)} placeholder="Dry cough, mild dyspnea." className="w-full glass-input" />
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
                    <input type="number" step="0.1" value={patTemp || 37.0} onChange={e => setPatTemp(e.target.value)} className="w-full glass-input py-1.5 text-center" />
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Pulse (bpm)</span>
                    <input type="number" value={patPulse || 78} onChange={e => setPatPulse(e.target.value)} className="w-full glass-input py-1.5 text-center" />
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">BP Systolic</span>
                    <input type="number" value={patBpSys || 120} onChange={e => setPatBpSys(e.target.value)} className="w-full glass-input py-1.5 text-center" />
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">BP Diastolic</span>
                    <input type="number" value={patBpDia || 80} onChange={e => setPatBpDia(e.target.value)} className="w-full glass-input py-1.5 text-center" />
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">SpO2 (%)</span>
                    <input type="number" value={patSpo2 || 98} onChange={e => setPatSpo2(e.target.value)} className="w-full glass-input py-1.5 text-center" />
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full glass-btn-primary py-3 font-semibold text-xs tracking-wider cursor-pointer shadow-lg shadow-cyan-500/10">
                Register Patient & Generate Digital ID
              </button>
            </form>
          ) : null}
        </motion.div>
      )}

      {/* ==================== TAB: USER MANAGEMENT & DOCTORS ==================== */}
      {(activeTab === 'user_management' || activeTab === 'doctors') && (
        <div className="space-y-6 font-sans">
          
          {/* Approvals ledger */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5 font-display">
              Clinician Workspace Approval Ledger
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Degree Certificate</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map(user => (
                    <tr key={user._id} className="border-b border-white/5 hover:bg-[#102a43]/20 transition">
                      <td className="py-3 px-3 font-semibold text-white font-display">{user.name}</td>
                      <td className="py-3 px-3 text-slate-400 font-mono">{user.email}</td>
                      <td className="py-3 px-3">
                        <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider font-display">
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{user.department}</td>
                      <td className="py-3 px-3">
                        {user.degreeCertificate ? (
                          <button
                            onClick={() => {
                              const win = window.open();
                              if (win) {
                                win.document.write(`<iframe src="${user.degreeCertificate}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                              }
                            }}
                            className="px-2.5 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/40 rounded-lg text-[10px] font-semibold hover:bg-blue-600/40 transition cursor-pointer flex items-center gap-1"
                          >
                            📄 View Degree Certificate
                          </button>
                        ) : (
                          <span className="text-slate-500 italic text-[10px]">No file</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleApproveClinician(user._id)}
                          className="glass-btn-primary text-[10px] py-1.5 px-3 cursor-pointer shadow-md"
                        >
                          Verify & Authorize Doctor
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pendingUsers.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-slate-500 italic font-display">No clinician registrations awaiting administrator credentials check.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Practitioner Directory registry */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5 font-display">
              System Practitioner Registries Directory
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Practitioner</th>
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Security status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user._id} className="border-b border-white/5 hover:bg-[#102a43]/20 transition">
                      <td className="py-3 px-3 font-semibold text-white font-display">{user.name}</td>
                      <td className="py-3 px-3 text-slate-400 font-mono">{user.email}</td>
                      <td className="py-3 px-3">
                        <span className="bg-white/4 border border-white/5 px-2.5 py-0.5 rounded-full text-[9px] font-bold text-slate-300 uppercase tracking-wider font-display">{user.role}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider font-display ${
                          user.isSuspended 
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {user.isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right flex justify-end gap-2">
                        {user.isSuspended ? (
                          <button onClick={() => handleUnsuspendUser(user._id)} className="text-[10px] bg-emerald-600/90 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-500 transition cursor-pointer">Activate</button>
                        ) : (
                          user.role !== 'Admin' && <button onClick={() => handleSuspendUser(user._id)} className="text-[10px] bg-rose-600/90 text-white px-2.5 py-1 rounded-lg hover:bg-rose-500 transition cursor-pointer">Suspend</button>
                        )}
                        <button onClick={() => { setResetPassUserId(user._id); alert(`Reset password session initiated for ${user.name}`); }} className="text-[10px] bg-white/4 border border-white/5 text-slate-300 px-2.5 py-1 rounded-lg hover:bg-white/8 transition cursor-pointer">Reset Pass</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Reset password form */}
            {resetPassUserId && (
              <form onSubmit={handleResetPassword} className="p-4 bg-[#061826]/75 rounded-2xl border border-white/5 flex items-end gap-4 mt-4">
                <div className="flex-1">
                  <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Reset Password credentials value</label>
                  <input 
                    type="password" 
                    required 
                    value={newPasswordValue} 
                    onChange={e => setNewPasswordValue(e.target.value)}
                    placeholder="Enter new credentials string" 
                    className="w-full glass-input py-1.5 text-xs"
                  />
                </div>
                <button type="submit" className="glass-btn-primary py-2.5 text-xs cursor-pointer shadow-md">Submit Reset</button>
                <button onClick={() => setResetPassUserId('')} className="glass-btn-secondary py-2.5 text-xs cursor-pointer">Cancel</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB: MODALITY CASES (X-RAY, CT SCAN, MRI) ==================== */}
      {(activeTab === 'xray' || activeTab === 'ctscan' || activeTab === 'mri') && (
        <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4 font-sans">
          <div className="border-b border-white/5 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2 font-display">
              <Cpu className="text-cyan-400" size={18} />
              {activeTab === 'xray' ? 'Chest X-Ray' : activeTab === 'ctscan' ? 'CT Scan' : 'MRI'} Diagnostic Scans & PACS Cases Overview
            </h2>
            <p className="text-xs text-slate-400 mt-1">Hospital imaging cases assigned to {activeTab.toUpperCase()} modality workflow.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                  <th className="py-3 px-3">Case ID</th>
                  <th className="py-3 px-3">Patient Record</th>
                  <th className="py-3 px-3">Modality</th>
                  <th className="py-3 px-3">Priority Level</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {cases.filter(c => {
                  const mod = c.modality.toLowerCase();
                  if (activeTab === 'xray') return mod.includes('x-ray') || mod.includes('xray');
                  if (activeTab === 'ctscan') return mod.includes('ct');
                  if (activeTab === 'mri') return mod.includes('mri');
                  return true;
                }).map(c => (
                  <tr key={c._id} className="border-b border-white/5 hover:bg-[#102a43]/20 transition">
                    <td className="py-3.5 px-3 text-cyan-400 font-mono font-bold text-[10px]">{c.caseId}</td>
                    <td className="py-3.5 px-3 text-white font-semibold font-display">{c.patient?.name || 'N/A'}</td>
                    <td className="py-3.5 px-3 text-slate-300 font-mono">{c.modality}</td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold font-mono ${getPriorityBadgeClass(c.priorityLevel)}`}>
                        {c.priorityLevel}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold font-mono ${getStatusBadgeClass(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {cases.filter(c => {
                  const mod = c.modality.toLowerCase();
                  if (activeTab === 'xray') return mod.includes('x-ray') || mod.includes('xray');
                  if (activeTab === 'ctscan') return mod.includes('ct');
                  if (activeTab === 'mri') return mod.includes('mri');
                  return true;
                }).length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-500 italic font-display">No cases logged for this modality.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB: HIPAA AUDIT LOGS & REPORTS ==================== */}
      {(activeTab === 'audit_logs' || activeTab === 'reports') && (
        <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4 font-sans">
          <div className="border-b border-white/5 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2 font-display">
              <SecureIcon className="text-cyan-400 animate-pulse" size={18} />
              HIPAA Ledger Audit Tracking & PHI Access Trace
            </h2>
            <p className="text-xs text-slate-400 mt-1">Strict tamper-proof traces recording clinical lookups, diagnostic uploads, and credentials adjustments.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Accessor</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">HIPAA Log details</th>
                  <th className="py-3 px-3 font-mono">Network IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log._id} className="border-b border-white/5 hover:bg-[#102a43]/20 transition">
                    <td className="py-3.5 px-3 text-slate-500 font-mono text-[10px]">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="py-3.5 px-3 text-slate-200 font-semibold font-display">{log.userName}</td>
                    <td className="py-3.5 px-3 text-slate-400 font-medium">{log.userRole}</td>
                    <td className="py-3.5 px-3">
                      <span className="bg-[#061826] text-cyan-400 px-2 py-0.5 rounded-lg font-mono text-[9px] border border-cyan-400/25">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-300">{log.details}</td>
                    <td className="py-3.5 px-3 text-slate-500 font-mono text-[10px]">{log.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB: AI MODELS & HARDWARE TELEMETRY ==================== */}
      {(activeTab === 'ai_models' || activeTab === 'workstation') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs font-sans">
          {/* GPU Hardware */}
          <div className="lg:col-span-4 glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
            <h3 className="font-bold text-xs uppercase text-slate-300 flex items-center gap-1.5 border-b border-white/5 pb-2.5 font-display">
              <Cpu size={14} className="text-cyan-400 animate-pulse" />
              GPU Hardware Telemetry
            </h3>
            <div className="space-y-4 font-mono">
              <div className="bg-[#061826]/60 p-4 rounded-xl border border-white/5 shadow-inner">
                <div className="flex justify-between mb-2 text-slate-400">
                  <span className="font-bold">Core Temperature</span>
                  <span className="text-cyan-400 font-bold">{gpuMetrics.temp} °C</span>
                </div>
                <div className="w-full bg-[#061826] h-2 rounded-full overflow-hidden border border-white/5">
                  <div className="bg-gradient-to-r from-cyan-400 to-brand-500 h-full" style={{ width: `${(gpuMetrics.temp / 90)*100}%` }}></div>
                </div>
              </div>

              <div className="bg-[#061826]/60 p-4 rounded-xl border border-white/5 shadow-inner">
                <div className="flex justify-between mb-2 text-slate-400">
                  <span className="font-bold">Video Load</span>
                  <span className="text-cyan-400 font-bold">{gpuMetrics.load} %</span>
                </div>
                <div className="w-full bg-[#061826] h-2 rounded-full overflow-hidden border border-white/5">
                  <div className="bg-cyan-400 h-full animate-pulse" style={{ width: `${gpuMetrics.load}%` }}></div>
                </div>
              </div>

              <div className="bg-[#061826]/60 p-4 rounded-xl border border-white/5 shadow-inner">
                <div className="flex justify-between mb-2 text-slate-400">
                  <span className="font-bold">VRAM Allocation</span>
                  <span className="text-cyan-400 font-bold">{gpuMetrics.memory} / 16.0 GB</span>
                </div>
                <div className="w-full bg-[#061826] h-2 rounded-full overflow-hidden border border-white/5">
                  <div className="bg-gradient-to-r from-brand-500 to-indigo-500 h-full" style={{ width: `${(gpuMetrics.memory / 16.0)*100}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Model registries */}
          <div className="lg:col-span-8 glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
            <h3 className="font-bold text-xs uppercase text-slate-300 flex items-center gap-2 border-b border-white/5 pb-2.5 font-display">
              <Cpu size={14} className="text-cyan-400" />
              Inference AI Models Weights registries
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Model Engine</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Storage Size</th>
                    <th className="py-2.5 px-3">Model Details</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics?.modelMetrics?.datasetVersions?.map((d, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-[#102a43]/20 transition">
                      <td className="py-3 px-3 text-white font-bold font-mono">{d.version}</td>
                      <td className="py-3 px-3 text-slate-400 font-mono text-[10px]">{d.date}</td>
                      <td className="py-3 px-3 text-slate-400 font-mono">{d.size}</td>
                      <td className="py-3 px-3 text-slate-300 font-display font-medium">{d.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="flex gap-2 pt-3 justify-end">
              <button className="glass-btn-secondary text-[10px] py-2 flex items-center gap-1.5 hover:bg-white/8 cursor-pointer"><RefreshCcw size={11}/> Pull PubMed Guidelines</button>
              <button className="glass-btn-primary text-[10px] py-2 cursor-pointer shadow-md">Deploy New Weights Version</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB: SETTINGS ==================== */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs font-sans">
          
          {/* Departments List */}
          <div className="lg:col-span-6 glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
            <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5 font-display">
              Hospital Departments Configuration
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {deptList.map((d, idx) => (
                <div key={idx} className="p-3.5 bg-[#061826]/60 border border-white/5 rounded-2xl flex justify-between items-center hover:border-white/10 transition">
                  <span className="font-semibold text-white font-display">{d}</span>
                  <button 
                    onClick={() => {
                      if (confirm(`Remove department ${d}?`)) {
                        setDeptList(prev => prev.filter(dept => dept !== d));
                      }
                    }}
                    className="text-rose-400 hover:text-rose-500 cursor-pointer p-1 hover:bg-white/5 rounded-lg transition"
                  >
                    <Trash size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add department form */}
          <div className="lg:col-span-6 glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
            <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5 font-display">
              Register Hospital Department
            </h3>
            <form onSubmit={handleAddDept} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">Department Title</label>
                <input 
                  type="text" 
                  required 
                  value={newDeptName} 
                  onChange={e => setNewDeptName(e.target.value)}
                  placeholder="Neurology" 
                  className="w-full glass-input"
                />
              </div>
              <button type="submit" className="w-full glass-btn-primary py-3 font-semibold text-xs cursor-pointer shadow-lg shadow-cyan-500/10">
                Add Department to Hospital List
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Inline fallback for CheckCircle
function CheckCircleIcon({ size = 16, className = "" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
