import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'ad': {
          DEFAULT: '#F39800',
          light: '#FFF5E6',
          dark: '#CC7D00',
        },
      },
    },
  },
  plugins: [],
};
export default config;
