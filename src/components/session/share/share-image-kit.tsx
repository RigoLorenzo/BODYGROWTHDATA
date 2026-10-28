/**
 * Elementi comuni alle immagini di condivisione (Satori / next/og).
 *
 * Vincoli di Satori: solo stili inline, ogni <div> con più figli deve essere
 * flex, testo in un unico nodo stringa, niente hook React. I font coprono solo
 * il latino: niente emoji o simboli fuori set (stelle, ≈…), le icone sono SVG.
 */

import type { WorkoutShareStats } from "@/lib/workout-share";
import { formatNumberIt, splitTonnage } from "@/lib/workout-share";

export const DISPLAY = "Barlow Condensed";
export const BODY = "Inter";

export type ShareFormat = "story" | "post";
export type ShareStyle = "dark" | "light" | "transparent";

export const SHARE_FORMATS: Record<ShareFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1350 },
};

/** Lo sticker trasparente ha un solo formato: si ridimensiona sopra la foto */
export const STICKER_SIZE = { width: 1080, height: 1350 };

export function shareImageSize(style: ShareStyle, format: ShareFormat) {
  return style === "transparent" ? STICKER_SIZE : SHARE_FORMATS[format];
}

export interface Palette {
  bg: string;
  bgImage: string;
  text: string;
  muted: string;
  faint: string;
  line: string;
  /** Il numero da copertina */
  hero: string;
  /** Testi in evidenza: record, dominio */
  accent: string;
  pillBg: string;
  pillText: string;
}

const LIME = "#d4ff3a";
const INK = "#09090b";

export const PALETTES: Record<"dark" | "light", Palette> = {
  dark: {
    bg: INK,
    bgImage:
      "radial-gradient(circle at 92% 4%, rgba(212,255,58,0.20) 0%, rgba(9,9,11,0) 42%), radial-gradient(circle at 0% 100%, rgba(59,130,246,0.16) 0%, rgba(9,9,11,0) 48%)",
    text: "#fafafa",
    muted: "rgba(250,250,250,0.6)",
    faint: "rgba(250,250,250,0.38)",
    line: "rgba(250,250,250,0.12)",
    hero: LIME,
    accent: LIME,
    pillBg: LIME,
    pillText: INK,
  },
  light: {
    bg: "#f5f5f0",
    bgImage:
      "radial-gradient(circle at 92% 4%, rgba(190,242,100,0.55) 0%, rgba(245,245,240,0) 45%), radial-gradient(circle at 0% 100%, rgba(147,197,253,0.35) 0%, rgba(245,245,240,0) 50%)",
    text: INK,
    muted: "rgba(9,9,11,0.62)",
    faint: "rgba(9,9,11,0.42)",
    line: "rgba(9,9,11,0.12)",
    hero: INK,
    accent: "#4d7c0f",
    pillBg: LIME,
    pillText: INK,
  },
};

export function SectionLabel({
  children,
  size,
  color,
  shadow,
}: {
  children: string;
  size: number;
  color: string;
  shadow?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: BODY,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: size * 0.18,
        textTransform: "uppercase",
        color,
        // Satori non accetta textShadow undefined
        ...(shadow ? { textShadow: shadow } : {}),
      }}
    >
      {children}
    </div>
  );
}

export function TrophyIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M7 4h10v3a5 5 0 0 1-10 0V4Zm0 1H4v1.5A3.5 3.5 0 0 0 7.5 10M17 5h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 12v4m-4 4h8m-6.5 0 .5-4h4l.5 4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CalendarIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Data dell'allenamento ben leggibile: chi guarda il post capisce subito
 * quando è stato fatto, non si può spacciare una seduta vecchia per nuova.
 */
export function WorkoutDate({
  dateLabel,
  timeLabel,
  size,
  color,
  mutedColor,
  shadow,
}: {
  dateLabel: string;
  timeLabel: string;
  size: number;
  color: string;
  mutedColor: string;
  shadow?: string;
}) {
  const text = {
    fontFamily: BODY,
    fontSize: size,
    letterSpacing: size * 0.1,
    textTransform: "uppercase",
    ...(shadow ? { textShadow: shadow } : {}),
  } as const;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.45 }}>
      <CalendarIcon size={size * 1.15} color={color} />
      <div style={{ display: "flex", ...text, fontWeight: 700, color }}>{dateLabel}</div>
      <div style={{ display: "flex", ...text, fontWeight: 600, color: mutedColor }}>{`· ${timeLabel}`}</div>
    </div>
  );
}

/** Il tonnellaggio è il numero da copertina; a corpo libero lo sono le ripetizioni */
export function heroMetric(stats: WorkoutShareStats) {
  if (stats.tonnage > 0) return { label: "Tonnellaggio totale", ...splitTonnage(stats.tonnage) };
  return { label: "Ripetizioni totali", value: formatNumberIt(stats.reps), unit: "rip." };
}

export const hiddenExercisesText = (hidden: number) =>
  hidden === 1 ? "+ 1 altro esercizio" : `+ ${hidden} altri esercizi`;

export const recordCountText = (count: number) =>
  count === 1 ? "1 record personale" : `${count} record personali`;
