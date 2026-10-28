/**
 * Scheda condivisibile dell'allenamento con sfondo (scura o chiara),
 * renderizzata in PNG da next/og. Vincoli di Satori in share-image-kit.
 */

import type { ShareExercise, ShareMuscle, WorkoutShareStats } from "@/lib/workout-share";
import { formatKg, formatNumberIt, formatShareDuration } from "@/lib/workout-share";
import {
  BODY,
  DISPLAY,
  PALETTES,
  SHARE_FORMATS,
  SectionLabel,
  TrophyIcon,
  WorkoutDate,
  heroMetric,
  hiddenExercisesText,
  recordCountText,
  type Palette,
  type ShareFormat,
} from "./share-image-kit";

interface Layout {
  pad: number;
  logo: number;
  brand: number;
  meta: number;
  title: [number, number, number];
  hero: number;
  heroUnit: number;
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
    logo: 76,
    brand: 44,
    meta: 30,
    title: [128, 104, 86],
    hero: 270,
    heroUnit: 110,
    stat: 84,
    statLabel: 22,
    rowName: 32,
    rowValue: 34,
    rowGap: 22,
    maxExercises: 8,
    maxExercisesLongTitle: 7,
    showLegend: true,
    sectionGap: 50,
  },
  post: {
    pad: 64,
    logo: 60,
    brand: 36,
    meta: 24,
    title: [100, 84, 70],
    hero: 190,
    heroUnit: 80,
    stat: 64,
    statLabel: 18,
    rowName: 28,
    rowValue: 30,
    rowGap: 14,
    maxExercises: 6,
    maxExercisesLongTitle: 5,
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
  logoSrc: string;
}

const titleSize = (title: string, sizes: Layout["title"]) =>
  title.length <= 14 ? sizes[0] : title.length <= 24 ? sizes[1] : sizes[2];

// Larghezza media di un carattere maiuscolo in Barlow Condensed ExtraBold, in em
const TITLE_CHAR_EM = 0.45;

function titleWraps(title: string, layout: Layout, width: number) {
  const charsPerLine = (width - layout.pad * 2) / (titleSize(title, layout.title) * TITLE_CHAR_EM);
  return title.length > charsPerLine;
}

function Header({ layout, p, logoSrc, athlete }: Ctx & { logoSrc: string; athlete: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: layout.logo * 0.28 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          width={layout.logo}
          height={layout.logo}
          alt=""
          style={{ borderRadius: layout.logo * 0.24, border: `2px solid ${p.line}` }}
        />
        <div
          style={{
            display: "flex",
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: layout.brand,
            letterSpacing: layout.brand * 0.14,
            color: p.text,
          }}
        >
          BODYGROWTH
        </div>
      </div>
      {athlete && (
        <div
          style={{
            display: "flex",
            fontFamily: BODY,
            fontWeight: 600,
            fontSize: layout.meta,
            color: p.muted,
            maxWidth: 420,
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

function TitleBlock({ layout, p, title, dateLabel, timeLabel }: Ctx & { title: string; dateLabel: string; timeLabel: string }) {
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
    </div>
  );
}

function TopSet({ layout, p, topSet }: Ctx & { topSet: NonNullable<WorkoutShareStats["topSet"]> }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: layout.statLabel * 0.4,
        flexShrink: 0,
        maxWidth: 420,
        paddingBottom: layout.hero * 0.04,
      }}
    >
      <SectionLabel size={layout.statLabel} color={p.faint}>Serie top</SectionLabel>
      <div
        style={{
          display: "flex",
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: layout.stat * 0.85,
          lineHeight: 1,
          color: p.text,
          whiteSpace: "nowrap",
        }}
      >
        {`${formatKg(topSet.weight)} × ${topSet.reps}`}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: BODY,
          fontWeight: 600,
          fontSize: layout.statLabel * 1.15,
          color: p.muted,
          maxWidth: 420,
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

function Hero({ layout, p, stats }: Ctx & { stats: WorkoutShareStats }) {
  const { label, value, unit } = heroMetric(stats);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <SectionLabel size={layout.statLabel} color={p.faint}>{label}</SectionLabel>
          <div style={{ display: "flex", alignItems: "flex-end", gap: layout.heroUnit * 0.15 }}>
            <div
              style={{
                display: "flex",
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: layout.hero,
                lineHeight: 0.9,
                letterSpacing: -layout.hero * 0.01,
                color: p.hero,
              }}
            >
              {value}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: layout.heroUnit,
                lineHeight: 1.1,
                color: p.text,
              }}
            >
              {unit}
            </div>
          </div>
        </div>
        {stats.topSet && <TopSet layout={layout} p={p} topSet={stats.topSet} />}
      </div>
    </div>
  );
}

function StatsGrid({ layout, p, stats }: Ctx & { stats: WorkoutShareStats }) {
  const items = [
    { label: "Durata", value: stats.durationSeconds ? formatShareDuration(stats.durationSeconds) : "—" },
    { label: "Serie", value: formatNumberIt(stats.workingSets) },
    { label: "Ripetizioni", value: formatNumberIt(stats.reps) },
    { label: "Esercizi", value: formatNumberIt(stats.exerciseCount) },
  ];
  return (
    <div
      style={{
        display: "flex",
        borderTop: `2px solid ${p.line}`,
        borderBottom: `2px solid ${p.line}`,
        padding: `${layout.stat * 0.32}px 0`,
      }}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            flexDirection: "column",
            // La durata ("1h 13m") è il valore più largo
            flex: index === 0 ? 1.35 : 1,
            paddingLeft: index === 0 ? 0 : layout.stat * 0.3,
            borderLeft: index === 0 ? "none" : `2px solid ${p.line}`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: layout.stat,
              lineHeight: 1,
              color: p.text,
            }}
          >
            {item.value}
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
            maxWidth: exercise.pr ? "62%" : "100%",
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
              background: p.pillBg,
              color: p.pillText,
              borderRadius: 999,
              padding: `${layout.rowName * 0.12}px ${layout.rowName * 0.4}px`,
              fontFamily: BODY,
              fontWeight: 700,
              fontSize: layout.rowName * 0.6,
              letterSpacing: 1,
            }}
          >
            <TrophyIcon size={layout.rowName * 0.62} color={p.pillText} />
            {`PR ${exercise.pr}`}
          </div>
        )}
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
        {stats.records.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: BODY,
              fontWeight: 700,
              fontSize: layout.statLabel,
              letterSpacing: layout.statLabel * 0.12,
              textTransform: "uppercase",
              color: p.accent,
            }}
          >
            <TrophyIcon size={layout.statLabel * 1.2} color={p.accent} />
            {recordCountText(stats.records.length)}
          </div>
        )}
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
  const { format, variant, stats, title, dateLabel, timeLabel, athlete, logoSrc } = props;
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
      <div style={{ display: "flex", flexDirection: "column", gap: layout.sectionGap, flex: 1, overflow: "hidden" }}>
        <Header {...ctx} logoSrc={logoSrc} athlete={athlete} />
        <TitleBlock {...ctx} title={title} dateLabel={dateLabel} timeLabel={timeLabel} />
        <Hero {...ctx} stats={stats} />
        <StatsGrid {...ctx} stats={stats} />
        {stats.muscles.length > 0 && <MuscleBar {...ctx} muscles={stats.muscles} />}
        {stats.exercises.length > 0 && <ExerciseList {...ctx} stats={stats} maxRows={maxRows} />}
      </div>
    </div>
  );
}
