import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Lüks butik paleti — düşük saturasyon, sıcak nötrler
        ivory: {
          DEFAULT: "#F5F3EE",
          50: "#FBFAF7",
          100: "#F5F3EE",
          200: "#ECE8DF",
        },
        charcoal: {
          DEFAULT: "#1A1A1A",
          700: "#2B2B2B",
          500: "#4A4A4A",
          300: "#8A8A8A",
        },
        brass: {
          DEFAULT: "#B8954A",
          dark: "#8C6F36",
          light: "#D6B775",
        },
        line: "#E5E2DA", // border'lar için yumuşak gri
        burgundy: "#7A2E2A", // hata
        olive: "#5A6B3A", // başarı
      },
      fontFamily: {
        display: ['"Playfair Display"', "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        widest: "0.18em",
      },
      maxWidth: {
        "screen-2xl": "1440px",
      },
    },
  },
  plugins: [],
};

export default config;
