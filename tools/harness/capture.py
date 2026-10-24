"""Golden-master capture v2: for each .jhd chart, open JHora, walk the tabs in
views.json, read every visible table and every clipboard text the view offers,
and save golden/jhora/<chart>.json (list views + texts).

    python tools/harness/capture.py --jhora <copy-root> --out golden/jhora charts/*.jhd [--ini Key=Value ...]

Safety: see jh_dump.py (AutoUpdateOn=0 is required; JHora is killed on any TCP
connection). Tab captions are clicked by position (tabs.py); JHora's window is
pinned to a fixed size so positions are stable; calibration is cached per run.
"""
import argparse
import ctypes
import json
import os
import re
import subprocess
import sys
import time
import warnings

warnings.filterwarnings("ignore", message="32-bit application")
import win32clipboard  # noqa: E402
from pywinauto import Application  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jh_dump import check_ini, read_listview, tcp_connections  # noqa: E402
from tabs import Tabs, TabError, SUB_TABS, ensure_front  # noqa: E402

WM_COMMAND = 0x0111
HERE = os.path.dirname(os.path.abspath(__file__))


class Clipboard:
    @staticmethod
    def read():
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
            except Exception:
                # the owner may still be rendering (error 1460 = timeout); retry
                time.sleep(0.2)
                continue
            finally:
                win32clipboard.CloseClipboard()
        return ""

    @staticmethod
    def seq():
        return win32clipboard.GetClipboardSequenceNumber()

    @staticmethod
    def clear():
        for _ in range(20):
            try:
                win32clipboard.OpenClipboard()
            except Exception:
                time.sleep(0.05)
                continue
            try:
                win32clipboard.EmptyClipboard()
            finally:
                win32clipboard.CloseClipboard()
            return


