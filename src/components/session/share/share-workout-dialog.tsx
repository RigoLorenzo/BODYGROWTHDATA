"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ShareFormat, ShareStyle } from "./share-image-kit";
import type { StickerInk } from "./workout-share-sticker";

interface Props {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShareOptions {
  style: ShareStyle;
  format: ShareFormat;
  ink: StickerInk;
}

const STYLES: { value: ShareStyle; label: string; swatch: string }[] = [
  { value: "dark", label: "Scura", swatch: "bg-zinc-950 border-white/20" },
  { value: "light", label: "Chiara", swatch: "bg-stone-100 border-black/20" },
  {
    value: "transparent",
    label: "Senza sfondo",
    swatch: "border-black/20 bg-[conic-gradient(#d4d4d8_25%,#fff_0_50%,#d4d4d8_0_75%,#fff_0)] bg-[length:8px_8px]",
  },
];

const FORMATS: { value: ShareFormat; label: string }[] = [
  { value: "story", label: "Storia · 9:16" },
  { value: "post", label: "Post · 4:5" },
];

const INKS: { value: StickerInk; label: string }[] = [
  { value: "light", label: "Testo bianco" },
  { value: "dark", label: "Testo nero" },
];

// Foto di esempio sotto lo sticker: scura per il testo bianco, chiara per il nero
const STICKER_BACKDROP: Record<StickerInk, string> = {
  light: "bg-[linear-gradient(160deg,#1f2937,#4b5563_45%,#7c2d12)]",
  dark: "bg-[linear-gradient(160deg,#e0f2fe,#fde68a_50%,#fca5a5)]",
};

const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
};

/** Solo le opzioni che cambiano l'immagine: lo sticker ignora il formato */
const variantKey = ({ style, format, ink }: ShareOptions) => (style === "transparent" ? ink : format);

const shareImageQuery = (sessionId: string, options: ShareOptions) => ({
  queryKey: ["share-image", sessionId, options.style, variantKey(options)],
  queryFn: async () => {
    const params = new URLSearchParams({ ...options, tz: deviceTimeZone() });
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

/** Copia di immagini negli appunti: Safari e Chrome recenti sì, altri no */
function useCanCopyImage() {
  const [canCopy, setCanCopy] = useState(false);
  useEffect(() => {
    setCanCopy(typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write);
  }, []);
  return canCopy;
}

export function ShareWorkoutDialog({ sessionId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const canCopy = useCanCopyImage();
  const [options, setOptions] = useState<ShareOptions>({ style: "dark", format: "story", ink: "light" });
  const { data: blob, isLoading, isError, refetch } = useQuery({ ...shareImageQuery(sessionId, options), enabled: open });
  const previewUrl = useObjectUrl(blob);
  const isSticker = options.style === "transparent";
  const fileName = `bodygrowth-${options.style}-${variantKey(options)}.png`;

  // Gli altri stili si preparano in background: il cambio è istantaneo
  useEffect(() => {
    if (!open || !blob) return;
    STYLES.filter((s) => s.value !== options.style).forEach((s) =>
      queryClient.prefetchQuery(shareImageQuery(sessionId, { ...options, style: s.value }))
    );
  }, [open, blob, options, sessionId, queryClient]);

  const update = (patch: Partial<ShareOptions>) => setOptions((current) => ({ ...current, ...patch }));

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

  const handleCopy = async () => {
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast({
        title: "Immagine copiata",
        description: isSticker ? "Incollala sopra la tua foto nella storia." : "Incollala dove vuoi condividerla.",
      });
    } catch {
      toast({ title: "Copia non riuscita", description: "Salva l'immagine e caricala dall'app.", variant: "destructive" });
    }
  };

  const aspect = !isSticker && options.format === "story" ? "aspect-[9/16]" : "aspect-[4/5]";
  const maxWidth =
    !isSticker && options.format === "story" ? "max-w-[min(100%,calc(50dvh*9/16))]" : "max-w-[min(100%,calc(50dvh*4/5))]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-3 p-4 max-h-[100dvh] overflow-y-auto">
        <DialogHeader className="pr-6">
          <DialogTitle>Condividi allenamento</DialogTitle>
          <DialogDescription>Scegli la scheda: con sfondo oppure solo i valori da mettere sulla tua foto.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Stile della scheda">
          {STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={options.style === s.value}
              onClick={() => update({ style: s.value })}
              className={cn(
                "flex min-h-11 flex-col items-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-colors touch-manipulation",
                options.style === s.value ? "border-foreground bg-muted" : "border-border text-muted-foreground"
              )}
            >
              <span className={cn("h-6 w-6 rounded-md border", s.swatch)} />
              {s.label}
            </button>
          ))}
        </div>

        {isSticker ? (
          <Tabs value={options.ink} onValueChange={(v) => update({ ink: v as StickerInk })}>
            <TabsList className="grid w-full grid-cols-2">
              {INKS.map((i) => (
                <TabsTrigger key={i.value} value={i.value}>
                  {i.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <Tabs value={options.format} onValueChange={(v) => update({ format: v as ShareFormat })}>
            <TabsList className="grid w-full grid-cols-2">
              {FORMATS.map((f) => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <div
          className={cn(
            "relative mx-auto w-full overflow-hidden rounded-xl",
            aspect,
            maxWidth,
            isSticker ? STICKER_BACKDROP[options.ink] : "bg-zinc-950"
          )}
        >
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
            <Skeleton className="h-full w-full rounded-none bg-white/10" />
          )}
        </div>

        {isSticker && (
          <p className="text-center text-xs text-muted-foreground">
            Lo sfondo qui è solo un esempio: l&apos;immagine è trasparente. Copiala e incollala sopra la tua foto nella
            storia.
          </p>
        )}

        <div className={cn("grid gap-2", canCopy ? "grid-cols-[1fr_auto_auto]" : "grid-cols-[1fr_auto]")}>
          <Button onClick={handleShare} disabled={!blob}>
            {blob ? <Share2 className="mr-2 h-4 w-4" /> : <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Condividi
          </Button>
          {canCopy && (
            <Button variant="outline" size="icon" aria-label="Copia immagine" disabled={!blob} onClick={handleCopy}>
              <Copy className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label="Salva immagine"
            disabled={!blob}
            onClick={() => blob && downloadBlob(blob, fileName)}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
