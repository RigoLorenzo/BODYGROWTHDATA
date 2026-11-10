"use client";

import { useQueryClient } from "@tanstack/react-query";
import { saveToPlan } from "@/components/session/exercise-note";
import { cleanNote } from "@/lib/exercise-notes";
import { useSessionStore } from "@/store/session-store";

/**
 * Crea o scioglie un superset durante l'allenamento e lo ricorda nel piano
 * (etichetta "Superset" nella nota del primo esercizio), così la prossima
 * seduta dello stesso giorno lo ripropone.
 */
export function useSuperset() {
  const linkSuperset = useSessionStore((s) => s.linkSuperset);
  const unlinkSuperset = useSessionStore((s) => s.unlinkSuperset);
  const queryClient = useQueryClient();

  const remember = async (ids: (string | undefined)[]) => {
    const session = useSessionStore.getState().activeSession;
    if (!session?.programDayId) return;
    const touched = session.exercises.filter((ex) => ids.includes(ex.id));
    // Un esercizio aggiunto oggi non è nel giorno del piano: il server lo ignora
    await Promise.allSettled(touched.map((ex) => saveToPlan(session.programDayId!, ex.exerciseId, cleanNote(ex.notes))));
    queryClient.invalidateQueries({ queryKey: ["programs"] });
  };

  const partnerOf = (id: string) => useSessionStore.getState().activeSession?.exercises.find((ex) => ex.id === id)?.supersetWith;

  return {
    linkNext: (id: string) => {
      linkSuperset(id);
      void remember([id, partnerOf(id)]);
    },
    unlink: (id: string) => {
      const partner = partnerOf(id);
      unlinkSuperset(id);
      void remember([id, partner]);
    },
  };
}
