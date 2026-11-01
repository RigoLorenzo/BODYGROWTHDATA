"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DEVICE_LABEL, type DeviceProvider } from "./labels";

/**
 * Con più orologi collegati: da quale arrivano sonno, battiti, passi e
 * stress. I dati di ciascuno restano salvati, cambiare fonte è immediato.
 */
export function WellnessSourcePicker({
  connected,
  value,
  className,
}: {
  connected: DeviceProvider[];
  value: DeviceProvider | null;
  className?: string;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState<DeviceProvider | null>(null);
  if (connected.length < 2) return null;

  const choose = async (provider: DeviceProvider) => {
    if (provider === value || saving) return;
    setSaving(provider);
    try {
      const res = await fetch("/api/integrations/devices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wellnessSource: provider }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Scelta non salvata");
      await Promise.all([["devices"], ["wellness"], ["runs"]].map((queryKey) => qc.invalidateQueries({ queryKey })));
    } catch (error) {
      toast({ title: "Benessere", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className={className}>
      <p id="wellness-source-label" className="mb-1.5 text-xs font-medium text-muted-foreground">
        Benessere da
      </p>
      <div className="flex rounded-xl bg-muted p-1" role="radiogroup" aria-labelledby="wellness-source-label">
        {connected.map((provider) => (
          <button
            key={provider}
            type="button"
            role="radio"
            aria-checked={value === provider}
            disabled={!!saving}
            onClick={() => choose(provider)}
            className={cn(
              "h-9 flex-1 rounded-lg text-sm font-medium transition-colors disabled:opacity-70",
              value === provider ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            {DEVICE_LABEL[provider]}
          </button>
        ))}
      </div>
    </div>
  );
}
