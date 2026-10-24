"""One-off: trace clipboard calls and drawn text while JHora handles 33086."""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import frida
from capture import Session, kill_harness_jhora, WM_COMMAND
from jh_dump import check_ini
JS = r"""
const u = Process.getModuleByName('user32.dll');
for (const n of ['OpenClipboard', 'EmptyClipboard', 'SetClipboardData', 'CloseClipboard', 'MessageBoxA', 'MessageBoxW'])
  Interceptor.attach(u.getExportByName(n), { onEnter(a) { send(n + ' ' + a[0] + ' ' + a[1]); } });
const g = Process.getModuleByName('gdi32.dll');
Interceptor.attach(g.getExportByName('TextOutA'), { onEnter(a) { send('TextOutA ' + a[3].readAnsiString(a[4].toInt32())); } });
const k = Process.getModuleByName('kernel32.dll');
for (const n of ['CreateFileA', 'CreateFileW']) Interceptor.attach(k.getExportByName(n), { onEnter(a) { send(n + ' ' + (n.endsWith('W') ? a[0].readUtf16String() : a[0].readAnsiString())); } });
"""
root = os.path.expanduser(r"~\.local\share\jhweb\jhora-harness")
check_ini(root)
s = Session(root, os.path.abspath(sys.argv[1]))
t0 = time.time()
try:
    sess = frida.attach(s.pid)
    sc = sess.create_script(JS)
    sc.on("message", lambda m, d: print(f"{time.time()-t0:7.2f}", m.get("payload") or m))
    sc.load()
    s.tabs.activate("Miscellany", "Panchanga")
    print("posting 33085"); s.main.post_message(WM_COMMAND, 33085, 0); time.sleep(4); print("dialogs", s.dismiss_dialogs())
    print("posting 33086"); s.main.post_message(WM_COMMAND, 33086, 0)
    for _ in range(36):
        time.sleep(5)
        d = s.dismiss_dialogs()
        if d: print("dialogs", d)
finally:
    s.close(); kill_harness_jhora(root)
