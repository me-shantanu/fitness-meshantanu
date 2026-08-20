import { vars } from "nativewind";
import { lightTheme, darkTheme } from "./colors";

const toVars = (t: typeof lightTheme) =>
  vars({
    "--bg": t.bg,
    "--surface": t.surface,
    "--surface-2": t.surface2,
    "--text": t.text,
    "--text-light": t.textLight,
    "--border": t.border,
    "--brand": t.brand,
    "--brand-active": t.brandActive,
    "--on-brand": t.onBrand,
    "--accent": t.accent,
    "--danger": t.danger,
    "--hover": t.hover,
  });

export const themes = {
  light: toVars(lightTheme),
  dark: toVars(darkTheme),
};
