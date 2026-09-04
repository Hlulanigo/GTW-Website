/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#F97316", dark: "#EA580C", light: "#FB923C" },
        navy: {
          DEFAULT: "#0F172A",
          mid: "#1E293B",
          secondary: "#273549",
          light: "#334155",
          lighter: "#475569",
        },
        surface: { DEFAULT: "#F8FAFC" },
        slate: { 100: "#F1F5F9", 200: "#E2E8F0", 300: "#CBD5E1", 400: "#94A3B8", 500: "#64748B" },
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "3rem",
      },
      boxShadow: {
        orange: "0 4px 16px rgba(249,115,22,0.35)",
        card: "0 4px 12px rgba(15,23,42,0.10), 0 2px 4px rgba(15,23,42,0.06)",
        "card-dark": "0 4px 12px rgba(0,0,0,0.3)",
      },
    },
  },
  plugins: [],
};
