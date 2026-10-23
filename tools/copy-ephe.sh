#!/usr/bin/env bash
# Copy JHora's own Swiss Ephemeris data files into public/ephe (not committed).
# JHora 8.0 ships an older build of the .se1 files than current Swiss Ephemeris;
# using the same files keeps positions identical to the desktop program.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JH="${JHORA_DIR:-/c/Program Files (x86)/Jagannatha Hora}"
mkdir -p "$ROOT/public/ephe"
cp "$JH/jhcore/ephe/"*.se1 "$ROOT/public/ephe/"
cp "$ROOT/.cache/swisseph/ephe/sefstars.txt" "$ROOT/public/ephe/"
echo "copied $(ls "$ROOT/public/ephe" | wc -l) files"
