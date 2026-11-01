import React, { useState } from 'react';
import { 
  LayoutDashboard, Users, UserCheck, Image, Scan, Activity, 
  Sparkles, FileText, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight, UserPlus 
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function GlassSidebar({ user, activeTab, setActiveTab, onLogout, theme }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isLight = theme === 'light';

  const getRoleBadge = (role) => {
    switch (role) {
      case 'Admin': 
        return isLight ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
      case 'Doctor': 
        return isLight ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      case 'Radiologist': 
        return isLight ? 'bg-cyan-100 text-cyan-700 border border-cyan-200' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
      default: 
        return isLight ? 'bg-slate-200 text-slate-700 border border-slate-300' : 'bg-slate-800 text-slate-400 border border-slate-700';
    }
  };

  const getNavItems = (role) => {
    switch (role) {
      case 'Admin':
        return [
          { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'doctors', label: 'User Management', icon: UserCheck },
          { id: 'patients', label: 'Patients Directory', icon: Users },
          { id: 'xray', label: 'X-Ray Diagnosis', icon: Image },
          { id: 'ctscan', label: 'CT Scan Diagnosis', icon: Scan },
          { id: 'mri', label: 'MRI Diagnosis', icon: Activity },
          { id: 'workstation', label: 'AI Models & Hardware', icon: Sparkles },
          { id: 'reports', label: 'HIPAA Audit Logs', icon: FileText },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'settings', label: 'Settings', icon: Settings }
        ];
      case 'Doctor':
        return [
          { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'register_patient', label: 'Add Patient', icon: UserPlus },
          { id: 'patients', label: 'Patients', icon: Users },
          { id: 'workstation', label: 'AI Diagnosis', icon: Sparkles },
          { id: 'reports', label: 'Medical Reports', icon: FileText },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'settings', label: 'Settings', icon: Settings }
        ];
      case 'Radiologist':
        return [
          { id: 'overview', label: 'Imaging Queue', icon: LayoutDashboard },
          { id: 'workstation', label: 'Scan Ingestion & AI', icon: Sparkles },
          { id: 'mri_lab', label: 'MRI Lab', icon: Activity },
          { id: 'reports', label: 'Radiology Reports', icon: FileText },
          { id: 'settings', label: 'Settings', icon: Settings }
        ];
      default:
        return [
          { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'register_patient', label: 'Add Patient', icon: UserPlus },
          { id: 'patients', label: 'Patients', icon: Users },
          { id: 'workstation', label: 'AI Diagnosis', icon: Sparkles },
          { id: 'reports', label: 'Medical Reports', icon: FileText },
          { id: 'settings', label: 'Settings', icon: Settings }
        ];
    }
  };

  const navItems = getNavItems(user?.role);

  return (
    <motion.aside 
      animate={{ width: isCollapsed ? 80 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={`flex flex-col justify-between h-screen sticky top-0 z-30 transition-all duration-200 ${
        isLight 
          ? 'bg-white border-r border-slate-200 text-[#0f172a] shadow-lg' 
          : 'bg-[#0f172a] border-r border-[#1e293b] text-[#f8fafc] shadow-2xl'
      }`}
    >
      <div>
        {/* Header / Brand Logo */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isLight ? 'border-slate-200' : 'border-[#1e293b]'
        } ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2563eb] to-[#06b6d4] flex items-center justify-center text-white font-bold text-sm shadow-md">
              MA
            </div>
            {!isCollapsed && (
              <div>
                <h1 className={`font-bold tracking-tight leading-none text-sm font-display ${
                  isLight ? 'text-[#0f172a]' : 'text-white'
                }`}>
                  MultiDiagnosis <span className="text-[#06b6d4]">AI</span>
                </h1>
                <span className={`text-[9px] font-semibold uppercase tracking-widest font-mono block mt-1 ${
                  isLight ? 'text-[#2563eb]' : 'text-emerald-400'
                }`}>
                  Enterprise Platform
                </span>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-1 rounded-lg transition cursor-pointer ${
              isLight ? 'text-slate-500 hover:text-[#0f172a] hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* User Card */}
        {!isCollapsed && user && (
          <div className={`p-4 mx-4 my-4 rounded-2xl border text-xs ${
            isLight ? 'bg-slate-100/80 border-slate-200 text-[#0f172a]' : 'bg-slate-900/90 border-[#1e293b] text-white'
          }`}>
            <span className={`text-[9px] uppercase font-mono font-bold tracking-wider ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Practitioner Account:
            </span>
            <div className={`font-bold mt-0.5 truncate font-display ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
              {user.name}
            </div>
            <div className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getRoleBadge(user.role)}`}>
              {user.role}
            </div>
          </div>
        )}

        {/* Navigation links */}
        <nav className="px-3 space-y-1.5 mt-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'workstation' && activeTab === 'ai_diagnosis');

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all relative duration-200 cursor-pointer ${
                  isActive 
                    ? isLight 
                      ? 'bg-blue-50 text-[#2563eb] font-bold border-l-4 border-[#2563eb] shadow-sm' 
                      : 'nav-item-active text-white font-bold' 
                    : isLight 
                      ? 'text-slate-600 hover:text-[#0f172a] hover:bg-slate-100' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon size={16} className={`${
                  isActive 
                    ? isLight ? 'text-[#2563eb]' : 'text-[#06b6d4]' 
                    : isLight ? 'text-slate-500' : 'text-slate-400'
                }`} />
                {!isCollapsed && <span className="truncate font-display">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout Session Button */}
      <div className={`p-3 border-t ${isLight ? 'border-slate-200' : 'border-[#1e293b]'}`}>
        <button
          onClick={onLogout}
          className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition duration-200 cursor-pointer ${
            isLight 
              ? 'bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600' 
              : 'bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400'
          } ${isCollapsed ? 'px-0' : ''}`}
        >
          <LogOut size={14} />
          {!isCollapsed && <span className="font-display">End Session</span>}
        </button>
      </div>
    </motion.aside>
  );
}
