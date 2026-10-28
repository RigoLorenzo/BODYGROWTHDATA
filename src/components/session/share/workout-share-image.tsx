/**
 * Scheda condivisibile dell'allenamento, renderizzata in PNG da next/og (Satori).
 *
 * Vincoli di Satori: solo stili inline, ogni <div> con più figli deve essere
 * flex, testo in un unico nodo stringa. I font coprono solo il latino: niente
 * emoji o simboli fuori set (stelle, ≈…), le icone sono SVG inline.
 */

import type { ShareExercise, ShareMuscle, WorkoutShareStats } from "@/lib/workout-share";
import { formatKg, formatNumberIt, formatShareDuration, splitTonnage } from "@/lib/workout-share";

export type ShareFormat = "story" | "post";

export const SHARE_FORMATS: Record<ShareFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1350 },
};

interface Layout {
  pad: number;
  logo: number;
  brand: number;
  meta: number;
  title: [number, number, number];
  hero: number;
  heroUnit: number;
  heroCaption: number;
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
    heroCaption: 34,
    stat: 84,
    statLabel: 22,
    rowName: 32,
    rowValue: 34,
    rowGap: 22,
    maxExercises: 6,
    maxExercisesLongTitle: 5,
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
    heroCaption: 26,
    stat: 64,
    statLabel: 18,
    rowName: 28,
    rowValue: 30,
    rowGap: 14,
    maxExercises: 4,
    maxExercisesLongTitle: 3,
    showLegend: false,
    sectionGap: 34,
  },
};

const COLORS = {
  bg: "#09090b",
  accent: "#d4ff3a",
  text: "#fafafa",
  muted: "rgba(250,250,250,0.6)",
  faint: "rgba(250,250,250,0.38)",
  line: "rgba(250,250,250,0.12)",
  surface: "rgba(250,250,250,0.05)",
};

const DISPLAY = "Barlow Condensed";
const BODY = "Inter";

export interface WorkoutShareImageProps {
  format: ShareFormat;
  stats: WorkoutShareStats;
  title: string;
  dateLabel: string;
  timeLabel: string;
  athlete: string | null;
  logoSrc: string;
  domain: string;
}

const titleSize = (title: string, sizes: Layout["title"]) =>
  title.length <= 14 ? sizes[0] : title.length <= 24 ? sizes[1] : sizes[2];

// Larghezza media di un carattere maiuscolo in Barlow Condensed ExtraBold, in em
const TITLE_CHAR_EM = 0.45;

function titleWraps(title: string, layout: Layout, width: number) {
  const charsPerLine = (width - layout.pad * 2) / (titleSize(title, layout.title) * TITLE_CHAR_EM);
  return title.length > charsPerLine;
}

function SectionLabel({ children, size }: { children: string; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: BODY,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: size * 0.18,
        textTransform: "uppercase",
        color: COLORS.faint,
      }}
    >
      {children}
    </div>
  );
}

