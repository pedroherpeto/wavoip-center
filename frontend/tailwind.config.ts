import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wavoip: {
          DEFAULT: "#25D366",
          50: "#E8FBF0",
          100: "#C8F4D7",
          200: "#8FE9B0",
          300: "#56DD88",
          400: "#2DD46E",
          500: "#25D366",
          600: "#1FB257",
          700: "#188F46",
          800: "#126D36",
          900: "#0B4A25",
        },
      },
    },
  },
  plugins: [],
};

export default config;
