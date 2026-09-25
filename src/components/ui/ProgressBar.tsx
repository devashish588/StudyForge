import React from "react";

interface ProgressBarProps {
  value: number; // 0 to 100
  color?: string;
  heightClass?: string;
  showText?: boolean;
  /** Accessible name, e.g. "GATE syllabus progress". Falls back to visible text. */
  label?: string;
}

// Phase 7 — accessible shared progress: semantic role + real values.
// State is never color-alone: a textual value is always exposed to AT.
export function ProgressBar({ value, color = "bg-accent", heightClass = "h-2", showText = false, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="w-full">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={label}
        className={`w-full bg-border/60 rounded-full overflow-hidden ${heightClass}`}
      >
        <div
          className={`${color} ${heightClass} rounded-full transition-[width] duration-200 ease-out motion-reduce:transition-none`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showText ? (
        <div className="flex justify-end mt-1">
          <span className="type-metadata">{clamped}%</span>
        </div>
      ) : (
        <span className="sr-only">{clamped}%{label ? ` ${label}` : ""}</span>
      )}
    </div>
  );
}
