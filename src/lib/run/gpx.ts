import { analyzeTrack, type AnalyzedRun, type TrackPoint } from "./track";

export class GpxError extends Error {}

const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`));
  return m ? Number(m[1]) : NaN;
};

/** Primo valore di un tag, con o senza prefisso di namespace (es. gpxtpx:hr) */
const child = (body: string, name: string): string | undefined =>
  body.match(new RegExp(`<(?:[\\w-]+:)?${name}>\\s*([^<]+?)\\s*</(?:[\\w-]+:)?${name}>`))?.[1];

/** Nome dell'attività scritto nel file, se c'è */
export function gpxName(xml: string): string | undefined {
  const name = xml.match(/<trk>[\s\S]*?<name>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/name>/)?.[1]?.trim();
  return name || undefined;
}

/**
 * Legge un file GPX (Strava, Apple Salute, Mi Fitness, Garmin…) e lo analizza.
 * Supporta frequenza cardiaca e cadenza nelle estensioni Garmin TrackPoint.
 */
export function parseGpx(xml: string): AnalyzedRun {
  if (!/<gpx[\s>]/.test(xml)) throw new GpxError("Il file non è un GPX valido");

  const points: TrackPoint[] = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const [, attrs, body] = m;
    const time = child(body, "time");
    if (!time) continue;
    const ele = child(body, "ele");
    const hr = child(body, "hr");
    const cad = child(body, "cad");
    points.push({
      lat: attr(attrs, "lat"),
      lon: attr(attrs, "lon"),
      time: Date.parse(time),
      ele: ele != null ? Number(ele) : undefined,
      hr: hr != null ? Number(hr) : undefined,
      cadence: cad != null ? Number(cad) : undefined,
    });
  }

  const run = analyzeTrack(points);
  if (!run) throw new GpxError("Il file non contiene una traccia con orari: esportalo come attività, non come percorso");
  if (run.distance < 100) throw new GpxError("La traccia è troppo corta per essere una corsa");
  return run;
}
