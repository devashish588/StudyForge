import React from "react";

interface ProgressBarProps {
  value: number; // 0 to 100
  color?: string;
  heightClass?: string;
  showText?: boolean;
}

export function ProgressBar({ value, color = "bg-accent", heightClass = "h-2.5", showText = false }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="w-full">
      <div className={`w-full bg-border/60 rounded-full overflow-hidden ${heightClass}`}>
        <div
          className={`${color} ${heightClass} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showText && (
        <div className="flex justify-end mt-1">
          <span className="text-xs font-semibold text-gray-400">{clamped}%</span>
        </div>
      )}
    </div>
  );
}
