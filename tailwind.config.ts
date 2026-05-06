import type { Config } from "tailwindcss";

/**
 * TripTiles brand theme - hybrid planner design tokens.
 * Utilities: bg-royal, text-gold, bg-tt-surface, shadow-tt-md, rounded-tt-lg, etc.
 */
const config: Config = {
  theme: {
    extend: {
      colors: {
        tt: {
          bg: "var(--tt-bg)",
          "bg-soft": "var(--tt-bg-soft)",
          surface: "var(--tt-surface)",
          "surface-warm": "var(--tt-surface-warm)",
          ink: "var(--tt-ink)",
          "ink-muted": "var(--tt-ink-muted)",
          "ink-soft": "var(--tt-ink-soft)",
          line: "var(--tt-line)",
          "line-soft": "var(--tt-line-soft)",
          royal: "var(--tt-royal)",
          "royal-deep": "var(--tt-royal-deep)",
          "royal-soft": "var(--tt-royal-soft)",
          gold: "var(--tt-gold)",
          "gold-soft": "var(--tt-gold-soft)",
          magic: "var(--tt-magic)",
          success: "var(--tt-success)",
          "success-soft": "var(--tt-success-soft)",
          warning: "var(--tt-warning)",
          "warning-soft": "var(--tt-warning-soft)",
        },

        // Primary brand colors. Kept as legacy class names while the app migrates.
        royal: "var(--tt-royal)",
        "royal-deep": "var(--tt-royal-deep)",
        "royal-soft": "var(--tt-royal-soft)",
        royalDeep: "var(--tt-royal-deep)",
        royalSoft: "var(--tt-royal-soft)",
        ink: "var(--tt-ink-muted)",
        gold: "var(--tt-gold)",
        "gold-soft": "var(--tt-gold-soft)",
        goldSoft: "var(--tt-gold-soft)",
        cream: "var(--tt-cream)",

        // Accent colors
        magic: "var(--tt-magic)",
        lime: "var(--tt-lime)",
        success: "var(--tt-success)",
        warning: "var(--tt-warning)",
        sky: "#c0d5e0",         // Soft blue-gray

        // Highlight colors (from WhatsApp palette)
        cyan: "#c3f5fd",        // Light cyan highlight
        pink: "#ffb8c2",        // Soft pink accent
        lavender: "#d5caf8",    // Gentle lavender
      },
      boxShadow: {
        "tt-sm": "var(--tt-shadow-sm)",
        "tt-md": "var(--tt-shadow-md)",
        "tt-lg": "var(--tt-shadow-lg)",
      },
      borderRadius: {
        "tt-sm": "var(--tt-radius-sm)",
        "tt-md": "var(--tt-radius-md)",
        "tt-lg": "var(--tt-radius-lg)",
        "tt-xl": "var(--tt-radius-xl)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-fraunces)", "Georgia", "serif"],
        meta: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
    },
  },
};

export default config;
