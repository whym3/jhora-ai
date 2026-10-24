// Copy JHora's atlas files into public/atlas so the browser app can search them.
// Usage: node tools/atlas/install.mjs [jhcore/atlas directory]
// Default source: the private JHora copy used by the harness.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const src = process.argv[2] ?? join(homedir(), '.local/share/jhweb/jhora-harness/jhcore/atlas');
const dst = join(import.meta.dirname, '../../public/atlas');
mkdirSync(dst, { recursive: true });
for (const f of ['jhworld.adb', 'jhlite.adb']) {
  if (!existsSync(join(src, f))) { console.log(`missing ${join(src, f)}`); continue; }
  copyFileSync(join(src, f), join(dst, f));
  console.log(`copied ${f}`);
}
