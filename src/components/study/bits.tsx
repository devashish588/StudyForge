"use client";

import React from "react";

export function ProgressRing({
  value, size = 120, stroke = 10, label, sublabel, color = "#10b981",
}: {
  value: number; size?: number; stroke?: number; label: string; sublabel?: string; color?: string;
}) {
  const pct = Math.max(0, value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.min(100, pct) / 100;
  return (
    <div className="flex flex-col items-center" role="img" aria-label={`${label} ${Math.round(pct)} percent`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(148,163,184,0.15)" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - filled)}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold text-card-foreground">
            {Math.round(pct)}<span className="text-xs font-bold text-gray-400">%</span>
          </span>
          <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">{label}</span>
        </div>
      </div>
      {sublabel && <p className="text-[11px] text-gray-400 mt-1 text-center">{sublabel}</p>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="text-center py-8 px-4 border border-dashed border-border rounded-xl bg-border/10">
      <p className="text-sm font-bold text-gray-300">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{hint}</p>
    </div>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs font-extrabold tracking-widest text-gray-400 uppercase">{children}</h2>
      {right}
    </div>
  );
}
