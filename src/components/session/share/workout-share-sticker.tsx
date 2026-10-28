/**
 * Sticker trasparente dell'allenamento: solo i valori, senza sfondo, da
 * appoggiare sopra una propria foto (come gli overlay di Strava).
 * Testo bianco con ombra morbida, leggibile sia su foto chiare che scure.
 */

import type { WorkoutShareStats } from "@/lib/workout-share";
import { formatKg, formatNumberIt, formatShareDuration } from "@/lib/workout-share";
import {
  BODY,
  DISPLAY,
  STICKER_SIZE,
  SectionLabel,
  TrophyIcon,
  WorkoutDate,
  equivalenceText,
  heroMetric,
  hiddenExercisesText,
} from "./share-image-kit";

const LIME = "#d4ff3a";
const INK = "#09090b";

/** Testo bianco per foto scure, nero per foto chiare */
export type StickerInk = "light" | "dark";

interface StickerColors {
  text: string;
  soft: string;
  hero: string;
  shadow: string;
  heroShadow: string;
}

const INKS: Record<StickerInk, StickerColors> = {
  light: {
    text: "#ffffff",
    soft: "rgba(255,255,255,0.82)",
    hero: LIME,
    shadow: "0 2px 14px rgba(0,0,0,0.55)",
    heroShadow: "0 4px 24px rgba(0,0,0,0.45)",
  },
  dark: {
    text: INK,
    soft: "rgba(9,9,11,0.72)",
    hero: INK,
    shadow: "0 1px 12px rgba(255,255,255,0.55)",
    heroShadow: "0 4px 24px rgba(255,255,255,0.5)",
  },
};
const MAX_EXERCISES = 5;
const CONTENT_WIDTH = 900;

export interface WorkoutShareStickerProps {
  ink: StickerInk;
  stats: WorkoutShareStats;
  title: string;
  dateLabel: string;
  timeLabel: string;
  logoSrc: string;
}

function Stat({ c, label, value }: { c: StickerColors; label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
      <div
        style={{
          display: "flex",
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: 84,
          lineHeight: 1,
          color: c.text,
          textShadow: c.shadow,
        }}
      >
        {value}
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

function Hero({ c, stats }: { c: StickerColors; stats: WorkoutShareStats }) {
  const { label, value, unit } = heroMetric(stats);
  const caption = equivalenceText(stats);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <SectionLabel size={24} color={c.soft} shadow={c.shadow}>{label}</SectionLabel>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 18 }}>
        <div
          style={{
            display: "flex",
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: 250,
            lineHeight: 0.92,
            color: c.hero,
            textShadow: c.heroShadow,
          }}
        >
          {value}
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: 100,
            lineHeight: 1.15,
            color: c.text,
            textShadow: c.shadow,
          }}
        >
          {unit}
        </div>
      </div>
      {caption && (
        <div
          style={{
            display: "flex",
            fontFamily: BODY,
            fontWeight: 600,
            fontSize: 30,
            color: c.text,
            marginTop: 8,
            textShadow: c.shadow,
          }}
        >
          {caption}
        </div>
      )}
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
                maxWidth: exercise.pr ? "64%" : "100%",
              }}
            >
              {exercise.name}
            </div>
            {exercise.pr && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: LIME,
                  color: INK,
                  borderRadius: 999,
                  padding: "4px 12px",
                  fontFamily: BODY,
                  fontWeight: 800,
                  fontSize: 18,
                  letterSpacing: 1,
                }}
              >
                <TrophyIcon size={19} color={INK} />
                PR
              </div>
            )}
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

function Brand({ c, logoSrc }: { c: StickerColors; logoSrc: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} width={56} height={56} alt="" style={{ borderRadius: 14 }} />
      <div
        style={{
          display: "flex",
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: 44,
          letterSpacing: 6,
          color: c.text,
          textShadow: c.shadow,
        }}
      >
        BODYGROWTH
      </div>
    </div>
  );
}

export function WorkoutShareSticker({ ink, stats, title, dateLabel, timeLabel, logoSrc }: WorkoutShareStickerProps) {
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

      <Hero c={c} stats={stats} />

      <div style={{ display: "flex", width: CONTENT_WIDTH }}>
        <Stat c={c} label="Durata" value={stats.durationSeconds ? formatShareDuration(stats.durationSeconds) : "—"} />
        <Stat c={c} label="Serie" value={formatNumberIt(stats.workingSets)} />
        <Stat c={c} label="Ripetizioni" value={formatNumberIt(stats.reps)} />
        <Stat c={c} label="Esercizi" value={formatNumberIt(stats.exerciseCount)} />
      </div>

      {top && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, maxWidth: CONTENT_WIDTH }}>
          <SectionLabel size={22} color={c.soft} shadow={c.shadow}>Serie top</SectionLabel>
          <div
            style={{
              display: "flex",
              fontFamily: DISPLAY,
              fontWeight: 800,
              fontSize: 52,
              color: c.hero,
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

      <Brand c={c} logoSrc={logoSrc} />
    </div>
  );
}
