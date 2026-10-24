"""One-off exploration: record what each chakra view draws (gditrace) and list the
form controls of the Mundane / Miscellany views and the matching dialog.

    python tools/harness/probe_draw.py <chart.jhd> <out.json>
"""
import ctypes
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import Session  # noqa: E402
from gditrace import GdiTrace  # noqa: E402
from jh_dump import check_ini  # noqa: E402
from tabs import SUB_TABS  # noqa: E402

RDW = 0x0001 | 0x0004 | 0x0080 | 0x0100   # INVALIDATE | ERASE | ALLCHILDREN | UPDATENOW


def repaint(s):
    ctypes.windll.user32.RedrawWindow(s.main.handle, None, None, RDW)


def controls(s):
    out = []
    for w in s.main.descendants():
        if not w.is_visible() or w.class_name() not in ("Edit", "ComboBox", "Button", "Static", "SysListView32", "SysDateTimePick32"):
            continue
        r = w.rectangle()
        c = {"id": w.control_id(), "class": w.class_name(), "text": w.window_text()[:80], "rect": [r.left, r.top, r.right, r.bottom]}
        if w.class_name() == "ComboBox":
            try:
                c["items"] = w.item_texts()
                c["selected"] = w.selected_index()
            except Exception:
                pass
        out.append(c)
    return out


def main():
    chart, out_path = sys.argv[1], sys.argv[2]
    root = os.path.expanduser(r"~\.local\share\jhweb\jhora-harness")
    check_ini(root)
    s = Session(root, os.path.abspath(chart))
    t = GdiTrace(s.pid)
    result = {"draw": {}, "forms": {}}
    try:
        t.start()
        for sub in SUB_TABS["Chakras"]:
            s.tabs.activate("Chakras", sub)
            t.drain()
            repaint(s)
            result["draw"][sub] = t.drain(1.0)
            print(sub, len(result["draw"][sub]), "events")
            s.guard()
        for top, sub in [("Mundane", None), ("Miscellany", "Angular Return"), ("Miscellany", "Progressions"), ("Miscellany", "Prasna (Horary)")]:
            s.tabs.activate(top, sub)
            time.sleep(0.5)
            result["forms"][f"{top}/{sub}"] = controls(s)
            print(top, sub, len(result["forms"][f"{top}/{sub}"]), "controls")
            s.guard()
    finally:
        t.stop()
        s.close()
    json.dump(result, open(out_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
