/**
 * Scheda condivisibile dell'allenamento con sfondo (scura o chiara),
 * renderizzata in PNG da next/og. Vincoli di Satori in share-image-kit.
 */

import type { ShareExercise, ShareMuscle, WorkoutShareStats } from "@/lib/workout-share";
import { formatKg } from "@/lib/workout-share";
import {
  BODY,
  DISPLAY,
  PALETTES,
  SHARE_FORMATS,
  SectionLabel,
  WorkoutDate,
  hiddenExercisesText,
  shareMetrics,
  type Palette,
  type ShareFormat,
} from "./share-image-kit";

interface Layout {
  pad: number;
  meta: number;
  title: [number, number, number];
  stat: number;
  statLabel: number;
  rowName: number;
  rowValue: number;
  rowGap: number;
  maxExercises: number;
  /** Con il titolo su due righe resta meno spazio per gli esercizi */
  maxExercisesLongTitle: number;
  showLegend: boolean;
  sectionGap: number;
}

const LAYOUTS: Record<ShareFormat, Layout> = {
  story: {
    pad: 80,
    meta: 30,
    title: [128, 104, 86],
    stat: 120,
    statLabel: 22,
    rowName: 32,
    rowValue: 34,
    rowGap: 22,
    maxExercises: 10,
    maxExercisesLongTitle: 9,
    showLegend: true,
    sectionGap: 50,
  },
  post: {
    pad: 64,
    meta: 24,
    title: [100, 84, 70],
    stat: 92,
    statLabel: 18,
    rowName: 28,
    rowValue: 30,
    rowGap: 14,
    maxExercises: 8,
    maxExercisesLongTitle: 7,
    showLegend: false,
    sectionGap: 34,
  },
};

interface Ctx {
  layout: Layout;
  p: Palette;
}

export interface WorkoutShareImageProps {
  format: ShareFormat;
  variant: "dark" | "light";
  stats: WorkoutShareStats;
  title: string;
  dateLabel: string;
  timeLabel: string;
  athlete: string | null;
}

const titleSize = (title: string, sizes: Layout["title"]) =>
  title.length <= 14 ? sizes[0] : title.length <= 24 ? sizes[1] : sizes[2];

// Larghezza media di un carattere maiuscolo in Barlow Condensed ExtraBold, in em
const TITLE_CHAR_EM = 0.45;

function titleWraps(title: string, layout: Layout, width: number) {
  const charsPerLine = (width - layout.pad * 2) / (titleSize(title, layout.title) * TITLE_CHAR_EM);
  return title.length > charsPerLine;
}

function TitleBlock({
  layout,
  p,
  title,
  dateLabel,
  timeLabel,
  athlete,
}: Ctx & { title: string; dateLabel: string; timeLabel: string; athlete: string | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: layout.meta * 0.6 }}>
      <WorkoutDate dateLabel={dateLabel} timeLabel={timeLabel} size={layout.meta} color={p.text} mutedColor={p.muted} />
      <div
        style={{
          display: "block",
          lineClamp: 2,
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: titleSize(title, layout.title),
          lineHeight: 0.92,
          textTransform: "uppercase",
          color: p.text,
        }}
      >
        {title}
      </div>
      {athlete && (
        <div
          style={{
            display: "flex",
            fontFamily: BODY,
            fontWeight: 600,
            fontSize: layout.meta,
            color: p.muted,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {athlete}
        </div>
      )}
    </div>
  );
}

/**
 * I quattro numeri in una griglia 2×2, tutti uguali: durata, volume,
 * serie e ripetizioni. Nessuno fa da copertina.
 */
function Metrics({ layout, p, stats }: Ctx & { stats: WorkoutShareStats }) {
  const items = shareMetrics(stats);
  const line = `2px solid ${p.line}`;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", borderTop: line }}>
      {items.map((item, index) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            flexDirection: "column",
            width: "50%",
            padding: `${layout.stat * 0.22}px ${index % 2 === 0 ? layout.stat * 0.25 : 0}px ${layout.stat * 0.22}px ${index % 2 === 0 ? 0 : layout.stat * 0.25}px`,
            borderBottom: line,
            borderLeft: index % 2 === 0 ? "none" : line,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: layout.stat * 0.08 }}>
            <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 800, fontSize: layout.stat, lineHeight: 1, color: p.text }}>
              {item.value}
            </div>
            {item.unit && (
              <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 700, fontSize: layout.stat * 0.45, lineHeight: 1.3, color: p.muted }}>
                {item.unit}
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: BODY,
              fontWeight: 600,
              fontSize: layout.statLabel,
              letterSpacing: layout.statLabel * 0.12,
              textTransform: "uppercase",
              color: p.faint,
              marginTop: layout.statLabel * 0.5,
            }}
          >
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/** La serie più pesante, in una riga discreta */
function TopSetLine({ layout, p, topSet }: Ctx & { topSet: NonNullable<WorkoutShareStats["topSet"]> }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: layout.statLabel * 0.8 }}>
      <SectionLabel size={layout.statLabel} color={p.faint}>Serie top</SectionLabel>
      <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 700, fontSize: layout.rowValue * 1.15, color: p.text, whiteSpace: "nowrap" }}>
        {`${formatKg(topSet.weight)} × ${topSet.reps}`}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: BODY,
          fontWeight: 600,
          fontSize: layout.rowName * 0.85,
          color: p.muted,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {topSet.exerciseName}
      </div>
    </div>
  );
}

