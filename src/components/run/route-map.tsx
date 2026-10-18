import { decodePolyline } from "@/lib/run/polyline";
import { cn } from "@/lib/utils";

interface Props {
  polyline: string | null;
  className?: string;
  strokeWidth?: number;
  /** Partenza e arrivo evidenziati (solo nella vista grande) */
  showEnds?: boolean;
}

const SIZE = 100;
const PADDING = 6;

/** Proiezione equirettangolare scalata sul riquadro, con proporzioni reali */
function project(points: [number, number][]) {
  const lats = points.map((p) => p[0]);
  const lons = points.map((p) => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = lons.map((l) => l * kx);
  const minX = Math.min(...xs);
  const maxY = Math.max(...lats);
  const span = Math.max(Math.max(...xs) - minX, maxY - Math.min(...lats)) || 1;
  const scale = (SIZE - PADDING * 2) / span;
  const offX = (SIZE - (Math.max(...xs) - minX) * scale) / 2;
  const offY = (SIZE - (maxY - Math.min(...lats)) * scale) / 2;
  return points.map((_, i) => [offX + (xs[i] - minX) * scale, offY + (maxY - lats[i]) * scale] as const);
}

/** Percorso disegnato in SVG dalla polyline: niente mappe esterne né chiavi API */
export function RouteMap({ polyline, className, strokeWidth = 3, showEnds = false }: Props) {
  const points = polyline ? decodePolyline(polyline) : [];
  if (points.length < 2) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-[10px] text-muted-foreground", className)}>
        Senza GPS
      </div>
    );
  }
  const xy = project(points);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
  const [start, end] = [xy[0], xy[xy.length - 1]];

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={cn("bg-muted", className)} role="img" aria-label="Percorso">
      <path
        d={d}
        fill="none"
        className="stroke-lime-500"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showEnds && (
        <>
          <circle cx={start[0]} cy={start[1]} r={2.2} className="fill-background stroke-foreground" strokeWidth={1} />
          <circle cx={end[0]} cy={end[1]} r={2.2} className="fill-foreground" />
        </>
      )}
    </svg>
  );
}
