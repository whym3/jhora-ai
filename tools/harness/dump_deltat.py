"""Sample delta-T from JHora's own Swiss Ephemeris DLL (2.02.01) into
src/core/data/deltat-jhora.json.

JHora converts UT to ET with swe_deltat from swedll32.dll, whose historical
delta-T table differs from current Swiss Ephemeris by up to ~3 s in the 19th
century (about 1.5" in the Moon). Needs a 32-bit Python, e.g.:
    uv python install cpython-3.12-windows-x86
    $(uv python find cpython-3.12-windows-x86) tools/harness/dump_deltat.py --jhora <copy-root>
"""
import argparse
import ctypes
import json
import os

ap = argparse.ArgumentParser()
ap.add_argument("--jhora", required=True)
ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "..", "src", "core", "data", "deltat-jhora.json"))
args = ap.parse_args()

dll = ctypes.WinDLL(os.path.join(args.jhora, "bin", "swedll32.dll"))
dll.swe_deltat.restype = ctypes.c_double
dll.swe_deltat.argtypes = [ctypes.c_double]
dll.swe_julday.restype = ctypes.c_double
dll.swe_julday.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_double, ctypes.c_int]
dll.swe_calc.argtypes = [ctypes.c_double, ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_double), ctypes.c_char_p]
dll.swe_set_ephe_path(os.path.join(args.jhora, "jhcore", "ephe").encode())

# Put the DLL in the state JHora runs in: after a swe_calc has read the
# ephemeris file, the tidal acceleration follows that file (DE406).
xx = (ctypes.c_double * 6)()
err = ctypes.create_string_buffer(256)
dll.swe_calc(2451545.0, 1, 2, xx, err)
ver = ctypes.create_string_buffer(64)
dll.swe_version(ver)


def grid(start_jd, step, count):
    return [round(dll.swe_deltat(start_jd + i * step) * 86400, 4) for i in range(count)]


MONTH = 365.25 / 12
fine_start = dll.swe_julday(1600, 1, 1, 0.0, 1)
fine = grid(fine_start, MONTH, 600 * 12 + 1)            # 1600..2200, monthly
coarse_start = dll.swe_julday(-5400, 1, 1, 0.0, 0)
coarse = grid(coarse_start, 365.25, 10801)              # -5400..5400, yearly

os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
with open(args.out, "w") as f:
    json.dump({
        "source": f"swe_deltat from JHora 8.0 swedll32.dll (Swiss Ephemeris {ver.value.decode()}), seconds",
        "fine": {"startJd": fine_start, "stepDays": MONTH, "values": fine},
        "coarse": {"startJd": coarse_start, "stepDays": 365.25, "values": coarse},
    }, f, separators=(",", ":"))
print("wrote", args.out, len(fine), len(coarse))
