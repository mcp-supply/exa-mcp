import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["./index.ts"],
  splitting: false,
  outDir: "dist",
  sourcemap: false,
  clean: true,
  format: "esm",
  outExtension: () => ({ js: ".js", dts: ".d.ts" }),
  name: "index",
  // banner: {
  //   js: "#!/usr/bin/env node",
  // },
})
