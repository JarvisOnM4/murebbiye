import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          deep: "#0f4c5c",
          base: "#1d6f82",
          soft: "#d5edf2",
        },
      },
    },
  },
  plugins: [],
};

export default config;
