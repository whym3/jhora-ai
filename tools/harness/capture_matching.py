"""Horoscope matching (command 33320, dialog 2067) for every nakshatra/pada of the
other person, as bride and as bridegroom: the result message box text per case.

    python tools/harness/capture_matching.py --jhora <copy-root> --out golden/jhora-matching charts/*.jhd [--probe]

--probe only opens the dialog once and prints its controls.
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import Session, kill_harness_jhora, WM_COMMAND  # noqa: E402
from jh_dump import check_ini  # noqa: E402

CMD = 33320
RESULT_TITLE = "Result of Horoscope Matching for Marriage"


def wait_dialog(s, exclude=(), timeout=5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        s.guard()
        for w in s.app.windows():
            if w.class_name() == "#32770" and w.is_visible() and w.handle not in exclude:
                return w
        time.sleep(0.05)
    return None


def controls(w):
    out = []
    for c in w.children():
        d = {"id": c.control_id(), "class": c.class_name(), "text": c.window_text()}
        if c.class_name() == "ComboBox":
            d["items"] = c.item_texts()
            d["selected"] = c.selected_index()
        out.append(d)
    return out


def wait_closed(s, timeout=5.0):
    """Until no dialog of the copy is visible (a closing box must not pass for the next one)."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not any(w.class_name() == "#32770" and w.is_visible() for w in s.app.windows()):
            return
        time.sleep(0.05)
    raise RuntimeError("a dialog stayed open")


def run_case(s, groom_idx, nak, pada, ids, tries=3):
    for attempt in range(tries):
        wait_closed(s)
        s.main.post_message(WM_COMMAND, CMD, 0)
        dlg = wait_dialog(s)
        if dlg is None:
            raise RuntimeError("matching dialog did not open")
        by_id = {c.control_id(): c for c in dlg.children()}
        by_id[ids["who"]].select(groom_idx)
        by_id[ids["nak"]].select(nak)
        by_id[ids["pada"]].select(pada)
        # IDOK posted to the dialog: a mouse click was lost ~45% of the time, and the
        # input dialog itself was then read as the result
        dlg.post_message(WM_COMMAND, 1, by_id[1].handle)
        box = wait_dialog(s, exclude=(dlg.handle,))
        if box is not None and box.window_text() == RESULT_TITLE:
            text = "\n".join(c.window_text() for c in box.children() if c.class_name() == "Static" and c.window_text())
            box.close()
            return RESULT_TITLE, text
        for w in (box, dlg):
            if w is not None and w.exists():
                w.close()
        print(f"   retry {groom_idx}/{nak}/{pada} (attempt {attempt + 1})")
    raise RuntimeError(f"no result box for {groom_idx}/{nak}/{pada}")


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
        try:
            s.main.post_message(WM_COMMAND, CMD, 0)
            dlg = wait_dialog(s)
            ctl = controls(dlg)
            if args.probe:
                print(json.dumps(ctl, indent=1))
                dlg.close()
                return
            combos = [c for c in ctl if c["class"] == "ComboBox"]
            # dialog order: [Bride|Bridegroom], nakshatra (27), pada (4)
            who = next(c["id"] for c in combos if len(c["items"]) == 2)
            nak = next(c["id"] for c in combos if len(c["items"]) == 27)
            pada = next(c["id"] for c in combos if len(c["items"]) == 4)
            default_who = next(c["selected"] for c in combos if c["id"] == who)
            dlg.close()
            time.sleep(0.3)
            ids = {"who": who, "nak": nak, "pada": pada}
            cases = []
            for g in (0, 1):
                for k in range(27):
                    for p in range(4):
                        title, text = run_case(s, g, k, p, ids)
                        cases.append({"who": g, "nak": k, "pada": p, "title": title, "text": text})
            result = {"chart": os.path.basename(chart), "dialog": ctl, "default_who": default_who, "cases": cases}
            os.makedirs(args.out, exist_ok=True)
            with open(os.path.join(args.out, name + ".json"), "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=1)
            print(f"   {len(cases)} cases")
        finally:
            s.close()
            kill_harness_jhora(args.jhora)


if __name__ == "__main__":
    main()
