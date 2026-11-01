"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { CalendarDays, ChevronDown, Share2, Trophy, X } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { cn } from "@/lib/utils";
import { splitDayName } from "@/lib/plan-format";
import {
  buildWorkoutShareStats,
  formatKg,
  formatNumberIt,
  formatShareDuration,
  timeOfDayTitle,
  type ShareExercise,
  type ShareMuscle,
  type WorkoutShareStats,
} from "@/lib/workout-share";
import { heroMetric, hiddenExercisesText, recordCountText } from "./share/share-image-kit";
import { ShareWorkoutDialog } from "./share/share-workout-dialog";

type WorkoutDetail = Prisma.WorkoutSessionGetPayload<{
  include: {
    personalRecords: { include: { exercise: true } };
    exercises: { include: { exercise: true; sets: true } };
  };
}>;

interface Props {
  workout: WorkoutDetail;
  /** Nome del giorno del piano ("A — Push"): titolo come nella scheda condivisa */
  dayName?: string | null;
  /** Fine allenamento: conteggio del tonnellaggio e ingresso animato */
  celebrate?: boolean;
  onClose?: () => void;
}

/** Esercizi visibili prima di "Mostra tutti" */
const VISIBLE_EXERCISES = 6;

/* Stessa lastra della scheda condivisa: scura in entrambi i temi, alone lime e blu */
const slabStyle: React.CSSProperties = {
  backgroundImage: [
    "radial-gradient(circle at 100% 0%, rgba(212,255,58,0.20) 0%, transparent 45%)",
    "radial-gradient(circle at 0% 100%, rgba(59,130,246,0.16) 0%, transparent 50%)",
  ].join(","),
};

const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500", className)}>{children}</p>
);

/** Da 0 al valore in ~0,9 s; subito il valore se l'animazione è ridotta o spenta */
function useCountUp(enabled: boolean) {
  const reduce = useReducedMotion();
  const [progress, setProgress] = useState(enabled && !reduce ? 0 : 1);
  useEffect(() => {
    if (!enabled || reduce) return setProgress(1);
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setProgress(1 - (1 - t) ** 3);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, reduce]);
  return progress;
}

/** Numero da copertina con la stessa unità finale anche durante il conteggio */
function heroValue(stats: WorkoutShareStats, unit: string, progress: number) {
  if (unit === "t") return ((stats.tonnage * progress) / 1000).toFixed(1).replace(".", ",");
  if (unit === "kg") return formatNumberIt(stats.tonnage * progress);
  return formatNumberIt(stats.reps * progress);
}

function Hero({ stats, celebrate }: { stats: WorkoutShareStats; celebrate: boolean }) {
  const { label, value, unit } = heroMetric(stats);
  const progress = useCountUp(celebrate);
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <Label>{label}</Label>
        <p className="mt-1 flex items-end gap-1.5 font-display font-extrabold leading-[0.85]">
          <span className="text-[5.5rem] tabular-nums tracking-tight text-[#d4ff3a]" aria-label={`${value} ${unit}`}>
            {progress < 1 ? heroValue(stats, unit, progress) : value}
          </span>
          <span className="pb-2 text-4xl font-bold text-zinc-50">{unit}</span>
        </p>
      </div>
      {stats.topSet && (
        <div className="min-w-0 shrink pb-2 text-right">
          <Label>Serie top</Label>
          <p className="mt-1 whitespace-nowrap font-display text-3xl font-extrabold leading-none text-zinc-50">
            {formatKg(stats.topSet.weight)} × {stats.topSet.reps}
          </p>
          <p className="mt-1 truncate text-xs font-medium text-zinc-400">{stats.topSet.exerciseName}</p>
        </div>
      )}
    </div>
  );
}

