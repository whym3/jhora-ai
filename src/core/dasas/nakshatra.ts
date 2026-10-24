// Nakshatra (graha) dasas that run a fixed sequence of lords from the Moon's
// star. Each system is either "per star" (lord index counted from a starting
// star, balance = fraction of the Moon's star left) or "grouped" (consecutive
// stars belong to one lord and the balance is taken over the whole group, as
// in Ashtottari). Antardasas follow the same sequence starting with the dasa
// lord, proportionally to the years. Rules verified against JHora 8.0 output.
import type { Graha } from '../positions';
import type { Period } from './vimsottari';

const NAK = 360 / 27;

export interface NakshatraDasaDef {
  title: string;
  lords: [Graha, number][];
  /** per-star systems: lord index = ((dir * (nak - startStar)) mod 27) mod n */
  startStar?: number;
  dir?: 1 | -1;
  /** count without wrapping at 27 first (Yogini: (star + 3) mod 8) */
  noWrap?: boolean;
  /** grouped systems: [first star, number of stars] per lord, in sequence order */
  groups?: [number, number][];
  /** how many cycles of maha dasas JHora lists */
  cycles?: number;
}

const L = (s: string): [Graha, number][] => s.split(' ').map((x) => {
  const [g, y] = x.split(':');
  const name = { Su: 'Sun', Mo: 'Moon', Ma: 'Mars', Me: 'Mercury', Ju: 'Jupiter', Ve: 'Venus', Sa: 'Saturn', Ra: 'Rahu', Ke: 'Ketu' }[g] as Graha;
  return [name, Number(y)];
});

export const NAKSHATRA_DASAS: Record<string, NakshatraDasaDef> = {
  Ashtottari: {
    title: 'Ashtottari Dasa (conditional nakshatra dasa)',
    lords: L('Su:6 Mo:15 Ma:8 Me:17 Sa:10 Ju:19 Ra:12 Ve:21'),
    // Ardra.. Sun 4, Magha.. Moon 3, Hasta.. Mars 4, Anuradha.. Mercury 3,
    // P.Ashadha..Sravana Saturn (4 with Abhijit), Dhanishtha.. Jupiter 3,
    // U.Bhadra..Bharani Rahu 4, Krittika..Mrigasira Venus 3
    groups: [[5, 4], [9, 3], [12, 4], [16, 3], [19, 3], [22, 3], [25, 4], [2, 3]],
  },
  Yogini: { title: 'Yogini Dasa (with planets replacing Yoginis)', lords: L('Mo:1 Su:2 Ju:3 Ma:4 Me:5 Sa:6 Ve:7 Ra:8'), startStar: -3, noWrap: true, cycles: 3 },
  'Dwisaptati sama': { title: 'Dwi-saptati sama dasa (applicable if lagna lord is in 7th or 7th lord is in lagna)', lords: L('Su:9 Mo:9 Ma:9 Me:9 Ju:9 Ve:9 Sa:9 Ra:9'), startStar: 18 },
  'Shattrimsa sama': { title: 'Shat-trimsa sama dasa (applicable for daytime births in Sun\'s hora and night-time births in Moon\'s hora)', lords: L('Mo:1 Su:2 Ju:3 Ma:4 Me:5 Sa:6 Ve:7 Ra:8'), startStar: 21, cycles: 3 },
  Dwadasottari: { title: 'Dwadasottari dasa (applicable if lagna is in Venusian amsa)', lords: L('Su:7 Ju:9 Ke:11 Me:13 Ra:15 Ma:17 Sa:19 Mo:21'), startStar: 26, dir: -1 },
  'Chaturaseeti sama': { title: 'Chaturaseeti sama dasa (applicable if 10th lord is in 10th)', lords: L('Su:12 Mo:12 Ma:12 Me:12 Ju:12 Ve:12 Sa:12'), startStar: 14 },
  Sataabdika: { title: 'Sataabdika dasa (applicable if lagna is in vargottama)', lords: L('Su:5 Mo:5 Ve:10 Me:10 Ju:20 Ma:20 Sa:30'), startStar: 26 },
  Shodasottari: { title: 'Shodasottari dasa (applicable if lagna in Moon\'s hora in Krishna paksha or in Sun\'s hora in Sukla paksha)', lords: L('Su:11 Ma:12 Ju:13 Sa:14 Ke:15 Mo:16 Me:17 Ve:18'), startStar: 7 },
  Panchottari: { title: 'Panchottari dasa (applicable if lagna is in Cancer in rasi and dwadasamsa)', lords: L('Su:12 Me:13 Sa:14 Ma:15 Ve:16 Mo:17 Ju:18'), startStar: 16 },
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Maha dasas (in dasa years from birth) with `levels` levels of sub-periods. */
export function nakshatraDasa(def: NakshatraDasaDef, moonLon: number, levels = 2): Period[] {
  const n = def.lords.length;
  const total = def.lords.reduce((a, [, y]) => a + y, 0);
  const nak = Math.floor(moonLon / NAK);
  let first: number, elapsed: number;
  if (def.groups) {
    first = def.groups.findIndex(([s, c]) => mod(nak - s, 27) < c);
    const [s, c] = def.groups[first];
    elapsed = (mod(moonLon - s * NAK, 360) / (c * NAK)) * def.lords[first][1];
  } else {
    // stars are counted around the 27 from the starting star, then reduced mod n
    const count = (def.dir ?? 1) * (nak - def.startStar!);
    first = mod(def.noWrap ? count : mod(count, 27), n);
    elapsed = ((moonLon - nak * NAK) / NAK) * def.lords[first][1];
  }
  const out: Period[] = [];
  let t = -elapsed;
  for (let i = 0; i < n * (def.cycles ?? 1); i++) {
    const [lord, years] = def.lords[(first + i) % n];
    out.push(split({ lord, start: t, end: t + years }, def, total, levels - 1));
    t += years;
  }
  return out;
}

function split(p: Period, def: NakshatraDasaDef, total: number, levels: number): Period {
  if (levels <= 0) return p;
  const i0 = def.lords.findIndex(([g]) => g === p.lord);
  const len = p.end - p.start;
  const children: Period[] = [];
  let t = p.start;
  for (let i = 0; i < def.lords.length; i++) {
    const [lord, years] = def.lords[(i0 + i) % def.lords.length];
    const sub = (len * years) / total;
    children.push(split({ lord, start: t, end: t + sub }, def, total, levels - 1));
    t += sub;
  }
  return { ...p, children };
}
