import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import JavaScriptObfuscator from "javascript-obfuscator";

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

export default defineConfig({
  plugins: [react(), tailwindcss(), obfuscatorPlugin()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
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