function TrophyIcon({ size, color }: { size: number; color: string }) {
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

function Header({ layout, logoSrc, athlete }: { layout: Layout; logoSrc: string; athlete: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: layout.logo * 0.28 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          width={layout.logo}
          height={layout.logo}
          alt=""
          style={{ borderRadius: layout.logo * 0.24, border: `2px solid ${COLORS.line}` }}
        />
        <div
          style={{
            display: "flex",
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: layout.brand,
            letterSpacing: layout.brand * 0.14,
            color: COLORS.text,
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
            color: COLORS.muted,
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

function TitleBlock({ layout, title, meta }: { layout: Layout; title: string; meta: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: layout.meta * 0.5 }}>
      <div
        style={{
          display: "flex",
          fontFamily: BODY,
          fontWeight: 600,
          fontSize: layout.meta,
          letterSpacing: layout.meta * 0.12,
          textTransform: "uppercase",
          color: COLORS.muted,
        }}
      >
        {meta}
      </div>
      <div
        style={{
          display: "block",
          lineClamp: 2,
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: titleSize(title, layout.title),
          lineHeight: 0.92,
          textTransform: "uppercase",
          color: COLORS.text,
        }}
      >
        {title}
      </div>
    </div>
  );
}

function TopSet({ layout, topSet }: { layout: Layout; topSet: NonNullable<WorkoutShareStats["topSet"]> }) {
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
      <SectionLabel size={layout.statLabel}>Serie top</SectionLabel>
      <div
        style={{
          display: "flex",
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: layout.stat * 0.85,
          lineHeight: 1,
          color: COLORS.text,
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
          color: COLORS.muted,
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

/** Il tonnellaggio è il numero da copertina; a corpo libero lo sono le ripetizioni */
function heroMetric(stats: WorkoutShareStats) {
  if (stats.tonnage > 0) return { label: "Tonnellaggio totale", ...splitTonnage(stats.tonnage) };
  return { label: "Ripetizioni totali", value: formatNumberIt(stats.reps), unit: "rip." };
}

function Hero({ layout, stats }: { layout: Layout; stats: WorkoutShareStats }) {
  const { label, value, unit } = heroMetric(stats);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <SectionLabel size={layout.statLabel}>{label}</SectionLabel>
          <div style={{ display: "flex", alignItems: "flex-end", gap: layout.heroUnit * 0.15 }}>
            <div
              style={{
                display: "flex",
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: layout.hero,
                lineHeight: 0.9,
                letterSpacing: -layout.hero * 0.01,
                color: COLORS.accent,
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
                color: COLORS.text,
              }}
            >
              {unit}
            </div>
          </div>
        </div>
        {stats.topSet && <TopSet layout={layout} topSet={stats.topSet} />}
      </div>
      {stats.tonnage > 0 && stats.equivalence && (
        <div
          style={{
            display: "flex",
            fontFamily: BODY,
            fontWeight: 500,
            fontSize: layout.heroCaption,
            color: COLORS.muted,
            marginTop: layout.heroCaption * 0.4,
          }}
        >
          {`Come sollevare ${stats.equivalence.count} ${stats.equivalence.label}`}
        </div>
      )}
    </div>
  );
}

function StatsGrid({ layout, stats }: { layout: Layout; stats: WorkoutShareStats }) {
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
        borderTop: `2px solid ${COLORS.line}`,
        borderBottom: `2px solid ${COLORS.line}`,
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
            borderLeft: index === 0 ? "none" : `2px solid ${COLORS.line}`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: layout.stat,
              lineHeight: 1,
              color: COLORS.text,
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
              color: COLORS.faint,
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

function MuscleBar({ layout, muscles }: { layout: Layout; muscles: ShareMuscle[] }) {
  const legend = muscles.slice(0, 4);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: layout.statLabel * 0.8 }}>
      <SectionLabel size={layout.statLabel}>Muscoli allenati</SectionLabel>
      <div style={{ display: "flex", height: layout.statLabel * 0.7, borderRadius: 999, overflow: "hidden" }}>
        {muscles.map((m, index) => (
          <div
            key={m.muscle}
            style={{
              display: "flex",
              width: `${m.share * 100}%`,
              height: "100%",
              background: m.color,
              borderLeft: index === 0 ? "none" : `3px solid ${COLORS.bg}`,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", columnGap: layout.rowName, rowGap: layout.statLabel * 0.6 }}>
        {(layout.showLegend ? legend : legend.slice(0, 3)).map((m) => (
          <div key={m.muscle} style={{ display: "flex", alignItems: "center", gap: layout.statLabel * 0.5 }}>
            <div style={{ display: "flex", width: 14, height: 14, borderRadius: 999, background: m.color }} />
            <div
              style={{
                display: "flex",
                fontFamily: BODY,
                fontWeight: 600,
                fontSize: layout.statLabel * 1.15,
                color: COLORS.muted,
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

function ExerciseRow({ layout, exercise }: { layout: Layout; exercise: ShareExercise }) {
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
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: layout.rowName * 0.4 }}>
          <div
            style={{
              display: "flex",
              fontFamily: BODY,
              fontWeight: 600,
              fontSize: layout.rowName,
              color: COLORS.text,
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
                background: COLORS.accent,
                color: COLORS.bg,
                borderRadius: 999,
                padding: `${layout.rowName * 0.12}px ${layout.rowName * 0.4}px`,
                fontFamily: BODY,
                fontWeight: 700,
                fontSize: layout.rowName * 0.6,
                letterSpacing: 1,
              }}
            >
              <TrophyIcon size={layout.rowName * 0.62} color={COLORS.bg} />
              {`PR ${exercise.pr}`}
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: DISPLAY,
          fontWeight: 600,
          fontSize: layout.rowValue,
          color: COLORS.muted,
          whiteSpace: "nowrap",
        }}
      >
        {exercise.summary}
      </div>
    </div>
  );
}

function ExerciseList({ layout, stats, maxRows }: { layout: Layout; stats: WorkoutShareStats; maxRows: number }) {
  const visible = stats.exercises.slice(0, maxRows);
  const hidden = stats.exercises.length - visible.length;
  const recordCount = stats.records.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: layout.rowGap }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <SectionLabel size={layout.statLabel}>Esercizi</SectionLabel>
        {recordCount > 0 && (
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
              color: COLORS.accent,
            }}
          >
            <TrophyIcon size={layout.statLabel * 1.2} color={COLORS.accent} />
            {recordCount === 1 ? "1 record personale" : `${recordCount} record personali`}
          </div>
        )}
      </div>
      {visible.map((exercise, index) => (
        <ExerciseRow key={`${exercise.name}-${index}`} layout={layout} exercise={exercise} />
      ))}
      {hidden > 0 && (
        <div
          style={{
            display: "flex",
            fontFamily: BODY,
            fontWeight: 600,
            fontSize: layout.rowName * 0.8,
            color: COLORS.faint,
            paddingLeft: layout.rowName * 0.6 + 6,
          }}
        >
          {hidden === 1 ? "+ 1 altro esercizio" : `+ ${hidden} altri esercizi`}
        </div>
      )}
    </div>
  );
}

function Footer({ layout, logoSrc, domain }: { layout: Layout; logoSrc: string; domain: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flex: 1,
        borderTop: `2px solid ${COLORS.line}`,
        paddingTop: layout.meta,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={layout.meta * 1.6} height={layout.meta * 1.6} alt="" style={{ borderRadius: 10 }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontFamily: BODY, fontWeight: 500, fontSize: layout.meta * 0.75, color: COLORS.faint }}>
            Tracciato con
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: DISPLAY,
              fontWeight: 800,
              fontSize: layout.meta * 1.05,
              letterSpacing: layout.meta * 0.1,
              color: COLORS.text,
            }}
          >
            BODYGROWTH
          </div>
        </div>
      </div>
      <div style={{ display: "flex", fontFamily: BODY, fontWeight: 600, fontSize: layout.meta * 0.85, color: COLORS.accent }}>
        {domain}
      </div>
    </div>
  );
}

export function WorkoutShareImage(props: WorkoutShareImageProps) {
  const { format, stats, title, dateLabel, timeLabel, athlete, logoSrc, domain } = props;
  const layout = LAYOUTS[format];
  const { width, height } = SHARE_FORMATS[format];
  const maxRows = titleWraps(title, layout, width) ? layout.maxExercisesLongTitle : layout.maxExercises;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width,
        height,
        padding: layout.pad,
        background: COLORS.bg,
        backgroundImage:
          "radial-gradient(circle at 92% 4%, rgba(212,255,58,0.20) 0%, rgba(9,9,11,0) 42%), radial-gradient(circle at 0% 100%, rgba(59,130,246,0.16) 0%, rgba(9,9,11,0) 48%)",
        color: COLORS.text,
        fontFamily: BODY,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: layout.sectionGap, flex: 1, overflow: "hidden" }}>
        <Header layout={layout} logoSrc={logoSrc} athlete={athlete} />
        <TitleBlock layout={layout} title={title} meta={`${dateLabel} · ${timeLabel}`} />
        <Hero layout={layout} stats={stats} />
        <StatsGrid layout={layout} stats={stats} />
        {stats.muscles.length > 0 && <MuscleBar layout={layout} muscles={stats.muscles} />}
        {stats.exercises.length > 0 && <ExerciseList layout={layout} stats={stats} maxRows={maxRows} />}
      </div>
      <div style={{ display: "flex", marginTop: layout.sectionGap * 0.6 }}>
        <Footer layout={layout} logoSrc={logoSrc} domain={domain} />
      </div>
    </div>
  );
}
