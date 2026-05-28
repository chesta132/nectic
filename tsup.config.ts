import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/server/index.ts", "src/route/index.ts", "src/actions/index.ts", "src/proxy/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  external: [/^next/],
  outExtension({ format }) {
    return {
      js: format === "esm" ? ".mjs" : ".cjs",
    };
  },
});
