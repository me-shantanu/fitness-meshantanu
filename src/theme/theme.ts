import { lightTheme, darkTheme } from "./colors";

export type ThemeMode = "light" | "dark";

export const Theme = {
  light: {
    mode: "light" as ThemeMode,
    colors: lightTheme,
  },
  dark: {
    mode: "dark" as ThemeMode,
    colors: darkTheme,
  },
};
