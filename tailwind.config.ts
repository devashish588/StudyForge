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
        // Semantic text tokens (Phase 2: centralized, theme-driven)
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        // Three surface levels only: none (default) / surface / elevated
        surface: {
          DEFAULT: "var(--surface)",
          elevated: "var(--surface-elevated)",
          muted: "var(--surface-muted)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        border: "var(--border)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
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
          DEFAULT: "var(--success)",
          light: "rgba(16, 185, 129, 0.1)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          light: "rgba(245, 158, 11, 0.1)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          light: "rgba(239, 68, 68, 0.1)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
