"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ShareFormat } from "./workout-share-image";

interface Props {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORMATS: { value: ShareFormat; label: string; aspect: string }[] = [
  { value: "story", label: "Storia · 9:16", aspect: "aspect-[9/16]" },
  { value: "post", label: "Post · 4:5", aspect: "aspect-[4/5]" },
];

const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
};

const shareImageQuery = (sessionId: string, format: ShareFormat) => ({
  queryKey: ["share-image", sessionId, format],
  queryFn: async () => {
    const params = new URLSearchParams({ format, tz: deviceTimeZone() });
    const res = await fetch(`/api/sessions/${sessionId}/share-image?${params}`);
    if (!res.ok) throw new Error("Immagine non disponibile");
    return res.blob();
  },
  staleTime: 60_000,
  gcTime: 5 * 60_000,
});

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** URL temporaneo per l'anteprima, liberato quando cambia l'immagine */
function useObjectUrl(blob: Blob | undefined) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

export function ShareWorkoutDialog({ sessionId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [format, setFormat] = useState<ShareFormat>("story");
  const { data: blob, isLoading, isError, refetch } = useQuery({ ...shareImageQuery(sessionId, format), enabled: open });
  const previewUrl = useObjectUrl(blob);
  const fileName = `bodygrowth-allenamento-${format}.png`;

  // L'altro formato si prepara in background: il cambio di scheda è istantaneo
  useEffect(() => {
    if (!open || !blob) return;
    const other: ShareFormat = format === "story" ? "post" : "story";
    queryClient.prefetchQuery(shareImageQuery(sessionId, other));
  }, [open, blob, format, sessionId, queryClient]);

  // L'immagine è già in memoria: navigator.share parte subito dal tocco,
  // requisito di Safari per aprire il foglio di condivisione
  const handleShare = async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast({ title: "Condivisione non riuscita", description: "Salva l'immagine e pubblicala dall'app.", variant: "destructive" });
        }
      }
      return;
    }
    downloadBlob(blob, fileName);
    toast({ title: "Immagine salvata", description: "Pubblicala dove vuoi: storie, post o chat." });
  };

  const current = FORMATS.find((f) => f.value === format) ?? FORMATS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-3 p-4 max-h-[100dvh] overflow-y-auto">
        <DialogHeader className="pr-6">
          <DialogTitle>Condividi allenamento</DialogTitle>
          <DialogDescription>Una scheda pronta per storie e post, con tutti i tuoi numeri.</DialogDescription>
        </DialogHeader>

        <Tabs value={format} onValueChange={(v) => setFormat(v as ShareFormat)}>
          <TabsList className="grid w-full grid-cols-2">
            {FORMATS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className={cn("relative mx-auto w-full overflow-hidden rounded-xl bg-zinc-950", current.aspect, format === "story" ? "max-w-[min(100%,calc(55dvh*9/16))]" : "max-w-[min(100%,calc(55dvh*4/5))]")}>
          {previewUrl && !isLoading ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Anteprima della scheda allenamento" className="h-full w-full object-contain" />
          ) : isError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-white/70">Non sono riuscito a creare l&apos;immagine.</p>
              <Button size="sm" variant="secondary" onClick={() => refetch()}>
                Riprova
              </Button>
            </div>
          ) : (
            <Skeleton className="h-full w-full rounded-none bg-white/5" />
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button onClick={handleShare} disabled={!blob}>
            {blob ? <Share2 className="mr-2 h-4 w-4" /> : <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Condividi
          </Button>
          <Button variant="outline" size="icon" aria-label="Salva immagine" disabled={!blob} onClick={() => blob && downloadBlob(blob, fileName)}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
