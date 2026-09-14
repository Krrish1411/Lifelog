import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import JavaScriptObfuscator from "javascript-obfuscator";
import fs from "fs";

const pkg = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

function obfuscatorPlugin() {
  return {
    name: "vite-plugin-javascript-obfuscator",
    enforce: "post",
    apply: "build",
    renderChunk(code, chunk) {
      if (!chunk.fileName.endsWith(".js") || chunk.fileName.includes("web-")) return null;
      const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        identifierNamesGenerator: "mangled",
        renameGlobals: false,
        stringArray: true,
        stringArrayEncoding: ["base64"],
        stringArrayThreshold: 0.75,
        splitStrings: true,
        splitStringsChunkLength: 10,
        transformObjectKeys: false,
        unicodeEscapeSequence: false,
      });
      return {
        code: obfuscationResult.getObfuscatedCode(),
        map: null,
      };
    },
  };
}

const enableObfuscation = process.env.OBFUSCATE === "true";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), tailwindcss(), ...(enableObfuscation ? [obfuscatorPlugin()] : [])],
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: [
          "console.log",
          "console.info",
          "console.debug",
          "console.trace",
          "console.warn",
        ],
        passes: 2,
        dead_code: true,
      },
      mangle: {
        toplevel: true,
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        chunkFileNames: "assets/ll-[hash].js",
        entryFileNames: "assets/ll-[hash].js",
        assetFileNames: "assets/ll-[hash][extname]",
      },
    },
    chunkSizeWarningLimit: 1200,
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
