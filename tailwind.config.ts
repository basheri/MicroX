import type { Config } from "tailwindcss";

// RTL-first config. The app is Arabic-only (rule 50-arabic-rtl-ui):
// global `dir="rtl"` is set on <html>; logical (start/end) utilities are
// preferred over left/right so the layout follows reading direction.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Arabic-capable stack; no build-time network fetch required.
        // A web font (e.g. Cairo/Tajawal via next/font) can be layered in later.
        arabic: [
          '"Noto Naskh Arabic"',
          '"Noto Sans Arabic"',
          '"Segoe UI"',
          "Tahoma",
          "Arial",
          "sans-serif",
        ],
      },
      lineHeight: {
        // rule 50: Arabic line-height >= 1.5
        arabic: "1.6",
      },
    },
  },
  plugins: [],
};

export default config;
