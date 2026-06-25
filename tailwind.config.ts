import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        lightOrange: "#FE6E44",
        darkOrange: "rgb(255,77,17)",
        lightText: "#888888",
        accent: "#000000",
        accentWhite: "#FFFFFF",
        lightRed: "#EF3636",
        lightGreen: "#41CE09",
        bgLight: "#F5F5F5",
        zinc: {
          50: "var(--zinc-50)",
          100: "var(--zinc-100)",
          150: "var(--zinc-150)",
          200: "var(--zinc-200)",
          250: "var(--zinc-250)",
          300: "var(--zinc-300)",
          400: "var(--zinc-400)",
          450: "var(--zinc-450)",
          500: "var(--zinc-500)",
          600: "var(--zinc-600)",
          650: "var(--zinc-650)",
          655: "var(--zinc-655)",
          700: "var(--zinc-700)",
          750: "var(--zinc-750)",
          800: "var(--zinc-800)",
          850: "var(--zinc-850)",
          900: "var(--zinc-900)",
          950: "var(--zinc-950)",
        },
        gray: {
          50: "var(--gray-50)",
          100: "var(--gray-100)",
          150: "var(--gray-150)",
          200: "var(--gray-200)",
          250: "var(--gray-250)",
          300: "var(--gray-300)",
          400: "var(--gray-400)",
          500: "var(--gray-500)",
          600: "var(--gray-600)",
          700: "var(--gray-700)",
          800: "var(--gray-800)",
          850: "var(--gray-850)",
          900: "var(--gray-900)",
          950: "var(--gray-950)",
        },
      },
      keyframes: {
        dcartLoad: {
          "0%": { left: "-10%" },
          "100%": { left: "110%" },
        },
        progressLinear: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(250%)" },
        },
      },
      animation: {
        dcartLoad: "dcartLoad 2s linear infinite",
        progressLinear: "progressLinear 1.5s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
