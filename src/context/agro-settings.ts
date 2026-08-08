export type UsageMode = "simples" | "completo";

export const SETTINGS_STORAGE_KEY = "agrozap-settings";

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

export function readUsageMode(storage: SettingsStorage): UsageMode {
  try {
    const serializedSettings = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!serializedSettings) return "simples";

    const settings = JSON.parse(serializedSettings) as { modoUso?: unknown };
    return settings.modoUso === "completo" ? "completo" : "simples";
  } catch {
    return "simples";
  }
}

export function writeUsageMode(storage: SettingsStorage, mode: UsageMode) {
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ modoUso: mode }));
  } catch {
    // A preferência local é opcional; falhas de armazenamento não bloqueiam a UI.
  }
}
