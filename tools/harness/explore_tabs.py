"""Calibrate JHora's custom tab strips (top tabs and the sub-tabs of each top tab).
For each strip, click along its caption row and record which page became visible.
Writes tabs-explore.json: groups of x-ranges in left-to-right order."""
import json, os, sys, time, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pywinauto import Application
from jh_dump import check_ini, tcp_connections

H = os.path.expanduser(r"~\.local\share\jhweb\jhora-harness")
check_ini(H)
chart = os.path.join(H, "data", "Swami Vivekananda.jhd")
app = Application(backend="win32").start(f'"{os.path.join(H, "bin", "jhora.exe")}" "{chart}"', work_dir=os.path.join(H, "bin"))
pid = app.process
time.sleep(6)
assert not tcp_connections(pid)
main = app.top_window()
main.set_focus()
main.move_window(0, 0, 2000, 1400, repaint=True)
time.sleep(1)

PAGE_CLASSES = ("AfxMDIFrame42s", "AfxWnd42s", "AfxFrameOrView42s", "#32770")

PAGE_CLASSES = PAGE_CLASSES + ("SysListView32",)

def pages(strip):
    return [c for c in strip.descendants(depth=3) if c.class_name() in PAGE_CLASSES]

def visible_pages(strip):
    return tuple(c.handle for c in pages(strip) if c.is_visible())

def scan(strip, y_off, x_step=20, x_max=None):
    r = strip.rectangle()
    groups = []  # [x_start, x_end, visible-handles]
    for x in range(r.left + 8, (x_max or r.right) - 8, x_step):
        strip.click_input(coords=(x - r.left, y_off), absolute=False)
        time.sleep(0.12)
        v = visible_pages(strip)
        if groups and groups[-1][2] == v:
            groups[-1][1] = x
        else:
            groups.append([x, x, v])
    return groups

top = [w for w in main.descendants(class_name="AfxWnd42s") if w.control_id() == 9592][0]
tr = top.rectangle()
print("top strip", tr, "pages", len(pages(top)))
top_groups = scan(top, 30, x_step=20, x_max=1500)
print("top groups", [(g[0], g[1]) for g in top_groups])

out = {"top": {"rect": [tr.left, tr.top, tr.right, tr.bottom], "y": 30, "groups": [(g[0], g[1], list(g[2])) for g in top_groups]}, "sub": []}
for gi, g in enumerate(top_groups):
    top.click_input(coords=((g[0] + g[1]) // 2 - tr.left, 30), absolute=False)
    time.sleep(0.3)
    subs = [w for w in main.descendants(class_name="AfxWnd42s") if w.control_id() != 9592 and w.is_visible() and w.rectangle().width() > 300]
    if not subs:
        out["sub"].append({"top_index": gi, "strip": None}); print(gi, "no sub strip"); continue
    best = None
    for s in subs:
        sr = s.rectangle()
        for y_off in (14, 30, sr.height() - 14, sr.height() - 30):
            sg = scan(s, y_off, x_step=20)
            print(gi, "strip id", s.control_id(), sr, "y", y_off, "groups", [(x[0], x[1]) for x in sg])
            if best is None or len(sg) > len(best[2]):
                best = (s, y_off, sg)
            if len(sg) > 1:
                break
        if best and len(best[2]) > 1:
            break
    s, y_off, sg = best
    sr = s.rectangle()
    out["sub"].append({"top_index": gi, "strip_id": s.control_id(), "strip": [sr.left, sr.top, sr.right, sr.bottom], "y": y_off, "groups": [(x[0], x[1], list(x[2])) for x in sg]})
with open(os.path.join(os.path.dirname(__file__), "tabs-explore.json"), "w") as f:
    json.dump(out, f, indent=1)
app.kill()
