"use client";

import React from "react";

interface ConfidenceRatingProps {
  value: number; // 1-5
  onChange: (val: number) => void;
}

const labels = [
  "1 — Don't understand it",
  "2 — Understand the basics",
  "3 — Solve basic questions",
  "4 — Comfortable",
  "5 — Explain/Solve without help"
];

export function ConfidenceRating({ value, onChange }: ConfidenceRatingProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-400">Self Assessment Confidence (1–5)</label>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={`w-9 h-9 rounded-lg font-bold text-xs border transition flex items-center justify-center ${
              value === score
                ? "bg-accent border-accent text-white shadow-md scale-105"
                : "bg-border/30 border-border text-gray-400 hover:border-gray-500"
            }`}
          >
            {score}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 italic mt-1">{labels[value - 1] || labels[2]}</p>
    </div>
  );
}
