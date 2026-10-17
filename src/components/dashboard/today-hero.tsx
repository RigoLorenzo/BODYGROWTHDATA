"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowRight, ChevronRight, Play, Trash2 } from "lucide-react";
import { useActiveProgram, useStartPlanDay } from "@/hooks/use-active-program";
import { useServerActiveSession } from "@/hooks/use-workout-session";
import { useSessionStore } from "@/store/session-store";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, getMuscleColor, getMuscleLabel } from "@/lib/utils";
import { repsLabel, setsByMuscle, splitDayName } from "@/lib/plan-format";
import type { ActiveProgramResponse } from "@/types";

/* ─── Superficie "lavagna": scura in entrambi i temi, il punto focale della home ─── */

const slabTexture: React.CSSProperties = {
  backgroundImage: [
    "radial-gradient(120% 80% at 100% 0%, rgba(163,230,53,0.16), transparent 55%)",
    "repeating-linear-gradient(135deg, rgba(255,255,255,0.028) 0 2px, transparent 2px 11px)",
  ].join(","),
};

function Slab({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn("relative overflow-hidden rounded-3xl bg-zinc-950 text-zinc-50 ring-1 ring-white/10", className)}
      style={slabTexture}
    >
      {children}
    </section>
  );
}

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="shrink-0 whitespace-nowrap font-display text-[13px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{children}</p>
);

const ctaClass =
  "flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime-400 font-display text-xl font-bold uppercase tracking-wide text-zinc-950 shadow-[0_8px_30px_-8px_rgba(163,230,53,0.6)] transition-transform active:scale-[0.98] disabled:opacity-60 touch-manipulation";

/* ─── Stati della card ─── */

function ActiveWorkoutSlab() {
  const session = useSessionStore((s) => s.activeSession)!;
  const sets = session.exercises.flatMap((ex) => ex.sets);
  const done = sets.filter((s) => s.completed).length;
  const pct = sets.length ? Math.round((done / sets.length) * 100) : 0;
  const { code, title } = session.programDayName
    ? splitDayName(session.programDayName, 0)
    : { code: null, title: "Allenamento libero" };

  return (
    <Slab className="p-5">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime-400" />
        </span>
        <Eyebrow>Allenamento in corso</Eyebrow>
      </div>
      <div className="mt-3 flex items-end gap-3">
        {code && (
          <span className="font-display text-6xl font-extrabold uppercase leading-[0.8] text-lime-400">{code}</span>
        )}
        <h2 className="min-w-0 font-display text-xl font-bold uppercase leading-tight">{title}</h2>
      </div>
      <div className="mt-5 flex items-end justify-between">
        <p className="font-display text-5xl font-bold tabular-nums leading-none">
          {done}
          <span className="text-2xl text-zinc-500">/{sets.length}</span>
        </p>
        <p className="pb-1 text-sm text-zinc-400">serie fatte</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-lime-400 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <Link href="/workout/active" className={cn(ctaClass, "mt-5")}>
        Riprendi <ArrowRight className="h-5 w-5" />
      </Link>
    </Slab>
  );
}

function OrphanWorkoutSlab() {
  const { orphanSession, resume, discard } = useServerActiveSession();
  if (!orphanSession) return null;
  const busy = resume.isPending || discard.isPending;

  return (
    <Slab className="p-5">
      <Eyebrow>Allenamento non concluso</Eyebrow>
      <p className="mt-2 text-sm text-zinc-300">
        Iniziato alle {format(new Date(orphanSession.startedAt), "HH:mm 'del' d MMMM", { locale: it })}. Riprendilo
        da dove eri rimasto: le serie salvate vengono ripristinate.
      </p>
      <button className={cn(ctaClass, "mt-5")} onClick={() => resume.mutate(orphanSession.id)} disabled={busy}>
        <Play className="h-5 w-5" /> {resume.isPending ? "Ripresa..." : "Riprendi qui"}
      </button>
      <button
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm text-zinc-400 active:bg-white/5"
        onClick={() => discard.mutate(orphanSession.id)}
        disabled={busy}
      >
        <Trash2 className="h-4 w-4" /> Scarta e iniziane uno nuovo
      </button>
    </Slab>
  );
}

function NoPlanSlab() {
  const { startFree, isLoading } = useStartPlanDay();
  return (
    <Slab className="p-5">
      <Eyebrow>Oggi</Eyebrow>
      <h2 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none">Allenamento libero</h2>
      <p className="mt-2 text-sm text-zinc-400">Nessun piano attivo: aggiungi gli esercizi mentre ti alleni.</p>
      <button className={cn(ctaClass, "mt-5")} onClick={startFree} disabled={isLoading}>
        <Play className="h-5 w-5" /> {isLoading ? "Avvio..." : "Inizia"}
      </button>
      <Link
        href="/programs"
        className="mt-2 flex h-11 items-center justify-center gap-1 text-sm text-zinc-400 active:text-zinc-200"
      >
        Crea o attiva un piano <ChevronRight className="h-4 w-4" />
      </Link>
    </Slab>
  );
}

