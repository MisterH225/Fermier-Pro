import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
        "4xl": "2rem"
      },
      boxShadow: {
        "glow-blue": "0 4px 20px rgba(37, 99, 235, 0.35)",
        glass: "0 8px 32px rgba(37, 99, 235, 0.08)"
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        brand: {
          DEFAULT: "#2563EB",
          light: "#3B82F6",
          lighter: "#60A5FA",
          accent: "#2563EB",
          cream: "#F0F4FF",
          olive: "#5C6B3A",
          "olive-light": "#8B9A5B",
          "olive-dark": "#3D4A28",
          gold: "#F59E0B"
        },
        success: {
          DEFAULT: "#10B981",
          foreground: "#FFFFFF"
        },
        danger: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF"
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        script: ["Dancing Script", "cursive"]
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
