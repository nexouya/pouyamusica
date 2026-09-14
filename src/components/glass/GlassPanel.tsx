import { motion } from "framer-motion";
import type { CSSProperties, ButtonHTMLAttributes, ReactNode } from "react";
import { useLiquidHighlight } from "../../hooks/useLiquidHighlight";
import styles from "./Glass.module.css";

type GlassPanelProps = {
  children: ReactNode;
  className?: string;
  radius?: number;
  strong?: boolean;
  player?: boolean;
  titlebar?: boolean;
  refraction?: boolean;
  style?: CSSProperties;
};

export function GlassPanel({
  children,
  className = "",
  radius = 28,
  strong = false,
  player = false,
  titlebar = false,
  refraction = false,
  style,
}: GlassPanelProps) {
  const { ref, onPointerMove, onPointerLeave } = useLiquidHighlight<HTMLDivElement>();
  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={[
        "glass",
        strong ? styles.strong : "",
        player ? "glassPlayer" : "",
        titlebar ? "glassTitlebar" : "",
        styles.panel,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        borderRadius: radius,
        ...style,
      }}
    >
      <span className="glassHighlight" aria-hidden />
      {refraction && (
        <svg className="glassRefraction" aria-hidden>
          <filter id={`refr-${radius}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <rect width="100%" height="100%" fill="transparent" filter={`url(#refr-${radius})`} opacity="0.35" />
        </svg>
      )}
      {children}
    </div>
  );
}

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: number;
  round?: boolean;
  active?: boolean;
  label?: string;
};

export function GlassButton({
  children,
  className = "",
  size = 44,
  round = true,
  active = false,
  label,
  ...rest
}: GlassButtonProps) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={[styles.btn, active ? styles.btnActive : "", className].filter(Boolean).join(" ")}
      style={{
        width: size,
        height: size,
        borderRadius: round ? 999 : 12,
      }}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.02 }}
      initial={false}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
      {...(rest as object)}
    >
      {children}
    </motion.button>
  );
}