class Session:
    def __init__(self, root, chart):
        exe = os.path.join(root, "bin", "jhora.exe")
        self.app = Application(backend="win32").start(f'"{exe}" "{chart}"', work_dir=os.path.dirname(exe))
        self.pid = self.app.process
        deadline = time.time() + 30
        while time.time() < deadline:
            self.guard()
            try:
                main = self.app.top_window()
                if main.window_text().endswith(os.path.basename(chart)) and main.descendants(class_name="SysListView32"):
                    break
            except Exception:
                pass
            time.sleep(0.25)
        time.sleep(1.5)
        self.main = self.app.top_window()
        self.tabs = Tabs(self.main, log=lambda m: print("   ", m))

    def guard(self):
        conns = tcp_connections(self.pid)
        if conns:
            self.app.kill()
            raise RuntimeError(f"JHora opened a network connection: {conns}")

    def dismiss_dialogs(self):
        texts = []
        for w in self.app.windows():
            if w.class_name() == "#32770" and w.is_visible() and w.handle != self.main.handle:
                texts.append(" | ".join(c.window_text() for c in w.children() if c.window_text())[:200])
                w.close()
                time.sleep(0.2)
        return texts

    def command(self, cmd, settle=0.25, to_panes=False):
        self.main.post_message(WM_COMMAND, cmd, 0)
        if to_panes:
            # pages with several list panes (Other strengths) route menu commands to
            # the active pane only; post to every visible pane (ids are unique)
            for w in self.main.descendants(class_name="AfxFrameOrView42s"):
                if w.is_visible():
                    w.post_message(WM_COMMAND, cmd, 0)
        time.sleep(settle)
        return self.dismiss_dialogs()

    def copy_text(self, cmd, target=None, wait=2.0):
        """Post a copy command and return the clipboard text it leaves. The clipboard is
        emptied first (a slow copy, e.g. the JD-format panchanga, must not be read as the
        previous text) and read once it has text and has not changed for 0.2 s."""
        self.dismiss_dialogs()      # a modal box left open would swallow the command
        Clipboard.clear()
        seq = Clipboard.seq()
        (target or self.main).post_message(WM_COMMAND, cmd, 0)
        deadline = time.time() + wait
        while time.time() < deadline:
            time.sleep(0.05)
            now = Clipboard.seq()
            if now == seq:
                continue
            time.sleep(0.2)
            if Clipboard.seq() != now:
                continue
            seq = now
            text = Clipboard.read()
            if not text:
                continue
            # some copies confirm with a modal "Successfully copied..." box shortly after
            dialogs = []
            for _ in range(15):
                time.sleep(0.1)
                dialogs += self.dismiss_dialogs()
                if dialogs:
                    break
            return text, dialogs
        return "", self.dismiss_dialogs()

    def copy_active(self, cmd, wait=2.0):
        """Copy via the frame, which routes the command to its active view. If that view is
        not the one owning the command (e.g. after copies posted to other panes), make
        each visible pane the active view in turn (WM_MOUSEACTIVATE, no click: a click
        would act on the view) and retry."""
        text, dialogs = self.copy_text(cmd, wait=wait)
        if text:
            return text, dialogs
        panes = [w for w in self.main.descendants(class_name="AfxFrameOrView42s") if w.is_visible()]
        for w in sorted(panes, key=lambda w: -w.rectangle().width() * w.rectangle().height()):
            ctypes.windll.user32.SendMessageW(w.handle, 0x0021, self.main.handle, (0x0201 << 16) | 1)
            time.sleep(0.2)
            text, dialogs = self.copy_text(cmd, wait=wait)
            if text:
                return text, dialogs
        return "", dialogs

    def copy_from_panes(self, cmd, wait=2.0):
        """Some copies (Key Info, chart drawings) belong to a pane that is not the
        active view: post the command to each visible pane until one answers."""
        for w in self.main.descendants(class_name="AfxFrameOrView42s"):
            if w.is_visible():
                text, dialogs = self.copy_text(cmd, target=w, wait=wait)
                if text:
                    return text, dialogs
        return "", []

    def focus_list(self, control_id):
        for lv in self.main.descendants(class_name="SysListView32"):
            if lv.is_visible() and lv.control_id() == control_id:
                r = lv.rectangle()
                ensure_front(self.main)
                lv.click_input(coords=(8, min(r.height() - 4, 40)))
                time.sleep(0.2)
                return True
        return False

    def visible_lists(self):
        out = []
        for lv in self.main.descendants(class_name="SysListView32"):
            if lv.is_visible():
                out.append({"id": lv.control_id(), **read_listview(lv)})
        return out

    def close(self):
        try:
            self.app.kill()
        except Exception:
            pass


# first mahadasa row and row pitch in the dasa pane, measured at 192 dpi (200% scaling) and
# scaled to the current display (JHora scales its fonts with the system DPI)
_DPI_SCALE = ctypes.windll.user32.GetDpiForSystem() / 192
DASA_ROW0, DASA_ROW_DY, DASA_ROW_X = round(267 * _DPI_SCALE), round(40 * _DPI_SCALE), round(90 * _DPI_SCALE)


def capture_dasa_levels(s, result, top, sub, label, copies, reset, max_rows=12):
    """JHora divides a period when it is left-clicked; the pane's buttons only move
    between dasa cycles, so `reset()` rebuilds the mahadasa view before each click."""
    def pane():
        # the dasa pane is the right-hand view (the charts are on the left)
        views = [w for w in s.main.descendants(class_name="AfxFrameOrView42s") if w.is_visible()]
        right = max(views, key=lambda w: w.rectangle().left, default=None)
        return right if right is not None and right.rectangle().left > s.main.rectangle().left + 300 else None
    if not pane():
        return
    n_rows = len([l for l in s.copy_text(copies["dasa"])[0].split("\n") if re.match(r"^ \w+: \d{4}-", l)])
    for i in range(min(n_rows, max_rows)):
        reset()
        p = pane()
        if not p:
            return
        ensure_front(s.main)
        p.click_input(coords=(DASA_ROW_X, DASA_ROW0 + DASA_ROW_DY * i))
        time.sleep(0.4)
        text, _ = s.copy_text(copies["dasa"])
        if text:
            result["texts"].append({"top": top, "sub": sub, "mode": label, "name": f"dasa_level2_{i}", "cmd": copies["dasa"], "lines": text.replace("\r\n", "\n").split("\n")})
    reset()


