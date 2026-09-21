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
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        border: "var(--border)",
        accent: {
          DEFAULT: "#6366f1",
          hover: "#4f46e5",
          light: "rgba(99, 102, 241, 0.1)",
        },
        gate: {
          DEFAULT: "#8b5cf6",
          light: "rgba(139, 92, 246, 0.1)",
        },
        roadmap: {
          DEFAULT: "#3b82f6",
          light: "rgba(59, 130, 246, 0.1)",
        },
        success: {
          DEFAULT: "#10b981",
          light: "rgba(16, 185, 129, 0.1)",
        },
        warning: {
          DEFAULT: "#f59e0b",
          light: "rgba(245, 158, 11, 0.1)",
        },
        danger: {
          DEFAULT: "#ef4444",
          light: "rgba(239, 68, 68, 0.1)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
