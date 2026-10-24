// Node build of the MCP server (src/mcp/main.ts) -> dist-mcp/jhora-mcp.mjs. Vite resolves the
// engine's ?raw imports and bundles the MCP SDK too, so the file runs without node_modules
// (in the Docker image, or from a sandbox that cannot read node_modules).
// The emscripten module reads sweph.wasm from its own directory, so the wasm is emitted
// beside the bundle. Ephemeris files and samples are read from public/ at run time.
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  ssr: { noExternal: true },
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
