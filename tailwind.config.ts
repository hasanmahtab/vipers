import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light, FPL-inspired surfaces: page/card/input backgrounds + borders.
        ink: {
          DEFAULT: "#F4F5FA",
          soft: "#EAECF6",
          card: "#FFFFFF",
          border: "#E1E3F0",
        },
        // Primary brand accent — deep purple, used everywhere the old neon
        // green was (headings, CTAs, active states). Name kept to avoid
        // touching every file; only the palette changed.
        neon: {
          DEFAULT: "#37003C",
          dim: "#22002A",
          glow: "#5C2D91",
        },
        // Danger/loss accent only — never a brand color.
        blood: {
          DEFAULT: "#D6002A",
          dim: "#9E001E",
        },
        // Overriding Tailwind's own "white" gives every existing
        // text-white/NN, border-white/NN, ring-white/NN utility (used
        // throughout for foreground-on-background hierarchy) a dark,
        // legible color now that backgrounds are light, with no per-file
        // changes needed.
        white: "#170B2E",
      },
      fontFamily: {
        display: ["Rajdhani", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        neon: "0 8px 24px rgba(55,0,60,0.16)",
        neonSm: "0 4px 12px rgba(55,0,60,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
