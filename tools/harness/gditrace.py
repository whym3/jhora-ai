"""Record what JHora draws: text (with position and colours) and filled shapes (with
brush colour), by hooking GDI in the running process with Frida. Used for views
that have no copy-to-clipboard command (chakras, chart highlights).

    t = GdiTrace(pid); t.start(); ...repaint...; events = t.drain()

Each event: {"fn", "hwnd", "x", "y", "text", "color", "bk", "rect", "pts", "brush"}.
Coordinates are the logical coordinates JHora passed (its views use MM_TEXT, so
pixels relative to the window or the memory bitmap it paints into).
Needs `pip install frida` (run with plain `python`, not `python -I`).
"""
import threading
import time

import frida

JS = r"""
const gdi = Process.getModuleByName('gdi32.dll');
const user = Process.getModuleByName('user32.dll');
const fn = (m, name, ret, args) => new NativeFunction(m.getExportByName(name), ret, args);
const GetTextColor = fn(gdi, 'GetTextColor', 'uint32', ['pointer']);
const GetBkColor = fn(gdi, 'GetBkColor', 'uint32', ['pointer']);
const GetCurrentObject = fn(gdi, 'GetCurrentObject', 'pointer', ['pointer', 'uint32']);
const GetObjectW = fn(gdi, 'GetObjectW', 'int', ['pointer', 'int', 'pointer']);
const WindowFromDC = fn(user, 'WindowFromDC', 'pointer', ['pointer']);
const lb = Memory.alloc(16);
let depth = 0;   // TextOutA -> ExtTextOutW etc.: keep only the outermost call

function brushColor(hbr) {
  if (hbr.isNull()) return null;
  if (GetObjectW(hbr, 12, lb) !== 12) return null;
  return lb.readU8() === 0 ? lb.add(4).readU32() : null;  // BS_SOLID
}
function rect(p) { return p.isNull() ? null : [p.readS32(), p.add(4).readS32(), p.add(8).readS32(), p.add(12).readS32()]; }
function base(name, hdc) {
  return { fn: name, hwnd: WindowFromDC(hdc).toInt32(), color: GetTextColor(hdc), bk: GetBkColor(hdc) };
}
function hook(m, name, onEnter) {
  Interceptor.attach(m.getExportByName(name), {
    onEnter(args) { this.top = depth++ === 0; if (this.top) { const e = onEnter(args); if (e) send(e); } },
    onLeave() { depth--; },
  });
}
const str = (p, n, wide) => p.isNull() ? '' : (wide ? p.readUtf16String(n) : p.readAnsiString(n));
for (const w of [true, false]) {
  const s = w ? 'W' : 'A';
  hook(gdi, 'ExtTextOut' + s, (a) => Object.assign(base('ExtTextOut', a[0]),
    { x: a[1].toInt32(), y: a[2].toInt32(), opts: a[3].toInt32(), rect: rect(a[4]), text: str(a[5], a[6].toInt32(), w) }));
  hook(gdi, 'TextOut' + s, (a) => Object.assign(base('TextOut', a[0]),
    { x: a[1].toInt32(), y: a[2].toInt32(), text: str(a[3], a[4].toInt32(), w) }));
  hook(user, 'DrawText' + s, (a) => { const n = a[2].toInt32(); return Object.assign(base('DrawText', a[0]),
    { text: n < 0 ? (w ? a[1].readUtf16String() : a[1].readAnsiString()) : str(a[1], n, w), rect: rect(a[3]), fmt: a[4].toInt32() }); });
}
hook(user, 'FillRect', (a) => Object.assign(base('FillRect', a[0]), { rect: rect(a[1]), brush: brushColor(a[2]) }));
function shape(name, readPts) {
  hook(gdi, name, (a) => Object.assign(base(name, a[0]), { pts: readPts(a), brush: brushColor(GetCurrentObject(a[0], 2)) }));
}
shape('Rectangle', (a) => [a[1].toInt32(), a[2].toInt32(), a[3].toInt32(), a[4].toInt32()]);
shape('Ellipse', (a) => [a[1].toInt32(), a[2].toInt32(), a[3].toInt32(), a[4].toInt32()]);
shape('Polygon', (a) => { const n = a[2].toInt32(), out = []; for (let i = 0; i < n; i++) out.push(a[1].add(8 * i).readS32(), a[1].add(8 * i + 4).readS32()); return out; });
"""


class GdiTrace:
    def __init__(self, pid):
        self.pid = pid
        self.events = []
        self.lock = threading.Lock()
        self.session = None

    def _on_message(self, msg, _data):
        if msg.get("type") == "send":
            with self.lock:
                self.events.append(msg["payload"])
        elif msg.get("type") == "error":
            print("    gditrace:", msg.get("description"))

    def start(self):
        self.session = frida.attach(self.pid)
        self.script = self.session.create_script(JS)
        self.script.on("message", self._on_message)
        self.script.load()

    def drain(self, settle=0.5):
        """Events since the last drain, once drawing has been quiet for `settle` seconds."""
        n = -1
        while True:
            time.sleep(settle)
            with self.lock:
                if len(self.events) == n:
                    out, self.events = self.events, []
                    return out
                n = len(self.events)

    def stop(self):
        if self.session:
            try:
                self.session.detach()
            except Exception:
                pass
            self.session = None
