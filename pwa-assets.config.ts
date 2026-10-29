import { defineConfig } from "@vite-pwa/assets-generator/config";

/**
 * Generates `public/apple-touch-icon.png` (180 × 180) from `public/apple-touch-icon.svg`.
 * iPadOS does not accept SVG home screen icons and scales the 180 px icon down to 167/152 px
 * itself. All other icons are served as SVG directly. Run with `npm run generate-pwa-assets`.
 */
export default defineConfig({
  preset: {
    transparent: { sizes: [] },
    maskable: { sizes: [] },
    // The SVG is already a full-bleed square, iPadOS rounds the corners
    apple: { sizes: [180], padding: 0 },
    assetName: () => "apple-touch-icon.png",
    // Full color instead of a reduced palette, so the gradients stay smooth
    png: { compressionLevel: 9, quality: 100, palette: false },
  },
  images: ["public/apple-touch-icon.svg"],
});
