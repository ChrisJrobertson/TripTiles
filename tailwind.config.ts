import type { Config } from "tailwindcss";

/**
 * TripTiles brand theme - Color palette from logo and magical theme park aesthetic.
 * Utilities: bg-royal, text-gold, bg-cream, border-gold, etc.
 */
const config: Config = {
  theme: {
    extend: {
      colors: {
        // Primary brand colors (from logo palette)
        royal: "#2455ac",      // Deep blue (accents, borders)
        /** Softer blue for large fills (nav CTAs, headers) — less harsh than royal. */
        royalSoft: "#5c6b88",
        /** Muted blue-gray for nav/body text — easier on the eye with cream + pastels. */
        ink: "#3d4a5c",
        gold: "#dd4e14",       // Vibrant orange from logo (was gold)
        cream: "#fce7cc",      // Warm cream/peach from logo

        // Accent colors
        magic: "#3fa2ec",       // Bright blue accent
        lime: "#a2df56",        // Fresh lime green
        sky: "#c0d5e0",         // Soft blue-gray

        // Highlight colors (from WhatsApp palette)
        cyan: "#c3f5fd",        // Light cyan highlight
        pink: "#ffb8c2",        // Soft pink accent
        lavender: "#d5caf8",    // Gentle lavender
      },
    },
  },
};

export default config;
