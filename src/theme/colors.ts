// Design tokens as RGB triplets ("r g b") so Tailwind can apply alpha via
// rgb(var(--token) / <alpha-value>). `hex` mirrors them as color strings for
// imperative uses (icons, ActivityIndicator, StatusBar).

export const lightTheme = {
  bg: "246 247 249", // cool off-white page
  surface: "255 255 255", // cards
  surface2: "240 242 245", // chips, inputs, wells
  text: "17 24 28",
  textLight: "100 116 139",
  border: "226 232 240",
  brand: "5 150 105", // emerald 600 — energetic, not corporate blue
  brandActive: "4 120 87",
  onBrand: "255 255 255",
  accent: "217 119 6", // amber 600 — PRs & highlights
  danger: "220 38 38",
  hover: "229 231 235",
};

export const darkTheme = {
  bg: "15 17 21", // near-black with a hint of blue
  surface: "26 29 35",
  surface2: "36 40 48",
  text: "236 237 238",
  textLight: "148 156 168",
  border: "44 49 58",
  brand: "52 211 153", // emerald 400 — pops on dark
  brandActive: "16 185 129",
  onBrand: "5 30 22",
  accent: "251 191 36",
  danger: "248 113 113",
  hover: "55 61 70",
};

const toHex = (triplet: string) =>
  "#" +
  triplet
    .split(" ")
    .map((n) => Number(n).toString(16).padStart(2, "0"))
    .join("");

const asHex = (t: typeof lightTheme) => ({
  bg: toHex(t.bg),
  surface: toHex(t.surface),
  surface2: toHex(t.surface2),
  text: toHex(t.text),
  textLight: toHex(t.textLight),
  border: toHex(t.border),
  brand: toHex(t.brand),
  brandActive: toHex(t.brandActive),
  onBrand: toHex(t.onBrand),
  accent: toHex(t.accent),
  danger: toHex(t.danger),
  hover: toHex(t.hover),
});

export const hexColors = {
  light: asHex(lightTheme),
  dark: asHex(darkTheme),
};
