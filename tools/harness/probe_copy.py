"""One-off: why do some copies return nothing? (JD panchanga 33086, the second dasa
copy in a run, Bhrigu progression Key Info)."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import Session, kill_harness_jhora  # noqa: E402
from jh_dump import check_ini  # noqa: E402


def show(tag, r):
    text, dialogs = r
    print(f"{tag}: {len(text)} chars, first line {text.splitlines()[:3] if text else None}, dialogs {dialogs}")


def form(s, steps):
    for kind, cid, *rest in steps:
        ctrl = next(w for w in s.main.descendants() if w.control_id() == cid and w.is_visible())
        if kind == "edit":
            ctrl.set_edit_text(str(rest[0]))
        elif kind == "combo":
            ctrl.select(int(rest[0]))
        else:
            ctrl.click()
            time.sleep(rest[0] if rest else 3.0)
    print("   dialogs after form:", s.dismiss_dialogs())


root = os.path.expanduser(r"~\.local\share\jhweb\jhora-harness")
check_ini(root)
s = Session(root, os.path.abspath(sys.argv[1]))
try:
    s.tabs.activate("Miscellany", "Panchanga")
    show("33086 main", s.copy_text(33086, wait=30))
    show("33086 panes", s.copy_from_panes(33086, wait=30))
    show("33085 main", s.copy_text(33085, wait=10))
    for i in range(2):
        s.tabs.activate("Dasas", "Nakshatra dasas")
        s.command(32846)
        show(f"dasa {i} main", s.copy_text(32972))
        show(f"dasa {i} panes", s.copy_from_panes(32972))
    s.tabs.activate("Miscellany", "Progressions")
    form(s, [["combo", 1007, 0], ["combo", 1013, 2], ["combo", 1014, 0], ["combo", 1003, 5], ["edit", 100, "15"], ["edit", 101, "2010"],
             ["edit", 1004, "12"], ["edit", 1005, "0"], ["edit", 1006, "0"], ["click", 1012, 4.0]])
    s.tabs.activate("Basics", "Key Info")
    s.command(32822)
    show("bhrigu key info panes", s.copy_from_panes(32974))
finally:
    s.close()
    kill_harness_jhora(root)
