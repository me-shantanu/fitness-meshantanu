import { lightTheme, darkTheme } from "./colors";

export const themes = {
  light: {
    "--bg": lightTheme.background,
    "--surface": lightTheme.surface,
    "--text": lightTheme.text,
    "--text-light": lightTheme.textLight,
    "--hover": lightTheme.hover,
    "--brand": lightTheme.brand,
    "--brand-active": lightTheme.brandActive,
  },
  dark: {
    "--bg": darkTheme.background,
    "--surface": darkTheme.surface,
    "--text": darkTheme.text,
    "--text-light": darkTheme.textLight,
    "--hover": darkTheme.hover,
    "--brand": darkTheme.brand,
    "--brand-active": darkTheme.brandActive,
  },
};