function StatsRow({ stats }: { stats: WorkoutShareStats }) {
  const items = [
    { label: "Durata", value: stats.durationSeconds ? formatShareDuration(stats.durationSeconds) : "—" },
    { label: "Serie", value: formatNumberIt(stats.workingSets) },
    { label: "Ripetiz.", value: formatNumberIt(stats.reps) },
    { label: "Esercizi", value: formatNumberIt(stats.exerciseCount) },
  ];
  return (
    <dl className="grid grid-cols-[1.35fr_1fr_1fr_1fr] border-y border-white/10 py-3">
      {items.map((item, i) => (
        <div key={item.label} className={cn("min-w-0", i > 0 && "border-l border-white/10 pl-3")}>
          <dd className="truncate font-display text-[1.75rem] font-bold leading-none tabular-nums text-zinc-50">{item.value}</dd>
          <dt className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function MuscleBar({ muscles }: { muscles: ShareMuscle[] }) {
  return (
    <div>
      <Label>Muscoli allenati</Label>
      <div className="mt-2.5 flex h-2.5 gap-[3px] overflow-hidden rounded-full" aria-hidden>
        {muscles.map((m) => (
          <span key={m.muscle} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${m.share * 100}%`, background: m.color }} />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {muscles.map((m) => (
          <li key={m.muscle} className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
            <span className="h-2 w-2 rounded-full" style={{ background: m.color }} aria-hidden />
            {m.label} {Math.round(m.share * 100)}%
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExerciseRow({ exercise }: { exercise: ShareExercise }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: exercise.color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-50">{exercise.name}</p>
        {exercise.pr && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#d4ff3a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-950">
            <Trophy className="h-3 w-3" aria-hidden /> PR {exercise.pr}
          </span>
        )}
      </div>
      <p className="shrink-0 text-right font-display text-base font-semibold tabular-nums text-zinc-400">{exercise.summary}</p>
    </li>
  );
}

function ExerciseList({ stats }: { stats: WorkoutShareStats }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? stats.exercises : stats.exercises.slice(0, VISIBLE_EXERCISES);
  const hidden = stats.exercises.length - visible.length;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Label>Esercizi</Label>
        {stats.records.length > 0 && (
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#d4ff3a]">
            <Trophy className="h-3.5 w-3.5" aria-hidden /> {recordCountText(stats.records.length)}
          </p>
        )}
      </div>
      <ul className="mt-1">
        {visible.map((exercise, i) => (
          <ExerciseRow key={`${exercise.name}-${i}`} exercise={exercise} />
        ))}
      </ul>
      {(hidden > 0 || expanded) && stats.exercises.length > VISIBLE_EXERCISES && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-zinc-400 active:bg-white/5"
        >
          {expanded ? "Mostra meno" : hiddenExercisesText(hidden)}
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      )}
    </div>
  );
}

const list: Variants = { show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", damping: 24, stiffness: 260 } },
};

/**
 * Resoconto dell'allenamento: a fine seduta e nel dettaglio. Stessi numeri e
 * stesso stile della scheda da condividere, così quello che vedi è quello
 * che pubblichi.
 */
export function WorkoutSummaryCard({ workout, dayName, celebrate = false, onClose }: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  const reduce = useReducedMotion();
  const stats = useMemo(() => buildWorkoutShareStats(workout), [workout]);

  const started = new Date(workout.startedAt);
  const day = dayName ? splitDayName(dayName, 0) : null;
  const title = day?.title ?? timeOfDayTitle(started.getHours());
  const dateLabel = started.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const timeLabel = started.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const animate = celebrate && !reduce;

  return (
    <motion.section
      aria-label="Riepilogo allenamento"
      className="relative overflow-hidden rounded-3xl bg-zinc-950 p-5 text-zinc-50 shadow-2xl ring-1 ring-white/10"
      style={slabStyle}
      variants={list}
      initial={animate ? "hidden" : false}
      animate="show"
    >
      <motion.header variants={item} className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {celebrate && (
            <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d4ff3a]">
              <span className="h-2 w-2 rounded-full bg-[#d4ff3a]" aria-hidden /> Allenamento completato
            </p>
          )}
          {/* Ora locale del telefono: il server può essere in un altro fuso */}
          <p suppressHydrationWarning className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate">{dateLabel}</span>
            <span className="text-zinc-500">· {timeLabel}</span>
          </p>
          <h2 className="mt-2 flex items-end gap-2.5 font-display font-extrabold uppercase leading-[0.9]">
            {day?.code && <span className="text-5xl text-[#d4ff3a]">{day.code}</span>}
            <span suppressHydrationWarning className={cn("min-w-0 break-words", title.length > 18 ? "text-3xl" : "text-4xl")}>
              {title}
            </span>
          </h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi riepilogo"
            className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 active:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </motion.header>

      <motion.div variants={item} className="mt-6">
        <Hero stats={stats} celebrate={animate} />
      </motion.div>
      <motion.div variants={item} className="mt-5">
        <StatsRow stats={stats} />
      </motion.div>
      {stats.muscles.length > 0 && (
        <motion.div variants={item} className="mt-5">
          <MuscleBar muscles={stats.muscles} />
        </motion.div>
      )}
      {stats.exercises.length > 0 && (
        <motion.div variants={item} className="mt-5">
          <ExerciseList stats={stats} />
        </motion.div>
      )}

      <motion.div variants={item} className="mt-5 space-y-2">
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#d4ff3a] font-display text-xl font-bold uppercase tracking-wide text-zinc-950 shadow-[0_8px_30px_-8px_rgba(212,255,58,0.55)] transition-transform active:scale-[0.98]"
        >
          <Share2 className="h-5 w-5" aria-hidden /> Condividi
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold text-zinc-300 active:bg-white/5"
          >
            Torna alla home
          </button>
        )}
      </motion.div>

      <ShareWorkoutDialog sessionId={workout.id} open={shareOpen} onOpenChange={setShareOpen} />
    </motion.section>
  );
}
