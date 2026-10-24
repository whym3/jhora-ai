// Stdio entry of the MCP server (npm run mcp:build, then point the client at dist-mcp/jhora-mcp.mjs).
// Data comes from the repository: public/ephe (tools/copy-ephe.sh), public/samples and the
// user's saved charts in charts/ (JHORA_CHARTS overrides); JHORA_ROOT overrides where the
// repository is.
import { appendFileSync, existsSync, statSync, truncateSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createJhoraServer } from './server';

function findRoot(): string {
  if (process.env.JHORA_ROOT) return resolve(process.env.JHORA_ROOT);
  for (let dir = dirname(fileURLToPath(import.meta.url)); ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'public', 'samples'))) return dir;
    if (dirname(dir) === dir) throw new Error('cannot find the jhora-ai repository: set JHORA_ROOT');
  }
}

const root = findRoot();
const epheDir = join(root, 'public', 'ephe');
// stdout carries the protocol: diagnostics go to stderr
if (!existsSync(epheDir)) console.error(`jhora-mcp: ${epheDir} is missing; copy the ephemeris files with tools/copy-ephe.sh`);
const chartsDir = process.env.JHORA_CHARTS ? resolve(process.env.JHORA_CHARTS) : join(root, 'charts');
// A short log of every message (method, tool, argument excerpt), for clients whose own logs
// are out of reach. charts/ is where a sandboxed client is most likely to allow writing.
const logFile = process.env.JHORA_MCP_LOG ? resolve(process.env.JHORA_MCP_LOG) : join(chartsDir, '.jhora-mcp.log');
const log = (line: string) => {
  try {
    if (existsSync(logFile) && statSync(logFile).size > 1_000_000) truncateSync(logFile, 0);
    appendFileSync(logFile, `${new Date().toISOString()} [${process.pid}] ${line}\n`);
  } catch { /* no write access: run without the log */ }
};
const brief = (m: unknown) => {
  const x = m as { id?: unknown; method?: string; params?: { name?: string; arguments?: unknown; protocolVersion?: string; clientInfo?: unknown }; result?: unknown; error?: { message?: string } };
  if (x.method) {
    const detail = x.method === 'tools/call' ? ` ${x.params?.name} ${JSON.stringify(x.params?.arguments ?? {}).slice(0, 200)}`
      : x.method === 'initialize' ? ` ${x.params?.protocolVersion} ${JSON.stringify(x.params?.clientInfo)}` : '';
    return `${x.method}${x.id !== undefined ? ` #${x.id}` : ''}${detail}`;
  }
  if (x.error) return `error #${x.id}: ${x.error.message}`;
  const r = x.result as { tools?: unknown[]; isError?: boolean } | undefined;
  return `result #${x.id}${r?.tools ? ` (${r.tools.length} tools)` : ''}${r?.isError ? ' isError' : ''} ${JSON.stringify(r ?? {}).length} bytes`;
};
log(`start: node ${process.version}, root ${root}`);
process.on('exit', (code) => log(`exit ${code}`));
process.on('uncaughtException', (e) => { log(`uncaught: ${e.stack ?? e}`); process.exit(1); });

const server = createJhoraServer({ epheDir, chartsDir, samplesDir: join(root, 'public', 'samples') });
const transport = new StdioServerTransport();
await server.connect(transport);
const receive = transport.onmessage;
transport.onmessage = (...args: Parameters<NonNullable<typeof receive>>) => { log(`<- ${brief(args[0])}`); receive?.(...args); };
const send = transport.send.bind(transport);
transport.send = (...args: Parameters<typeof send>) => { log(`-> ${brief(args[0])}`); return send(...args); };
process.stdin.on('end', () => log('stdin closed by the client'));
console.error(`jhora-mcp: ready (${root})`);