function PlanSlab({ active }: { active: ActiveProgramResponse }) {
  const { startDay, startFree, isLoading } = useStartPlanDay();
  const suggested = active.suggestedDayIndex ?? 0;
  const [selected, setSelected] = useState(suggested);
  const [showAll, setShowAll] = useState(false);

  const index = Math.min(selected, active.days.length - 1);
  const day = active.days[index];
  const { code, title } = splitDayName(day.name, index);
  const totalSets = day.exercises.reduce((sum, ex) => sum + ex.sets, 0);
  const muscles = setsByMuscle(day.exercises);
  const visible = showAll ? day.exercises : day.exercises.slice(0, 4);

  return (
    <Slab>
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>
            Settimana {Math.min(active.weekProgress, active.program.durationWeeks)}/{active.program.durationWeeks}
          </Eyebrow>
          <Link
            href={`/programs/${active.programId}`}
            className="-mr-2 flex h-10 min-w-0 items-center gap-0.5 rounded-lg px-2 text-xs text-zinc-400 active:bg-white/5"
          >
            <span className="truncate">{active.program.name.split(" — ")[0]}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          </Link>
        </div>

        {/* Scelta del giorno direttamente qui, senza aprire pannelli */}
        <div
          className="mt-4 grid gap-1.5 rounded-2xl bg-white/5 p-1.5"
          style={{ gridTemplateColumns: `repeat(${active.days.length}, minmax(0, 1fr))` }}
          role="tablist"
          aria-label="Giorno del piano"
        >
          {active.days.map((d, i) => {
            const isSelected = i === index;
            return (
              <button
                key={d.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => {
                  setSelected(i);
                  setShowAll(false);
                }}
                className={cn(
                  "relative h-11 rounded-xl font-display text-lg font-bold uppercase transition-colors touch-manipulation",
                  isSelected ? "bg-zinc-50 text-zinc-950" : "text-zinc-400 active:bg-white/10"
                )}
              >
                {splitDayName(d.name, i).code}
                {i === suggested && (
                  <span
                    className={cn(
                      "absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full",
                      isSelected ? "bg-lime-500" : "bg-lime-400"
                    )}
                    aria-label="Prossimo"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-end gap-3">
          <span className="font-display text-7xl font-extrabold uppercase leading-[0.8] tracking-tight text-lime-400">
            {code}
          </span>
          <div className="min-w-0 pb-0.5">
            {index === suggested && (
              <span className="mb-1 inline-block rounded-full bg-lime-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-400">
                Prossimo
              </span>
            )}
            <p className="font-display text-xl font-bold uppercase leading-tight">{title}</p>
            <p className="text-xs text-zinc-400">
              {day.exercises.length} esercizi · <span className="tabular-nums">{totalSets}</span> serie
            </p>
          </div>
        </div>


        {/* Azione principale subito visibile, senza scorrere */}
        <button className={cn(ctaClass, "mt-5")} onClick={() => startDay(day)} disabled={isLoading}>
          <Play className="h-5 w-5 fill-current" />
          {isLoading ? "Avvio..." : `Inizia ${code}`}
        </button>
        <button
          onClick={startFree}
          disabled={isLoading}
          className="flex h-10 w-full items-center justify-center text-sm text-zinc-400 active:text-zinc-200"
        >
          oppure allenamento libero
        </button>
        {/* Dove vanno le serie di oggi */}
        {muscles.length > 0 && (
          <div className="mt-2">
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
              {muscles.map(([muscle, sets]) => (
                <div key={muscle} style={{ flexGrow: sets, background: getMuscleColor(muscle) }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {muscles.map(([muscle, sets]) => (
                <span key={muscle} className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: getMuscleColor(muscle) }} />
                  {getMuscleLabel(muscle)} <span className="tabular-nums text-zinc-200">{sets}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {day.exercises.length > 0 ? (
        <ol className="mt-4 border-t border-white/10">
          {visible.map((ex, i) => (
            <li key={`${ex.exerciseId}-${i}`} className="flex items-center gap-3 border-b border-white/5 px-5 py-2.5">
              <span className="w-5 font-display text-sm font-bold tabular-nums text-zinc-500">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{ex.exercise?.nameIt ?? ex.exercise?.name}</span>
              <span className="font-display text-base font-semibold tabular-nums text-zinc-300">
                {ex.sets}×{repsLabel(ex.repsMin, ex.repsMax)}
              </span>
            </li>
          ))}
          {day.exercises.length > 4 && (
            <li>
              <button
                onClick={() => setShowAll((v) => !v)}
                className="h-11 w-full text-xs font-medium text-zinc-400 active:bg-white/5"
              >
                {showAll ? "Mostra meno" : `Mostra tutti i ${day.exercises.length} esercizi`}
              </button>
            </li>
          )}
        </ol>
      ) : (
        <p className="mt-4 border-t border-white/10 px-5 py-4 pb-5 text-sm text-zinc-400">
          Nessun esercizio programmato per questo giorno.
        </p>
      )}

    </Slab>
  );
}

/** Card principale della home: cosa allenare oggi, a un tocco di distanza */
export function TodayHero() {
  const activeSession = useSessionStore((s) => s.activeSession);
  const { orphanSession } = useServerActiveSession();
  const { data: active, isPending } = useActiveProgram();
  // L'allenamento in corso vive nel localStorage: si decide solo dopo il mount
  // per non avere differenze tra HTML del server e del client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <Skeleton className="h-[460px] rounded-3xl" />;
  if (activeSession) return <ActiveWorkoutSlab />;
  if (orphanSession) return <OrphanWorkoutSlab />;
  if (isPending) return <Skeleton className="h-[460px] rounded-3xl" />;
  if (!active?.days?.length) return <NoPlanSlab />;
  return <PlanSlab key={active.programId} active={active} />;
}
