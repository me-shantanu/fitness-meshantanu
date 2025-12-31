/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        text: "var(--text)",
        "text-light": "var(--text-light)",
        hover: "var(--hover)",
        brand: "var(--brand)",
        "brand-active": "var(--brand-active)",
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
