import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#202735",
        muted: "#667085",
        line: "#e2e6ec",
        canvas: "#f3f5f8",
        indigo: { 950: "#202844", 900: "#252e52", 800: "#34416f" },
        teal: { 700: "#007185", 50: "#e9f5f5" },
      },
    },
  },
  plugins: [],
};

export default config;