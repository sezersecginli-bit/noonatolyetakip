/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14181F",        // ana metin / koyu zemin
        slate: {
          850: "#1B212C",
        },
        canvas: "#F6F5F2",      // açık zemin
        panel: "#FFFFFF",
        line: "#E4E1D9",
        brand: {
          DEFAULT: "#2F5F52",  // atölye yeşili — güven, "mesai" hissi
          dark: "#20423A",
          light: "#DCEAE4",
        },
        amber: {
          DEFAULT: "#C97A32",  // giriş/çıkış vurgusu
          light: "#F3E2CD",
        },
        danger: "#B3452F",
        ok: "#2F5F52",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
