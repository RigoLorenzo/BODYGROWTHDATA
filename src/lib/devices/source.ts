import type { DeviceProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Quale orologio alimenta la sezione Benessere. Si possono collegare più
 * dispositivi: le corse arrivano da tutti, il benessere (un valore per giorno)
 * da quello scelto. Senza scelta valida vale il primo collegato.
 */

/** Ordine di preferenza quando l'utente non ha scelto */
export const DEVICE_PROVIDERS: readonly DeviceProvider[] = ["MI_FITNESS", "GARMIN"];

export const isDeviceProvider = (value: unknown): value is DeviceProvider =>
  typeof value === "string" && (DEVICE_PROVIDERS as readonly string[]).includes(value);

export async function connectedProviders(userId: string): Promise<DeviceProvider[]> {
  const [mi, garmin] = await Promise.all([
    prisma.miFitnessConnection.findUnique({ where: { userId }, select: { id: true } }),
    prisma.garminConnection.findUnique({ where: { userId }, select: { id: true } }),
  ]);
  return DEVICE_PROVIDERS.filter((p) => (p === "MI_FITNESS" ? mi : garmin));
}

/** La scelta dell'utente se il dispositivo è collegato, altrimenti il primo collegato */
export const pickWellnessSource = (preferred: DeviceProvider | null, connected: DeviceProvider[]) =>
  preferred && connected.includes(preferred) ? preferred : (connected[0] ?? null);

export interface WellnessSourceState {
  /** fonte attiva (collegata), null se nessun dispositivo è collegato */
  active: DeviceProvider | null;
  /** fonte dei dati da mostrare: dopo lo scollegamento restano visibili quelli già salvati */
  shown: DeviceProvider;
  connected: DeviceProvider[];
}

export async function wellnessSourceState(userId: string): Promise<WellnessSourceState> {
  const [user, connected] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { wellnessSource: true } }),
    connectedProviders(userId),
  ]);
  const preferred = user?.wellnessSource ?? null;
  const active = pickWellnessSource(preferred, connected);
  return { active, shown: active ?? preferred ?? "MI_FITNESS", connected };
}

/** Fonte da cui leggere i dati benessere (es. FC a riposo per il carico delle corse) */
export const shownWellnessSource = async (userId: string) => (await wellnessSourceState(userId)).shown;

export async function setWellnessSource(userId: string, source: DeviceProvider) {
  await prisma.user.update({ where: { id: userId }, data: { wellnessSource: source } });
}

/** Al collegamento: diventa la fonte se non ce n'è già una collegata */
export async function adoptWellnessSource(userId: string, provider: DeviceProvider) {
  const { active } = await wellnessSourceState(userId);
  if (!active || active === provider) await setWellnessSource(userId, provider);
}

/** Allo scollegamento: la fonte passa a un altro dispositivo collegato, se c'è */
export async function releaseWellnessSource(userId: string, provider: DeviceProvider) {
  const [user, connected] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { wellnessSource: true } }),
    connectedProviders(userId),
  ]);
  const next = connected.find((p) => p !== provider);
  if (user?.wellnessSource === provider && next) await setWellnessSource(userId, next);
}
