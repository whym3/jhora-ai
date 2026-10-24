#!/usr/bin/env bash
# Build the Swiss Ephemeris (official Astrodienst source, pinned tag) to WASM
# with the official Emscripten Docker image. Output: src/sweph/wasm/.
set -euo pipefail

SWE_TAG=v2.10.3final
EMSDK_IMAGE=emscripten/emsdk:4.0.9

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/.cache/swisseph"
OUT="$ROOT/src/sweph/wasm"

if [ ! -d "$SRC" ]; then
  git clone --depth 1 --branch "$SWE_TAG" https://github.com/aloistr/swisseph.git "$SRC"
fi
mkdir -p "$OUT"

# Local patches (tools/sweph-patches/*.patch), applied to a pristine checkout:
#   0001  Moon: J2000 ecliptic->equator rotation with the precession model's
#         obliquity, as in SE <= 2.10.01 (JHora's swedll32.dll is 2.02.01).
git -C "$SRC" checkout -q -- .
for p in "$ROOT"/tools/sweph-patches/*.patch; do
  [ -e "$p" ] || continue
  git -C "$SRC" apply --ignore-whitespace "$p"
  echo "applied $(basename "$p")"
done

FUNCS='["_malloc","_free",
"_swe_version","_swe_set_ephe_path","_swe_close","_swe_set_astro_models","_swe_set_tid_acc","_swe_get_tid_acc","_swe_deltat",
"_swe_julday","_swe_revjul","_swe_utc_to_jd","_swe_deltat_ex","_swe_set_delta_t_userdef",
"_swe_calc","_swe_calc_ut","_swe_get_planet_name",
"_swe_set_sid_mode","_swe_get_ayanamsa_ex_ut","_swe_get_ayanamsa_ex",
"_swe_set_topo","_swe_houses_ex2","_swe_house_pos","_swe_sidtime",
"_swe_rise_trans","_swe_rise_trans_true_hor","_swe_azalt","_swe_refrac_extended",
"_swe_fixstar2_ut","_swe_fixstar2","_swe_solcross_ut","_swe_mooncross_ut",
"_swe_sol_eclipse_when_glob","_swe_sol_eclipse_when_loc","_swe_lun_eclipse_when"]'

MSYS_NO_PATHCONV=1 docker run --rm -v "$SRC:/src" -v "$OUT:/out" -w /src "$EMSDK_IMAGE" \
  emcc sweph.c swephlib.c swedate.c swehouse.c swejpl.c swemmoon.c swemplan.c swecl.c swehel.c \
    -O3 \
    -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORT_NAME=createSweph \
    -s ENVIRONMENT=web,worker,node \
    -s ALLOW_MEMORY_GROWTH=1 -s FORCE_FILESYSTEM=1 \
    -s EXPORTED_FUNCTIONS="$(echo "$FUNCS" | tr -d '\n')" \
    -s EXPORTED_RUNTIME_METHODS='["FS","HEAPF64","HEAP32","HEAPU8","UTF8ToString","stringToUTF8","lengthBytesUTF8"]' \
    -o /out/sweph.mjs

echo "built $OUT/sweph.mjs ($SWE_TAG, $EMSDK_IMAGE)"
