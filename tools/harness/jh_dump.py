"""Golden-master dumper: runs the desktop Jagannatha Hora 8.0 on .jhd charts and
saves every table it shows as JSON, for comparison with the web port.

Safety: JHora's auto-updater fetches http://www.vedicastrologer.org/jh/auto/
at start unless AutoUpdateOn=0 is set in <root>\\jhcore\\jhora.ini (the path is
built in FUN_004db700). This script refuses to run unless that line is
present, and kills JHora if it opens any TCP connection anyway.

Run against a private copy of the install (see tools/harness/README.md):
    python tools/harness/jh_dump.py --jhora <copy-root> --out golden/ charts/*.jhd
"""
import argparse
import json
import os
import subprocess
import sys
import time
import warnings

warnings.filterwarnings("ignore", message="32-bit application")
from pywinauto import Application  # noqa: E402

WM_COMMAND = 0x0111

# Extra modes of the "Longitudes & Basic Info" table (menu 105 in jhora.exe).
# Each entry: (label, command id). After each, the same list view is re-read.
BASIC_INFO_MODES = [
    ("Longitudes & Basic Info", 32822),
    ("Coordinates", 33071),
    ("All Divisional Longitudes", 33265),
    ("Rasis occupied in all vargas", 32823),
    ("Nava Taras (from Moon)", 32902),
    ("Special Taras (from Moon)", 32903),
    ("Nakshatra Aspects & Latta", 32824),
    ("Yogi, Sahayogi, Avayogi", 33286),
    ("Pushkaramsas", 33393),
    ("Special Tithis", 32893),
    ("Chara Karakas", 32825),
    ("Combustion", 33167),
    ("Graha Yuddha", 33168),
    ("Brahma Rudra Maheswara", 33039),
    ("Mrityu Bhaga", 33072),
    ("Planetary drekkanas", 33158),
    ("64th navamsa and 22nd drekkana", 33159),
    ("Sahamas", 32901),
]


def check_ini(root):
    ini = os.path.join(root, "jhcore", "jhora.ini")
    try:
        text = open(ini, encoding="latin-1").read()
    except FileNotFoundError:
        sys.exit(f"{ini} missing: create it with 'AutoUpdateOn=0' before running JHora")
    if "AutoUpdateOn=0" not in text.splitlines():
        sys.exit(f"{ini} does not contain 'AutoUpdateOn=0'; refusing to start JHora")


def tcp_connections(pid):
    out = subprocess.run(["netstat", "-ano", "-p", "TCP"], capture_output=True, text=True).stdout
    return [l.strip() for l in out.splitlines() if l.split() and l.split()[-1] == str(pid)]


def labels_for(ctrl):
    """Tab captions around a control: JHora places a Static label after each panel."""
    labels = []
    node = ctrl
    while node is not None:
        parent = node.parent()
        if parent is None:
            break
        sibs = parent.children()
        try:
            i = [s.handle for s in sibs].index(node.handle)
        except ValueError:
            break
        for s in sibs[i + 1:]:
            if s.class_name() == "Static" and s.window_text():
                labels.append(s.window_text())
                break
        node = parent
    return list(reversed(labels))


def read_listview(lv):
    cols = lv.column_count()
    headers = [c.get("text", "") for c in lv.columns()] if cols else []
    rows = [[lv.item(r, c).text() for c in range(cols)] for r in range(lv.item_count())]
    return {"headers": headers, "rows": rows}


def dump_chart(jhora_root, chart_path):
    exe = os.path.join(jhora_root, "bin", "jhora.exe")
    app = Application(backend="win32").start(f'"{exe}" "{chart_path}"', work_dir=os.path.dirname(exe))
    pid = app.process
    try:
        deadline = time.time() + 30
        while time.time() < deadline:
            if tcp_connections(pid):
                raise RuntimeError(f"JHora opened a network connection: {tcp_connections(pid)}")
            try:
                main = app.top_window()
                if main.window_text().endswith(os.path.basename(chart_path)) and main.descendants(class_name="SysListView32"):
                    break
            except Exception:
                pass
            time.sleep(0.25)
        time.sleep(1.5)  # let the remaining views finish populating
        if tcp_connections(pid):
            raise RuntimeError("JHora opened a network connection")

        views = []
        seen = set()
        for lv in main.descendants(class_name="SysListView32"):
            labels = labels_for(lv)
            key = (tuple(labels), lv.control_id())
            # Identical duplicate views (the same table shown in several frames) are kept once.
            data = read_listview(lv)
            sig = json.dumps(data, sort_keys=True)
            if (key, sig) in seen:
                continue
            seen.add((key, sig))
            views.append({"tabs": labels, "control_id": lv.control_id(), "mode": None, **data})

        # Switch the main "Basics" longitudes table through its alternative modes.
        # The visible table at start-up is the natal "Longitudes & Basic Info" view.
        basics = [lv for lv in main.descendants(class_name="SysListView32")
                  if lv.is_visible() and lv.column_count() == 6
                  and [c.get("text") for c in lv.columns()][:2] == ["Body", "Longitude"]]
        if basics:
            lv = basics[0]
            for label, cmd in BASIC_INFO_MODES:
                lv.send_message(WM_COMMAND, cmd, 0)
                time.sleep(0.2)
                views.append({"tabs": labels_for(lv), "control_id": lv.control_id(), "mode": label, **read_listview(lv)})
            lv.send_message(WM_COMMAND, 32822, 0)
        return {"chart": os.path.basename(chart_path), "window": main.window_text(), "views": views}
    finally:
        try:
            app.kill()  # never save state back; a kill also avoids "save changes?" prompts
        except Exception:
            pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jhora", required=True, help="root of a private JHora copy (contains bin/, jhcore/)")
    ap.add_argument("--out", required=True)
    ap.add_argument("charts", nargs="+")
    args = ap.parse_args()
    check_ini(args.jhora)
    os.makedirs(args.out, exist_ok=True)
    for chart in args.charts:
        t = time.time()
        result = dump_chart(args.jhora, os.path.abspath(chart))
        name = os.path.splitext(os.path.basename(chart))[0] + ".json"
        with open(os.path.join(args.out, name), "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=1)
        print(f"{name}: {len(result['views'])} tables in {time.time() - t:.1f}s")


if __name__ == "__main__":
    main()
