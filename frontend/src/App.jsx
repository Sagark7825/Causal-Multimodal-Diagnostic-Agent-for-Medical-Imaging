import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loginSuccess, logout } from './store/index.js';
import axios from 'axios';
import io from 'socket.io-client';
import { 
  Activity, Users, ShieldAlert, FileText, Upload, Plus, 
  UserCheck, Database, LogOut, Check, X, Send, Heart, 
  Sliders, ArrowRight, BookOpen, Clock, AlertTriangle, UserPlus, Cpu, RefreshCcw, Layout, Search, Calendar, ShieldCheck, Settings, Server, Trash, ShieldAlert as SuspendedIcon,
  Eye, EyeOff
} from 'lucide-react';
import DICOMViewer from './components/DICOMViewer.jsx';
import CausalDAGViewer from './components/CausalDAGViewer.jsx';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const dispatch = useDispatch();
  const auth = useSelector(state => state.auth);
  
  // Navigation tabs based on role
  const [activeTab, setActiveTab] = useState('overview'); // changes based on role

  // Hardware metrics
  const [gpuMetrics, setGpuMetrics] = useState({ load: 58.4, temp: 68, memory: 11.2 });
  useEffect(() => {
    const timer = setInterval(() => {
      setGpuMetrics({
        load: Number((50 + Math.random() * 20).toFixed(1)),
        temp: Math.floor(62 + Math.random() * 10),
        memory: Number((10.0 + Math.random() * 2.0).toFixed(1))
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // UI state variables
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginRole, setLoginRole] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Register state fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('Doctor');
  const [regDept, setRegDept] = useState('Internal Medicine');

  // Core Data States
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [caseNotes, setCaseNotes] = useState([]);
  const [newNote, setNewNote] = useState('');

  // Search filter query
  const [searchQuery, setSearchQuery] = useState('');
  const [casesFilter, setCasesFilter] = useState('All');

  // Doctor Form: Register Patient
  const [patName, setPatName] = useState('');
  const [patAge, setPatAge] = useState('');
  const [patGender, setPatGender] = useState('Male');
  const [patContact, setPatContact] = useState('');
  const [patAddress, setPatAddress] = useState('');
  const [patEmergency, setPatEmergency] = useState('');
  const [patHistory, setPatHistory] = useState('');
  const [patSymptoms, setPatSymptoms] = useState('');
  const [patTemp, setPatTemp] = useState(37.0);
  const [patPulse, setPatPulse] = useState(78);
  const [patBpSys, setPatBpSys] = useState(120);
  const [patBpDia, setPatBpDia] = useState(80);
  const [patSpo2, setPatSpo2] = useState(98);

  // Doctor Form: Create Clinical Case
  const [caseModality, setCaseModality] = useState('Chest X-ray');
  const [caseComplaint, setCaseComplaint] = useState('');
  const [caseNotesText, setCaseNotesText] = useState('');
  const [caseImagingReason, setCaseImagingReason] = useState('');
  const [casePriority, setCasePriority] = useState('Routine');

  // Radiologist search and assignment states
  const [radiologistsList, setRadiologistsList] = useState([]);
  const [selectedRadiologist, setSelectedRadiologist] = useState('');
  const [radioSearchQuery, setRadioSearchQuery] = useState('');

  // Radiologist Form: Ingestion & Scan Submission
  const [uploadFile, setUploadFile] = useState(null);
  const [radiologistObservation, setRadiologistObservation] = useState('');
  const [obsAction, setObsAction] = useState('Accept AI'); // 'Accept AI', 'Modify AI', 'Reject AI'

  // Doctor Form: Final Diagnosis & Plan
  const [docFinalDiagnosis, setDocFinalDiagnosis] = useState('');
  const [docTreatmentPlan, setDocTreatmentPlan] = useState('');
  const [docPrescription, setDocPrescription] = useState('');
  const [docFollowUp, setDocFollowUp] = useState('');

  // Admin Forms
  const [resetPassUserId, setResetPassUserId] = useState('');
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [deptList, setDeptList] = useState(['Cardiology', 'Radiology', 'Pathology', 'Internal Medicine', 'Emergency']);

  // Dynamic notifications queue
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'System Online. Real-time CDSS workstation loaded.', type: 'info' }
  ]);

  const addNotification = (text, type = 'info') => {
    setNotifications(prev => [{ id: Date.now(), text, type }, ...prev].slice(0, 10));
  };

  // Socket setup
  useEffect(() => {
    const socket = io('http://localhost:5000');
    socket.on('report-updated', (data) => {
      addNotification(`Case status updated to ${data.status} by ${data.updatedBy}`, 'success');
      fetchDashboardData();
    });
    return () => socket.disconnect();
  }, [auth.isAuthenticated]);

  // Initial Fetch on Login
  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchDashboardData();
      setActiveTab('overview');
    }
  }, [auth.isAuthenticated]);

  const getAxiosConfig = () => ({
    headers: { Authorization: `Bearer ${auth.token}` }
  });

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch Analytics
      const resAnal = await axios.get(`${API_BASE}/analytics/dashboard`, getAxiosConfig());
      if (resAnal.data.success) {
        setAnalytics(resAnal.data);
        setAppointments(resAnal.data.upcomingAppointments || []);
        setAuditLogs(resAnal.data.recentAudits || []);
      }

      // 2. Fetch Patients
      const resPat = await axios.get(`${API_BASE}/patients`, getAxiosConfig());
      if (resPat.data.success) {
        setPatients(resPat.data.patients);
      }

      // 3. Fetch Cases
      const resCases = await axios.get(`${API_BASE}/patients/cases/all`, getAxiosConfig());
      if (resCases.data.success) {
        setCases(resCases.data.cases);
      }

      // 4. Admin specific pulls
      if (auth.user?.role === 'Admin') {
        const resUsers = await axios.get(`${API_BASE}/auth/users`, getAxiosConfig());
        if (resUsers.data.success) setUsers(resUsers.data.users);

        const resPend = await axios.get(`${API_BASE}/auth/pending-users`, getAxiosConfig());
        if (resPend.data.success) setPendingUsers(resPend.data.users);
      }

      if (auth.user?.role === 'Doctor') {
        const resRad = await axios.get(`${API_BASE}/auth/radiologists`, getAxiosConfig());
        if (resRad.data.success) {
          setRadiologistsList(resRad.data.radiologists);
          if (resRad.data.radiologists.length > 0 && !selectedRadiologist) {
            setSelectedRadiologist(resRad.data.radiologists[0]._id);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching dashboard database components:', e);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    
    const isAdmin = email.toLowerCase() === 'sagarkhandagale7825@gmail.com';
    
    if (!isAdmin && !loginRole) {
      setError('Access Denied: Please select either Doctor or Radiologist workspace to continue.');
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
      if (res.data.success) {
        const loggedInUser = res.data.user;
        
        if (!isAdmin && loggedInUser.role !== loginRole) {
          setError(`Access Denied: Checked workspace role '${loginRole}' does not match your registered profile role '${loggedInUser.role}'.`);
          setLoading(false);
          return;
        }

        dispatch(loginSuccess({ token: res.data.token, user: loggedInUser }));
        addNotification(`Logged in successfully as ${loggedInUser.name}`, 'success');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await axios.post(`${API_BASE}/auth/register`, {
        name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        department: regDept
      });
      if (res.data.success) {
        setSuccessMsg(
          res.data.user.role === 'Admin'
            ? 'Administrator created! Log in to begin.'
            : 'Clinician registered! Pending administrator credential approval.'
        );
        setIsRegistering(false);
        setRegName(''); setRegEmail(''); setRegPassword('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDatabase = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await axios.post(`${API_BASE}/auth/seed`);
      await axios.post(`${API_BASE}/patients/seed`);
      setSuccessMsg('Database populated with Sagar Khandagale Admin (sagarkhandagale7825@gmail.com/sagar7825) & clinical cases.');
      addNotification('CDSS Database reseeded successfully.', 'success');
      fetchDashboardData();
    } catch (err) {
      setError('Database seeding failure.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (roleEmail, rolePass = 'Password123') => {
    setEmail(roleEmail);
    setPassword(rolePass);
  };

  // DOCTOR ACTIONS
  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: patName,
        age: Number(patAge),
        gender: patGender,
        contactNumber: patContact,
        address: patAddress,
        emergencyContact: patEmergency,
        medicalHistory: patHistory,
        currentSymptoms: patSymptoms,
        vitalSigns: {
          temperature: Number(patTemp),
          heartRate: Number(patPulse),
          bpSystolic: Number(patBpSys),
          bpDiastolic: Number(patBpDia),
          spo2: Number(patSpo2)
        }
      };

      const res = await axios.post(`${API_BASE}/patients`, payload, getAxiosConfig());
      if (res.data.success) {
        alert(`Patient registered successfully! Generated ID: ${res.data.patient.patientId}`);
        // Reset fields
        setPatName(''); setPatAge(''); setPatContact(''); setPatAddress(''); setPatEmergency(''); setPatHistory(''); setPatSymptoms('');
        fetchDashboardData();
        setSelectedPatient(res.data.patient);
        setActiveTab('create_case');
      }
    } catch (err) {
      alert('Patient registration failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCreateCase = async (e) => {
    e.preventDefault();
    if (!selectedPatient) {
      alert('Please select or search a patient first.');
      return;
    }

    try {
      const payload = {
        modality: caseModality,
        chiefComplaint: caseComplaint,
        clinicalNotes: caseNotesText,
        reasonForImaging: caseImagingReason,
        priorityLevel: casePriority,
        assignedRadiologist: selectedRadiologist
      };

      const res = await axios.post(`${API_BASE}/patients/${selectedPatient._id}/cases`, payload, getAxiosConfig());
      if (res.data.success) {
        alert(`Case created successfully! Case ID: ${res.data.clinicalCase.caseId}`);
        setCaseComplaint(''); setCaseNotesText(''); setCaseImagingReason('');
        fetchDashboardData();
        setActiveTab('overview');
      }
    } catch (err) {
      alert('Case creation failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleAddDoctorNote = async (e) => {
    e.preventDefault();
    if (!selectedCase || !newNote.trim()) return;
    try {
      const res = await axios.post(`${API_BASE}/patients/cases/${selectedCase._id}/notes`, { noteText: newNote }, getAxiosConfig());
      if (res.data.success) {
        setNewNote('');
        fetchCaseNotes(selectedCase._id);
      }
    } catch (err) { console.error('Add note failed:', err); }
  };

  const fetchCaseNotes = async (caseId) => {
    try {
      const res = await axios.get(`${API_BASE}/patients/cases/${caseId}/notes`, getAxiosConfig());
      if (res.data.success) setCaseNotes(res.data.notes);
    } catch (e) { console.error(e); }
  };

  const handleDoctorFinalSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCase) return;
    try {
      const payload = {
        treatmentPlan: docTreatmentPlan,
        prescription: docPrescription,
        followUpInstructions: docFollowUp,
        status: 'Treatment Completed' // or Case Closed
      };

      const res = await axios.put(`${API_BASE}/patients/cases/${selectedCase._id}`, payload, getAxiosConfig());
      if (res.data.success) {
        alert('Case final diagnosis submitted & closed successfully!');
        setDocFinalDiagnosis(''); setDocTreatmentPlan(''); setDocPrescription(''); setDocFollowUp('');
        fetchDashboardData();
        setSelectedCase(null);
        setActiveTab('overview');
      }
    } catch (err) { alert('Diagnosis submission failed: ' + err.message); }
  };

  // RADIOLOGIST ACTIONS
  const handleUploadImaging = async (e) => {
    e.preventDefault();
    if (!selectedCase) {
      alert('Select a clinical case from the queue first.');
      return;
    }
    if (!uploadFile) {
      alert('Please choose a scan image file.');
      return;
    }

    const formData = new FormData();
    formData.append('caseId', selectedCase._id);
    formData.append('file', uploadFile);

    try {
      const res = await axios.post(`${API_BASE}/reports/upload`, formData, {
        headers: {
          ...getAxiosConfig().headers,
          'Content-Type': 'multipart/form-data'
        }
      });
      if (res.data.success) {
        alert('Scan uploaded successfully!');
        setSelectedReport(res.data.report);
        fetchDashboardData();
        // Automatically fetch case info again
        const resCase = await axios.get(`${API_BASE}/patients/cases/${selectedCase._id}`, getAxiosConfig());
        if (resCase.data.success) setSelectedCase(resCase.data.clinicalCase);
      }
    } catch (err) { alert('Scan upload failed: ' + err.message); }
  };

  const handleRunAIAnalysis = async () => {
    if (!selectedReport) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/reports/${selectedReport._id}/run-ai`, {}, getAxiosConfig());
      if (res.data.success) {
        alert('AI Inference completed!');
        setSelectedReport(res.data.report);
        if (res.data.aiPrediction) {
          setRadiologistObservation(res.data.aiPrediction.suggestedObservation || '');
        }
        fetchDashboardData();
        // Reload case
        const resCase = await axios.get(`${API_BASE}/patients/cases/${selectedCase._id}`, getAxiosConfig());
        if (resCase.data.success) setSelectedCase(resCase.data.clinicalCase);
      }
    } catch (err) { alert('AI processing failed: ' + err.message); }
    finally { setLoading(false); }
  };

  const handleRadiologistSubmitReport = async (e) => {
    e.preventDefault();
    if (!selectedReport) return;
    try {
      const payload = {
        radiologistObservation,
        action: obsAction
      };
      const res = await axios.post(`${API_BASE}/reports/${selectedReport._id}/observation`, payload, getAxiosConfig());
      if (res.data.success) {
        alert('Observation report submitted successfully to the attending Doctor!');
        setRadiologistObservation('');
        setUploadFile(null);
        setSelectedReport(null);
        setSelectedCase(null);
        fetchDashboardData();
        setActiveTab('overview');
      }
    } catch (err) { alert('Report submission failed: ' + err.message); }
  };

  // ADMIN ACTIONS
  const handleApproveClinician = async (userId) => {
    try {
      const res = await axios.post(`${API_BASE}/auth/approve-user/${userId}`, {}, getAxiosConfig());
      if (res.data.success) {
        alert(res.data.message);
        fetchDashboardData();
      }
    } catch (err) { alert('Approval failed: ' + err.message); }
  };

  const handleSuspendUser = async (userId) => {
    try {
      const res = await axios.put(`${API_BASE}/auth/suspend/${userId}`, {}, getAxiosConfig());
      if (res.data.success) {
        alert('User suspended successfully.');
        fetchDashboardData();
      }
    } catch (err) { alert(err.message); }
  };

  const handleUnsuspendUser = async (userId) => {
    try {
      const res = await axios.put(`${API_BASE}/auth/unsuspend/${userId}`, {}, getAxiosConfig());
      if (res.data.success) {
        alert('User unsuspended.');
        fetchDashboardData();
      }
    } catch (err) { alert(err.message); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetPassUserId || !newPasswordValue.trim()) return;
    try {
      const res = await axios.put(`${API_BASE}/auth/reset-password/${resetPassUserId}`, { newPassword: newPasswordValue }, getAxiosConfig());
      if (res.data.success) {
        alert('User password reset successfully!');
        setResetPassUserId('');
        setNewPasswordValue('');
      }
    } catch (err) { alert(err.message); }
  };

  const handleAddDept = (e) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setDeptList(prev => [...prev, newDeptName]);
    setNewDeptName('');
    alert('Department added successfully.');
  };

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'Emergency': return 'bg-rose-950/60 text-rose-400 border border-rose-800 pulse-critical';
      case 'Urgent': return 'bg-amber-950/60 text-amber-400 border border-amber-800 pulse-high';
      default: return 'bg-cyan-950/60 text-cyan-400 border border-cyan-800';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Case Closed':
      case 'Treatment Completed': return 'bg-emerald-950/60 text-emerald-400 border border-emerald-800';
      case 'Doctor Review Pending': return 'bg-violet-950/60 text-violet-400 border border-violet-800';
      case 'AI Analysis Completed': return 'bg-cyan-950/60 text-cyan-400 border border-cyan-800';
      case 'Imaging Uploaded': return 'bg-blue-950/60 text-blue-400 border border-blue-800';
      default: return 'bg-slate-900/60 text-slate-400 border border-slate-700';
    }
  };

  const filteredPatients = patients.filter(p => {
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.patientId.toLowerCase().includes(q);
  });

  const filteredCases = cases.filter(c => {
    if (casesFilter === 'All') return true;
    return c.status === casesFilter;
  });

  // Timeline components rendering
  const timelineStages = [
    'New Case',
    'Awaiting Imaging',
    'Imaging Uploaded',
    'AI Analysis Completed',
    'Radiologist Review Completed',
    'Doctor Review Pending',
    'Treatment Completed',
    'Case Closed'
  ];

  const getStageIndex = (status) => {
    // If completed or closed, all stages completed
    if (status === 'Treatment Completed') return 6;
    if (status === 'Case Closed') return 7;
    return timelineStages.indexOf(status);
  };

  // AUTH REGISTRATION / LOGIN LAYOUT
  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background neon glows */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-cyan-600/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-600/5 rounded-full blur-[120px]"></div>

        <div className="glass-panel w-full max-w-md p-8 rounded-2xl border border-cyan-500/20 z-10">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-cyan-500/10 rounded-xl mb-3 text-cyan-400 border border-cyan-500/20">
              <Activity size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">MedCausal HIS & CDSS</h1>
            <p className="text-xs text-slate-400 mt-1">AI-Powered Hospital Information Decision Support Suite</p>
          </div>

          {error && (
            <div className="bg-rose-950/40 border border-rose-800 text-rose-400 text-xs p-3 rounded-lg mb-4 flex items-center gap-2">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-400 text-xs p-3 rounded-lg mb-4 flex items-center gap-2">
              <Check size={14} />
              <span>{successMsg}</span>
            </div>
          )}

          {!isRegistering ? (
            /* LOGIN FORM */
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Role Workspace Selection */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5 text-center">
                  Select Login Workspace
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-200/60 p-2 rounded-xl border border-slate-300 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setLoginRole('Doctor')}
                    className={`py-2.5 rounded-lg text-sm font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                      loginRole === 'Doctor'
                        ? 'bg-indigo-600 text-white shadow-md scale-[1.02]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/40'
                    }`}
                  >
                    <span>🩺</span> Doctor
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginRole('Radiologist')}
                    className={`py-2.5 rounded-lg text-sm font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                      loginRole === 'Radiologist'
                        ? 'bg-indigo-600 text-white shadow-md scale-[1.02]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/40'
                    }`}
                  >
                    <span>☢️</span> Radiologist
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Hospital Email Address</label>
                <input
                  type="email" required className="w-full glass-input"
                  placeholder="doctor@medcausal.com" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"} required className="w-full glass-input pr-10"
                    placeholder="••••••••" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full glass-btn-primary py-2.5 flex items-center justify-center gap-2"
              >
                {loading ? 'Verifying Credentials...' : 'Sign In to HIS Workspace'}
                <ArrowRight size={16} />
              </button>

              <div className="text-center mt-3.5">
                <button 
                  type="button" onClick={() => setIsRegistering(true)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                >
                  Register New Clinician Profile
                </button>
              </div>
            </form>
          ) : (
            /* REGISTER / SIGN UP FORM */
            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Full Name</label>
                <input
                  type="text" required className="w-full glass-input py-1.5 text-xs"
                  placeholder="Dr. Sarah Jenkins" value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Hospital Email</label>
                <input
                  type="email" required className="w-full glass-input py-1.5 text-xs"
                  placeholder="sarah@medcausal.com" value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showRegPassword ? "text" : "password"} required className="w-full glass-input py-1.5 text-xs pr-10"
                    placeholder="••••••••" value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Clinical Role</label>
                  <select
                    value={regRole} onChange={(e) => setRegRole(e.target.value)}
                    className="w-full glass-input text-xs py-1.5"
                  >
                    <option value="Doctor">Doctor (Requires approval)</option>
                    <option value="Radiologist">Radiologist (Requires approval)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Department</label>
                  <input
                    type="text" required className="w-full glass-input py-1.5 text-xs"
                    placeholder="Radiology" value={regDept}
                    onChange={(e) => setRegDept(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full glass-btn-primary py-2.5 flex items-center justify-center gap-2 mt-2"
              >
                <UserPlus size={15} />
                {loading ? 'Submitting Registration...' : 'Register Profile'}
              </button>

              <div className="text-center mt-3">
                <button 
                  type="button" onClick={() => setIsRegistering(false)}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    );
  }

  // ACTIVE HIS CDSS WORKSPACE once authenticated
  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-100 font-sans">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-slate-900/80 border-r border-white/5 flex flex-col justify-between">
        <div>
          {/* Logo */}
          <div className="p-6 border-b border-white/5 flex items-center gap-3">
            <div className="p-2 bg-cyan-600/10 rounded-lg text-cyan-400 border border-cyan-500/20">
              <Activity size={20} />
            </div>
            <div>
              <div className="font-bold text-white tracking-tight leading-none text-sm">MedCausal HIS</div>
              <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider font-mono">CDSS Station</span>
            </div>
          </div>

          {/* User detail card */}
          <div className="p-4 mx-4 my-4 bg-slate-950/80 rounded-xl border border-white/5 text-xs">
            <span className="text-slate-500 text-[10px]">Active Practitioner:</span>
            <div className="font-semibold text-slate-200 mt-0.5">{auth.user?.name}</div>
            <div className="inline-flex mt-2 px-2 py-0.5 rounded text-[9px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">
              {auth.user?.role}
            </div>
          </div>

          {/* Sidebar options based on roles */}
          <nav className="px-4 space-y-1.5">
            {auth.user?.role === 'Doctor' && (
              <>
                <button 
                  onClick={() => setActiveTab('overview')} 
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${activeTab === 'overview' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Layout size={14} />
                  Dashboard Overview
                </button>
                <button 
                  onClick={() => setActiveTab('register_patient')} 
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${activeTab === 'register_patient' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <UserPlus size={14} />
                  Register New Patient
                </button>
                <button 
                  onClick={() => setActiveTab('search_patient')} 
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${activeTab === 'search_patient' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Search size={14} />
                  Search Patient / Cases
                </button>
                <button 
                  onClick={() => setActiveTab('workstation')} 
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${activeTab === 'workstation' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Sliders size={14} />
                  AI CDSS Workstation
                </button>
                <button 
                  onClick={() => setActiveTab('appointments')} 
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${activeTab === 'appointments' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Calendar size={14} />
                  Appointments
                </button>
              </>
            )}

            {auth.user?.role === 'Radiologist' && (
              <>
                <button 
                  onClick={() => setActiveTab('overview')} 
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${activeTab === 'overview' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Clock size={14} />
                  Imaging Ingest Queue
                </button>
                <button 
                  onClick={() => setActiveTab('workstation')} 
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${activeTab === 'workstation' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Upload size={14} />
                  Ingest Scan & AI run
                </button>
                <button 
                  onClick={() => setActiveTab('reports')} 
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${activeTab === 'reports' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <FileText size={14} />
                  Completed Reports
                </button>
              </>
            )}

            {auth.user?.role === 'Admin' && (
              <>
                <button 
                  onClick={() => setActiveTab('overview')} 
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${activeTab === 'overview' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Layout size={14} />
                  Overview Analytics
                </button>
                <button 
                  onClick={() => setActiveTab('user_management')} 
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${activeTab === 'user_management' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <UserCheck size={14} />
                  User & Approvals
                </button>
                <button 
                  onClick={() => setActiveTab('audit_logs')} 
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${activeTab === 'audit_logs' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <ShieldCheck size={14} />
                  HIPAA Security Log
                </button>
                <button 
                  onClick={() => setActiveTab('ai_models')} 
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${activeTab === 'ai_models' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Cpu size={14} />
                  AI Models & GPUs
                </button>
                <button 
                  onClick={() => setActiveTab('settings')} 
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${activeTab === 'settings' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Settings size={14} />
                  Hospital Settings
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-white/5">
          <button 
            onClick={() => dispatch(logout())}
            className="w-full bg-rose-950/20 hover:bg-rose-900/30 border border-rose-800/30 text-rose-400 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <LogOut size={13} />
            End Session
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* TOP STATUS BAR */}
        <header className="h-16 border-b border-white/5 bg-slate-900/30 px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span>MEDCAUSAL HIS CDSS WORKSPACE</span>
            <span>/</span>
            <span className="text-white uppercase">{activeTab.replace('_', ' ')}</span>
          </div>

          {/* Quick hardware monitor at top */}
          <div className="flex items-center gap-6 text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <Cpu size={12} className="text-cyan-400" />
              <span>GPU TEMP: <span className="text-cyan-400 font-bold">{gpuMetrics.temp}°C</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity size={12} className="text-emerald-400" />
              <span>GPU LOAD: <span className="text-emerald-400 font-bold">{gpuMetrics.load}%</span></span>
            </div>
          </div>
        </header>

        {/* Live notification Banner */}
        {notifications.length > 0 && (
          <div className="bg-cyan-950/40 border-b border-cyan-500/20 px-8 py-2 flex items-center justify-between text-[11px] text-cyan-300">
            <div className="flex items-center gap-2">
              <Clock size={12} className="animate-pulse" />
              <span><strong>Triage Bulletin:</strong> {notifications[0].text}</span>
            </div>
            <button onClick={() => setNotifications([])} className="text-cyan-400 hover:text-white"><X size={12} /></button>
          </div>
        )}

        <div className="p-8 space-y-6">
          
          {/* ============================================================== */}
          {/* DOCTOR DASHBOARD */}
          {/* ============================================================== */}
          {auth.user?.role === 'Doctor' && (
            <>
              {/* TAB: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Row */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider">Today's Patients</div>
                      <div className="text-3xl font-bold text-cyan-400 mt-2">{patients.length}</div>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider">Upcoming Appointments</div>
                      <div className="text-3xl font-bold text-cyan-400 mt-2">{appointments.length}</div>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider">Pending CDSS Reviews</div>
                      <div className="text-3xl font-bold text-rose-400 mt-2">
                        {cases.filter(c => c.status === 'Doctor Review Pending').length}
                      </div>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider">Total Patient Records</div>
                      <div className="text-3xl font-bold text-emerald-400 mt-2">{patients.length}</div>
                    </div>
                  </div>

                  {/* Split Overview components */}
                  <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 md:col-span-5 glass-panel p-5 rounded-xl space-y-4">
                      <h3 className="font-bold text-xs uppercase text-slate-300 flex items-center gap-2 border-b border-white/5 pb-2.5">
                        <Calendar size={14} className="text-cyan-400" />
                        Today's Scheduled Appointments ({appointments.length})
                      </h3>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {appointments.map(app => (
                          <div key={app._id} className="p-3 bg-slate-950/60 rounded-lg border border-white/5 text-xs">
                            <div className="flex justify-between font-mono text-[9px] text-slate-500">
                              <span>{new Date(app.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="text-cyan-400">{app.status}</span>
                            </div>
                            <div className="font-bold text-white mt-1">{app.patient?.name}</div>
                            <div className="text-slate-400 mt-0.5">Reason: {app.reason}</div>
                          </div>
                        ))}
                        {appointments.length === 0 && (
                          <div className="text-center text-slate-500 py-6 text-xs">No scheduled consultations today.</div>
                        )}
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-7 glass-panel p-5 rounded-xl space-y-4">
                      <h3 className="font-bold text-xs uppercase text-slate-300 flex items-center gap-2 border-b border-white/5 pb-2.5">
                        <Layout size={14} className="text-cyan-400" />
                        Attending Clinical Case Registry
                      </h3>
                      <div className="flex gap-2 mb-3">
                        {['All', 'Awaiting Imaging', 'Doctor Review Pending', 'Treatment Completed'].map(f => (
                          <button
                            key={f} onClick={() => setCasesFilter(f)}
                            className={`px-2.5 py-1 rounded text-[10px] font-semibold transition border ${casesFilter === f ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-slate-900 text-slate-400 border-white/5 hover:text-white'}`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {filteredCases.map(c => (
                          <div 
                            key={c._id} 
                            onClick={() => { setSelectedCase(c); setActiveTab('workstation'); }}
                            className="p-3.5 bg-slate-950/60 rounded-lg border border-white/5 hover:border-cyan-500/30 transition cursor-pointer flex justify-between items-center text-xs"
                          >
                            <div>
                              <div className="flex gap-3 text-[9px] font-mono text-slate-500">
                                <span>{c.caseId}</span>
                                <span>{c.modality}</span>
                              </div>
                              <div className="font-bold text-white mt-1">{c.patient?.name}</div>
                              <p className="text-slate-400 italic text-[11px] mt-0.5">"{c.chiefComplaint}"</p>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <span className={`px-2 py-0.5 rounded-[4px] text-[9px] font-mono ${getPriorityBadgeClass(c.priorityLevel)}`}>{c.priorityLevel}</span>
                              <span className={`px-2 py-0.5 rounded-[4px] text-[9px] font-mono ${getStatusBadgeClass(c.status)}`}>{c.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: REGISTER PATIENT */}
              {activeTab === 'register_patient' && (
                <div className="max-w-2xl mx-auto glass-panel p-6 rounded-xl space-y-6">
                  <div className="border-b border-white/5 pb-3">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <UserPlus size={18} className="text-cyan-400" />
                      Register New Patient Record
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">This will register a new patient visiting Springfield Hospital for the first time.</p>
                  </div>

                  <form onSubmit={handleRegisterPatient} className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 mb-1.5 font-medium">Full Name</label>
                        <input type="text" required value={patName} onChange={e => setPatName(e.target.value)} placeholder="Eleanor Vance" className="w-full glass-input" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 mb-1.5 font-medium">Age</label>
                          <input type="number" required value={patAge} onChange={e => setPatAge(e.target.value)} placeholder="45" className="w-full glass-input" />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1.5 font-medium">Gender</label>
                          <select value={patGender} onChange={e => setPatGender(e.target.value)} className="w-full glass-input">
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 mb-1.5 font-medium">Contact Number</label>
                        <input type="text" required value={patContact} onChange={e => setPatContact(e.target.value)} placeholder="+1-555-0199" className="w-full glass-input" />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1.5 font-medium">Emergency Contact</label>
                        <input type="text" value={patEmergency} onChange={e => setPatEmergency(e.target.value)} placeholder="Robert Vance (+1-555-0200)" className="w-full glass-input" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Residential Address</label>
                      <input type="text" value={patAddress} onChange={e => setPatAddress(e.target.value)} placeholder="742 Evergreen Terrace, Springfield" className="w-full glass-input" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 mb-1.5 font-medium">Medical History Notes</label>
                        <textarea rows="3" value={patHistory} onChange={e => setPatHistory(e.target.value)} placeholder="Mild asthma, seasonal allergies." className="w-full glass-input" />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1.5 font-medium">Current Symptoms</label>
                        <textarea rows="3" value={patSymptoms} onChange={e => setPatSymptoms(e.target.value)} placeholder="Dry cough, mild dyspnea." className="w-full glass-input" />
                      </div>
                    </div>

                    {/* Vitals Form block */}
                    <div className="p-4 bg-slate-950/60 rounded-xl border border-white/5">
                      <div className="text-[10px] text-cyan-400 font-bold uppercase mb-3 tracking-wider">Patient Vitals Metrics Ingestion</div>
                      <div className="grid grid-cols-5 gap-3 text-[10px]">
                        <div>
                          <span>Temp (°C)</span>
                          <input type="number" step="0.1" value={patTemp} onChange={e => setPatTemp(e.target.value)} className="w-full glass-input py-1.5 mt-1 text-center" />
                        </div>
                        <div>
                          <span>Pulse (bpm)</span>
                          <input type="number" value={patPulse} onChange={e => setPatPulse(e.target.value)} className="w-full glass-input py-1.5 mt-1 text-center" />
                        </div>
                        <div>
                          <span>BP Systolic</span>
                          <input type="number" value={patBpSys} onChange={e => setPatBpSys(e.target.value)} className="w-full glass-input py-1.5 mt-1 text-center" />
                        </div>
                        <div>
                          <span>BP Diastolic</span>
                          <input type="number" value={patBpDia} onChange={e => setPatBpDia(e.target.value)} className="w-full glass-input py-1.5 mt-1 text-center" />
                        </div>
                        <div>
                          <span>SpO2 (%)</span>
                          <input type="number" value={patSpo2} onChange={e => setPatSpo2(e.target.value)} className="w-full glass-input py-1.5 mt-1 text-center" />
                        </div>
                      </div>
                    </div>

                    <button type="submit" className="w-full glass-btn-primary py-2.5">
                      Register Patient & Allocate Patient ID
                    </button>
                  </form>
                </div>
              )}

              {/* TAB: SEARCH PATIENTS / CASES */}
              {activeTab === 'search_patient' && (
                <div className="grid grid-cols-12 gap-6">
                  {/* Left Column: List/Search */}
                  <div className="col-span-12 md:col-span-5 glass-panel p-5 rounded-xl space-y-4">
                    <div className="relative">
                      <input 
                        type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by Patient Name or ID..." className="w-full glass-input pl-10 py-1.5"
                      />
                      <Search className="absolute left-3.5 top-2.5 text-slate-400" size={14} />
                    </div>

                    <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                      {filteredPatients.map(p => (
                        <div
                          key={p._id} onClick={() => setSelectedPatient(p)}
                          className={`p-3 rounded-lg border transition cursor-pointer text-xs ${selectedPatient?._id === p._id ? 'bg-cyan-950/20 border-cyan-500/50' : 'bg-slate-950/60 border-white/5 hover:bg-slate-900/30'}`}
                        >
                          <div className="flex justify-between font-mono text-[9px] text-cyan-400">
                            <span>{p.patientId}</span>
                            <span>{p.gender} • {p.age}y</span>
                          </div>
                          <div className="font-bold text-white mt-1">{p.name}</div>
                          <div className="text-slate-500 text-[10px] truncate mt-0.5">{p.address}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Profile & Case Creation */}
                  <div className="col-span-12 md:col-span-7 glass-panel p-5 rounded-xl space-y-4">
                    {selectedPatient ? (
                      <div className="space-y-6">
                        <div className="border-b border-white/5 pb-3 flex justify-between items-center">
                          <div>
                            <h2 className="text-base font-bold text-white">{selectedPatient.name}</h2>
                            <span className="text-[10px] font-mono text-cyan-400">Patient ID: {selectedPatient.patientId}</span>
                          </div>
                          <button onClick={() => setActiveTab('create_case')} className="glass-btn-primary py-1.5 text-[10px] flex items-center gap-1.5">
                            <Plus size={11} /> Create Clinical Case
                          </button>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-slate-500 block">Residential Address:</span>
                            <span className="text-slate-200">{selectedPatient.address}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Contact Info:</span>
                            <span className="text-slate-200">{selectedPatient.contactNumber}</span>
                          </div>
                        </div>

                        {/* Vitals preview */}
                        {selectedPatient.vitalSigns && (
                          <div className="p-3 bg-slate-950/60 rounded-lg border border-white/5 text-[10px] font-mono text-slate-400 grid grid-cols-5 gap-2 text-center">
                            <div><span className="text-slate-500">TEMP:</span> {selectedPatient.vitalSigns.temperature}°C</div>
                            <div><span className="text-slate-500">PULSE:</span> {selectedPatient.vitalSigns.heartRate} bpm</div>
                            <div><span className="text-slate-500">SYS:</span> {selectedPatient.vitalSigns.bpSystolic}</div>
                            <div><span className="text-slate-500">DIA:</span> {selectedPatient.vitalSigns.bpDiastolic}</div>
                            <div><span className="text-slate-500">SPO2:</span> {selectedPatient.vitalSigns.spo2}%</div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <span className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Clinical Cases History</span>
                          <div className="space-y-2 max-h-[220px] overflow-y-auto">
                            {cases.filter(c => c.patient?._id === selectedPatient._id).map(c => (
                              <div key={c._id} className="p-3 bg-slate-950/40 rounded-lg border border-white/5 flex justify-between items-center text-xs">
                                <div>
                                  <div className="font-mono text-[9px] text-cyan-400">{c.caseId} ({c.modality})</div>
                                  <div className="text-white font-semibold mt-0.5">{c.chiefComplaint}</div>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-mono ${getStatusBadgeClass(c.status)}`}>{c.status}</span>
                              </div>
                            ))}
                            {cases.filter(c => c.patient?._id === selectedPatient._id).length === 0 && (
                              <div className="text-center text-slate-500 py-4 text-xs">No clinical cases registered for this patient.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-slate-500 py-12 text-xs">
                        Select a patient in the search directory to view records and history.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: CREATE CLINICAL CASE */}
              {activeTab === 'create_case' && (
                <div className="max-w-2xl mx-auto glass-panel p-6 rounded-xl space-y-6">
                  {selectedPatient ? (
                    <>
                      <div className="border-b border-white/5 pb-3">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                          <Sliders size={18} className="text-cyan-400" />
                          Allocate Clinical Case File
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">Creating case file for: <strong>{selectedPatient.name}</strong> ({selectedPatient.patientId})</p>
                      </div>

                      <form onSubmit={handleCreateCase} className="space-y-4 text-xs">
                        {/* Radiologist Search & Assignment */}
                        <div className="p-4 bg-slate-950/60 rounded-xl border border-white/5 space-y-3">
                          <label className="block text-slate-400 font-medium">Search & Assign Radiologist / Diagnostic Lab</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={radioSearchQuery} 
                              onChange={e => setRadioSearchQuery(e.target.value)} 
                              placeholder="Type radiologist name to filter..." 
                              className="w-full glass-input py-1 text-xs"
                            />
                          </div>
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

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-slate-400 mb-1.5 font-medium font-mono">Modality Selection</label>
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
                            <label className="block text-slate-400 mb-1.5 font-medium font-mono">Triage Priority Level</label>
                            <select value={casePriority} onChange={e => setCasePriority(e.target.value)} className="w-full glass-input font-mono font-bold text-cyan-400">
                              <option value="Routine">Routine</option>
                              <option value="Urgent">Urgent</option>
                              <option value="Emergency">Emergency</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1.5 font-medium">Chief Complaint</label>
                          <input type="text" required value={caseComplaint} onChange={e => setCaseComplaint(e.target.value)} placeholder="Chest congestion, dyspnea for 3 days" className="w-full glass-input" />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1.5 font-medium">Imaging Observation Request Reason</label>
                          <textarea rows="3" required value={caseImagingReason} onChange={e => setCaseImagingReason(e.target.value)} placeholder="Check for right lower lobe opacities or consolidation." className="w-full glass-input" />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1.5 font-medium">Clinical Admission Notes</label>
                          <textarea rows="2" value={caseNotesText} onChange={e => setCaseNotesText(e.target.value)} placeholder="Patient has lisinopril therapy, no recent cardiovascular reports." className="w-full glass-input" />
                        </div>

                        <button type="submit" className="w-full glass-btn-primary py-2.5">
                          Allocate Case & Set Status: "Awaiting Imaging"
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="text-center text-slate-500 py-8 text-xs">
                      No active patient selected. Go to <button onClick={() => setActiveTab('search_patient')} className="text-cyan-400 underline cursor-pointer">Search Patient</button> first.
                    </div>
                  )}
                </div>
              )}

              {/* TAB: WORKSTATION (DOCTOR DIAGNOSIS & REVIEWS) */}
              {activeTab === 'workstation' && (
                <div className="grid grid-cols-12 gap-6">
                  {/* Left Column: Case Directory */}
                  <div className="col-span-12 lg:col-span-3 glass-panel p-5 rounded-xl space-y-4">
                    <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5">
                      Case Workstation Queue
                    </h3>
                    <div className="space-y-2 max-h-[480px] overflow-y-auto">
                      {cases.map(c => (
                        <button
                          key={c._id} onClick={() => { setSelectedCase(c); fetchCaseNotes(c._id); }}
                          className={`w-full text-left p-3 rounded-lg border transition text-xs ${selectedCase?._id === c._id ? 'bg-cyan-950/20 border-cyan-500/50' : 'bg-slate-950/40 border-white/5 hover:bg-slate-900/30'}`}
                        >
                          <div className="flex justify-between font-mono text-[8px] text-slate-500">
                            <span>{c.caseId}</span>
                            <span>{c.modality}</span>
                          </div>
                          <div className="font-bold text-white mt-1">{c.patient?.name}</div>
                          <span className={`inline-block mt-2 px-1.5 py-0.5 rounded text-[8px] font-mono ${getStatusBadgeClass(c.status)}`}>{c.status}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Case Workstation Details */}
                  <div className="col-span-12 lg:col-span-9 space-y-6">
                    {selectedCase ? (
                      <div className="space-y-6">
                        {/* Case Timeline tracker */}
                        <div className="glass-panel p-5 rounded-xl border border-white/5">
                          <h3 className="text-slate-400 text-[10px] uppercase font-mono tracking-wider mb-4">Case Progression Timeline</h3>
                          <div className="flex items-center justify-between">
                            {timelineStages.map((stage, idx) => {
                              const activeStageIdx = getStageIndex(selectedCase.status);
                              const isCompleted = idx < activeStageIdx;
                              const isActive = idx === activeStageIdx;

                              return (
                                <div key={stage} className="flex flex-col items-center text-center flex-1 relative">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center border font-mono text-[9px] font-bold z-10 transition ${isCompleted ? 'bg-emerald-600 border-emerald-500 text-white' : isActive ? 'bg-cyan-950 border-cyan-500 text-cyan-400 animate-pulse' : 'bg-slate-900 border-white/5 text-slate-500'}`}>
                                    {idx + 1}
                                  </div>
                                  <span className={`text-[8px] font-semibold mt-2 max-w-[80px] leading-tight ${isActive ? 'text-cyan-400' : isCompleted ? 'text-emerald-400' : 'text-slate-500'}`}>{stage}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Image viewer & causal dags */}
                        {selectedCase.radiologyReport && selectedCase.radiologyReport.scanUrl && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                        {/* Split details layout */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                          {/* Left Details block */}
                          <div className="glass-panel p-5 rounded-xl space-y-4">
                            <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2">
                              Radiology Observation report
                            </h3>
                            {selectedCase.radiologyReport ? (
                              <div className="space-y-3">
                                <div>
                                  <span className="text-slate-500 text-[10px]">Attending Radiologist Note:</span>
                                  <p className="bg-slate-950/60 p-3 rounded-lg border border-white/5 text-slate-300 mt-1 italic leading-relaxed">
                                    "{selectedCase.radiologyReport.radiologistObservation || 'No observation submitted yet.'}"
                                  </p>
                                </div>
                                <div className="text-[10px] font-mono text-slate-500">
                                  Report Status: <span className="text-cyan-400">{selectedCase.radiologyReport.status}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-slate-500 py-6 text-center italic">Awaiting scan upload from Radiology team.</div>
                            )}
                          </div>

                          {/* Right Details block */}
                          <div className="glass-panel p-5 rounded-xl space-y-4">
                            <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2">
                              AI Decision Support Draft
                            </h3>
                            {selectedCase.aiPrediction ? (
                              <div className="space-y-3">
                                <div className="flex justify-between items-center bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                                  <div>
                                    <span className="text-slate-500 text-[9px]">Predicted Disease</span>
                                    <div className="font-bold text-white text-sm">{selectedCase.aiPrediction.predictedDisease}</div>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 text-[9px] block text-right">Confidence</span>
                                    <div className="font-bold text-cyan-400 text-sm">{(selectedCase.aiPrediction.confidenceScore * 100).toFixed(1)}%</div>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-slate-500 text-[10px] block">AI Suggested Observation:</span>
                                  <p className="text-slate-300 leading-relaxed mt-1 text-[11px] bg-slate-950/40 p-2.5 rounded border border-white/5 font-mono">
                                    {selectedCase.aiPrediction.suggestedObservation}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-slate-500 text-[10px]">Differential Diagnosis:</span>
                                  <div className="flex gap-2 mt-1.5">
                                    {selectedCase.aiPrediction.differentialDiagnosis?.map((d, idx) => (
                                      <span key={idx} className="bg-slate-900 border border-white/5 px-2 py-0.5 rounded text-[9px] text-slate-300 font-mono">{d}</span>
                                    ))}
                                  </div>
                                </div>
                                {selectedCase.aiPrediction.indicators && Object.keys(selectedCase.aiPrediction.indicators).length > 0 && (
                                  <div className="pt-2 border-t border-white/5">
                                    <span className="text-slate-500 text-[10px] block mb-1">Extracted Clinical Indicators:</span>
                                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                                      {Object.entries(selectedCase.aiPrediction.indicators).map(([key, val]) => (
                                        <div key={key} className="bg-slate-950/40 p-1.5 rounded border border-white/5">
                                          <span className="text-slate-500 capitalize">{key.replace('_', ' ')}:</span>{' '}
                                          <span className="text-cyan-400 font-bold">{val}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-slate-500 py-6 text-center italic">AI model has not analyzed this case.</div>
                            )}
                          </div>
                        </div>

                        {/* Doctor Notes & Clinical Diary */}
                        <div className="glass-panel p-5 rounded-xl space-y-4 text-xs">
                          <h3 className="font-bold text-xs uppercase text-slate-300">Clinician Session Notes</h3>
                          <div className="space-y-2 max-h-[160px] overflow-y-auto">
                            {caseNotes.map(n => (
                              <div key={n._id} className="p-2.5 bg-slate-950/40 rounded border border-white/5">
                                <div className="flex justify-between text-[9px] text-slate-500 font-mono mb-1">
                                  <span>{n.doctor?.name}</span>
                                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                                </div>
                                <p className="text-slate-300">"{n.noteText}"</p>
                              </div>
                            ))}
                            {caseNotes.length === 0 && (
                              <div className="text-center text-slate-500 italic py-3">No clinician notes logged.</div>
                            )}
                          </div>
                          <form onSubmit={handleAddDoctorNote} className="flex gap-2">
                            <input 
                              type="text" value={newNote} onChange={e => setNewNote(e.target.value)}
                              placeholder="Log patient symptom progress or indicators..." className="flex-1 glass-input text-xs"
                            />
                            <button type="submit" className="glass-btn-secondary py-1 text-xs">Add Note</button>
                          </form>
                        </div>

                        {/* Doctor Final Action Form */}
                        {selectedCase.status === 'Doctor Review Pending' && (
                          <div className="glass-panel p-6 rounded-xl border border-cyan-500/20 space-y-4 text-xs">
                            <h3 className="font-bold text-sm text-cyan-400 flex items-center gap-2 border-b border-white/5 pb-2">
                              <Heart size={16} className="text-rose-500" />
                              Final Diagnostics & Attending Treatment Plan
                            </h3>
                            <form onSubmit={handleDoctorFinalSubmit} className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-slate-400 mb-1.5 font-medium">Attending Diagnosis Definition</label>
                                  <input type="text" required value={docFinalDiagnosis} onChange={e => setDocFinalDiagnosis(e.target.value)} placeholder="Confirmed Right Lower Lobe Atypical Pneumonia" className="w-full glass-input" />
                                </div>
                                <div>
                                  <label className="block text-slate-400 mb-1.5 font-medium">Follow-Up Instructions</label>
                                  <input type="text" required value={docFollowUp} onChange={e => setDocFollowUp(e.target.value)} placeholder="Repeat chest X-ray in 4 weeks. Primary consult in 7 days." className="w-full glass-input" />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-slate-400 mb-1.5 font-medium">Prescription Dosage Schedule</label>
                                  <textarea rows="3" required value={docPrescription} onChange={e => setDocPrescription(e.target.value)} placeholder="Azithromycin 250mg orally once daily for 5 days. Monitor for allergies." className="w-full glass-input" />
                                </div>
                                <div>
                                  <label className="block text-slate-400 mb-1.5 font-medium">Clinical Treatment Plan Summary</label>
                                  <textarea rows="3" required value={docTreatmentPlan} onChange={e => setDocTreatmentPlan(e.target.value)} placeholder="Rest, hydration, empiric antibiotic therapy, trigger pulmonology referral if SpO2 drops below 92%." className="w-full glass-input" />
                                </div>
                              </div>

                              <button type="submit" className="w-full glass-btn-primary py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500">
                                Submit Final Care Plan & Close Case File
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="glass-panel p-12 text-center text-slate-500 text-xs rounded-xl">
                        No active clinical case loaded. Select a case from the sidebar directory.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: APPOINTMENTS */}
              {activeTab === 'appointments' && (
                <div className="grid grid-cols-12 gap-6">
                  {/* Left Column: Form */}
                  <div className="col-span-12 md:col-span-5 glass-panel p-5 rounded-xl space-y-4 text-xs">
                    <h3 className="font-bold text-xs uppercase text-slate-300 flex items-center gap-1.5 border-b border-white/5 pb-2.5">
                      <Calendar size={14} className="text-cyan-400" />
                      Book Consultation Appointment
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
                          alert('Appointment scheduled!');
                          fetchDashboardData();
                        }
                      } catch (err) { alert(err.message); }
                    }} className="space-y-4">
                      <div>
                        <label className="block text-slate-400 mb-1.5">Select Patient</label>
                        <select name="patientSelect" required className="w-full glass-input">
                          {patients.map(p => (
                            <option key={p._id} value={p._id}>{p.name} ({p.patientId})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1.5">Consultation Date & Time</label>
                        <input type="datetime-local" name="appointmentDate" required className="w-full glass-input" />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1.5">Reason for Consultation</label>
                        <textarea rows="3" name="reason" required placeholder="Asthma checkup, prescription review..." className="w-full glass-input" />
                      </div>

                      <button type="submit" className="w-full glass-btn-primary py-2.5">
                        Schedule Consultation
                      </button>
                    </form>
                  </div>

                  {/* Right Column: List */}
                  <div className="col-span-12 md:col-span-7 glass-panel p-5 rounded-xl space-y-4">
                    <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5">
                      Consultations Schedule List
                    </h3>
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {appointments.map(app => (
                        <div key={app._id} className="p-3.5 bg-slate-950/60 border border-white/5 rounded-xl text-xs flex justify-between items-center">
                          <div>
                            <span className="font-mono text-[9px] text-cyan-400">{new Date(app.appointmentDate).toLocaleString()}</span>
                            <div className="font-bold text-white mt-1">{app.patient?.name}</div>
                            <div className="text-slate-400 mt-0.5">Reason: {app.reason}</div>
                          </div>
                          <span className="bg-cyan-950/40 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded text-[10px] font-semibold">{app.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ============================================================== */}
          {/* RADIOLOGIST DASHBOARD */}
          {/* ============================================================== */}
          {auth.user?.role === 'Radiologist' && (
            <>
              {/* TAB: OVERVIEW QUEUE */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider font-semibold">Awaiting Scan Request</div>
                      <div className="text-3xl font-bold text-cyan-400 mt-2">
                        {cases.filter(c => c.status === 'Awaiting Imaging').length}
                      </div>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider font-semibold font-semibold">Imaging Complete</div>
                      <div className="text-3xl font-bold text-cyan-400 mt-2">
                        {cases.filter(c => c.status !== 'Awaiting Imaging' && c.status !== 'New Case').length}
                      </div>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider font-semibold">AI Accuracy Rate</div>
                      <div className="text-3xl font-bold text-emerald-400 mt-2">94.2%</div>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider font-semibold">Avg reporting speed</div>
                      <div className="text-3xl font-bold text-cyan-400 mt-2">18m</div>
                    </div>
                  </div>

                  {/* Queue tables */}
                  <div className="glass-panel p-6 rounded-xl space-y-4">
                    <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5 flex items-center gap-2">
                      <Clock className="text-cyan-400" size={14} />
                      Today's Imaging Queue (Assigned Clinical Scans)
                    </h3>
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400 font-mono text-[9px] uppercase">
                            <th className="py-2 px-3">Case ID</th>
                            <th className="py-2 px-3">Patient</th>
                            <th className="py-2 px-3">Requested Modality</th>
                            <th className="py-2 px-3">Priority</th>
                            <th className="py-2 px-3">Case Status</th>
                            <th className="py-2 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cases.filter(c => c.status === 'Awaiting Imaging' || c.status === 'Imaging Uploaded' || c.status === 'AI Analysis Completed').map(c => (
                            <tr key={c._id} className="border-b border-white/5 hover:bg-slate-900/20">
                              <td className="py-3 px-3 font-mono text-cyan-400 font-bold">{c.caseId}</td>
                              <td className="py-3 px-3 font-semibold text-white">{c.patient?.name} ({c.patient?.age}y / {c.patient?.gender})</td>
                              <td className="py-3 px-3 text-slate-300 font-mono">{c.modality}</td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-mono ${getPriorityBadgeClass(c.priorityLevel)}`}>{c.priorityLevel}</span>
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-mono ${getStatusBadgeClass(c.status)}`}>{c.status}</span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  onClick={() => { setSelectedCase(c); setSelectedReport(c.radiologyReport); setActiveTab('workstation'); }}
                                  className="glass-btn-primary text-[10px] py-1 flex items-center gap-1 hover:bg-cyan-500 cursor-pointer ml-auto"
                                >
                                  Ingest Case <ArrowRight size={10} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {cases.filter(c => c.status === 'Awaiting Imaging' || c.status === 'Imaging Uploaded' || c.status === 'AI Analysis Completed').length === 0 && (
                            <tr>
                              <td colSpan="6" className="py-6 text-center text-slate-500">No imaging cases pending in queue.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: WORKSTATION (RADIOLOGIST SCAN INGESTION) */}
              {activeTab === 'workstation' && (
                <div className="grid grid-cols-12 gap-6">
                  {/* Left Column: Form and Upload */}
                  <div className="col-span-12 lg:col-span-4 space-y-6">
                    {selectedCase ? (
                      <div className="glass-panel p-5 rounded-xl border border-white/5 space-y-4 text-xs">
                        <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5">
                          DICOM scan upload
                        </h3>
                        <div>
                          <span className="text-slate-500 font-mono text-[9px]">CASE ID: {selectedCase.caseId}</span>
                          <div className="font-bold text-white text-sm mt-1">{selectedCase.patient?.name}</div>
                          <div className="text-slate-400 mt-0.5">Modality: {selectedCase.modality}</div>
                        </div>

                        {/* Upload scan */}
                        <form onSubmit={handleUploadImaging} className="space-y-3">
                          <div>
                            <label className="block text-slate-500 text-[10px] mb-1">Select DICOM or Scan Image File</label>
                            <input 
                              type="file" required onChange={e => setUploadFile(e.target.files[0])}
                              className="w-full text-slate-400 text-xs mt-1"
                            />
                          </div>
                          <button type="submit" className="w-full glass-btn-primary py-2">
                            Upload Scan to PACS
                          </button>
                        </form>

                        {/* AI Trigger */}
                        {selectedReport && (
                          <div className="pt-4 border-t border-white/5 space-y-3">
                            <span className="text-slate-500 text-[10px]">AI Neural Inference Engine</span>
                            <button
                              onClick={handleRunAIAnalysis} disabled={loading}
                              className="w-full glass-btn-secondary py-2 flex items-center justify-center gap-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 cursor-pointer"
                            >
                              <Cpu size={14} className={loading ? 'animate-spin' : ''} />
                              {loading ? 'Running AI Models...' : 'Run AI Analysis & Generate Heatmap'}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="glass-panel p-6 text-center text-slate-500 text-xs rounded-xl">
                        Select a case from the queue in the <button onClick={() => setActiveTab('overview')} className="text-cyan-400 underline cursor-pointer">Queue Overview</button> first.
                      </div>
                    )}
                  </div>

                  {/* Right Column: Radiologist Workstation view */}
                  <div className="col-span-12 lg:col-span-8 space-y-6">
                    {selectedCase && selectedReport ? (
                      <div className="space-y-6">
                        {/* PACS viewer and heatmap */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                        {/* AI Output results details */}
                        {selectedCase.aiPrediction && (
                          <div className="glass-panel p-5 rounded-xl border border-white/5 space-y-4 text-xs">
                            <h3 className="font-bold text-xs uppercase text-cyan-400 border-b border-white/5 pb-2">
                              AI Neural Networks Output Draft
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-slate-500 text-[10px]">Predicted Disease Correlation:</span>
                                <div className="text-base font-bold text-white mt-1">{selectedCase.aiPrediction.predictedDisease} ({(selectedCase.aiPrediction.confidenceScore * 100).toFixed(1)}%)</div>
                              </div>
                              <div>
                                <span className="text-slate-500 text-[10px]">Affected Region / Segment:</span>
                                <div className="text-base font-bold text-slate-300 mt-1">{selectedCase.aiPrediction.affectedRegion}</div>
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px]">Suggested Clinical Finding Notes:</span>
                              <p className="text-slate-300 leading-normal mt-1 italic">"{selectedCase.aiPrediction.suggestedFindings}"</p>
                            </div>
                            {selectedCase.aiPrediction.indicators && Object.keys(selectedCase.aiPrediction.indicators).length > 0 && (
                              <div className="pt-2 border-t border-white/5">
                                <span className="text-slate-500 text-[10px] block mb-1">Extracted Clinical Indicators:</span>
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                                  {Object.entries(selectedCase.aiPrediction.indicators).map(([key, val]) => (
                                    <div key={key} className="bg-slate-950/40 p-1.5 rounded border border-white/5">
                                      <span className="text-slate-500 capitalize">{key.replace('_', ' ')}:</span>{' '}
                                      <span className="text-cyan-400 font-bold">{val}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Submit Radiologist Observation Form */}
                        <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 space-y-4 text-xs">
                          <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2">
                            Submit Final Radiologist Diagnostic Report
                          </h3>
                          <form onSubmit={handleRadiologistSubmitReport} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-slate-400 mb-1.5 font-medium">Observation Draft Decision</label>
                                <select value={obsAction} onChange={e => setObsAction(e.target.value)} className="w-full glass-input">
                                  <option value="Accept AI">Accept AI Suggested Observation</option>
                                  <option value="Modify AI">Edit AI Findings</option>
                                  <option value="Reject AI">Reject AI Findings</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1.5 font-medium">Attending Radiologist Name</label>
                                <input type="text" disabled value={auth.user?.name} className="w-full glass-input opacity-70" />
                              </div>
                            </div>

                            <div>
                              <label className="block text-slate-400 mb-1.5 font-medium">Final Radiology Diagnostic Observation Note</label>
                              <textarea 
                                rows="3" required value={radiologistObservation} onChange={e => setRadiologistObservation(e.target.value)}
                                placeholder="Right lung console zone shows focal opacities. Corresponds to AI predicted atypical pneumonia." className="w-full glass-input"
                              />
                            </div>

                            <button type="submit" className="w-full glass-btn-primary py-2 font-semibold">
                              Submit Final Report & Set Status: "Ready For Doctor Review"
                            </button>
                          </form>
                        </div>
                      </div>
                    ) : (
                      selectedCase && (
                        <div className="glass-panel p-12 text-center text-slate-500 text-xs rounded-xl">
                          Medical Scan file not uploaded. Upload image in the left panel to trigger workstation view.
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* TAB: COMPLETED REPORTS */}
              {activeTab === 'reports' && (
                <div className="glass-panel p-6 rounded-xl space-y-4">
                  <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5">
                    Completed Radiology Reports
                  </h3>
                  <div className="space-y-2 max-h-[480px] overflow-y-auto">
                    {cases.filter(c => c.status === 'Doctor Review Pending' || c.status === 'Treatment Completed' || c.status === 'Case Closed').map(c => (
                      <div key={c._id} className="p-4 bg-slate-950/60 border border-white/5 rounded-xl text-xs flex justify-between items-center">
                        <div>
                          <div className="font-mono text-[9px] text-cyan-400">{c.caseId} ({c.modality})</div>
                          <div className="font-bold text-white mt-1">{c.patient?.name}</div>
                          {c.radiologyReport && <p className="text-slate-400 italic mt-1 leading-normal">"Observation: {c.radiologyReport.radiologistObservation}"</p>}
                        </div>
                        <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-semibold">Report Completed</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ============================================================== */}
          {/* ADMIN DASHBOARD */}
          {/* ============================================================== */}
          {auth.user?.role === 'Admin' && (
            <>
              {/* TAB: OVERVIEW ANALYTICS */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats card grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider font-semibold">Total Patients</div>
                      <div className="text-3xl font-bold text-cyan-400 mt-2">{analytics?.stats?.totalPatients || 0}</div>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider font-semibold">Total Doctors</div>
                      <div className="text-3xl font-bold text-cyan-400 mt-2">{analytics?.stats?.totalDoctors || 0}</div>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider font-semibold">Total Radiologists</div>
                      <div className="text-3xl font-bold text-cyan-400 mt-2">{analytics?.stats?.totalRadiologists || 0}</div>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider font-semibold">Today's New Cases</div>
                      <div className="text-3xl font-bold text-cyan-400 mt-2">{analytics?.stats?.todaysCases || 0}</div>
                    </div>
                  </div>

                  {/* More Admin Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider font-semibold">Completed Diagnoses</div>
                      <div className="text-3xl font-bold text-emerald-400 mt-2">{analytics?.stats?.completedCasesCount || 0}</div>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider font-semibold">AI Success Rate</div>
                      <div className="text-3xl font-bold text-cyan-400 mt-2">{analytics?.modelMetrics?.aiSuccessRate * 100 || 98.4}%</div>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border border-white/5 text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider font-semibold">System Uptime</div>
                      <div className="text-lg font-mono font-bold text-cyan-400 mt-3">{analytics?.modelMetrics?.systemUptime || '14d 6h 12m'}</div>
                    </div>
                  </div>

                  {/* Accuracies SVG plots */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Accuracy epochs plot */}
                    <div className="glass-panel p-5 rounded-xl border border-white/5 space-y-4">
                      <h4 className="font-semibold text-slate-300 text-xs uppercase font-mono">Model Accuracy Curve (Training Epochs)</h4>
                      <div className="bg-slate-950 border border-brand-500/10 rounded p-4 h-[180px] flex items-center justify-center">
                        <svg viewBox="0 0 400 150" className="w-full h-full">
                          <line x1="40" y1="20" x2="380" y2="20" stroke="rgba(6, 182, 212, 0.06)" strokeDasharray="3"/>
                          <line x1="40" y1="70" x2="380" y2="70" stroke="rgba(6, 182, 212, 0.06)" strokeDasharray="3"/>
                          <line x1="40" y1="120" x2="380" y2="120" stroke="rgba(6, 182, 212, 0.06)" strokeDasharray="3"/>
                          <line x1="40" y1="120" x2="380" y2="120" stroke="rgba(6, 182, 212, 0.12)"/>
                          <line x1="40" y1="20" x2="40" y2="120" stroke="rgba(6, 182, 212, 0.12)"/>
                          <path d="M 40 110 Q 100 80, 180 50 T 380 30" fill="none" stroke="#0ea5e9" strokeWidth="3"/>
                          <circle cx="380" cy="30" r="4" fill="#0ea5e9"/>
                          <text x="345" y="25" className="fill-cyan-400 font-mono text-[9px]">Acc: 94.2%</text>
                        </svg>
                      </div>
                    </div>

                    {/* Confusion matrix grid */}
                    <div className="glass-panel p-5 rounded-xl border border-white/5 space-y-4">
                      <h4 className="font-semibold text-slate-300 text-xs uppercase font-mono">Confusion Matrix (Validation)</h4>
                      <div className="bg-slate-950 border border-brand-500/10 rounded p-4 h-[180px] flex items-center justify-center">
                        <div className="grid grid-cols-2 gap-2 text-center w-full max-w-[280px] text-xs">
                          <div className="bg-slate-900/60 p-3 border border-white/5 rounded">
                            <div className="text-[10px] text-slate-500 font-bold font-mono">True Pos (TP)</div>
                            <div className="text-lg font-bold text-white mt-1">142</div>
                          </div>
                          <div className="bg-slate-900/60 p-3 border border-white/5 rounded">
                            <div className="text-[10px] text-slate-500 font-bold font-mono">False Neg (FN)</div>
                            <div className="text-lg font-bold text-white mt-1">8</div>
                          </div>
                          <div className="bg-slate-900/60 p-3 border border-white/5 rounded">
                            <div className="text-[10px] text-slate-500 font-bold font-mono">False Pos (FP)</div>
                            <div className="text-lg font-bold text-white mt-1">9</div>
                          </div>
                          <div className="bg-slate-900/60 p-3 border border-white/5 rounded">
                            <div className="text-[10px] text-slate-500 font-bold font-mono">True Neg (TN)</div>
                            <div className="text-lg font-bold text-white mt-1">161</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: USER MANAGEMENT & APPROVALS */}
              {activeTab === 'user_management' && (
                <div className="space-y-6">
                  {/* Approvals Ledger */}
                  <div className="glass-panel p-5 rounded-xl border border-white/5 space-y-4">
                    <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5">
                      Clinician Access Approval Ledger
                    </h3>
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400 font-mono text-[9px] uppercase">
                            <th className="py-2.5 px-3">Name</th>
                            <th className="py-2.5 px-3">Email</th>
                            <th className="py-2.5 px-3">Role</th>
                            <th className="py-2.5 px-3">Department</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingUsers.map(user => (
                            <tr key={user._id} className="border-b border-white/5 hover:bg-slate-900/20">
                              <td className="py-3 px-3 font-semibold text-white">{user.name}</td>
                              <td className="py-3 px-3 text-slate-400">{user.email}</td>
                              <td className="py-3 px-3">
                                <span className="bg-cyan-950/40 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded text-[10px] font-semibold font-mono uppercase">{user.role}</span>
                              </td>
                              <td className="py-3 px-3 text-slate-300">{user.department}</td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  onClick={() => handleApproveClinician(user._id)}
                                  className="glass-btn-primary text-[10px] py-1 cursor-pointer"
                                >
                                  Authorize Practitioner
                                </button>
                              </td>
                            </tr>
                          ))}
                          {pendingUsers.length === 0 && (
                            <tr>
                              <td colSpan="5" className="py-6 text-center text-slate-500">No accounts awaiting administrator approval.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Suspensions & User Directory */}
                  <div className="glass-panel p-5 rounded-xl border border-white/5 space-y-4">
                    <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5">
                      System Practitioner Registry
                    </h3>
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400 font-mono text-[9px] uppercase">
                            <th className="py-2 px-3">Practitioner</th>
                            <th className="py-2 px-3">Email</th>
                            <th className="py-2 px-3">Role</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map(user => (
                            <tr key={user._id} className="border-b border-white/5 hover:bg-slate-900/20">
                              <td className="py-3 px-3 font-semibold text-white">{user.name}</td>
                              <td className="py-3 px-3 text-slate-400">{user.email}</td>
                              <td className="py-3 px-3">
                                <span className="bg-slate-900 border border-white/5 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-300">{user.role}</span>
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-mono ${user.isSuspended ? 'bg-rose-950/40 text-rose-400 border border-rose-800' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-800'}`}>
                                  {user.isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right flex justify-end gap-2">
                                {user.isSuspended ? (
                                  <button onClick={() => handleUnsuspendUser(user._id)} className="text-[10px] bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-500 cursor-pointer">Activate</button>
                                ) : (
                                  user.role !== 'Admin' && <button onClick={() => handleSuspendUser(user._id)} className="text-[10px] bg-rose-600 text-white px-2 py-1 rounded hover:bg-rose-500 cursor-pointer">Suspend</button>
                                )}
                                <button onClick={() => { setResetPassUserId(user._id); alert(`Reset password initiated for ${user.name}`); }} className="text-[10px] bg-slate-800 border border-white/5 text-slate-300 px-2 py-1 rounded hover:bg-slate-700 cursor-pointer">Reset Pass</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Reset Password Form Block */}
                    {resetPassUserId && (
                      <form onSubmit={handleResetPassword} className="p-4 bg-slate-950/60 rounded-xl border border-white/5 flex items-end gap-4 mt-4">
                        <div className="flex-1">
                          <label className="block text-slate-500 text-[10px] mb-1 font-mono">Reset Password to Value</label>
                          <input 
                            type="password" required value={newPasswordValue} onChange={e => setNewPasswordValue(e.target.value)}
                            placeholder="Enter new strong password" className="w-full glass-input py-1 text-xs"
                          />
                        </div>
                        <button type="submit" className="glass-btn-primary py-1.5 text-xs">Submit Reset</button>
                        <button onClick={() => setResetPassUserId('')} className="glass-btn-secondary py-1.5 text-xs">Cancel</button>
                      </form>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: HIPAA AUDIT LOGS */}
              {activeTab === 'audit_logs' && (
                <div className="glass-panel p-6 rounded-xl border border-white/5 space-y-4">
                  <div className="border-b border-white/5 pb-2.5">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="text-cyan-400" size={18} />
                      HIPAA Audit Ledger & PHI access log
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Strict ledger tracking patient case reads, diagnostic uploads, and credential adjustments.</p>
                  </div>
                  
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 font-mono text-[9px] uppercase">
                          <th className="py-2 px-3">Timestamp</th>
                          <th className="py-2 px-3">Accessor</th>
                          <th className="py-2 px-3">Role</th>
                          <th className="py-2 px-3">Action</th>
                          <th className="py-2 px-3">HIPAA Log details</th>
                          <th className="py-2 px-3 font-mono">Network IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map(log => (
                          <tr key={log._id} className="border-b border-white/5 hover:bg-slate-900/20">
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px]">{new Date(log.createdAt).toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-slate-200 font-medium">{log.userName}</td>
                            <td className="py-2.5 px-3 text-slate-400">{log.userRole}</td>
                            <td className="py-2.5 px-3">
                              <span className="bg-slate-900 text-cyan-400 px-1.5 py-0.5 rounded font-mono text-[9px] border border-cyan-500/10">
                                {log.action}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">{log.details}</td>
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px]">{log.ipAddress}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: AI MODELS & HARDWARE */}
              {activeTab === 'ai_models' && (
                <div className="grid grid-cols-12 gap-6 text-xs">
                  {/* GPU metrics */}
                  <div className="col-span-12 md:col-span-4 glass-panel p-5 rounded-xl border border-white/5 space-y-4">
                    <h3 className="font-bold text-xs uppercase text-slate-300 flex items-center gap-1.5 border-b border-white/5 pb-2.5">
                      <Cpu size={14} className="text-cyan-400" />
                      GPU Hardware metrics
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-slate-950/60 p-3 rounded border border-white/5">
                        <div className="flex justify-between mb-1.5 text-slate-400">
                          <span>GPU Temperature</span>
                          <span className="font-mono text-cyan-400 font-bold">{gpuMetrics.temp} °C</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded overflow-hidden">
                          <div className="bg-cyan-500 h-full" style={{ width: `${(gpuMetrics.temp / 90)*100}%` }}></div>
                        </div>
                      </div>

                      <div className="bg-slate-950/60 p-3 rounded border border-white/5">
                        <div className="flex justify-between mb-1.5 text-slate-400">
                          <span>Video Load</span>
                          <span className="font-mono text-cyan-400 font-bold">{gpuMetrics.load} %</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded overflow-hidden">
                          <div className="bg-cyan-400 h-full animate-pulse" style={{ width: `${gpuMetrics.load}%` }}></div>
                        </div>
                      </div>

                      <div className="bg-slate-950/60 p-3 rounded border border-white/5">
                        <div className="flex justify-between mb-1.5 text-slate-400">
                          <span>VRAM Allocation</span>
                          <span className="font-mono text-cyan-400 font-bold">{gpuMetrics.memory} / 16.0 GB</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded overflow-hidden">
                          <div className="bg-cyan-600 h-full" style={{ width: `${(gpuMetrics.memory / 16.0)*100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Models list */}
                  <div className="col-span-12 md:col-span-8 glass-panel p-5 rounded-xl border border-white/5 space-y-4">
                    <h3 className="font-bold text-xs uppercase text-slate-300 flex items-center gap-2 border-b border-white/5 pb-2.5">
                      <Cpu size={14} className="text-cyan-400" />
                      Inference AI Models & Weights Registry
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-500 font-mono text-[9px] uppercase">
                            <th className="py-2 px-3">Model Engine</th>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Storage Size</th>
                            <th className="py-2 px-3">Model Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics?.modelMetrics?.datasetVersions?.map((d, i) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-slate-900/30">
                              <td className="py-2.5 px-3 text-white font-bold font-mono">{d.version}</td>
                              <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{d.date}</td>
                              <td className="py-2.5 px-3 text-slate-400 font-mono">{d.size}</td>
                              <td className="py-2.5 px-3 text-slate-300">{d.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="flex gap-2 pt-3 justify-end">
                      <button className="glass-btn-secondary text-[10px] py-1.5 flex items-center gap-1.5 hover:bg-white/10"><RefreshCcw size={11}/> Pull PubMed Guidelines</button>
                      <button className="glass-btn-primary text-[10px] py-1.5">Deploy New Weights Version</button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: SETTINGS (DEPARTMENTS) */}
              {activeTab === 'settings' && (
                <div className="grid grid-cols-12 gap-6 text-xs">
                  {/* Left: Department List */}
                  <div className="col-span-12 md:col-span-6 glass-panel p-5 rounded-xl border border-white/5 space-y-4">
                    <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5">
                      Hospital Departments Settings
                    </h3>
                    <div className="space-y-2">
                      {deptList.map((d, idx) => (
                        <div key={idx} className="p-3 bg-slate-950/60 border border-white/5 rounded-xl flex justify-between items-center">
                          <span className="font-semibold text-white">{d}</span>
                          <button 
                            onClick={() => {
                              if (confirm(`Remove department ${d}?`)) {
                                setDeptList(prev => prev.filter(dept => dept !== d));
                              }
                            }}
                            className="text-rose-400 hover:text-rose-500 cursor-pointer"
                          >
                            <Trash size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Add Form */}
                  <div className="col-span-12 md:col-span-6 glass-panel p-5 rounded-xl border border-white/5 space-y-4">
                    <h3 className="font-bold text-xs uppercase text-slate-300 border-b border-white/5 pb-2.5">
                      Register Hospital Department
                    </h3>
                    <form onSubmit={handleAddDept} className="space-y-4">
                      <div>
                        <label className="block text-slate-400 mb-1.5 font-medium">Department Name</label>
                        <input 
                          type="text" required value={newDeptName} onChange={e => setNewDeptName(e.target.value)}
                          placeholder="Neurology" className="w-full glass-input"
                        />
                      </div>
                      <button type="submit" className="w-full glass-btn-primary py-2 font-semibold">
                        Add Department to Hospital List
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}
