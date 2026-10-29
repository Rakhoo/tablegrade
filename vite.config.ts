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
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "mask-icon.svg",
      ],
      manifest: {
        name: "Sitzordnung & Noten",
        short_name: "Noten",
        description: "App für Sitzordnung und Notenverteilung",
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
      devOptions: {
        enabled: true,
      },
    }),
  ],
});
