import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loginSuccess, logout } from './store/index.js';
import axios from 'axios';
import io from 'socket.io-client';
import { X, Clock } from 'lucide-react';

// Modular views imports
import LoginView from './components/Auth/LoginView.jsx';
import SignupView from './components/Auth/SignupView.jsx';
import GlassSidebar from './components/Layout/GlassSidebar.jsx';
import TopNavbar from './components/Layout/TopNavbar.jsx';
import DoctorDashboard from './components/Dashboard/DoctorDashboard.jsx';
import RadiologistDashboard from './components/Dashboard/RadiologistDashboard.jsx';
import AdminDashboard from './components/Dashboard/AdminDashboard.jsx';
import AIAnalysisOverlay from './components/UI/AIAnalysisOverlay.jsx';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const dispatch = useDispatch();
  const auth = useSelector(state => state.auth);
  
  // Navigation tabs based on role
  const [activeTab, setActiveTab] = useState('overview');

  // Theme state
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Hardware metrics simulation
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
    { id: 1, text: 'System Online. Real-time MedVision AI workstation loaded.', type: 'info' }
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
      const resPat = await axios.get(`${API_BASE}/patients?includeDeleted=true`, getAxiosConfig());
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
    if (e) e.preventDefault();
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
        setPatName(''); setPatAge(''); setPatContact(''); setPatAddress(''); setPatEmergency(''); setPatHistory(''); setPatSymptoms('');
        fetchDashboardData();
        setSelectedPatient(res.data.patient);
        setActiveTab('create_case');
      }
    } catch (err) {
      alert('Patient registration failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleTemporaryDeletePatient = async (patientId) => {
    if (!window.confirm('Are you sure you want to temporarily delete (archive) this patient record? You can restore it anytime.')) {
      return;
    }
    try {
      const res = await axios.put(`${API_BASE}/patients/${patientId}/temporary-delete`, {}, getAxiosConfig());
      if (res.data.success) {
        addNotification(res.data.message || 'Patient record temporarily deleted.', 'warning');
        fetchDashboardData();
        setSelectedPatient(null);
      }
    } catch (err) {
      alert('Failed to temporarily delete patient: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleRestorePatient = async (patientId) => {
    try {
      const res = await axios.put(`${API_BASE}/patients/${patientId}/restore`, {}, getAxiosConfig());
      if (res.data.success) {
        addNotification(res.data.message || 'Patient record restored successfully.', 'success');
        fetchDashboardData();
        setSelectedPatient(res.data.patient);
      }
    } catch (err) {
      alert('Failed to restore patient: ' + (err.response?.data?.message || err.message));
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
        status: 'Treatment Completed'
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
        // Reload case
        const resCase = await axios.get(`${API_BASE}/patients/cases/${selectedCase._id}`, getAxiosConfig());
        if (resCase.data.success) setSelectedCase(resCase.data.clinicalCase);
      }
    } catch (err) { alert('Scan upload failed: ' + (err.response?.data?.message || err.message)); }
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
    } catch (err) { alert('AI processing failed: ' + (err.response?.data?.message || err.message)); }
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

  // Case stages
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
    if (status === 'Treatment Completed') return 6;
    if (status === 'Case Closed') return 7;
    return timelineStages.indexOf(status);
  };

  // Rendering conditional auth screens
  if (!auth.isAuthenticated) {
    if (isRegistering) {
      return (
        <SignupView 
          regName={regName} setRegName={setRegName}
          regEmail={regEmail} setRegEmail={setRegEmail}
          regPassword={regPassword} setRegPassword={setRegPassword}
          regRole={regRole} setRegRole={setRegRole}
          regDept={regDept} setRegDept={setRegDept}
          showRegPassword={showRegPassword} setShowRegPassword={setShowRegPassword}
          loading={loading}
          handleRegister={handleRegister}
          setIsRegistering={setIsRegistering}
        />
      );
    }
    return (
      <LoginView 
        email={email} setEmail={setEmail}
        password={password} setPassword={setPassword}
        error={error} setError={setError}
        successMsg={successMsg} setSuccessMsg={setSuccessMsg}
        loading={loading}
        loginRole={loginRole} setLoginRole={setLoginRole}
        showPassword={showPassword} setShowPassword={setShowPassword}
        handleLogin={handleLogin}
        handleQuickLogin={handleQuickLogin}
        handleSeedDatabase={handleSeedDatabase}
        setIsRegistering={setIsRegistering}
      />
    );
  }

  // Active Workspace
  return (
    <div className="min-h-screen bg-[#061826] flex text-slate-100 font-sans relative">
      {theme === 'light' && (
        <style>{`
          /* Day Mode clinical light overrides */
          body {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
          }
          .min-h-screen,
          .bg-\\[\\#061826\\], 
          .bg-\\[\\#061826\\]\\/70, 
          .bg-\\[\\#061826\\]\\/60, 
          .bg-\\[\\#061826\\]\\/50, 
          .bg-\\[\\#061826\\]\\/40,
          .bg-\\[\\#061826\\]\\/75,
          .bg-\\[\\#0b253a\\],
          .bg-\\[\\#0b253a\\]\\/60,
          .bg-\\[\\#102a43\\],
          .bg-\\[\\#102a43\\]\\/65,
          .bg-\\[\\#102a43\\]\\/60,
          .bg-\\[\\#102a43\\]\\/75,
          .bg-\\[\\#102a43\\]\\/20 {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
          .bg-\\[\\#061826\\]\\/40,
          .bg-\\[\\#061826\\]\\/50,
          .bg-\\[\\#061826\\]\\/60,
          .bg-\\[\\#061826\\]\\/70,
          .bg-\\[\\#061826\\]\\/75,
          .bg-\\[\\#0b253a\\]\\/60,
          .bg-\\[\\#102a43\\]\\/60,
          .bg-\\[\\#102a43\\]\\/65,
          .bg-\\[\\#102a43\\]\\/75 {
            background-color: rgba(255, 255, 255, 0.75) !important;
            color: #0f172a !important;
          }
          .glass-panel {
            background: rgba(255, 255, 255, 0.75) !important;
            border-color: rgba(15, 23, 42, 0.08) !important;
            box-shadow: 0 20px 50px rgba(15, 23, 42, 0.04) !important;
          }
          .glass-card {
            background: rgba(255, 255, 255, 0.5) !important;
            border-color: rgba(15, 23, 42, 0.06) !important;
          }
          .text-slate-100, .text-slate-200, .text-slate-300, .text-white,
          span.text-white, .glass-panel .text-white, .glass-card .text-white {
            color: #0f172a !important;
          }
          .text-slate-400, .text-slate-500 {
            color: #475569 !important;
          }
          .border-white\\/5, .border-white\\/10, .border-slate-800, .border-slate-700 {
            border-color: rgba(15, 23, 42, 0.08) !important;
          }
          select option {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
          /* Visual grid pattern and glows overrides in day mode */
          .laboratory-grid {
            background-image: 
              linear-gradient(rgba(15, 23, 42, 0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(15, 23, 42, 0.02) 1px, transparent 1px) !important;
          }
          .laboratory-glows {
            background: 
              radial-gradient(circle at 10% 20%, rgba(0, 198, 255, 0.04) 0%, transparent 40%),
              radial-gradient(circle at 90% 80%, rgba(123, 97, 255, 0.04) 0%, transparent 40%),
              radial-gradient(circle at 50% 50%, rgba(241, 245, 249, 0.5) 0%, transparent 60%) !important;
          }
          .floating-circle {
            background: radial-gradient(circle, rgba(0, 114, 255, 0.08) 0%, transparent 70%) !important;
          }
        `}</style>
      )}
      
      {/* Background visual components */}
      <div className="laboratory-grid" />
      <div className="laboratory-glows" />
      <div className="floating-circle w-96 h-96 top-10 left-10" />
      <div className="floating-circle w-80 h-80 bottom-10 right-10" style={{ animationDelay: '-10s' }} />

      {/* Side Menu */}
      <GlassSidebar 
        user={auth.user} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={() => dispatch(logout())} 
      />

      {/* Content Body */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        
        {/* Navbar */}
        <TopNavbar 
          activeTab={activeTab} 
          gpuMetrics={gpuMetrics} 
          notifications={notifications} 
          setNotifications={setNotifications} 
          theme={theme}
          toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        />

        {/* Live alert ticker if active notifications */}
        {notifications.length > 0 && (
          <div className="bg-[#0b253a]/60 border-b border-cyan-500/15 px-8 py-2.5 flex items-center justify-between text-[11px] text-cyan-300">
            <div className="flex items-center gap-2">
              <Clock size={12} className="animate-pulse text-cyan-400" />
              <span><strong>System Alert:</strong> {notifications[0].text}</span>
            </div>
            <button 
              onClick={() => setNotifications([])} 
              className="text-cyan-400 hover:text-white transition p-1 hover:bg-white/5 rounded"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Dashboard layouts based on clinician roles */}
        <main className="p-8 flex-1">
          {auth.user?.role === 'Doctor' && (
            <DoctorDashboard 
              activeTab={activeTab} setActiveTab={setActiveTab}
              patients={patients} selectedPatient={selectedPatient} setSelectedPatient={setSelectedPatient}
              cases={cases} selectedCase={selectedCase} setSelectedCase={setSelectedCase}
              appointments={appointments}
              caseNotes={caseNotes} newNote={newNote} setNewNote={setNewNote}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              casesFilter={casesFilter} setCasesFilter={setCasesFilter}
              
              patName={patName} setPatName={setPatName} patAge={patAge} setPatAge={setPatAge} patGender={patGender} setPatGender={setPatGender}
              patContact={patContact} setPatContact={setPatContact} patAddress={patAddress} setPatAddress={setPatAddress} patEmergency={patEmergency} setPatEmergency={setPatEmergency}
              patHistory={patHistory} setPatHistory={setPatHistory} patSymptoms={patSymptoms} setPatSymptoms={setPatSymptoms} patTemp={patTemp} setPatTemp={setPatTemp}
              patPulse={patPulse} setPatPulse={setPatPulse} patBpSys={patBpSys} setPatBpSys={setPatBpSys} patBpDia={patBpDia} setPatBpDia={setPatBpDia} patSpo2={patSpo2} setPatSpo2={setPatSpo2}
              
              caseModality={caseModality} setCaseModality={setCaseModality} caseComplaint={caseComplaint} setCaseComplaint={setCaseComplaint}
              caseNotesText={caseNotesText} setCaseNotesText={setCaseNotesText} caseImagingReason={caseImagingReason} setCaseImagingReason={setCaseImagingReason}
              casePriority={casePriority} setCasePriority={setCasePriority}
              
              radiologistsList={radiologistsList} selectedRadiologist={selectedRadiologist} setSelectedRadiologist={setSelectedRadiologist}
              radioSearchQuery={radioSearchQuery} setRadioSearchQuery={setRadioSearchQuery}
              
              docFinalDiagnosis={docFinalDiagnosis} setDocFinalDiagnosis={setDocFinalDiagnosis} docTreatmentPlan={docTreatmentPlan} setDocTreatmentPlan={setDocTreatmentPlan}
              docPrescription={docPrescription} setDocPrescription={setDocPrescription} docFollowUp={docFollowUp} setDocFollowUp={setDocFollowUp}
              
              handleRegisterPatient={handleRegisterPatient}
              handleTemporaryDeletePatient={handleTemporaryDeletePatient}
              handleRestorePatient={handleRestorePatient}
              handleCreateCase={handleCreateCase}
              handleAddDoctorNote={handleAddDoctorNote}
              handleDoctorFinalSubmit={handleDoctorFinalSubmit}
              fetchCaseNotes={fetchCaseNotes}
              
              getPriorityBadgeClass={getPriorityBadgeClass}
              getStatusBadgeClass={getStatusBadgeClass}
              timelineStages={timelineStages}
              getStageIndex={getStageIndex}
              API_BASE={API_BASE}
              getAxiosConfig={getAxiosConfig}
            />
          )}

          {auth.user?.role === 'Radiologist' && (
            <RadiologistDashboard 
              activeTab={activeTab} setActiveTab={setActiveTab}
              cases={cases} selectedCase={selectedCase} setSelectedCase={setSelectedCase}
              selectedReport={selectedReport} setSelectedReport={setSelectedReport}
              uploadFile={uploadFile} setUploadFile={setUploadFile}
              radiologistObservation={radiologistObservation} setRadiologistObservation={setRadiologistObservation}
              obsAction={obsAction} setObsAction={setObsAction}
              loading={loading}
              
              handleUploadImaging={handleUploadImaging}
              handleRunAIAnalysis={handleRunAIAnalysis}
              handleRadiologistSubmitReport={handleRadiologistSubmitReport}
              
              getPriorityBadgeClass={getPriorityBadgeClass}
              getStatusBadgeClass={getStatusBadgeClass}
              auth={auth}
            />
          )}

          {auth.user?.role === 'Admin' && (
            <AdminDashboard 
              activeTab={activeTab}
              analytics={analytics}
              appointments={appointments}
              auditLogs={auditLogs}
              users={users}
              pendingUsers={pendingUsers}
              gpuMetrics={gpuMetrics}
              deptList={deptList} setDeptList={setDeptList}
              resetPassUserId={resetPassUserId} setResetPassUserId={setResetPassUserId}
              newPasswordValue={newPasswordValue} setNewPasswordValue={setNewPasswordValue}
              newDeptName={newDeptName} setNewDeptName={setNewDeptName}
              
              handleApproveClinician={handleApproveClinician}
              handleSuspendUser={handleSuspendUser}
              handleUnsuspendUser={handleUnsuspendUser}
              handleResetPassword={handleResetPassword}
              handleAddDept={handleAddDept}
              
              getPriorityBadgeClass={getPriorityBadgeClass}
              getStatusBadgeClass={getStatusBadgeClass}
            />
          )}
        </main>
      </div>

      {/* AI Inference Overlay */}
      <AIAnalysisOverlay isOpen={loading && activeTab === 'workstation'} />

    </div>
  );
}
