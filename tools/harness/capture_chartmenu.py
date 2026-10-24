"""Chart right-click menu (CChartView, menu resource 'Highlight rasi(s)' etc.) on the
D-1 chart of Chakras > Many Vargas: for each body, right-click it (JHora stores the
clicked sign/body), dismiss the popup, then post each menu command to the view and
record the message box text or the highlight fills it draws (gditrace).

    python tools/harness/capture_chartmenu.py --jhora <copy-root> --out golden/jhora-chartmenu charts/*.jhd [--probe]
"""
import argparse
import ctypes
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pywinauto import keyboard  # noqa: E402
from pywinauto.controls.hwndwrapper import HwndWrapper  # noqa: E402
from capture import Session, kill_harness_jhora, record_draw, WM_COMMAND  # noqa: E402
from gditrace import GdiTrace  # noqa: E402
from jh_dump import check_ini  # noqa: E402
from tabs import ensure_front  # noqa: E402

BODIES = ["As", "Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa", "Ra", "Ke"]
MESSAGES = {33160: "signChange", 33076: "lagnaChange", 33113: "mks", 32944: "permanent", 32945: "temporary",
            32946: "compound", 33109: "pachakadiPlanet", 33110: "pachakadiRasi"}
HIGHLIGHTS = {32811: "argala", 32812: "virodhargala", 32808: "grahaDrishti", 32819: "rasiDrishtiPlanet",
              32809: "rasiDrishtiRasi", 32810: "owned", 32815: "moolatrikona", 32816: "exalted", 32817: "debilitated"}
DT_CALCRECT = 0x400


def chart_view(events):
    """The Many Vargas view (the window that drew most), its first chart's frame (the
    view clears each chart box with ExtTextOut(ETO_OPAQUE, "")) and that chart's body labels."""
    by = {}
    for e in events:
        by.setdefault(e["hwnd"], []).append(e)
    hwnd = max(by, key=lambda h: len(by[h]))
    boxes = [e["rect"] for e in by[hwnd] if e["fn"] == "ExtTextOut" and not e.get("text") and e.get("rect")
             and e["rect"][2] - e["rect"][0] < 600]
    box = min(boxes, key=lambda r: (r[1], r[0]))
    first = {}
    for e in by[hwnd]:
        r = e.get("rect")
        if e["fn"] != "DrawText" or not r or e.get("fmt", 0) & DT_CALCRECT:
            continue
        name = e["text"].strip()
        if name in BODIES and box[0] <= r[0] < box[2] and box[1] <= r[1] < box[3]:
            first.setdefault(name, e)
    return hwnd, box, first


def right_click(s, hwnd, rect):
    ensure_front(s.main)
    HwndWrapper(hwnd).click_input(button="right", coords=((rect[0] + rect[2]) // 2, (rect[1] + rect[3]) // 2))
    time.sleep(0.4)
    keyboard.send_keys("{ESC}")
    time.sleep(0.2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jhora", required=True)
    ap.add_argument("--out")
    ap.add_argument("--probe", action="store_true")
    ap.add_argument("charts", nargs="+")
    args = ap.parse_args()
    check_ini(args.jhora)
    for chart in args.charts:
        name = os.path.splitext(os.path.basename(chart))[0]
        print(name)
        s = Session(args.jhora, os.path.abspath(chart))
        trace = GdiTrace(s.pid)
        try:
            trace.start()
            s.tabs.activate("Chakras", "Many Vargas")
            base = record_draw(s, trace)
            hwnd, box, first = chart_view(base)
            print("   view", hwnd, "chart box", box, "bodies", {k: v["rect"] for k, v in first.items()})
            result = {"chart": os.path.basename(chart), "view": hwnd, "box": box, "bodies": {k: v["rect"] for k, v in first.items()},
                      "base": [e for e in base if e["hwnd"] == hwnd and e.get("rect") and box[0] <= e["rect"][0] < box[2] and box[1] <= e["rect"][1] < box[3]],
                      "cases": []}
            targets = BODIES if not args.probe else ["Su"]
            cmds = {**MESSAGES, **HIGHLIGHTS} if not args.probe else {32808: "grahaDrishti", 32945: "temporary"}
            for body in targets:
                if body not in first:
                    continue
                for cmd, label in cmds.items():
                    right_click(s, hwnd, first[body]["rect"])
                    s.dismiss_dialogs()
                    HwndWrapper(hwnd).post_message(WM_COMMAND, cmd, 0)
                    time.sleep(0.5)
                    case = {"body": body, "cmd": cmd, "what": label, "dialogs": s.dismiss_dialogs()}
                    if cmd in HIGHLIGHTS:
                        ev = [e for e in record_draw(s, trace) if e["hwnd"] == hwnd]
                        case["fills"] = [e for e in ev if e["fn"] in ("FillRect", "Polygon", "Rectangle", "Ellipse")
                                         or (e["fn"] == "ExtTextOut" and not e.get("text"))]
                        if args.probe:
                            case["all"] = ev
                    result["cases"].append(case)
                    s.guard()
            if args.out:
                os.makedirs(args.out, exist_ok=True)
                with open(os.path.join(args.out, name + ".json"), "w", encoding="utf-8") as f:
                    json.dump(result, f, ensure_ascii=False, indent=1)
            print(f"   {len(result['cases'])} cases")
        finally:
            trace.stop()
            s.close()
            kill_harness_jhora(args.jhora)


if __name__ == "__main__":
    main()
