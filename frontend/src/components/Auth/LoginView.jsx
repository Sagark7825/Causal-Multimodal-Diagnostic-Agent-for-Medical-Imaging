import React from 'react';
import { motion } from 'framer-motion';
import { Activity, ShieldAlert, Eye, EyeOff, ArrowRight, Database, RefreshCcw, Key } from 'lucide-react';

export default function LoginView({ 
  email, setEmail, 
  password, setPassword, 
  error, setError, 
  successMsg, setSuccessMsg, 
  loading, 
  loginRole, setLoginRole, 
  showPassword, setShowPassword, 
  handleLogin, 
  handleQuickLogin, 
  handleSeedDatabase,
  setIsRegistering 
}) {
  
  // Custom submit interceptor to make sure loginRole is verified
  const onSubmit = (e) => {
    e.preventDefault();
    handleLogin(e);
  };

  return (
    <div className="min-h-screen bg-[#061826] grid grid-cols-1 lg:grid-cols-12 relative overflow-hidden font-display">
      
      {/* Background neon glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-600/5 rounded-full blur-[140px] pointer-events-none"></div>
      
      <div className="laboratory-grid" />
      <div className="laboratory-glows" />

      {/* LEFT COLUMN: Modern DNA & AI Visuals */}
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

        {/* DNA Helix and floating nodes visual core */}
        <div className="my-auto relative py-12 flex flex-col items-center">
          {/* Animated DNA Helix */}
          <div className="dna-helix mb-12">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="dna-bar" />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center max-w-md space-y-4"
          >
            <h2 className="text-3xl font-bold tracking-tight text-white leading-tight font-display">
              Multimodal Medical Decision Analytics
            </h2>
            <p className="text-slate-400 text-sm font-medium leading-relaxed font-sans">
              Deploying deep layer DenseNet121, AI vision pipelines, and causal graph backdoor adjustments to build trusted medical diagnostics.
            </p>
          </motion.div>
        </div>

        <div className="flex items-center justify-between text-slate-500 text-[10px] font-mono">
          <span>&copy; {new Date().getFullYear()} MedVision AI platform</span>
          <span className="flex items-center gap-1.5"><ShieldAlert size={12} className="text-cyan-400" /> HIPAA Secure Workstation</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Glass login card */}
      <div className="lg:col-span-6 flex flex-col items-center justify-center p-8 z-10 relative">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="glass-panel w-full max-w-md p-8 rounded-3xl border border-cyan-500/20 shadow-2xl relative overflow-hidden"
        >
          {/* Subtle decoration lines */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-cyan-400 via-brand-500 to-indigo-500" />

          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-white tracking-tight font-display">Welcome Back</h1>
            <p className="text-xs text-slate-400 mt-1 font-sans font-medium">Access your enterprise clinical support dashboard</p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3.5 rounded-xl mb-5 flex items-start gap-2.5 font-sans">
              <ShieldAlert size={15} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3.5 rounded-xl mb-5 flex items-start gap-2.5 font-sans">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4 font-sans text-xs">
            
            {/* Workspace Select */}
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
                Select Workspace Mode
              </label>
              <div className="grid grid-cols-2 gap-2 bg-[#061826]/75 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                <button
                  type="button"
                  onClick={() => setLoginRole('Doctor')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                    loginRole === 'Doctor'
                      ? 'bg-gradient-to-r from-cyan-500 to-brand-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🩺 Doctor
                </button>
                <button
                  type="button"
                  onClick={() => setLoginRole('Radiologist')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                    loginRole === 'Radiologist'
                      ? 'bg-gradient-to-r from-cyan-500 to-brand-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ☢️ Radiologist
                </button>
              </div>
            </div>

            {/* Email field */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Hospital Email Address</label>
              <input
                type="email" 
                required 
                className="w-full glass-input"
                placeholder="clinician@medvision.ai" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password field */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"} 
                  required 
                  className="w-full glass-input pr-10"
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Signin trigger */}
            <button
              type="submit" 
              disabled={loading}
              className="w-full glass-btn-primary py-3 flex items-center justify-center gap-2 mt-4 text-xs font-semibold cursor-pointer shadow-lg shadow-cyan-500/10"
            >
              {loading ? 'Authenticating Profile...' : 'Sign In to Workspace'}
              <ArrowRight size={15} />
            </button>

            {/* Register trigger */}
            <div className="text-center mt-4">
              <button 
                type="button" 
                onClick={() => setIsRegistering(true)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
              >
                Register New Clinician Profile
              </button>
            </div>
          </form>

          {/* QUICK DEV LOGINS DROPDOWN */}
          <div className="mt-8 pt-6 border-t border-white/5 space-y-3 font-sans">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block text-center">
              Quick Clinician Logins
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => {
                  setLoginRole('Doctor');
                  handleQuickLogin('doctor@medcausal.com');
                }}
                className="px-2 py-2 bg-white/3 border border-white/5 hover:border-cyan-400/30 rounded-xl text-[10px] text-slate-300 hover:text-cyan-400 transition cursor-pointer flex flex-col items-center gap-1 font-medium"
              >
                <span>🩺</span>
                <span>Doctor</span>
              </button>
              <button 
                onClick={() => {
                  setLoginRole('Radiologist');
                  handleQuickLogin('radiologist@medcausal.com');
                }}
                className="px-2 py-2 bg-white/3 border border-white/5 hover:border-cyan-400/30 rounded-xl text-[10px] text-slate-300 hover:text-cyan-400 transition cursor-pointer flex flex-col items-center gap-1 font-medium"
              >
                <span>☢️</span>
                <span>Radiologist</span>
              </button>
            </div>

            {/* Seed database option */}
            <div className="flex justify-center pt-2">
              <button
                onClick={handleSeedDatabase}
                className="text-[9px] font-mono text-slate-500 hover:text-cyan-400 transition flex items-center gap-1 px-3 py-1 bg-white/2 hover:bg-white/4 rounded-lg border border-white/5 cursor-pointer"
              >
                <Database size={10} /> Seed Database API
              </button>
            </div>
          </div>

        </motion.div>
      </div>

    </div>
  );
}
