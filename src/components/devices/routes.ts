import type { DeviceProvider } from "./labels";

/** Pagina dei dispositivi collegati, nelle impostazioni */
export const DEVICES_PATH = "/profile/settings/dispositivi";

/** Apre la pagina dispositivi e avvia il ricollegamento di quello indicato */
export const reconnectHref = (provider: DeviceProvider) => `${DEVICES_PATH}?ricollega=${provider}`;
