import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "var(--void)",
        deep: "var(--deep)",
        surface: "var(--surface)",
        card: "var(--card)",
        border: "var(--border)",
        "border-subtle": "var(--border-subtle)",
        muted: "var(--muted)",
        "text-dim": "var(--text-dim)",
        "text-secondary": "var(--text-secondary)",
        "text-primary": "var(--text-primary)",
        emerald: "var(--emerald)",
        "emerald-dim": "var(--emerald-dim)",
        amber: "var(--amber)",
        danger: "var(--danger)",
      },
    },
  },
  plugins: [],
};
export default config;
