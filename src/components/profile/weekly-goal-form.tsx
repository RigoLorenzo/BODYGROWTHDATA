"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { WeeklyGoalSummary } from "@/lib/weekly-goal";

const SESSION_CHOICES = [1, 2, 3, 4, 5, 6, 7];
const KM_CHOICES = [10, 15, 20, 25, 30, 40, 50];

/** null = automatico (piano) per le sedute, nessun obiettivo per i km */
type Choice = number | null;

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 min-w-11 rounded-full border px-4 text-sm font-semibold tabular-nums transition-colors active:scale-[0.98]",
        selected ? "border-foreground bg-foreground text-background" : "border-border bg-background"
      )}
    >
      {children}
    </button>
  );
}

/** Obiettivo settimanale: sedute (o come il piano) e, per corsa e ibrido, km */
export function WeeklyGoalForm({ initial }: { initial: WeeklyGoalSummary }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sessions, setSessions] = useState<Choice>(initial.chosen.sessions);
  const [km, setKm] = useState<Choice>(initial.runsCount ? initial.chosen.km : null);
  const [saving, setSaving] = useState(false);
  const showKm = initial.runsCount;
  const planLabel = initial.planFrequency ? `Come il piano (${initial.planFrequency})` : null;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/weekly-goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Lo stile Bodybuilding/Powerlifting non usa i km: si conserva il valore già salvato
        body: JSON.stringify({ sessions, km: showKm ? km : initial.chosen.km }),
      });
      if (!res.ok) throw new Error();
      await queryClient.invalidateQueries({ queryKey: ["analytics", "overview"] });
      toast({ title: "Obiettivo salvato" });
      router.push("/dashboard");
    } catch {
      toast({ title: "Non salvato", description: "Controlla la connessione e riprova.", variant: "destructive" });
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Allenamenti a settimana</h2>
          <p className="text-sm text-muted-foreground">
            {initial.runsCount ? "Contano palestra e corse." : "Contano le sedute in palestra."} Nelle ultime settimane ne hai
            fatti in media <span className="font-semibold text-foreground">{initial.suggestedSessions}</span>.
          </p>
        </div>
        <div role="radiogroup" aria-label="Allenamenti a settimana" className="flex flex-wrap gap-2">
          {planLabel ? (
            <Chip selected={sessions == null} onClick={() => setSessions(null)}>
              {planLabel}
            </Chip>
          ) : (
            initial.runsCount && (
              <Chip selected={sessions == null} onClick={() => setSessions(null)}>
                Nessuno
              </Chip>
            )
          )}
          {SESSION_CHOICES.map((n) => (
            <Chip key={n} selected={sessions === n} onClick={() => setSessions(n)}>
              {n}
            </Chip>
          ))}
        </div>
      </section>

      {showKm && (
        <section className="space-y-3">
          <div>
            <h2 className="font-semibold">Km di corsa a settimana</h2>
            <p className="text-sm text-muted-foreground">Aumentali con gradualità: circa il 10% in più a settimana.</p>
          </div>
          <div role="radiogroup" aria-label="Km a settimana" className="flex flex-wrap gap-2">
            <Chip selected={km == null} onClick={() => setKm(null)}>
              Nessuno
            </Chip>
            {KM_CHOICES.map((n) => (
              <Chip key={n} selected={km === n} onClick={() => setKm(n)}>
                {n} km
              </Chip>
            ))}
            {km != null && !KM_CHOICES.includes(km) && (
              <Chip selected onClick={() => setKm(km)}>
                {String(km).replace(".", ",")} km
              </Chip>
            )}
          </div>
        </section>
      )}

      {!showKm && !planLabel && sessions == null && (
        <p className="text-sm text-muted-foreground">Scegli un numero per vedere ogni settimana a che punto sei.</p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-foreground font-semibold text-background disabled:opacity-50 active:scale-[0.98]"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Salva obiettivo
      </button>
    </div>
  );
}
