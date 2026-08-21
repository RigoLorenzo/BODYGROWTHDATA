import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";
import { it } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatWeight(value: number, unit: string = "kg"): string {
  if (unit === "lbs") return `${(value * 2.20462).toFixed(1)} lbs`;
  return `${value} kg`;
}

export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${kg.toFixed(0)} kg`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** mm:ss (o h:mm:ss oltre l'ora) — per cronometri e recuperi */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), "d MMM yyyy", { locale: it });
}

export function formatRelative(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: it });
}

export function formatWorkoutDuration(startedAt: Date, endedAt?: Date | null): string {
  const end = endedAt ?? new Date();
  const minutes = differenceInMinutes(end, startedAt);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function getMuscleColor(muscle: string): string {
  const colors: Record<string, string> = {
    CHEST: "#ef4444",
    BACK: "#3b82f6",
    SHOULDERS: "#f59e0b",
    BICEPS: "#8b5cf6",
    TRICEPS: "#7c3aed",
    FOREARMS: "#6d28d9",
    CORE: "#06b6d4",
    QUADS: "#22c55e",
    HAMSTRINGS: "#16a34a",
    GLUTES: "#ec4899",
    CALVES: "#84cc16",
    FULL_BODY: "#f97316",
  };
  return colors[muscle] ?? "#6b7280";
}

export function getMuscleLabel(muscle: string): string {
  const labels: Record<string, string> = {
    CHEST: "Pettorali",
    BACK: "Dorso",
    SHOULDERS: "Spalle",
    BICEPS: "Bicipiti",
    TRICEPS: "Tricipiti",
    FOREARMS: "Avambracci",
    CORE: "Core",
    QUADS: "Quadricipiti",
    HAMSTRINGS: "Femorali",
    GLUTES: "Glutei",
    CALVES: "Polpacci",
    FULL_BODY: "Corpo Intero",
  };
  return labels[muscle] ?? muscle;
}

export function getEquipmentLabel(eq: string): string {
  const labels: Record<string, string> = {
    BARBELL: "Bilanciere",
    DUMBBELL: "Manubri",
    MACHINE: "Macchina",
    CABLE: "Cavo",
    BODYWEIGHT: "Corpo libero",
    KETTLEBELL: "Kettlebell",
    BANDS: "Elastici",
    SMITH_MACHINE: "Smith Machine",
    TRAP_BAR: "Trap Bar",
    OTHER: "Altro",
  };
  return labels[eq] ?? eq;
}
