import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base keeps the build working on BOTH
//   https://<user>.github.io/campground/   (project pages)
//   https://campground.seeking77degrees.com/  (custom subdomain)
// so you can switch later without touching the config.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
