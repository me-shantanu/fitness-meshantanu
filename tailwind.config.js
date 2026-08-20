/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // All tokens resolve through CSS variables set by useThemeStore
        // (src/theme/appTheme.ts), so light/dark switch at runtime.
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        "text-light": "rgb(var(--text-light) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        brand: "rgb(var(--brand) / <alpha-value>)",
        primary: "rgb(var(--brand) / <alpha-value>)",
        "brand-active": "rgb(var(--brand-active) / <alpha-value>)",
        "on-brand": "rgb(var(--on-brand) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        hover: "rgb(var(--hover) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter_400Regular"],
        light: ["Inter_300Light"],
        medium: ["Inter_500Medium"],
        semibold: ["Inter_600SemiBold"],
        bold: ["Inter_700Bold"],
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [],
};
