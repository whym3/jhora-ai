// Registers the MCP server (dist-mcp/jhora-mcp.mjs) with the Claude desktop app, so a
// consultation starts from a new chat. `npm run setup:claude` builds the server first.
//
// Usage: node tools/setup-claude.mjs [--config <claude_desktop_config.json>] [--dry-run]
//        node tools/setup-claude.mjs --print   (the mcpServers block for any app, e.g. Antigravity)
//
// The entry "jhora" is added to (or replaces the one in) the config's mcpServers; everything
// else in the file is kept, and the old file is saved next to it as .bak. It runs the server
// with this Node binary's absolute path, because desktop apps do not see the shell's PATH.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const at = args.indexOf('--config');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = join(root, 'dist-mcp', 'jhora-mcp.mjs');

/** Where the Claude desktop app keeps its config on this system. */
function configPath() {
  if (at >= 0) return resolve(args[at + 1]);
  const home = homedir();
  if (process.platform === 'darwin') return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  if (process.platform === 'win32') {
    // the Microsoft Store build keeps its files inside its package folder
    const packages = join(process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), 'Packages');
    const store = existsSync(packages) ? readdirSync(packages).find((d) => /claude/i.test(d) && existsSync(join(packages, d, 'LocalCache', 'Roaming', 'Claude'))) : undefined;
    if (store) return join(packages, store, 'LocalCache', 'Roaming', 'Claude', 'claude_desktop_config.json');
    return join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  }
  return join(home, '.config', 'Claude', 'claude_desktop_config.json');
}

if (!existsSync(server)) {
  console.error(`The server is not built yet: run "npm run mcp:build" first (expected ${server}).`);
  process.exit(1);
}
if (!existsSync(join(root, 'public', 'ephe'))) {
  console.error(`public/ephe is missing: the server needs the ephemeris files (see the README).`);
  process.exit(1);
}

const entry = { command: process.execPath, args: [server] };
if (args.includes('--print')) {
  console.log(JSON.stringify({ mcpServers: { jhora: entry } }, null, 2));
  process.exit(0);
}

const file = configPath();
let config = {};
if (existsSync(file)) {
  try {
    config = JSON.parse(readFileSync(file, 'utf8') || '{}');
  } catch (e) {
    console.error(`${file} is not valid JSON, so it was left alone (${e.message}).`);
    console.error('Fix it in Claude (Settings > Developer > Edit Config), or add the "jhora" entry shown in the README by hand.');
    process.exit(1);
  }
}
const before = JSON.stringify(config.mcpServers?.jhora ?? null);
config.mcpServers = { ...(config.mcpServers ?? {}), jhora: entry };
const text = `${JSON.stringify(config, null, 2)}\n`;

if (dryRun) {
  console.log(`Would write ${file}:\n${text}`);
  process.exit(0);
}
mkdirSync(dirname(file), { recursive: true });
if (existsSync(file)) copyFileSync(file, `${file}.bak`);
writeFileSync(file, text);
console.log(`${before === 'null' ? 'Added' : 'Updated'} the "jhora" server in ${file}`);
if (existsSync(`${file}.bak`)) console.log(`(previous version saved as ${file}.bak)`);
console.log('\nNow quit Claude completely (not just close the window) and open it again.');
console.log('Then start a new chat and say: "I\'d like a Vedic astrology consultation."');
