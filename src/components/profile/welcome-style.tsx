"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { TrainingStyle } from "@/lib/training-style";
import { TrainingStylePicker, saveTrainingStyle } from "./training-style-picker";

/** Benvenuto: si sceglie lo stile, poi si entra nell'app */
export function WelcomeStyle({ name }: { name: string | null }) {
  const router = useRouter();
  const [style, setStyle] = useState<TrainingStyle | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!style) return;
    setSaving(true);
    try {
      await saveTrainingStyle(style);
      router.replace("/dashboard");
      router.refresh();
    } catch {
      toast({ title: "Non salvato", description: "Controlla la connessione e riprova.", variant: "destructive" });
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-xl px-4 pb-32 pt-8">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{name ? `Ciao ${name}` : "Benvenuto"}</p>
      <h1 className="mt-1 font-display text-4xl font-extrabold uppercase leading-none">Che allenamento fai?</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Ogni stile misura i progressi in modo diverso: chi fa bodybuilding guarda il lavoro sui muscoli, chi fa powerlifting il
        massimo che riesce ad alzare, chi corre la strada e il ritmo. Scegli quello più vicino a te: l&apos;app ti mostrerà per primi
        i numeri che contano. Tutti i dati restano sempre visibili e puoi cambiare idea quando vuoi dalle Impostazioni.
      </p>

      <div className="mt-6">
        <TrainingStylePicker value={style} onChange={setStyle} />
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border/60 bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={save}
          disabled={!style || saving}
          className="mx-auto flex h-14 w-full max-w-xl items-center justify-center gap-2 rounded-2xl bg-foreground font-display text-xl font-bold uppercase tracking-wide text-background active:scale-[0.98] disabled:opacity-40"
        >
          {saving ? "Salvataggio…" : "Continua"} {!saving && <ArrowRight className="h-5 w-5" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
