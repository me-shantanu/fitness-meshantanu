/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#2B2B2B",
        surface: "#303030",
        text: "#FFFFFF",
        "text-light": "#B3B3B3",
        hover: "#D4D4D4",
        brand: "#1762DF",
        "brand-active": "#334155",
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
