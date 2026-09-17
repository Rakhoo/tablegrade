import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  base: "/tablegrade",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "apple-icon-180.png",
        "apple-icon-167.png",
        "apple-icon-152.png",
        "mask-icon.svg",
      ],
      manifest: {
        name: "Sitzordnung & Noten",
        short_name: "Noten",
        description: "App für Sitzordnung und Notenverteilung",
        theme_color: "#ffffff",
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
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
