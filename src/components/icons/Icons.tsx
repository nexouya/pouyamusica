type IconProps = { size?: number; className?: string; strokeWidth?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
});

export function IconHome({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 10.5 12 4l7.5 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-4v6H5.5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

export function IconCompass({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m14.8 9.2-1.4 4.2-4.2 1.4 1.4-4.2 4.2-1.4Z" />
    </svg>
  );
}

export function IconLibrary({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="4" height="16" rx="1" />
      <rect x="10" y="4" width="4" height="16" rx="1" />
      <path d="m16.5 5.5 3 14.5" />
    </svg>
  );
}

export function IconHeart({ size = 20, className, filled = false, strokeWidth = 1.75 }: IconProps & { filled?: boolean }) {
  return (
    <svg
      {...base(size)}
      className={className}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={filled ? "currentColor" : "none"}
    >
      <path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7.5a3.8 3.8 0 0 1 7 3.3C19 15.6 12 20 12 20Z" />
    </svg>
  );
}

export function IconSearch({ size = 18, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function IconPlay({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <path d="M8.5 6.2c0-.9 1-1.4 1.7-.9l8 5.8c.6.4.6 1.4 0 1.8l-8 5.8c-.7.5-1.7 0-1.7-.9V6.2Z" />
    </svg>
  );
}

export function IconPause({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="7" y="6" width="3.2" height="12" rx="1.2" />
      <rect x="13.8" y="6" width="3.2" height="12" rx="1.2" />
    </svg>
  );
}

export function IconPrev({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="6" y="6" width="2.4" height="12" rx="1" />
      <path d="M18 7.2v9.6c0 .8-.9 1.3-1.6.8l-6.2-4.8a1 1 0 0 1 0-1.6l6.2-4.8c.7-.5 1.6 0 1.6.8Z" />
    </svg>
  );
}

export function IconNext({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="15.6" y="6" width="2.4" height="12" rx="1" />
      <path d="M6 7.2v9.6c0 .8.9 1.3 1.6.8l6.2-4.8a1 1 0 0 0 0-1.6L7.6 6.4C6.9 5.9 6 6.4 6 7.2Z" />
    </svg>
  );
}

export function IconShuffle({ size = 18, className, active = false }: IconProps & { active?: boolean }) {
  return (
    <svg
      {...base(size)}
      className={className}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={active ? 1 : 0.55}
      style={active ? { color: "rgba(var(--accent-dynamic-rgb), 1)" } : undefined}
    >
      <path d="M16 4h4v4" />
      <path d="m4 20 16-16" />
      <path d="M16 20h4v-4" />
      <path d="m4 4 5 5" />
      <path d="m15 15 5 5" />
    </svg>
  );
}

export function IconRepeat({ size = 18, className, mode = "off" }: IconProps & { mode?: "off" | "all" | "one" }) {
  return (
    <svg
      {...base(size)}
      className={className}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={mode === "off" ? 0.55 : 1}
      style={mode !== "off" ? { color: "rgba(var(--accent-dynamic-rgb), 1)" } : undefined}
    >
      <path d="M17 3l3 3-3 3" />
      <path d="M20 6H8a4 4 0 0 0-4 4v1" />
      <path d="M7 21l-3-3 3-3" />
      <path d="M4 18h12a4 4 0 0 0 4-4v-1" />
      {mode === "one" && <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />}
    </svg>
  );
}

export function IconQueue({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      <path d="M4 7h12M4 12h12M4 17h8" />
      <circle cx="18.5" cy="17" r="2" />
      <path d="M20.5 17V9" />
    </svg>
  );
}

export function IconEq({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      <path d="M6 5v14M12 5v14M18 5v14" />
      <circle cx="6" cy="9" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="18" cy="11" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconVolume({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10v4h3l4 3V7L7 10H4Z" />
      <path d="M15 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M17.5 7a7 7 0 0 1 0 10" />
    </svg>
  );
}

export function IconVolumeMute({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10v4h3l4 3V7L7 10H4Z" />
      <path d="m16 9 6 6m0-6-6 6" />
    </svg>
  );
}

export function IconMinimize({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className={className}>
      <rect x="2" y="5.5" width="8" height="1.2" rx="0.6" fill="currentColor" />
    </svg>
  );
}

export function IconMaximize({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className={className}>
      <rect x="2.5" y="2.5" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconRestore({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className={className}>
      <rect x="3.5" y="1.5" width="6.5" height="6.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path d="M2 3.5v6.5a1 1 0 0 0 1 1h6.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function IconClose({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className={className}>
      <path d="M3 3l6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function IconMusic({ size = 18, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V6l11-2v12" />
      <circle cx="6.5" cy="18" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="16" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPlus({ size = 14, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconChevronUp({ size = 14, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 14 6-6 6 6" />
    </svg>
  );
}

export function IconChevronDown({ size = 14, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 10 6 6 6-6" />
    </svg>
  );
}

export function IconSoundLab({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8v8M8 5v14M12 9v6M16 6v12M20 10v4" />
    </svg>
  );
}

export function IconOrbit({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <ellipse cx="12" cy="12" rx="10" ry="4.5" />
      <ellipse cx="12" cy="12" rx="4.5" ry="10" transform="rotate(60 12 12)" />
    </svg>
  );
}

export function IconWave({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round">
      <path d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0" />
    </svg>
  );
}

export function IconTape({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="8.5" cy="12" r="2" />
      <circle cx="15.5" cy="12" r="2" />
      <path d="M8.5 14.5h7" />
    </svg>
  );
}

export function IconBass({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14c2 4 4 4 6 0s4-4 6 0 4 4 4 0" />
      <path d="M4 9c2 3 4 3 6 0s4-3 6 0 4 3 4 0" opacity="0.5" />
    </svg>
  );
}

export function IconRocket({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c3 2 5 6 5 10l-5 3-5-3c0-4 2-8 5-10Z" />
      <path d="M9 16.5 7 21l5-2 5 2-2-4.5" />
      <circle cx="12" cy="10" r="1.5" />
    </svg>
  );
}

export function IconMoon({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 14.5A7.5 7.5 0 0 1 9.5 6 7.5 7.5 0 1 0 18 14.5Z" />
    </svg>
  );
}

export function IconMic({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v3M9 20h6" />
    </svg>
  );
}

export function IconHall({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20V10l9-6 9 6v10" />
      <path d="M8 20v-6h8v6" />
      <path d="M12 4v4" opacity="0.5" />
    </svg>
  );
}

export function IconLogo({ size = 28, className }: IconProps) {
  return (
    <img
      src="/app-icon.png"
      width={size}
      height={size}
      alt=""
      className={className}
      draggable={false}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        boxShadow: "0 4px 12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08)",
        objectFit: "cover",
        display: "block",
      }}
    />
  );
}
