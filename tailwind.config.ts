import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        paper: "#ffffff",
        mist: "#f4f4f5",
        line: "#e4e4e7",
        good: "#15803d",
        danger: "#dc2626",
        warn: "#ca8a04",
      },
      boxShadow: {
        soft: "0 12px 32px rgba(17, 17, 17, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
