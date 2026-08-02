import React, { useState } from 'react';
import { Cpu, Activity, Bell, Search, Shield, X, Check, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TopNavbar({ activeTab, gpuMetrics, notifications, setNotifications, theme, toggleTheme }) {
  const [showNotifications, setShowNotifications] = useState(false);

  const getBreadcrumbName = (tab) => {
    return tab.replace(/_/g, ' ').toUpperCase();
  };

  const clearAlerts = () => {
    setNotifications([]);
  };

  return (
    <header className="h-16 border-b border-white/5 bg-[#061826]/40 px-6 flex items-center justify-between sticky top-0 backdrop-blur-xl z-20">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 font-display">
        <Shield size={13} className="text-cyan-400" />
        <span className="tracking-wider">MEDVISION AI CORE</span>
        <span>/</span>
        <span className="text-white tracking-widest font-bold">
          {getBreadcrumbName(activeTab)}
        </span>
      </div>

      {/* Center global search container */}
      <div className="hidden md:flex items-center relative max-w-xs w-full mx-4">
        <Search size={13} className="absolute left-3 text-slate-400" />
        <input 
          type="text" 
          placeholder="Global system search..."
          className="w-full glass-input pl-9 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-cyan-400/40"
        />
      </div>

      {/* Telemetry and Triage Alert options */}
      <div className="flex items-center gap-6 text-[10px] font-mono text-slate-400">
        
        {/* GPU Temp */}
        <div className="flex items-center gap-1.5 bg-white/3 border border-white/5 px-2.5 py-1.5 rounded-lg">
          <Cpu size={12} className="text-cyan-400 animate-pulse" />
          <span>GPU TEMP: <span className="text-cyan-400 font-bold font-number">{gpuMetrics.temp}°C</span></span>
        </div>

        {/* GPU Load */}
        <div className="flex items-center gap-1.5 bg-white/3 border border-white/5 px-2.5 py-1.5 rounded-lg">
          <Activity size={12} className="text-emerald-400" />
          <span>GPU LOAD: <span className="text-emerald-400 font-bold font-number">{gpuMetrics.load}%</span></span>
        </div>

        {/* AI Model metadata */}
        <div className="hidden lg:flex items-center gap-1.5 bg-white/3 border border-white/5 px-2.5 py-1.5 rounded-lg">
          <Shield size={12} className="text-indigo-400" />
          <span>ENGINE: <span className="text-indigo-400 font-bold">DENSENET121-V4</span></span>
        </div>

        {/* Theme Toggle & Notification Bell Container */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle Button */}
          <button 
            type="button"
            onClick={toggleTheme}
            className="p-2 bg-white/3 border border-white/5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition duration-150 cursor-pointer"
            title="Toggle Day/Night Mode"
          >
            {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
          </button>

          {/* Notification Bell with Dropdown Menu */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 bg-white/3 border border-white/5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition duration-150 relative cursor-pointer"
            >
              <Bell size={13} />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
              )}
            </button>

            {/* Notifications dropdown menu */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2.5 w-72 glass-panel border border-white/10 rounded-xl p-3 shadow-2xl z-40 text-xs text-left"
                >
                  <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2 font-display">
                    <span className="font-bold text-white">System Logs ({notifications.length})</span>
                    {notifications.length > 0 && (
                      <button 
                        type="button"
                        onClick={clearAlerts} 
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-2 bg-white/3 rounded-lg border border-white/5 flex gap-2 items-start leading-relaxed">
                        <Check size={11} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-slate-200">{n.text}</div>
                          <span className="text-[8px] text-slate-500 font-mono block mt-0.5">Real-time alert</span>
                        </div>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <div className="text-center text-slate-500 py-4 italic font-display">No alerts in system.</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </header>
  );
}
