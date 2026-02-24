import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)"
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.4" }],   // 12px
        sm: ["0.9rem", { lineHeight: "1.5" }],    // 14.4px
        base: ["0.975rem", { lineHeight: "1.6" }],// ~15.6px
        lg: ["1.1rem", { lineHeight: "1.6" }],    // ~17.6px
        xl: ["1.2rem", { lineHeight: "1.5" }],    // ~19px
        "2xl": ["1.4rem", { lineHeight: "1.4" }], // ~22px
        "3xl": ["1.75rem", { lineHeight: "1.3" }],// ~28px
      },
    }
  },
  plugins: []
} satisfies Config;
