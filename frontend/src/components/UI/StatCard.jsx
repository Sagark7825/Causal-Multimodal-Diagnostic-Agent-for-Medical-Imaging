import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

function AnimatedNumber({ value }) {
  const numeric = typeof value === 'number' ? value : parseFloat(value);
  const isPercent = typeof value === 'string' && value.includes('%');
  const isDecimal = numeric % 1 !== 0;

  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { stiffness: 60, damping: 15 });
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    motionValue.set(numeric || 0);
  }, [numeric, motionValue]);

  useEffect(() => {
    return springValue.on('change', (latest) => {
      setDisplayVal(latest);
    });
  }, [springValue]);

  if (isNaN(numeric)) {
    return <span>{value}</span>;
  }

  return (
    <span className="font-mono">
      {isDecimal ? displayVal.toFixed(1) : Math.floor(displayVal)}
      {isPercent && '%'}
    </span>
  );
}

export default function StatCard({ title, value, icon: Icon, colorClass = "text-cyan-400", sparklineColor = "#00c6ff" }) {
  // Generate random data for sparkline
  const [chartData] = useState(() => 
    Array.from({ length: 12 }, () => ({ val: 30 + Math.random() * 70 }))
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card p-5 relative overflow-hidden flex flex-col justify-between h-[155px] cursor-default"
    >
      {/* Background soft light glow */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-white/3 rounded-full blur-xl pointer-events-none" />

      {/* Card Header */}
      <div className="flex justify-between items-start">
        <span className="text-slate-400 text-[10px] uppercase font-mono tracking-wider font-semibold">
          {title}
        </span>
        <div className={`p-2.5 bg-white/5 rounded-xl border border-white/5 ${colorClass}`}>
          {Icon && <Icon size={16} className="filter drop-shadow-[0_0_8px_currentColor]" />}
        </div>
      </div>

      {/* Value */}
      <div className="mt-2 text-2xl font-bold tracking-tight text-white font-display">
        <AnimatedNumber value={value} />
      </div>

      {/* Mini Line Chart / Telemetry Sparkline */}
      <div className="h-10 w-full mt-2 opacity-60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="val"
              stroke={sparklineColor}
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
