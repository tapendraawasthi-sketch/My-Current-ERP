import React from "react";

interface OrbixLogoProps {
  size?: number;
  className?: string;
  variant?: "full" | "icon";
}

/** Neuron-inspired Orbix mark — central orb with branching synaptic lines */
const OrbixLogo: React.FC<OrbixLogoProps> = ({ size = 32, className = "", variant = "icon" }) => {
  const id = React.useId().replace(/:/g, "");

  if (variant === "full") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        className={className}
        aria-hidden
      >
        <defs>
          <radialGradient id={`${id}-core`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="45%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#06b6d4" />
          </radialGradient>
          <linearGradient id={`${id}-branch`} x1="24" y1="24" x2="8" y2="8" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22d3ee" />
            <stop offset="1" stopColor="#a855f7" />
          </linearGradient>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Dendrite branches */}
        <g stroke={`url(#${id}-branch)`} strokeWidth="1.2" strokeLinecap="round" opacity="0.85">
          <path d="M24 24 L8 10 M24 24 L6 24 M24 24 L10 38" />
          <path d="M24 24 L38 8 M24 24 L42 22 M24 24 L36 40" />
          <path d="M24 24 L24 6 M24 24 L24 42" />
          <path d="M24 24 L14 16 M24 24 L34 16 M24 24 L16 32 M24 24 L32 32" opacity="0.6" />
        </g>

        {/* Synapse nodes */}
        {[
          [8, 10],
          [6, 24],
          [10, 38],
          [38, 8],
          [42, 22],
          [36, 40],
          [24, 6],
          [24, 42],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="2" fill="#fb923c" filter={`url(#${id}-glow)`} opacity="0.9" />
        ))}

        {/* Central orb */}
        <circle cx="24" cy="24" r="9" fill={`url(#${id}-core)`} filter={`url(#${id}-glow)`} />
        <circle cx="24" cy="24" r="9" fill="none" stroke="#22d3ee" strokeWidth="0.5" opacity="0.5" />
        <circle cx="21" cy="21" r="2.5" fill="white" opacity="0.25" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <radialGradient id={`${id}-ic`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="50%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#6366f1" />
        </radialGradient>
        <linearGradient id={`${id}-ib`} x1="16" y1="16" x2="4" y2="4">
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${id}-ib)`} strokeWidth="1" strokeLinecap="round" opacity="0.8">
        <path d="M16 16 L5 6 M16 16 L4 16 M16 16 L7 26" />
        <path d="M16 16 L27 6 M16 16 L28 15 M16 16 L25 26" />
      </g>
      <circle cx="5" cy="6" r="1.5" fill="#fb923c" />
      <circle cx="27" cy="6" r="1.5" fill="#fb923c" />
      <circle cx="4" cy="16" r="1.5" fill="#f97316" opacity="0.8" />
      <circle cx="28" cy="15" r="1.5" fill="#f97316" opacity="0.8" />
      <circle cx="16" cy="16" r="7" fill={`url(#${id}-ic)`} />
      <circle cx="14" cy="14" r="1.5" fill="white" opacity="0.3" />
    </svg>
  );
};

export default OrbixLogo;
