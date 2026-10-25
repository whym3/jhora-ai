# JHora's ayanamsa modes evaluated with JHora's own swedll32.dll (Swiss 2.02.01),
# following jhora.exe FUN_0049a3a0 / FUN_0049a370 / FUN_0049aaa0. Needs a 32-bit Python
# (ctypes.WinDLL on the DLL); it does not run JHora. The output is turned into
# tests/fixtures/ayanamsa-dll.json (charts -> jdUt, nakshatraShift, modes):
#
#   <32-bit python> tools/harness/dll_ayanamsa.py golden/charts > dll_ay.json
import ctypes, json, os, sys
H = r'C:\Users\remoteuser\.local\share\jhweb\jhora-harness'
d = ctypes.WinDLL(H + r'\bin\swedll32.dll')
D = ctypes.c_double; I = ctypes.c_int
def fn(name, res, *args):
    f = getattr(d, name); f.restype = res; f.argtypes = list(args); return f
set_path = fn('_swe_set_ephe_path@4', None, ctypes.c_char_p)
set_sid = fn('_swe_set_sid_mode@20', None, I, D, D)
get_ay = fn('_swe_get_ayanamsa@8', D, D)
deltat = fn('_swe_deltat@8', D, D)
julday = fn('_swe_julday@24', D, I, I, I, D, I)
calc = fn('_swe_calc@24', I, D, I, I, ctypes.POINTER(D), ctypes.c_char_p)
fixstar = fn('_swe_fixstar@24', I, ctypes.c_char_p, D, I, ctypes.POINTER(D), ctypes.c_char_p)
set_path((H + r'\jhcore\ephe').encode())

SIDEREAL = 64 * 1024
FLAGS = 2 | 16 | 256   # SWIEPH | TRUEPOS (TruePositions=1) | SPEED
# FUN_0049a3a0: index -> (tropical flag DAT_008a1ecc, sid mode DAT_008a1ed0)
SID = {0: (0, 1), 1: (0, 0x200), 2: (0, 3), 3: (0, 1), 4: (0, 5), 5: (0, 4), 6: (0, 7), 7: (0, 8),
       8: (1, 1), 9: (0, 0), 10: (0, 2), 11: (0, 6), 12: (0, 14), 13: (0, 17), 14: (0, 15), 15: (0, 16),
       16: (1, 30), 17: (0, 1), 20: (0, 1), 21: (0, 1)}
STAR = {1: ('Spica', 180.0), 17: ('Spica', 180.0), 20: ('Aldebaran', 46.666666666666664),
        21: (',deCnc', 106.0), 8: ('Shaula', 240.0)}
BODIES = [0, 1, 4, 2, 5, 3, 6, 10]   # Sun Moon Mars Mercury Jupiter Venus Saturn MeanNode

def star(name, jd, fl):
    xx = (D * 6)(); serr = ctypes.create_string_buffer(256)
    nm = ctypes.create_string_buffer(name.encode(), 64)
    if fixstar(nm, jd, fl, xx, serr) < 0: raise RuntimeError(serr.value)
    return xx[0]

def mode(jd_ut, idx, star_def=None, sid=None, flags=FLAGS, delta=0.0):
    trop, sm = SID.get(idx, (0, 1)) if sid is None else sid
    set_sid(sm, 0, 0)
    fl = flags | (0 if trop else SIDEREAL)
    delta = delta - (0.37694444444444447 if idx == 3 else 0.0)
    jd_et = jd_ut + deltat(jd_ut)
    lag = (0.0 if trop else get_ay(jd_ut)) + delta
    corr = 0.0
    sd = star_def or STAR.get(idx)
    if sd:
        sfl = fl | (16 if idx == 8 else 0)
        corr = sd[1] - star(sd[0], jd_et, sfl)
    lag -= corr
    xx = (D * 6)(); serr = ctypes.create_string_buffer(256)
    lons = []
    for b in BODIES:
        if calc(jd_et, b, fl, xx, serr) < 0: raise RuntimeError(serr.value)
        lons.append(((xx[0] + corr - delta) % 360 + 360) % 360)
    return {'lagnaAyanamsa': lag, 'lons': lons}

def jhd(path):
    t = open(path, encoding='latin1').read().split()
    def hms(v):
        v = float(v); s = -1 if v < 0 else 1; v = abs(v); w = int(v + 1e-9); f = (v - w) * 100
        m = int(f + 1e-7); return s * (w + m / 60 + max(0, (f - m) * 60) / 3600)
    return int(t[2]), int(t[0]), int(t[1]), hms(t[3]), -hms(t[4])

out = {}
cdir = sys.argv[1]
for f in sorted(os.listdir(cdir)):
    if not f.endswith('.jhd'): continue
    y, m, dd, h, tz = jhd(os.path.join(cdir, f))
    jd_ut = julday(y, m, dd, h - tz, 1)
    r = {'jdUt': jd_ut, 'modes': {}}
    for idx in [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21]:
        r['modes'][str(idx)] = mode(jd_ut, idx)
    # 19: custom star (CustomStarCode, CustomStarLongitude, FixedPlaneInCustomStarAyanamsa)
    r['modes']['19:,alVir:180:0'] = mode(jd_ut, 19, (',alVir', 180.0), (0, 1))
    r['modes']['19:,alVir:180:1'] = mode(jd_ut, 19, (',alVir', 180.0), (0, 0x200))
    r['modes']['19:,alTau:46.5:0'] = mode(jd_ut, 19, (',alTau', 46.5), (0, 1))
    r['modes']['19:,beGem:113:1'] = mode(jd_ut, 19, (',beGem', 113.0), (0, 0x200))
    # TruePositions=0 (apparent positions), and a correction (DeltaFromUserSelectedAyanamsa)
    for idx in [0, 1, 8, 9, 17, 21]:
        r['modes'][f'{idx}|TruePositions=0'] = mode(jd_ut, idx, flags=2 | 256)
    for idx in [3, 12, 17, 8, 1]:
        r['modes'][f'{idx}|DeltaFromUserSelectedAyanamsa=-0.25'] = mode(jd_ut, idx, delta=-0.25)
    r['modes']['17|NoNutation=1'] = mode(jd_ut, 17, flags=FLAGS | 64)
    r['modes']['0|NoNutation=1'] = mode(jd_ut, 0, flags=FLAGS | 64)
    # FUN_0049a930 (SiderealNaksharasInTropical with ayanamsa 16): 180 - tropical Spica
    set_sid(30, 0, 0)
    r['nakshatraShift'] = 180.0 - star('Spica', jd_ut + deltat(jd_ut), FLAGS)
    out[f[:-4]] = r
json.dump(out, sys.stdout, indent=1)
