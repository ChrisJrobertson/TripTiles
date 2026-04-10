import type { Config } from "tailwindcss";

/**
 * Brand theme extensions (royal, gold, cream).
 * Utilities: bg-royal, text-gold, bg-cream, border-gold, etc.
 */
const config: Config = {
  theme: {
    extend: {
      colors: {
        royal: "#0B1E5C",
        gold: "#C9A961",
        cream: "#faf8f3",
        magic: "#2E3192",
      },
    },
  },
};

export default config;
