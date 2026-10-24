// Node build of the MCP server (src/mcp/main.ts) -> dist-mcp/jhora-mcp.mjs. Vite resolves the
// engine's ?raw imports; npm packages (the MCP SDK) stay external and load from node_modules.
// The emscripten module reads sweph.wasm from its own directory, so the wasm is emitted
// beside the bundle. Ephemeris files and samples are read from public/ at run time.
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  plugins: [{
    name: 'emit-sweph-wasm',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sweph.wasm', source: readFileSync('src/sweph/wasm/sweph.wasm') });
    },
  }],
  build: {
    ssr: 'src/mcp/main.ts',
    outDir: 'dist-mcp',
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: { output: { entryFileNames: 'jhora-mcp.mjs' } },
  },
});
