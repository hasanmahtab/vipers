import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0a0b0d",
          soft: "#131519",
          card: "#181b20",
          border: "#262b33",
        },
        neon: {
          DEFAULT: "#39ff14",
          dim: "#1fae0b",
          glow: "#8dff6b",
        },
        blood: {
          DEFAULT: "#ff2e3b",
          dim: "#b3131d",
        },
      },
      fontFamily: {
        display: ["Rajdhani", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        neon: "0 0 12px rgba(57,255,20,0.45)",
        neonSm: "0 0 6px rgba(57,255,20,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
