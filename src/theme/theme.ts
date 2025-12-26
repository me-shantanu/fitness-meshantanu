import { LightColors, DarkColors } from "./colors";

export type ThemeMode = "light" | "dark";

export const Theme = {
  light: {
    mode: "light" as ThemeMode,
    colors: LightColors,
  },
  dark: {
    mode: "dark" as ThemeMode,
    colors: DarkColors,
  },
};
