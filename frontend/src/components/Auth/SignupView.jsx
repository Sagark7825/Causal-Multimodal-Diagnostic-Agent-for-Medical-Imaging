import React from 'react';
import { motion } from 'framer-motion';
import { Activity, ShieldAlert, Eye, EyeOff, UserPlus, ArrowLeft } from 'lucide-react';

export default function SignupView({
  regName, setRegName,
  regEmail, setRegEmail,
  regPassword, setRegPassword,
  regRole, setRegRole,
  regDept, setRegDept,
  showRegPassword, setShowRegPassword,
  loading,
  handleRegister,
  setIsRegistering
}) {

  return (
    <div className="min-h-screen bg-[#061826] grid grid-cols-1 lg:grid-cols-12 relative overflow-hidden font-display">
      
      {/* Background neon glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-600/5 rounded-full blur-[140px] pointer-events-none"></div>
      
      <div className="laboratory-grid" />
      <div className="laboratory-glows" />

      {/* LEFT COLUMN: Visual healthcare illustration */}
      <div className="hidden lg:flex lg:col-span-6 flex-col justify-between p-12 relative overflow-hidden border-r border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(0,198,255,0.15)]">
            <Activity size={24} />
          </div>
          <div>
            <span className="font-bold text-white tracking-tight leading-none text-base">MedVision AI</span>
            <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider font-mono block">Clinical support</span>
          </div>
        </div>

        {/* Circular Scanner graphic */}
        <div className="my-auto relative py-12 flex flex-col items-center">
          <div className="relative w-40 h-40 mb-8 flex items-center justify-center">
            <div className="absolute inset-0 border-2 border-dashed border-cyan-400/20 rounded-full animate-[spin_30s_linear_infinite]" />
            <div className="absolute inset-3 border border-brand-500/30 rounded-full animate-[spin_10s_linear_infinite]" />
            <div className="w-16 h-16 bg-cyan-400/10 rounded-full flex items-center justify-center border border-cyan-400/20 shadow-[0_0_20px_rgba(0,198,255,0.05)]">
              <UserPlus className="text-cyan-400 animate-pulse" size={24} />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center max-w-md space-y-4"
          >
            <h2 className="text-3xl font-bold tracking-tight text-white leading-tight font-display">
              Clinician Authentication Gateway
            </h2>
            <p className="text-slate-400 text-sm font-medium leading-relaxed font-sans">
              Create your secure, HIPAA-compliant digital practitioner keys. All registrations require administrator validation before clinical access is granted.
            </p>
          </motion.div>
        </div>

        <div className="flex items-center justify-between text-slate-500 text-[10px] font-mono">
          <span>&copy; {new Date().getFullYear()} MedVision AI platform</span>
          <span className="flex items-center gap-1.5"><ShieldAlert size={12} className="text-cyan-400" /> Secure Encryption Mode</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Glass signup card */}
      <div className="lg:col-span-6 flex flex-col items-center justify-center p-8 z-10 relative">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="glass-panel w-full max-w-md p-8 rounded-3xl border border-cyan-500/20 shadow-2xl relative overflow-hidden"
        >
          {/* Subtle top decoration */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-cyan-400 via-brand-500 to-indigo-500" />

          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-white tracking-tight font-display">Create Clinician Profile</h1>
            <p className="text-xs text-slate-400 mt-1 font-sans font-medium">Enter your credentials to apply for diagnostic access</p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-4 font-sans text-xs">
            
            {/* Full Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name & Title</label>
              <input
                type="text" 
                required 
                className="w-full glass-input"
                placeholder="Dr. Sarah Jenkins" 
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Hospital Email Address</label>
              <input
                type="email" 
                required 
                className="w-full glass-input"
                placeholder="s.jenkins@springfield.org" 
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showRegPassword ? "text" : "password"} 
                  required 
                  className="w-full glass-input pr-10"
                  placeholder="••••••••" 
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 focus:outline-none cursor-pointer"
                >
                  {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Role & Department */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Clinical Workspace Role</label>
                <select
                  value={regRole} 
                  onChange={(e) => setRegRole(e.target.value)}
                  className="w-full glass-input py-2"
                >
                  <option value="Doctor">Doctor</option>
                  <option value="Radiologist">Radiologist</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Department</label>
                <input
                  type="text" 
                  required 
                  className="w-full glass-input"
                  placeholder="Radiology" 
                  value={regDept}
                  onChange={(e) => setRegDept(e.target.value)}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit" 
              disabled={loading}
              className="w-full glass-btn-primary py-3 flex items-center justify-center gap-2 mt-4 text-xs font-semibold cursor-pointer shadow-lg shadow-cyan-500/10"
            >
              <UserPlus size={14} />
              {loading ? 'Submitting Registration...' : 'Register Profile'}
            </button>

            {/* Back to Login */}
            <div className="text-center mt-4">
              <button 
                type="button" 
                onClick={() => setIsRegistering(false)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
              >
                <ArrowLeft size={13} />
                Return to Sign In
              </button>
            </div>
          </form>

        </motion.div>
      </div>

    </div>
  );
}
