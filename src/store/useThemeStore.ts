import { create } from "zustand";
import { themes } from "@/theme/appTheme";

type ThemeMode = "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  vars: Record<string, string>;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "light",
  vars: themes.light,

  toggleTheme: () =>
    set((state) => {
      const next = state.mode === "light" ? "dark" : "light";
      return {
        mode: next,
        vars: themes[next],
      };
    }),
}));
