// Entry of the MCP server (npm run mcp:build -> dist-mcp/jhora-mcp.mjs). By default it speaks
// stdio, launched by the client; with --http[=port] it runs on its own as a Streamable HTTP
// server at http://127.0.0.1:<port>/mcp (default 3333), one server instance per client session;
// --https[=port] does the same over TLS at https://localhost:<port>/mcp (default 3443), with the
// certificate in .cache/mcp-tls/{cert,key}.pem (mkcert localhost 127.0.0.1) or JHORA_TLS_CERT/KEY.
// Both listen on 127.0.0.1 unless JHORA_MCP_HOST says otherwise (0.0.0.0 in the Docker image).
// Data comes from the repository: public/ephe (tools/copy-ephe.sh), public/samples and the
// user's saved charts in charts/ (JHORA_CHARTS overrides); JHORA_ROOT overrides where the
// repository is.
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, statSync, truncateSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createServer as createTlsServer } from 'node:https';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
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

const options = { epheDir, chartsDir, samplesDir: join(root, 'public', 'samples') };

/** Log every message through a connected transport. */
function tap(transport: Transport, tag = '') {
  const receive = transport.onmessage;
  transport.onmessage = (...args: Parameters<NonNullable<typeof receive>>) => { log(`${tag}<- ${brief(args[0])}`); receive?.(...args); };
  const send = transport.send.bind(transport);
  transport.send = (...args: Parameters<typeof send>) => { log(`${tag}-> ${brief(args[0])}`); return send(...args); };
}

const netArg = process.argv.slice(2).find((a) => /^--https?(=|$)/.test(a));
if (netArg) {
  const tls = netArg.startsWith('--https');
  const port = Number(netArg.split('=')[1] ?? process.env.PORT ?? (tls ? 3443 : 3333));
  const sessions = new Map<string, StreamableHTTPServerTransport>();
  const reply = (res: ServerResponse, status: number, message: string) =>
    res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }));
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/mcp') return reply(res, 404, 'the MCP endpoint is /mcp');
      let body: unknown;
      if (req.method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(res, 400, 'invalid JSON'); }
      }
      const sid = req.headers['mcp-session-id'];
      let transport = typeof sid === 'string' ? sessions.get(sid) : undefined;
      if (!transport) {
        if (sid) return reply(res, 404, 'unknown session: initialize again');
        if (req.method !== 'POST' || !isInitializeRequest(body)) return reply(res, 400, 'no session: send initialize first');
        const t = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => { sessions.set(id, t); log(`session ${id} opened`); },
          onsessionclosed: (id) => { sessions.delete(id); log(`session ${id} closed`); },
          // only this machine: refuse requests whose Host is not localhost (DNS rebinding)
          enableDnsRebindingProtection: true,
          allowedHosts: [`127.0.0.1:${port}`, `localhost:${port}`, `host.docker.internal:${port}`],
        });
        await createJhoraServer(options).connect(t);
        tap(t, '[http] ');
        transport = t;
      }
      await transport.handleRequest(req, res, body);
    } catch (e) {
      log(`http error: ${e instanceof Error ? e.stack : e}`);
      if (!res.headersSent) reply(res, 500, 'internal error');
    }
  };
  const url = tls ? `https://localhost:${port}/mcp` : `http://127.0.0.1:${port}/mcp`;
  const tlsDir = join(root, '.cache', 'mcp-tls');
  const server = tls
    ? createTlsServer({ cert: readFileSync(process.env.JHORA_TLS_CERT ?? join(tlsDir, 'cert.pem')), key: readFileSync(process.env.JHORA_TLS_KEY ?? join(tlsDir, 'key.pem')) }, handle)
    : createServer(handle);
  server.listen(port, process.env.JHORA_MCP_HOST ?? '127.0.0.1', () => {
    log(`listening on ${url}`);
    console.error(`jhora-mcp: listening on ${url} (${root})`);
  });
} else {
  const transport = new StdioServerTransport();
  await createJhoraServer(options).connect(transport);
  tap(transport);
  process.stdin.on('end', () => log('stdin closed by the client'));
  console.error(`jhora-mcp: ready (${root})`);
}