function MuscleBar({ layout, p, muscles }: Ctx & { muscles: ShareMuscle[] }) {
  const legend = muscles.slice(0, layout.showLegend ? 4 : 3);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: layout.statLabel * 0.8 }}>
      <SectionLabel size={layout.statLabel} color={p.faint}>Muscoli allenati</SectionLabel>
      <div style={{ display: "flex", height: layout.statLabel * 0.7, borderRadius: 999, overflow: "hidden" }}>
        {muscles.map((m, index) => (
          <div
            key={m.muscle}
            style={{
              display: "flex",
              width: `${m.share * 100}%`,
              height: "100%",
              background: m.color,
              borderLeft: index === 0 ? "none" : `3px solid ${p.bg}`,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", columnGap: layout.rowName, rowGap: layout.statLabel * 0.6 }}>
        {legend.map((m) => (
          <div key={m.muscle} style={{ display: "flex", alignItems: "center", gap: layout.statLabel * 0.5 }}>
            <div style={{ display: "flex", width: 14, height: 14, borderRadius: 999, background: m.color }} />
            <div
              style={{
                display: "flex",
                fontFamily: BODY,
                fontWeight: 600,
                fontSize: layout.statLabel * 1.15,
                color: p.muted,
              }}
            >
              {`${m.label} ${Math.round(m.share * 100)}%`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExerciseRow({ layout, p, exercise }: Ctx & { exercise: ShareExercise }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: layout.rowName * 0.6 }}>
      <div
        style={{
          display: "flex",
          width: 6,
          height: layout.rowName * 1.4,
          borderRadius: 999,
          background: exercise.color,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: layout.rowName * 0.4, flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            fontFamily: BODY,
            fontWeight: 600,
            fontSize: layout.rowName,
            color: p.text,
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
          fontWeight: 600,
          fontSize: layout.rowValue,
          color: p.muted,
          whiteSpace: "nowrap",
        }}
      >
        {exercise.summary}
      </div>
    </div>
  );
}

function ExerciseList({ layout, p, stats, maxRows }: Ctx & { stats: WorkoutShareStats; maxRows: number }) {
  const visible = stats.exercises.slice(0, maxRows);
  const hidden = stats.exercises.length - visible.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: layout.rowGap }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <SectionLabel size={layout.statLabel} color={p.faint}>Esercizi</SectionLabel>
      </div>
      {visible.map((exercise, index) => (
        <ExerciseRow key={`${exercise.name}-${index}`} layout={layout} p={p} exercise={exercise} />
      ))}
      {hidden > 0 && (
        <div
          style={{
            display: "flex",
            fontFamily: BODY,
            fontWeight: 600,
            fontSize: layout.rowName * 0.8,
            color: p.faint,
            paddingLeft: layout.rowName * 0.6 + 6,
          }}
        >
          {hiddenExercisesText(hidden)}
        </div>
      )}
    </div>
  );
}

export function WorkoutShareImage(props: WorkoutShareImageProps) {
  const { format, variant, stats, title, dateLabel, timeLabel, athlete } = props;
  const layout = LAYOUTS[format];
  const p = PALETTES[variant];
  const ctx = { layout, p };
  const { width, height } = SHARE_FORMATS[format];
  const maxRows = titleWraps(title, layout, width) ? layout.maxExercisesLongTitle : layout.maxExercises;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        padding: layout.pad,
        background: p.bg,
        backgroundImage: p.bgImage,
        color: p.text,
        fontFamily: BODY,
      }}
    >
      {/* Centrato: con pochi esercizi la scheda resta bilanciata */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: layout.sectionGap,
          flex: 1,
          overflow: "hidden",
        }}
      >
        <TitleBlock {...ctx} title={title} dateLabel={dateLabel} timeLabel={timeLabel} athlete={athlete} />
        <Metrics {...ctx} stats={stats} />
        {stats.topSet && <TopSetLine {...ctx} topSet={stats.topSet} />}
        {stats.muscles.length > 0 && <MuscleBar {...ctx} muscles={stats.muscles} />}
        {stats.exercises.length > 0 && <ExerciseList {...ctx} stats={stats} maxRows={maxRows} />}
      </div>
    </div>
  );
}
