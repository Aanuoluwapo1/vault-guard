export function VaultGuardLogo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="VaultGuard Emblem"
    >
      <defs>
        <linearGradient id="vg-ring" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="55%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="vg-core" x1="8" y1="6" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f1722" />
          <stop offset="100%" stopColor="#070a0f" />
        </linearGradient>
      </defs>

      {/* Chamfered Octagonal Vault Seal */}
      <polygon
        points="13,3 27,3 37,13 37,27 27,37 13,37 3,27 3,13"
        fill="url(#vg-core)"
        stroke="url(#vg-ring)"
        strokeWidth="1.5"
      />

      {/* Inner Precision Frame */}
      <polygon
        points="14.5,6.5 25.5,6.5 33.5,14.5 33.5,25.5 25.5,33.5 14.5,33.5 6.5,25.5 6.5,14.5"
        stroke="#10b981"
        strokeOpacity="0.24"
        strokeWidth="1"
      />

      {/* Hash-Chain Corner Nodes */}
      <circle cx="13" cy="3" r="1.4" fill="#34d399" />
      <circle cx="27" cy="3" r="1.4" fill="#38bdf8" />
      <circle cx="27" cy="37" r="1.4" fill="#38bdf8" />
      <circle cx="13" cy="37" r="1.4" fill="#34d399" />

      {/* Interlocking Cryptographic Vault Chevron & Keyhole Aperture */}
      <path
        d="M12.5 13.5L20 27.5L27.5 13.5"
        stroke="url(#vg-ring)"
        strokeWidth="2.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <polygon points="20,11 23.5,15.5 20,20 16.5,15.5" fill="#34d399" fillOpacity="0.9" />
      <line x1="20" y1="20" x2="20" y2="23.5" stroke="#070a0f" strokeWidth="1.5" />
    </svg>
  );
}
