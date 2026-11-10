/**
 * Sticker trasparente dell'allenamento: solo i valori, senza sfondo, da
 * appoggiare sopra una propria foto (come gli overlay di Strava).
 * Testo bianco con ombra morbida, leggibile sia su foto chiare che scure.
 */

import type { WorkoutShareStats } from "@/lib/workout-share";
import { formatKg } from "@/lib/workout-share";
import { BODY, DISPLAY, STICKER_SIZE, SectionLabel, WorkoutDate, hiddenExercisesText, shareMetrics } from "./share-image-kit";

const INK = "#09090b";

/** Testo bianco per foto scure, nero per foto chiare */
export type StickerInk = "light" | "dark";

interface StickerColors {
  text: string;
  soft: string;
  shadow: string;
}

const INKS: Record<StickerInk, StickerColors> = {
  light: {
    text: "#ffffff",
    soft: "rgba(255,255,255,0.82)",
    shadow: "0 2px 14px rgba(0,0,0,0.55)",
  },
  dark: {
    text: INK,
    soft: "rgba(9,9,11,0.72)",
    shadow: "0 1px 12px rgba(255,255,255,0.55)",
  },
};
const MAX_EXERCISES = 7;
const CONTENT_WIDTH = 900;

export interface WorkoutShareStickerProps {
  ink: StickerInk;
  stats: WorkoutShareStats;
  title: string;
  dateLabel: string;
  timeLabel: string;
}

function Stat({ c, label, value, unit, grow = 1 }: { c: StickerColors; label: string; value: string; unit?: string; grow?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: grow }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 800, fontSize: 84, lineHeight: 1, whiteSpace: "nowrap", color: c.text, textShadow: c.shadow }}>
          {value}
        </div>
        {unit && (
          <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 700, fontSize: 40, lineHeight: 1.25, color: c.soft, textShadow: c.shadow }}>
            {unit}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: BODY,
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: c.soft,
          marginTop: 10,
          textShadow: c.shadow,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Exercises({ c, stats }: { c: StickerColors; stats: WorkoutShareStats }) {
  const visible = stats.exercises.slice(0, MAX_EXERCISES);
  const hidden = stats.exercises.length - visible.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, width: CONTENT_WIDTH }}>
      {visible.map((exercise, index) => (
        <div key={`${exercise.name}-${index}`} style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                fontFamily: BODY,
                fontWeight: 700,
                fontSize: 31,
                color: c.text,
                textShadow: c.shadow,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                maxWidth: "100%",
              }}
            >
              {exercise.name}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: 34,
              color: c.text,
              whiteSpace: "nowrap",
              textShadow: c.shadow,
            }}
          >
            {exercise.summary}
          </div>
        </div>
      ))}
      {hidden > 0 && (
        <div style={{ display: "flex", fontFamily: BODY, fontWeight: 600, fontSize: 26, color: c.soft, textShadow: c.shadow }}>
          {hiddenExercisesText(hidden)}
        </div>
      )}
    </div>
  );
}

export function WorkoutShareSticker({ ink, stats, title, dateLabel, timeLabel }: WorkoutShareStickerProps) {
  const c = INKS[ink];
  const top = stats.topSet;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 46,
        width: STICKER_SIZE.width,
        height: STICKER_SIZE.height,
        padding: "48px 90px",
        background: "transparent",
        fontFamily: BODY,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <WorkoutDate
          dateLabel={dateLabel}
          timeLabel={timeLabel}
          size={30}
          color={c.text}
          mutedColor={c.soft}
          shadow={c.shadow}
        />
        <div
          style={{
            display: "flex",
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: title.length <= 18 ? 96 : 72,
            lineHeight: 1,
            textTransform: "uppercase",
            color: c.text,
            textShadow: c.shadow,
            maxWidth: CONTENT_WIDTH,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
      </div>

      {/* Quattro numeri alla pari: nessuno fa da copertina */}
      <div style={{ display: "flex", width: CONTENT_WIDTH }}>
        {shareMetrics(stats).map((m, i) => (
          // La durata ("1h 27m") è il valore più largo
          <Stat key={m.label} c={c} label={m.label} value={m.value} unit={m.unit} grow={i === 0 ? 1.35 : 1} />
        ))}
      </div>

      {top && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, maxWidth: CONTENT_WIDTH }}>
          <SectionLabel size={22} color={c.soft} shadow={c.shadow}>Serie top</SectionLabel>
          <div
            style={{
              display: "flex",
              fontFamily: DISPLAY,
              fontWeight: 800,
              fontSize: 44,
              color: c.text,
              whiteSpace: "nowrap",
              textShadow: c.shadow,
            }}
          >
            {`${formatKg(top.weight)} × ${top.reps}`}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: BODY,
              fontWeight: 600,
              fontSize: 28,
              color: c.text,
              textShadow: c.shadow,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {top.exerciseName}
          </div>
        </div>
      )}

      {stats.exercises.length > 0 && <Exercises c={c} stats={stats} />}

    </div>
  );
}
