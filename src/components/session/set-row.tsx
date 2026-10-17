"use client";

import { memo, useEffect, useState } from "react";
import { useSessionStore } from "@/store/session-store";
import { Check, Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveSet } from "@/types";

interface Props {
  exerciseId: string;
  set: ActiveSet;
  index: number;
  onRemove?: (index: number) => void;
}

const WEIGHT_STEP = 2.5;

const toNumber = (value: string, parse: (v: string) => number) => {
  const n = parse(value.replace(",", "."));
  return Number.isNaN(n) ? undefined : n;
};

const formatWeight = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(2).replace(/0$/, ""));

const stepButton =
  "h-9 w-8 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground active:bg-muted touch-manipulation disabled:opacity-30";

const numberInput =
  "w-full min-w-0 text-center text-base font-semibold bg-muted/40 rounded-lg h-9 tabular-nums border-0 outline-none focus:ring-1 focus:ring-primary disabled:bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

/** Campo numerico locale, riallineato quando il valore cambia dallo store */
function useSyncedField(value: number | undefined, parse: (v: string) => number) {
  const [text, setText] = useState(value?.toString() ?? "");
  useEffect(() => {
    if ((toNumber(text, parse) ?? null) !== (value ?? null)) setText(value?.toString() ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return [text, setText] as const;
}

function SetRowComponent({ exerciseId, set, index, onRemove }: Props) {
  const updateSet = useSessionStore((s) => s.updateSet);
  const completeSet = useSessionStore((s) => s.completeSet);
  const uncompleteSet = useSessionStore((s) => s.uncompleteSet);
  const [weight, setWeight] = useSyncedField(set.weight, parseFloat);
  const [reps, setReps] = useSyncedField(set.reps, (v) => parseInt(v, 10));

  const locked = set.completed;
  const suggested = set.prefilled && !set.completed;

  const toggle = () => {
    if (set.completed) {
      uncompleteSet(exerciseId, index);
      return;
    }
    updateSet(exerciseId, index, {
      weight: toNumber(weight, parseFloat),
      reps: toNumber(reps, (v) => parseInt(v, 10)),
    });
    completeSet(exerciseId, index);
    if ("vibrate" in navigator) navigator.vibrate(30);
  };

  const adjustWeight = (delta: number) => {
    const next = Math.max(0, (toNumber(weight, parseFloat) ?? 0) + delta);
    setWeight(formatWeight(next));
    updateSet(exerciseId, index, { weight: next });
  };

  return (
    <div
      className={cn(
        "grid grid-cols-[1.25rem_minmax(0,1fr)_3.5rem_2.5rem_1.25rem] gap-1.5 items-center rounded-lg px-1 py-1",
        set.completed && "bg-green-500/10"
      )}
    >
      <span
        className={cn(
          "text-sm font-semibold tabular-nums text-center",
          set.type === "WARMUP" ? "text-yellow-400" : "text-muted-foreground"
        )}
      >
        {set.type === "WARMUP" ? "W" : set.setNumber}
      </span>

      <div className="flex items-center gap-0.5 min-w-0">
        <button
          type="button"
          aria-label="Diminuisci peso"
          className={stepButton}
          onClick={() => adjustWeight(-WEIGHT_STEP)}
          disabled={locked}
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="text"
          inputMode="decimal"
          aria-label="Peso in kg"
          value={weight}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            setWeight(e.target.value);
            updateSet(exerciseId, index, { weight: toNumber(e.target.value, parseFloat) });
          }}
          className={cn(numberInput, suggested && "text-muted-foreground/60")}
          placeholder="kg"
          disabled={locked}
        />
        <button
          type="button"
          aria-label="Aumenta peso"
          className={stepButton}
          onClick={() => adjustWeight(WEIGHT_STEP)}
          disabled={locked}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <input
        type="text"
        inputMode="numeric"
        aria-label="Ripetizioni"
        value={reps}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setReps(e.target.value);
          updateSet(exerciseId, index, { reps: toNumber(e.target.value, (v) => parseInt(v, 10)) });
        }}
        className={cn(numberInput, suggested && "text-muted-foreground/60")}
        placeholder="reps"
        disabled={locked}
      />

      <button
        type="button"
        onClick={toggle}
        aria-pressed={set.completed}
        aria-label={set.completed ? "Segna la serie come non fatta" : "Segna la serie come fatta"}
        className={cn(
          "h-10 w-10 justify-self-center rounded-full flex items-center justify-center touch-manipulation transition-colors",
          set.completed
            ? "bg-green-600 text-white"
            : "border-2 border-border text-muted-foreground active:border-green-600"
        )}
      >
        <Check className="h-4 w-4" />
      </button>

      <div className="flex justify-center">
        {!set.completed && onRemove && (
          <button
            type="button"
            aria-label="Elimina serie"
            onClick={() => onRemove(index)}
            className="h-8 w-5 flex items-center justify-center text-muted-foreground/50 active:text-destructive touch-manipulation"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Si ridisegna solo quando cambia la sua serie: le liste lunghe restano fluide */
export const SetRow = memo(SetRowComponent);
