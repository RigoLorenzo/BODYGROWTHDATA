"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-24 md:bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg transition-all animate-fade-in",
            "bg-card text-card-foreground",
            toast.variant === "destructive" && "border-destructive bg-destructive/10"
          )}
        >
          <div className="flex-1 min-w-0">
            {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
            {toast.description && <p className="text-xs text-muted-foreground mt-0.5">{toast.description}</p>}
          </div>
          <button
            onClick={() => dismiss(toast.id!)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
