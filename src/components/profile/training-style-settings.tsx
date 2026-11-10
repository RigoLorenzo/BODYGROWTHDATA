"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { STYLE_INFO, type TrainingStyle } from "@/lib/training-style";
import { TrainingStylePicker, saveTrainingStyle } from "./training-style-picker";

/** Cambio dello stile dalle Impostazioni: si salva appena tocchi un'altra scheda */
export function TrainingStyleSettings({ initial }: { initial: TrainingStyle | null }) {
  const router = useRouter();
  const [style, setStyle] = useState<TrainingStyle | null>(initial);

  const change = async (next: TrainingStyle) => {
    const previous = style;
    setStyle(next);
    try {
      await saveTrainingStyle(next);
      router.refresh();
      toast({ title: `Stile: ${STYLE_INFO[next].name}`, description: "Fitness ora mette in evidenza i tuoi indicatori." });
    } catch {
      setStyle(previous);
      toast({ title: "Non salvato", description: "Controlla la connessione e riprova.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ogni stile misura i progressi in modo diverso. Scegli quello più vicino a come ti alleni: l&apos;app ti mostrerà per primi i
        numeri che contano per te. Cambiarlo non cancella nulla: tutti i dati restano visibili.
      </p>
      <TrainingStylePicker value={style} onChange={change} />
    </div>
  );
}