RDW_REPAINT = 0x0001 | 0x0004 | 0x0080 | 0x0100   # INVALIDATE | ERASE | ALLCHILDREN | UPDATENOW
DRAW_KEYS = ("fn", "text", "x", "y", "rect", "fmt", "opts", "color", "bk", "brush", "pts")


def record_draw(s, trace):
    """Repaint the window and return what the visible views drew (gditrace events),
    without the tab strips; each event keeps its window's class name."""
    import win32gui
    trace.drain(0.3)
    ctypes.windll.user32.RedrawWindow(s.main.handle, None, None, RDW_REPAINT)
    out = []
    for e in trace.drain(1.0):
        cls = win32gui.GetClassName(e["hwnd"]) if e["hwnd"] else ""
        if cls == "AfxWnd42s" or (e["fn"] == "DrawText" and e.get("rect") and e["rect"][1] == 10 and e["rect"][3] == 23):
            continue    # tab captions
        out.append({"hwnd": e["hwnd"], "cls": cls, **{k: e[k] for k in DRAW_KEYS if e.get(k) is not None}})
    return out


def capture_chart(root, chart, manifest, ini_overrides):
    s = Session(root, chart)
    result = {"chart": os.path.basename(chart), "window": s.main.window_text(), "ini_overrides": ini_overrides, "views": [], "texts": [], "draws": []}
    trace = None
    if any(t.get("draw") for t in manifest["tabs"]):
        from gditrace import GdiTrace
        trace = GdiTrace(s.pid)
        trace.start()
    try:
        for tab in manifest["tabs"]:
            top, sub = tab["top"], tab["sub"]
            try:
                for _ in range(5):          # copies can leave a modal "copied" message box behind
                    if not s.dismiss_dialogs():
                        break
                    time.sleep(0.3)
                try:
                    s.tabs.activate(top, sub)
                except TabError:
                    time.sleep(1.0)
                    s.dismiss_dialogs()
                    s.tabs.activate(top, sub)
            except TabError as e:
                result["texts"].append({"top": top, "sub": sub, "error": str(e)})
                print("   !!", top, sub, e)
                continue
            s.guard()
            for step in tab.get("form") or []:      # e.g. ["edit", 100, "2000"], ["combo", 1003, 6], ["click", 1000]
                kind, cid = step[0], step[1]
                ctrl = next(w for w in s.main.descendants() if w.control_id() == cid and w.is_visible())
                if kind == "edit":
                    ctrl.set_edit_text(str(step[2]))
                elif kind == "combo":
                    ctrl.select(int(step[2]))
                elif kind == "click":
                    ctrl.click()
                    time.sleep(step[2] if len(step) > 2 else 3.0)
                s.guard()
            modes = tab.get("modes") or [[None, None]]
            for mode in modes:
                label, cmd = mode[0], mode[1]
                if len(mode) > 2:   # the view holds several lists: menu commands act on the last one clicked
                    s.focus_list(mode[2])
                popups = s.command(cmd) if cmd else []
                if tab.get("lists"):
                    for lv in s.visible_lists():
                        result["views"].append({"top": top, "sub": sub, "mode": label, "control_id": lv["id"], "headers": lv["headers"], "rows": lv["rows"]})
                if tab.get("draw") and trace:
                    result["draws"].append({"top": top, "sub": sub, "mode": label, "events": record_draw(s, trace)})
                wait = tab.get("copy_wait", 2.0)
                for name, ccmd in (tab.get("copies") or {}).items():
                    text, dialogs = s.copy_from_panes(ccmd, wait) if name in (tab.get("pane_copies") or []) else s.copy_active(ccmd, wait=wait)
                    if text:
                        result["texts"].append({"top": top, "sub": sub, "mode": label, "name": name, "cmd": ccmd, "lines": text.replace("\r\n", "\n").split("\n")})
                    if dialogs:
                        result["texts"].append({"top": top, "sub": sub, "mode": label, "name": name, "cmd": ccmd, "dialogs": dialogs})
                if popups:
                    result["texts"].append({"top": top, "sub": sub, "mode": label, "cmd": cmd, "dialogs": popups})
                if tab.get("dasa_levels"):
                    def reset(cmd=cmd, top=top, sub=sub):
                        if cmd:
                            s.command(cmd, settle=0.4)
                        else:   # rasi/other dasas have no command id: toggle the sub-tab to rebuild the view
                            other = next(x for x in SUB_TABS[top] if x != sub)
                            s.tabs.activate(top, other); s.tabs.activate(top, sub)
                    capture_dasa_levels(s, result, top, sub, label, tab["copies"], reset, tab.get("dasa_level_rows", 12))
            # leave the view in its first mode for the next chart's sake
            if modes[0][1]:
                s.command(modes[0][1])
    finally:
        if trace:
            trace.stop()
        s.close()
    if not result["draws"]:
        del result["draws"]
    return result


