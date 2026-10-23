// Read and write JHora's jhora.ini (sections, "key=value", indexed "key=i value").
import { DEFAULTS, INI_SPEC, type JhoraIni } from '../settings/generated';

const specByKey = new Map(INI_SPEC.map((s) => [s.key, s]));

/** Parse ini text onto a copy of the defaults. Unknown keys are kept in `extra`. */
export function parseIni(text: string): { ini: JhoraIni; extra: Record<string, string> } {
  const ini: JhoraIni = structuredClone(DEFAULTS);
  const extra: Record<string, string> = {};
  const target = ini as unknown as Record<string, unknown>;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('[') || line.startsWith(';')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1);
    const spec = specByKey.get(key);
    if (!spec) { extra[key] = value; continue; }
    if (spec.kind.endsWith('[]')) {
      const m = /^(\d+) (.*)$/.exec(value);
      if (!m) continue;
      const arr = target[key] as unknown[];
      arr[Number(m[1])] = spec.kind === 'str[]' ? m[2] : Number(m[2]);
    } else if (spec.kind === 'str') {
      target[key] = value;
    } else {
      const n = Number(value);
      if (!Number.isNaN(n)) target[key] = n;
    }
  }
  return { ini, extra };
}

const fmt = (spec: { kind: string }, v: unknown) =>
  spec.kind === 'float' || spec.kind === 'float[]' ? (v as number).toFixed(6) : String(v);

/** Write ini text in JHora's own layout: section header, blank line, keys, blank line. */
export function writeIni(ini: JhoraIni): string {
  const lines: string[] = [];
  let section = '';
  const src = ini as unknown as Record<string, unknown>;
  for (let i = 0; i < INI_SPEC.length; i++) {
    const spec = INI_SPEC[i];
    if (spec.section !== section) {
      if (section) lines.push('');
      lines.push(`[${spec.section}]`, '');
      section = spec.section;
    }
    if (!spec.kind.endsWith('[]')) {
      lines.push(`${spec.key}=${fmt(spec, src[spec.key])}`);
      continue;
    }
    // JHora writes grouped arrays slot by slot:
    // YearDefinition=0 .., YearLength=0 .., YearDefinition=1 .., ...
    const group = [spec];
    while (i + 1 < INI_SPEC.length && INI_SPEC[i + 1].group === spec.group) {
      group.push(INI_SPEC[++i]);
    }
    for (let slot = 0; slot < (spec.length ?? 0); slot++) {
      for (const g of group) lines.push(`${g.key}=${slot} ${fmt(g, (src[g.key] as unknown[])[slot])}`);
    }
  }
  lines.push('');
  return lines.join('\r\n');
}
