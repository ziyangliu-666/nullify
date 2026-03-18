/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cs: {
          bg: "#0f1117",
          surface: "#161b26",
          border: "#1e2535",
          accent: "#e8a24a",
          "accent-dim": "#b87d35",
          text: "#c9d1e0",
          muted: "#6b7a99",
          success: "#4caf7a",
          error: "#e05252",
        },
      },
    },
  },
  plugins: [],
};
