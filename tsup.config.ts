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
    // launcher.js is plain JS — copy it alongside the bundle
    copyFileSync("src/launcher.js", "dist/launcher.js");
  },
});
