/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0F",
        surface: "#12121A",
        foreground: "#E2E2F0",
        muted: "#8B8B9E",
        border: "#1E1E2E",
        primary: "#7B2FBE",
        accent: "#00D4FF",
        success: "#00E676",
        warning: "#FFC107",
        danger: "#FF1744",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
