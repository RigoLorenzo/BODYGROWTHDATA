export const runtime = "nodejs";
export const maxDuration = 60;
import { handleDeviceSync } from "@/lib/devices/http";

/** Sincronizza Mi Fitness; `?auto=1` (all'apertura dell'app) rispetta l'intervallo minimo */
export const POST = (req: Request) => handleDeviceSync(req, "MI_FITNESS");
