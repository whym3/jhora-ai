"""Screenshot the dasa pane after row click, '|', '<', '>' to learn the navigation."""
import os, sys, time, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import Session
H = os.path.expanduser(r"~\.local\share\jhweb\jhora-harness")
S = os.environ["SCRATCH"]
s = Session(H, os.path.join(H, "data", "Swami Vivekananda.jhd"))
try:
    s.tabs.activate("Dasas", "Nakshatra dasas")
    v = [w for w in s.main.descendants(class_name="AfxFrameOrView42s") if w.is_visible() and w.rectangle().left > 1000][0]
    btn = {b.window_text(): b for b in v.parent().children() if b.class_name() == "Button"}
    head = lambda: [l for l in s.copy_text(32972)[0].split("\n") if l.strip()][1][:50]
    v.click_input(coords=(90, 267)); time.sleep(0.5); print("after row0:", head()); v.capture_as_image().save(os.path.join(S, "d_row0.png"))
    btn["|"].click_input(); time.sleep(0.5); print("after |:", head()); v.capture_as_image().save(os.path.join(S, "d_bar.png"))
    btn["<"].click_input(); time.sleep(0.5); print("after <:", head()); v.capture_as_image().save(os.path.join(S, "d_lt.png"))
    btn[">"].click_input(); time.sleep(0.5); print("after >:", head())
    v.click_input(coords=(90, 307)); time.sleep(0.5); print("after row1:", head()); v.capture_as_image().save(os.path.join(S, "d_row1.png"))
finally:
    s.close()
