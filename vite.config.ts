import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `npm run dev`, proxy API calls to the Python server (run it with
// `python server/run.py`). Production builds are served by that same server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
  build: {
    // Product-named output files. Some antivirus heuristics false-positive on
    // Vite's generic `index-<hash>.js`; using a distinct app name avoids that.
    rollupOptions: {
      output: {
        entryFileNames: "assets/blocksandbox.[hash].js",
        chunkFileNames: "assets/blocksandbox-[name].[hash].js",
        assetFileNames: "assets/blocksandbox-[name].[hash][extname]",
        // Split big libraries into their own recognizable chunks (smaller
        // files are less likely to trip antivirus heuristics, and it makes
        // any real flag easy to attribute to a specific dependency).
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("blockly")) return "blockly";
          if (id.includes("@codemirror") || id.includes("@uiw") || id.includes("codemirror"))
            return "codemirror";
          // Recharts + its charting deps go in their own chunk. Keeping them out
          // of `vendor` avoids a vendor->react->vendor circular chunk (recharts
          // imports React, react-dom imports scheduler which lives in vendor).
          if (
            id.includes("recharts") ||
            id.includes("react-smooth") ||
            id.includes("victory-vendor") ||
            id.includes("d3-") ||
            id.includes("internmap") ||
            id.includes("decimal.js-light") ||
            // recharts v3 state deps (keep react-importing ones out of vendor)
            id.includes("react-redux") ||
            id.includes("@reduxjs/toolkit") ||
            id.includes("use-sync-external-store") ||
            id.includes("immer") ||
            id.includes("reselect") ||
            id.includes("es-toolkit") ||
            id.includes("eventemitter3") ||
            id.includes("tiny-invariant")
          )
            return "charts";
          if (id.includes("react")) return "react";
          if (id.includes("jszip")) return "jszip";
          if (id.includes("js-yaml")) return "jsyaml";
          return "vendor";
        },
      },
    },
  },
});
