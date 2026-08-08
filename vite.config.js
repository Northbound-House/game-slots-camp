import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base keeps the build working from the project-pages subpath
//   https://northbound-house.github.io/game-slots-camp/
// and from a domain root alike, so moving it later needs no config change.
// It also means the font URLs in src/fonts.css resolve against the emitted
// stylesheet rather than the server root.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
