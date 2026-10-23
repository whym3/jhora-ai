"""Visit every JHora tab and record what it shows: visible list views (headers, row
counts), visible dialogs/controls, and which copy-to-clipboard commands produce text.
Output: tools/harness/views-probe.json, used to write views.json by hand."""
import json, os, sys, time, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import win32clipboard
from pywinauto import Application
from jh_dump import check_ini, tcp_connections, read_listview
from tabs import Tabs, TabError, TOP_TABS, SUB_TABS

WM_COMMAND = 0x0111
COPY_IDS = [32974, 32972, 33236, 32975, 32976, 32977, 32978, 32979, 33010, 33013, 33085, 33086,
            33141, 33227, 33366, 32985, 32992, 32969]

H = os.path.expanduser(r"~\.local\share\jhweb\jhora-harness")
check_ini(H)
chart = os.path.join(H, "data", "Swami Vivekananda.jhd")
app = Application(backend="win32").start(f'"{os.path.join(H, "bin", "jhora.exe")}" "{chart}"', work_dir=os.path.join(H, "bin"))
pid = app.process
time.sleep(6)
assert not tcp_connections(pid)
main = app.top_window()


def read_clip():
    for _ in range(20):
        try:
            win32clipboard.OpenClipboard()
        except Exception:
            time.sleep(0.05)
            continue
        try:
            if win32clipboard.IsClipboardFormatAvailable(win32clipboard.CF_TEXT):
                return win32clipboard.GetClipboardData(win32clipboard.CF_TEXT).decode("latin-1")
            return ""
        finally:
            win32clipboard.CloseClipboard()
    return ""


def dismiss_dialogs():
    texts = []
    for w in app.windows():
        if w.class_name() == "#32770" and w.is_visible() and w.handle != main.handle:
            texts.append(" | ".join(c.window_text() for c in w.children() if c.window_text())[:200])
            w.close()
            time.sleep(0.2)
    return texts


def copy_text(cmd):
    seq = win32clipboard.GetClipboardSequenceNumber()
    main.post_message(WM_COMMAND, cmd, 0)
    for _ in range(30):
        time.sleep(0.05)
        if win32clipboard.GetClipboardSequenceNumber() != seq:
            time.sleep(0.1)
            return read_clip(), dismiss_dialogs()
    return "", dismiss_dialogs()


def snapshot():
    lvs = []
    for lv in main.descendants(class_name="SysListView32"):
        if lv.is_visible():
            d = read_listview(lv)
            lvs.append({"id": lv.control_id(), "headers": d["headers"], "rows": len(d["rows"]), "first": d["rows"][:2]})
    dlgs = []
    for d in main.descendants(class_name="#32770"):
        if d.is_visible():
            kids = [(c.class_name(), c.control_id(), c.window_text()[:40]) for c in d.children() if c.is_visible()]
            dlgs.append({"id": d.control_id(), "controls": kids[:60]})
    return lvs, dlgs


tabs = Tabs(main)
out = []
for top in TOP_TABS:
    for sub in SUB_TABS.get(top) or [None]:
        try:
            tabs.activate(top, sub)
        except TabError as e:
            out.append({"top": top, "sub": sub, "error": str(e)})
            print("ERR", top, sub, e)
            continue
        lvs, dlgs = snapshot()
        copies = {}
        for cmd in COPY_IDS:
            text, dialogs = copy_text(cmd)
            if text or dialogs:
                copies[cmd] = {"len": len(text), "head": text[:300], "dialogs": dialogs}
        out.append({"top": top, "sub": sub, "listviews": lvs, "dialogs": dlgs, "copies": copies})
        print(top, "/", sub, "lists", [(l["id"], l["rows"]) for l in lvs], "copies", {k: v["len"] for k, v in copies.items()})
with open(os.path.join(os.path.dirname(__file__), "views-probe.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
app.kill()
