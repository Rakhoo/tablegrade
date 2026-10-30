import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import sqlocal from "sqlocal/vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    sqlocal(),
    tailwindcss(),
    VitePWA({
      // New versions wait for the user to confirm the update banner (see UpdateBanner.tsx)
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "mask-icon.svg"],
      manifest: {
        name: "Sitzordnung & Noten",
        short_name: "Noten",
        description: "App für Sitzordnung und Notenverteilung",
        lang: "de",
        // Always launch on the timetable without URL parameters ("/" redirects there)
        start_url: "/",
        scope: "/",
        // Stable app identity, equal to the previous default, so installs stay the same app
        id: "/",
        theme_color: "#f5f2fb",
        background_color: "#f5f2fb",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "maskable-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
        display: "standalone",
        display_override: ["window-controls-overlay"],
      },
      workbox: {
        // Includes the PDF worker (.mjs), so the student import also works offline
        globPatterns: ["**/*.{js,mjs,css,html,wasm}"],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
});
