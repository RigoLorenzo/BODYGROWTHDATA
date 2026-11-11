"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoachQuestion } from "@/lib/coach/types";

/** Domande salvate dal modello: i campi facoltativi possono mancare */
const normalize = (raw: unknown[]): CoachQuestion[] =>
  raw.flatMap((item, index) => {
    const q = item as Partial<CoachQuestion>;
    if (!q?.question) return [];
    return [
      {
        id: q.id ?? `q${index}`,
        question: q.question,
        options: Array.isArray(q.options) ? q.options : [],
        multiSelect: Boolean(q.multiSelect),
        allowFreeText: q.allowFreeText ?? true,
      },
    ];
  });

interface Props {
  questions: unknown[];
  /** Solo l'ultima domanda senza risposta si può compilare */
  active: boolean;
  onSubmit: (answer: string) => void;
}

/** Domande del Coach con risposte da toccare, inviate tutte insieme */
export function QuestionCard({ questions, active, onSubmit }: Props) {
  const list = normalize(questions);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [free, setFree] = useState<Record<string, string>>({});

  const toggle = (q: CoachQuestion, option: string) =>
    setSelected((all) => {
      const current = all[q.id] ?? [];
      if (!q.multiSelect) return { ...all, [q.id]: current[0] === option ? [] : [option] };
      return { ...all, [q.id]: current.includes(option) ? current.filter((o) => o !== option) : [...current, option] };
    });

  const answerOf = (q: CoachQuestion) => [...(selected[q.id] ?? []), free[q.id]?.trim()].filter(Boolean).join(", ");
  const complete = list.every((q) => answerOf(q));

  const submit = () => {
    if (!complete) return;
    onSubmit(list.map((q) => `${q.question}\n→ ${answerOf(q)}`).join("\n\n"));
  };

  if (list.length === 0) return null;

  return (
    <div className={cn("mt-3 space-y-4 rounded-3xl border border-border/60 bg-muted/40 p-4", !active && "opacity-60")}>
      {list.map((q) => (
        <fieldset key={q.id} disabled={!active} className="space-y-2">
          <legend className="text-sm font-semibold">{q.question}</legend>
          {q.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {q.options.map((option) => {
                const on = (selected[q.id] ?? []).includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(q, option)}
                    className={cn(
                      "min-h-10 rounded-full border px-4 text-sm transition-colors active:scale-[0.98]",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}
          {q.allowFreeText && (
            <input
              value={free[q.id] ?? ""}
              onChange={(e) => setFree((all) => ({ ...all, [q.id]: e.target.value }))}
              placeholder={q.options.length ? "Oppure scrivi tu…" : "Scrivi la risposta…"}
              maxLength={300}
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            />
          )}
        </fieldset>
      ))}
      {active && (
        <button
          type="button"
          onClick={submit}
          disabled={!complete}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-sm font-semibold text-background transition-opacity disabled:opacity-40 active:scale-[0.98]"
        >
          <Send className="h-4 w-4" aria-hidden /> Invia le risposte
        </button>
      )}
    </div>
  );
}
