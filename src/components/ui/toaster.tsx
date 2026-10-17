"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      aria-live="polite"
      role="status"
      className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[100] mx-auto flex max-w-sm flex-col gap-2 pointer-events-none md:bottom-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg transition-all animate-fade-in",
            "bg-card text-card-foreground",
            // Fondo pieno: il messaggio resta leggibile sopra qualsiasi contenuto
            toast.variant === "destructive" && "border-destructive"
          )}
        >
          <div className="flex-1 min-w-0">
            {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
            {toast.description && <p className="text-xs text-muted-foreground mt-0.5">{toast.description}</p>}
          </div>
          <button
            onClick={() => dismiss(toast.id!)}
            aria-label="Chiudi"
            className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
