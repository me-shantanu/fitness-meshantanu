import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import { themes } from "@/theme/appTheme";
import { hexColors } from "@/theme/colors";

export type ThemePreference = "light" | "dark" | "system";
type ResolvedMode = "light" | "dark";

// Persistence is hand-rolled (AsyncStorage) instead of zustand/middleware:
// the middleware module uses import.meta, which Metro's web bundle rejects.
const STORAGE_KEY = "theme-preference";

const systemMode = (): ResolvedMode =>
  Appearance.getColorScheme() === "light" ? "light" : "dark";

const resolve = (pref: ThemePreference): ResolvedMode =>
  pref === "system" ? systemMode() : pref;

interface ThemeState {
  /** User's saved choice (persisted). */
  preference: ThemePreference;
  /** Resolved mode consumers render with. */
  mode: ResolvedMode;
  vars: (typeof themes)["dark"];
  /** Hex tokens for imperative colors (icons, spinners, StatusBar). */
  colors: (typeof hexColors)["dark"];
  setPreference: (pref: ThemePreference) => void;
  /** Re-resolve after an OS appearance change (only matters for "system"). */
  syncWithSystem: () => void;
}

const stateFor = (pref: ThemePreference) => {
  const mode = resolve(pref);
  return { preference: pref, mode, vars: themes[mode], colors: hexColors[mode] };
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  ...stateFor("system"),

  setPreference: (pref) => {
    set(stateFor(pref));
    AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
  },

  syncWithSystem: () => {
    if (get().preference === "system") set(stateFor("system"));
  },
}));

// Rehydrate the saved preference on startup.
AsyncStorage.getItem(STORAGE_KEY)
  .then((saved) => {
    if (saved === "light" || saved === "dark" || saved === "system") {
      useThemeStore.setState(stateFor(saved));
    }
  })
  .catch(() => {});
