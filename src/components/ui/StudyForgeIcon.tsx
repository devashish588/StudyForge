import React from "react";

interface StudyForgeIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
  showBackground?: boolean;
}

export function StudyForgeIcon({
  size = 32,
  className = "",
  showBackground = true,
  ...props
}: StudyForgeIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      {...props}
    >
      <defs>
        {/* Background Radial Gradient */}
        <radialGradient id="sf-bg-grad" cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#181A26" />
          <stop offset="55%" stopColor="#0F1017" />
          <stop offset="100%" stopColor="#07070B" />
        </radialGradient>

        {/* Electric Indigo Left Blade */}
        <linearGradient id="sf-left-blade" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>

        {/* Electric Indigo Right Blade */}
        <linearGradient id="sf-right-blade" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="50%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#3730A3" />
        </linearGradient>

        {/* Apex Peak Crown Gradient */}
        <linearGradient id="sf-apex-grad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#EEF2FF" />
          <stop offset="50%" stopColor="#C7D2FE" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>

        {/* Base Chevron Foundation Gradient */}
        <linearGradient id="sf-base-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4338CA" />
          <stop offset="100%" stopColor="#1E1B4B" />
        </linearGradient>

        {/* Warm Amber Forged Ember Core Gradient */}
        <linearGradient id="sf-amber-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="35%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>

        {/* Ember Glow Filter */}
        <filter id="sf-ember-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {showBackground && (
        <>
          <rect width="512" height="512" rx="116" fill="url(#sf-bg-grad)" />
          <rect
            width="506"
            height="506"
            x="3"
            y="3"
            rx="113"
            fill="none"
            stroke="#2A2E40"
            strokeWidth="1.5"
            opacity="0.6"
          />
        </>
      )}

      <g transform={showBackground ? "" : "translate(0, 0)"}>
        {/* 1. Apex Crown Peak */}
        <polygon
          points="256,64 300,108 256,152 212,108"
          fill="url(#sf-apex-grad)"
        />

        {/* 2. Left Monolith Blade */}
        <path
          d="M 196,124 L 144,176 L 144,336 L 196,388 L 236,348 L 236,296 L 196,256 L 236,216 L 236,164 Z"
          fill="url(#sf-left-blade)"
        />

        {/* 3. Right Monolith Blade */}
        <path
          d="M 316,124 L 368,176 L 368,336 L 316,388 L 276,348 L 276,296 L 316,256 L 276,216 L 276,164 Z"
          fill="url(#sf-right-blade)"
        />

        {/* 4. Lower Foundation Anchor */}
        <polygon
          points="256,364 316,424 256,456 196,424"
          fill="url(#sf-base-grad)"
        />

        {/* 5. Central Warm Amber Forged Ember Core */}
        <g filter="url(#sf-ember-glow)">
          <polygon
            points="256,196 306,256 256,316 206,256"
            fill="url(#sf-amber-grad)"
          />
          <polygon
            points="256,224 282,256 256,288 230,256"
            fill="#FFFFFF"
            opacity="0.95"
          />
        </g>
      </g>
    </svg>
  );
}

export default StudyForgeIcon;
