import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Font e logo per le immagini generate con next/og.
 * Satori non legge woff2 né i font di next/font: servono i file woff,
 * inclusi nel bundle della route tramite `outputFileTracingIncludes`.
 */

type FontWeight = 500 | 600 | 700 | 800;

export interface ShareFont {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: "normal";
}

const FONT_DIR = join(process.cwd(), "src/assets/fonts");

const FONT_FILES: { name: string; file: string; weight: FontWeight }[] = [
  { name: "Barlow Condensed", file: "barlow-condensed-latin-600-normal.woff", weight: 600 },
  { name: "Barlow Condensed", file: "barlow-condensed-latin-700-normal.woff", weight: 700 },
  { name: "Barlow Condensed", file: "barlow-condensed-latin-800-normal.woff", weight: 800 },
  { name: "Inter", file: "inter-latin-500-normal.woff", weight: 500 },
  { name: "Inter", file: "inter-latin-600-normal.woff", weight: 600 },
  { name: "Inter", file: "inter-latin-700-normal.woff", weight: 700 },
];

const toArrayBuffer = (buffer: Buffer) =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

let fontsPromise: Promise<ShareFont[]> | null = null;
let logoPromise: Promise<string> | null = null;

/** Caricati una volta per istanza: le richieste successive riusano la cache */
export function loadShareFonts(): Promise<ShareFont[]> {
  fontsPromise ??= Promise.all(
    FONT_FILES.map(async ({ name, file, weight }) => ({
      name,
      weight,
      style: "normal" as const,
      data: toArrayBuffer(await readFile(join(FONT_DIR, file))),
    }))
  ).catch((err) => {
    fontsPromise = null;
    throw err;
  });
  return fontsPromise;
}

/** Icona dell'app come data URI, da usare in <img> dentro l'immagine */
export function loadShareLogo(): Promise<string> {
  logoPromise ??= readFile(join(process.cwd(), "public/icon-192.png"))
    .then((png) => `data:image/png;base64,${png.toString("base64")}`)
    .catch((err) => {
      logoPromise = null;
      throw err;
    });
  return logoPromise;
}
