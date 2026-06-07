import { defineConfig } from "tsup";
import { copyFileSync } from "node:fs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node18",
  clean: true,
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  onSuccess: async () => {
    copyFileSync("src/launcher.js", "dist/launcher.js");
    copyFileSync("src/io-launcher.js", "dist/io-launcher.js");
  },
});
