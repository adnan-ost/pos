/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                /*
                 * Tailwind's stock `gray` is cool-toned — gray-900 is #111827,
                 * a visible blue against pure black. Remapped to the warm scale
                 * the public menu site uses, which recolours the ~140 hardcoded
                 * bg-gray-* / text-gray-* classes across the Tailwind-styled
                 * pages from one place rather than editing each and leaving the
                 * next one to drift.
                 */
                gray: {
                    50: "#fffdf9",
                    100: "#f8f4ee",
                    200: "#e5ded6",
                    300: "#cfc7bf",
                    400: "#a39a92",
                    500: "#8a8179",   // AA on the near-black card; #756d65 was 3.86:1
                    600: "#6b635b",
                    700: "#332c27",
                    800: "#1a1613",
                    900: "#0d0b0a",
                    950: "#000000",
                },
                background: "var(--background)",
                foreground: "var(--foreground)",
                primary: {
                    DEFAULT: "var(--primary)",
                    hover: "var(--primary-hover)",
                    foreground: "var(--primary-foreground)",
                },
                card: {
                    DEFAULT: "var(--card)",
                    foreground: "var(--card-foreground)",
                },
            },
        },
    },
    plugins: [],
};
