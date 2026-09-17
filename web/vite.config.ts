import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const patchedSanitizer = fileURLToPath(
  new URL("../node_modules/dompurify/dist/purify.es.mjs", import.meta.url),
);
export default defineConfig({
  plugins: [
    react(),
    {
      name: "pinned-monaco-sanitizer",
      enforce: "pre",
      resolveId(source, importer) {
        // Monaco vendors an old copy: an npm override alone does NOT replace it.
        if (
          importer?.replaceAll("\\", "/").includes("/monaco-editor/") &&
          source.endsWith("/dompurify/dompurify.js")
        )
          return patchedSanitizer;
      },
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle))
          if (output.type === "chunk") {
            if (
              Object.keys(output.modules).some((id) =>
                id
                  .replaceAll("\\", "/")
                  .includes("/monaco-editor/esm/vs/base/browser/dompurify/"),
              )
            )
              this.error(
                "Unpatched vendored Monaco sanitizer entered the bundle",
              );
          }
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:4173" },
  },
  build: { chunkSizeWarningLimit: 1500 },
});
