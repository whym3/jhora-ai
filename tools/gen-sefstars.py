"""Convert JHora's fixstars.cat (old Swiss format, read by its swedll32.dll 2.02.01)
into src/core/data/sefstars.txt (the format Swiss 2.10 reads).

Every star is renamed "JHora<name>" / "JH<nomenclature>" so that Swiss 2.10 never
substitutes one of its built-in star records (its Spica differs from JHora's in
proper motion).  Only the first record of a name or nomenclature is kept: the DLL
searches the file linearly and stops at the first match, while Swiss 2.10 sorts
the records.  Units: proper motion in RA s/century -> mas/yr (x150), in
declination "/century -> mas/yr (x10), parallax " -> mas (x1000); the other fields
are copied.

    python tools/gen-sefstars.py <jhora>/jhcore/ephe/fixstars.cat > src/core/data/sefstars.txt
"""
import sys
from decimal import Decimal

HEADER = """\
# JHora 8.0's fixed-star catalogue (jhcore/ephe/fixstars.cat, read by its
# swedll32.dll 2.02.01), converted by tools/gen-sefstars.py. Names carry a JHora /
# JH prefix so Swiss 2.10 does not substitute its own built-in star records.
"""


def num(s: str, k: int) -> str:
    v = Decimal(s.strip()) * k
    t = format(v.normalize(), 'f')
    return t if t not in ('-0', '') else '0'


def main(path: str) -> None:
    out = [HEADER.rstrip('\n')]
    names, codes = set(), set()
    for raw in open(path, encoding='latin1'):
        line = raw.split('#', 1)[0].strip()
        if not line or line.count(',') < 13:
            continue
        f = [x.strip() for x in line.split(',')]
        if len(f) == 15:   # a missing comma between parallax and magnitude
            f[12:13] = f[12].split()
        f = f[:16]
        while len(f) < 16:
            f.append('0')
        name, code = f[0].replace(' ', ''), f[1].replace(' ', '')
        if (name and name in names) or code in codes:
            continue
        if name:
            names.add(name)
        codes.add(code)
        rec = [f'JHora{name}' if name else '', f'JH{code}', f[2], *f[3:9],
               num(f[9], 150), num(f[10], 10), f[11], num(f[12], 1000), f[13], f[14], f[15]]
        out.append(','.join(rec))
    sys.stdout.buffer.write(('\n'.join(out) + '\n').encode('latin1'))


if __name__ == '__main__':
    main(sys.argv[1])
