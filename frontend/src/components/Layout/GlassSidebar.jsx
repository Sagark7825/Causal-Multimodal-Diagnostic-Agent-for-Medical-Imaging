import React, { useState } from 'react';
import { 
  Activity, Layout, UserPlus, Search, Sliders, Calendar, 
  Clock, Upload, FileText, UserCheck, ShieldCheck, Cpu, 
  Settings, LogOut, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function GlassSidebar({ user, activeTab, setActiveTab, onLogout }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'Admin': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'Doctor': return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
      case 'Radiologist': return 'bg-brand-500/10 text-brand-400 border border-brand-500/20';
      default: return 'bg-white/5 text-slate-400 border border-white/5';
    }
  };

  const navItems = {
    Doctor: [
      { id: 'overview', label: 'Dashboard Overview', icon: Layout },
      { id: 'register_patient', label: 'Register Patient', icon: UserPlus },
      { id: 'search_patient', label: 'Search Patient/Cases', icon: Search },
      { id: 'workstation', label: 'AI CDSS Workstation', icon: Sliders },
      { id: 'appointments', label: 'Appointments', icon: Calendar }
    ],
    Radiologist: [
      { id: 'overview', label: 'Imaging Ingest Queue', icon: Clock },
      { id: 'workstation', label: 'Ingest Scan & AI Run', icon: Upload },
      { id: 'reports', label: 'Completed Reports', icon: FileText }
    ],
    Admin: [
      { id: 'overview', label: 'Overview Analytics', icon: Layout },
      { id: 'user_management', label: 'User & Approvals', icon: UserCheck },
      { id: 'audit_logs', label: 'HIPAA Security Log', icon: ShieldCheck },
      { id: 'ai_models', label: 'AI Models & GPUs', icon: Cpu },
      { id: 'settings', label: 'Hospital Settings', icon: Settings }
    ]
  };

  const currentNav = navItems[user?.role] || [];

  return (
    <motion.aside 
      animate={{ width: isCollapsed ? 80 : 256 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="bg-[#102a43]/65 border-r border-white/7 flex flex-col justify-between h-screen sticky top-0 backdrop-blur-3xl z-30"
    >
      <div>
        {/* Header / Logo */}
        <div className={`p-5 border-b border-white/5 flex items-center justify-between ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-400/10 rounded-xl text-cyan-400 border border-cyan-400/25 shadow-[0_0_15px_rgba(0,198,255,0.1)]">
              <Activity size={18} className="animate-pulse" />
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="font-bold text-white tracking-tight leading-none text-sm font-display">
                  MedVision AI
                </h1>
                <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider font-mono">
                  CDSS Station
                </span>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* User Card */}
        {!isCollapsed && user && (
          <div className="p-4 mx-4 my-4 bg-[#061826]/70 rounded-2xl border border-white/5 text-xs shadow-inner">
            <span className="text-slate-500 text-[10px] uppercase font-mono font-bold tracking-wider">
              Practitioner:
            </span>
            <div className="font-bold text-slate-200 mt-1 truncate font-display">{user.name}</div>
            <div className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getRoleBadge(user.role)}`}>
              {user.role}
            </div>
          </div>
        )}

        {/* Navigation links */}
        <nav className="px-3 space-y-1.5 mt-4">
          {currentNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all relative duration-200 ${
                  isActive 
                    ? 'text-white' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/4'
                }`}
              >
                {/* Active glow backing */}
                {isActive && (
                  <motion.div 
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-gradient-to-r from-cyan-500/15 to-brand-500/15 border border-cyan-500/25 rounded-xl shadow-[0_0_15px_rgba(0,198,255,0.05)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                
                <Icon size={15} className={`z-10 ${isActive ? 'text-cyan-400 filter drop-shadow-[0_0_6px_#00c6ff]' : ''}`} />
                {!isCollapsed && <span className="z-10 truncate font-display">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout Session Button */}
      <div className="p-3 border-t border-white/5">
        <button
          onClick={onLogout}
          className={`w-full bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 hover:border-rose-500/35 text-rose-400 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition duration-200 cursor-pointer ${isCollapsed ? 'px-0' : ''}`}
        >
          <LogOut size={13} />
          {!isCollapsed && <span className="font-display">End Session</span>}
        </button>
      </div>
    </motion.aside>
  );
}
