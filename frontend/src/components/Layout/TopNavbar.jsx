import React, { useState } from 'react';
import { 
  Cpu, Bell, Search, Shield, Check, Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TopNavbar({ activeTab, gpuMetrics, notifications, setNotifications, theme, toggleTheme, user }) {
  const [showNotifications, setShowNotifications] = useState(false);

  const getBreadcrumbName = (tab) => {
    if (!tab) return 'DASHBOARD';
    return tab.replace(/_/g, ' ').toUpperCase();
  };

  const clearAlerts = () => {
    setNotifications([]);
  };

  const isLight = theme === 'light';

  return (
    <header className={`h-16 border-b px-6 flex items-center justify-between sticky top-0 backdrop-blur-xl z-20 transition-all duration-200 ${
      isLight 
        ? 'bg-white/90 border-slate-200 text-[#0f172a] shadow-sm' 
        : 'bg-[#0f172a]/90 border-slate-800 text-white'
    }`}>
      {/* Breadcrumb & AI Status Badge */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 font-display">
          <Shield size={14} className="text-[#2563eb]" />
          <span className={isLight ? "tracking-wider text-slate-500" : "tracking-wider text-slate-400"}>
            MULTIDIAGNOSIS AI
          </span>
          <span>/</span>
          <span className={`tracking-widest font-bold font-display ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
            {getBreadcrumbName(activeTab)}
          </span>
        </div>

        {/* AI Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
          <span className="ai-status-pulse" />
          <span>AI ENGINE ACTIVE</span>
        </div>
      </div>

      {/* Center Search Bar */}
      <div className="hidden md:flex items-center relative max-w-sm w-full mx-4">
        <Search size={14} className="absolute left-3 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search patients, diagnostic scans, or report IDs..."
          className={`w-full glass-input pl-9 pr-4 py-1.5 text-xs focus:ring-2 focus:ring-[#2563eb]/40 ${
            isLight ? 'bg-slate-100 border-slate-200 text-[#0f172a]' : 'bg-slate-900 border-slate-800 text-white'
          }`}
        />
      </div>

      {/* Actions, Theme Switcher & Profile Badge */}
      <div className="flex items-center gap-4 text-xs font-sans">
        
        {/* GPU Telemetry Pill */}
        <div className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-mono border ${
          isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-300'
        }`}>
          <Cpu size={13} className="text-[#06b6d4] animate-pulse" />
          <span className={isLight ? "text-slate-500" : "text-slate-400"}>GPU:</span>
          <span className="text-[#2563eb] font-bold">{gpuMetrics?.temp || 65}°C</span>
          <span className={isLight ? "text-slate-300" : "text-slate-700"}>•</span>
          <span className="text-emerald-500 font-bold">{gpuMetrics?.load || 52}%</span>
        </div>

        {/* Theme Toggle Button */}
        <button 
          type="button"
          onClick={toggleTheme}
          className={`p-2 border rounded-xl transition duration-150 cursor-pointer shadow-sm ${
            isLight 
              ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' 
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
          title="Toggle Light/Dark Theme"
        >
          {isLight ? <Moon size={15} /> : <Sun size={15} />}
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button 
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-2 border rounded-xl transition duration-150 relative cursor-pointer shadow-sm ${
              isLight 
                ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' 
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Bell size={15} />
            {notifications && notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
            )}
          </button>

          {/* Notifications Dropdown */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className={`absolute right-0 mt-2.5 w-72 border rounded-2xl p-4 shadow-2xl z-40 text-xs text-left ${
                  isLight ? 'bg-white border-slate-200 text-[#0f172a]' : 'bg-[#0f172a] border-slate-800 text-white'
                }`}
              >
                <div className={`flex justify-between items-center border-b pb-2 mb-2 font-display ${
                  isLight ? 'border-slate-200' : 'border-slate-800'
                }`}>
                  <span className={`font-bold ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                    System Alerts ({notifications?.length || 0})
                  </span>
                  {notifications && notifications.length > 0 && (
                    <button 
                      type="button"
                      onClick={clearAlerts} 
                      className="text-[10px] text-[#2563eb] font-semibold cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {notifications && notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className={`p-2.5 rounded-xl border flex gap-2 items-start leading-relaxed text-[11px] ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <Check size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className={isLight ? 'text-slate-800' : 'text-slate-200'}>{n.text}</div>
                        <span className="text-[8px] text-slate-400 font-mono block mt-0.5">Real-time alert</span>
                      </div>
                    </div>
                  ))}
                  {(!notifications || notifications.length === 0) && (
                    <div className="text-center text-slate-400 py-4 italic font-display">No active system notifications.</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Profile Badge */}
        {user && (
          <div className={`flex items-center gap-2 pl-2 border-l ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2563eb] to-[#06b6d4] text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="hidden xl:block">
              <div className={`font-bold font-display leading-tight ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                {user.name}
              </div>
              <div className="text-[9px] text-[#2563eb] font-semibold uppercase">{user.role}</div>
            </div>
          </div>
        )}

      </div>
    </header>
  );
}
