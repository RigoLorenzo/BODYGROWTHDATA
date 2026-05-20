"use client";

import { useState } from "react";
import { useSessionStore } from "@/store/session-store";
import { Check, Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveSet } from "@/types";

interface Props {
  exerciseId: string;
  set: ActiveSet;
  index: number;
  onRemove?: () => void;
}

const setTypeShort: Record<string, string> = {
  WARMUP: "W",
  WORKING: "●",
  DROPSET: "D",
  FAILURE: "F",
  MYOREP: "M",
};

export function SetRow({ exerciseId, set, index, onRemove }: Props) {
  const { updateSet, completeSet } = useSessionStore();
  const [weight, setWeight] = useState(set.weight?.toString() ?? "");
  const [reps, setReps] = useState(set.reps?.toString() ?? "");

  const handleComplete = () => {
    const w = parseFloat(weight) || undefined;
    const r = parseInt(reps) || undefined;
    updateSet(exerciseId, index, { weight: w, reps: r });
    completeSet(exerciseId, index);
    if ("vibrate" in navigator) navigator.vibrate(50);
  };

  const adjustWeight = (delta: number) => {
    const current = parseFloat(weight) || 0;
    const next = Math.max(0, current + delta);
    setWeight(next % 1 === 0 ? next.toString() : next.toFixed(2));
    updateSet(exerciseId, index, { weight: next });
  };

  const adjustReps = (delta: number) => {
    const current = parseInt(reps) || 0;
    const next = Math.max(1, current + delta);
    setReps(next.toString());
    updateSet(exerciseId, index, { reps: next });
  };

  return (
    <div
      className={cn(
        "grid grid-cols-12 gap-1 items-center rounded-lg p-1.5 transition-colors",
        set.completed
          ? "bg-green-500/10 border-l-2 border-green-500/40 pl-1"
          : "hover:bg-muted/30"
      )}
    >
      {/* Set number */}
      <span className="col-span-1 text-sm font-medium text-muted-foreground tabular-nums">{set.setNumber}</span>

      {/* Type */}
      <div className="col-span-2 flex justify-center">
        <span className={cn("text-sm font-bold", set.type === "WARMUP" ? "text-yellow-400" : "text-muted-foreground")}>
          {setTypeShort[set.type] ?? set.type}
        </span>
      </div>

      {/* Weight */}
      <div className="col-span-3 flex items-center justify-center gap-0.5">
        <button
          onClick={() => adjustWeight(-2.5)}
          className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          disabled={set.completed}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={weight}
          onChange={(e) => {
            setWeight(e.target.value);
            updateSet(exerciseId, index, { weight: parseFloat(e.target.value) || undefined });
          }}
          className="w-12 text-center text-sm font-semibold bg-transparent tabular-nums border-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="0"
          disabled={set.completed}
        />
        <button
          onClick={() => adjustWeight(2.5)}
          className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          disabled={set.completed}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Reps */}
      <div className="col-span-3 flex items-center justify-center gap-0.5">
        <button
          onClick={() => adjustReps(-1)}
          className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          disabled={set.completed}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={reps}
          onChange={(e) => {
            setReps(e.target.value);
            updateSet(exerciseId, index, { reps: parseInt(e.target.value) || undefined });
          }}
          className="w-10 text-center text-sm font-semibold bg-transparent tabular-nums border-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="0"
          disabled={set.completed}
        />
        <button
          onClick={() => adjustReps(1)}
          className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          disabled={set.completed}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Complete button */}
      <div className="col-span-2 flex justify-center">
        <button
          onClick={handleComplete}
          disabled={set.completed}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-all",
            set.completed
              ? "bg-green-600 text-white scale-90"
              : "border-2 border-border hover:border-green-600 hover:text-green-600 text-muted-foreground"
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Remove button — only when not completed */}
      <div className="col-span-1 flex justify-center">
        {!set.completed && onRemove && (
          <button
            onClick={onRemove}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-destructive transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