def kill_harness_jhora(root):
    """Kill JHora instances started from the private copy only: never `taskkill /IM`,
    which would also close the user's own JHora."""
    exe = os.path.normcase(os.path.abspath(os.path.join(root, "bin", "jhora.exe")))
    script = ("Get-CimInstance Win32_Process -Filter \"Name='jhora.exe'\" | "
              f"Where-Object {{ $_.ExecutablePath -and $_.ExecutablePath.ToLower() -eq '{exe.lower()}' }} | "
              "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }")
    subprocess.run(["powershell", "-NoProfile", "-Command", script], capture_output=True)


def write_ini_overrides(root, overrides):
    """Apply Key=Value overrides to the private copy's jhora.ini (AutoUpdateOn=0 stays)."""
    path = os.path.join(root, "jhcore", "jhora.ini")
    lines = open(path, encoding="latin-1").read().split("\n")
    for k, v in overrides.items():
        pat = re.compile(rf"^{re.escape(k)}=")
        if any(pat.match(l) for l in lines):
            lines = [f"{k}={v}" if pat.match(l) else l for l in lines]
        else:
            lines.insert(1, f"{k}={v}")
    text = "\n".join(lines)
    if "AutoUpdateOn=0" not in text.split("\n"):
        text = text.replace("[DisplayPreferences]", "[DisplayPreferences]\nAutoUpdateOn=0", 1)
    open(path, "w", encoding="latin-1").write(text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jhora", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--ini", action="append", default=[], help="Key=Value override written to the copy's jhora.ini")
    ap.add_argument("--views", default=os.path.join(HERE, "views.json"))
    ap.add_argument("charts", nargs="+")
    args = ap.parse_args()
    overrides = dict(kv.split("=", 1) for kv in args.ini)
    if overrides:
        write_ini_overrides(args.jhora, overrides)
    check_ini(args.jhora)
    manifest = json.load(open(args.views, encoding="utf-8"))
    os.makedirs(args.out, exist_ok=True)
    for chart in args.charts:
        t = time.time()
        name = os.path.splitext(os.path.basename(chart))[0]
        print(name)
        result = None
        for attempt in range(3):
            try:
                result = capture_chart(args.jhora, os.path.abspath(chart), manifest, overrides)
                break
            except Exception as e:
                if "network connection" in str(e):
                    raise           # never relaunch JHora after it tried to go online
                print(f"   attempt {attempt + 1} failed: {e}")
                kill_harness_jhora(args.jhora)
                time.sleep(3)
        if result is None:
            print("   giving up on this chart")
            continue
        with open(os.path.join(args.out, name + ".json"), "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=1)
        n_lists = len(result["views"]); n_texts = len([t for t in result["texts"] if "lines" in t])
        print(f"   {n_lists} tables, {n_texts} texts in {time.time() - t:.0f}s")


if __name__ == "__main__":
    main()
