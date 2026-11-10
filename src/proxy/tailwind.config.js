import forms from "@tailwindcss/forms";
import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./public/index.html", "./public/views/**/*.html", "./public/app.js", "./public/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        space: {
          700: "rgb(var(--sp-700) / <alpha-value>)",
          800: "rgb(var(--sp-800) / <alpha-value>)",
          850: "rgb(var(--sp-850) / <alpha-value>)",
          900: "rgb(var(--sp-900) / <alpha-value>)",
          950: "rgb(var(--sp-950) / <alpha-value>)",
          border: "rgb(var(--sp-border) / <alpha-value>)",
        },
        neon: {
          purple: "#a855f7",
          green: "#22c55e",
          cyan: "#06b6d4",
          yellow: "#eab308",
          red: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
    },
  },
  plugins: [forms, daisyui],
  daisyui: {
    themes: [
      {
        antigravity: {
          primary: "#a855f7",
          secondary: "#22c55e",
          accent: "#06b6d4",
          neutral: "#18181b",
          "base-100": "#09090b",
          "base-200": "#08080a",
          "base-300": "#070709",
          info: "#06b6d4",
          success: "#22c55e",
          warning: "#eab308",
          error: "#ef4444",
        },
      },
    ],
    logs: false,
  },
};


