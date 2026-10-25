"""Activate JHora's custom tab strips (CTabWnd, class AfxWnd42s) by clicking.

JHora draws its own tabs, so there is no tab control to query. We pin the main
window to a fixed size, click along each strip's caption row and record which page
became visible; the groups found left-to-right are the tabs in JHora's order.
Calibration is done once and cached in tabs-cache.json (per window size and DPI: the
window is pinned, so caption positions repeat across launches); every activation is
verified, and a cached position that fails falls back to a fresh calibration.
"""
import ctypes
import json
import os
import time

TOP_TABS = ["Chakras", "Basics", "Strengths", "Dasas", "Transits", "Tajaka", "Tithi Pravesha", "Mundane", "Miscellany"]
SUB_TABS = {
    "Chakras": ["Many Vargas", "Mixed 2-Vargas", "Kalachakra", "Sarvatobhadra", "Kota Chakra",
                "Surya Kalanala", "Chandra Kalanala", "Sudarsana", "Shoola", "Tripataki"],
    "Basics": ["Key Info", "Houses", "Amsa rulers", "KP"],
    "Strengths": ["Ashtakavarga", "Other strengths", "Bar graphs"],
    "Dasas": ["Nakshatra dasas", "Rasi dasas", "Other dasas"],
    "Transits": ["Basic Transit Results", "Transit Calendar", "Special Search", "Longitude Correlation"],
    "Miscellany": ["Angular Return", "Progressions", "Prasna (Horary)", "Panchanga", "Laghu Parasari"],
}


def ensure_front(main):
    """Coordinate clicks go to whatever window is on top: bring the harness copy's window
    back to the front first (the user may have another JHora, or anything else, open)."""
    if ctypes.windll.user32.GetForegroundWindow() != main.handle:
        main.set_focus()
        time.sleep(0.2)


def _work_area():
    """Desktop work area (excludes the taskbar) as (left, top, right, bottom)."""
    class RECT(ctypes.Structure):
        _fields_ = [("l", ctypes.c_long), ("t", ctypes.c_long), ("r", ctypes.c_long), ("b", ctypes.c_long)]
    r = RECT()
    ctypes.windll.user32.SystemParametersInfoW(0x30, 0, ctypes.byref(r), 0)   # SPI_GETWORKAREA
    return r.l, r.t, r.r, r.b


# The main window is pinned to 2000x1400, or to the work area when the screen is smaller
# (a window larger than the screen breaks the tab-strip calibration).
_l, _t, _r, _b = _work_area()
WINDOW = (_l, _t, min(2000, _r - _l), min(1400, _b - _t))
PAGE_CLASSES = ("AfxMDIFrame42s", "AfxWnd42s", "AfxFrameOrView42s", "#32770", "SysListView32")
TOP_STRIP_ID = 9592
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tabs-cache.json")
CACHE_KEY = f"{WINDOW}@{ctypes.windll.user32.GetDpiForSystem()}"


class TabError(RuntimeError):
    pass


class Tabs:
    def __init__(self, main, log=print):
        self.main = main
        self.log = log
        main.set_focus()
        main.move_window(*WINDOW, repaint=True)
        time.sleep(0.8)
        self.top = [w for w in main.descendants(class_name="AfxWnd42s") if w.control_id() == TOP_STRIP_ID][0]
        self.top_y = 30
        self.top_groups = []       # [(x_center, visible_set)] in TOP_TABS order
        self.sub = {}              # top name -> (strip, y_off, [(x_center, visible_set)])
        self.current = (None, None)
        self.cached = self._load_cache()
        self.clicked = set()       # strips clicked in this process (cached mode: see _click_and_check)
        if self.cached:
            self.top_y = self.cached["top_y"]
            self.top_groups = [(x, None) for x in self.cached["top"]]
            self.log("tabs: top strip from cache")
        else:
            self._calibrate_top()

    # -- cache -------------------------------------------------------------
    @staticmethod
    def _load_cache():
        try:
            return json.load(open(CACHE, encoding="utf-8")).get(CACHE_KEY)
        except (OSError, ValueError):
            return None

    def _save_cache(self):
        try:
            data = json.load(open(CACHE, encoding="utf-8"))
        except (OSError, ValueError):
            data = {}
        entry = {"top_y": self.top_y, "top": [g[0] for g in self.top_groups], "sub": {}}
        for name, e in self.sub.items():
            if e:
                entry["sub"][name] = {"id": e[0].control_id(), "y": e[1], "x": [g[0] for g in e[2]]}
        data[CACHE_KEY] = entry
        json.dump(data, open(CACHE, "w", encoding="utf-8"), indent=1)

    def _recalibrate(self):
        """A cached position failed: calibrate everything afresh and rewrite the cache."""
        self.log("tabs: cached positions failed, recalibrating")
        self.cached = None
        self.sub = {}
        self.current = (None, None)
        self._calibrate_top()

    # -- calibration -------------------------------------------------------
    @staticmethod
    def _visible(strip):
        return tuple(c.handle for c in strip.descendants(depth=3) if c.class_name() in PAGE_CLASSES and c.is_visible())

    def _settled_visible(self, strip):
        """Visible page set once it stops changing (a click can land mid-repaint)."""
        v = self._visible(strip)
        for _ in range(6):
            time.sleep(0.1)
            w = self._visible(strip)
            if w == v:
                return v
            v = w
        return v

    def _scan(self, strip, y_off, x_max=None, step=20):
        r = strip.rectangle()
        groups = []
        for x in range(r.left + 8, (x_max or r.right) - 8, step):
            ensure_front(self.main); strip.click_input(coords=(x - r.left, y_off), absolute=False)
            time.sleep(0.12)
            v = self._settled_visible(strip)
            if groups and groups[-1][2] == v:
                groups[-1][1] = x
            else:
                groups.append([x, x, v])
        # Click near each group's left edge: the last caption's group also covers the
        # empty strip to its right, so its centre can miss the caption.
        return [(g[0] + min(24, (g[1] - g[0]) // 2), g[2], g[1] - g[0]) for g in groups]

    @staticmethod
    def _trim(groups, wanted):
        """Drop single-sample groups (transient states) when there are too many."""
        if len(groups) > wanted:
            wide = [g for g in groups if g[2] > 0]
            if len(wide) == wanted:
                groups = wide
        return [(g[0], g[1]) for g in groups]

    def _calibrate_top(self):
        # the caption row's height depends on the display (font size/DPI): try a few rows
        for y in (30, 17, 12, 22, 8):
            groups = self._trim(self._scan(self.top, y, x_max=1500), len(TOP_TABS))
            if len(groups) == len(TOP_TABS):
                self.top_y = y
                break
        else:
            raise TabError(f"expected {len(TOP_TABS)} top tabs, found {len(groups)}")
        self.top_groups = groups
        self.log(f"tabs: top strip calibrated ({len(groups)} tabs)")
        self._save_cache()

    def _calibrate_sub(self, top_name):
        wanted = SUB_TABS.get(top_name)
        if not wanted:
            self.sub[top_name] = None
            return
        strips = [w for w in self.main.descendants(class_name="AfxWnd42s")
                  if w.control_id() != TOP_STRIP_ID and w.is_visible() and w.rectangle().width() > 300]
        for strip in strips:
            h = strip.rectangle().height()
            # captions are usually along the bottom; the top edge of some pages has buttons
            # (the dasa pane's Options opens a modal dialog), so try the bottom rows first
            found = []
            for y_off in (h - 14, h - 9, 14, 9):
                groups = self._trim(self._scan(strip, y_off), len(wanted))
                if len(groups) == len(wanted):
                    self.sub[top_name] = (strip, y_off, groups)
                    self.log(f"tabs: {top_name} sub strip calibrated ({len(groups)} tabs)")
                    self._save_cache()
                    return
                found.append(len(groups))
            if max(found) > 1:
                raise TabError(f"{top_name}: expected {len(wanted)} sub tabs, found {found}")
        raise TabError(f"{top_name}: no sub-tab strip found")

    # -- activation --------------------------------------------------------
    def _click_and_check(self, strip, x, y_off, expect, label):
        """Click a tab caption. The page set may legitimately differ from calibration
        (form dialogs are created lazily), so we only insist that the click took
        effect: the set must equal the expected one or at least differ from before.
        With cached positions (expect None) the first click on a strip may hit the tab
        already shown, so an unchanged set is accepted only then."""
        before = self._visible(strip)
        r = strip.rectangle()
        ensure_front(self.main); strip.click_input(coords=(x - r.left, y_off), absolute=False)
        time.sleep(0.3)
        after = self._settled_visible(strip)
        first = strip.handle not in self.clicked
        self.clicked.add(strip.handle)
        if after == expect or after != before or (expect is None and first):
            return
        # a second click sometimes lands after a repaint; try once more
        ensure_front(self.main); strip.click_input(coords=(x - r.left, y_off), absolute=False)
        time.sleep(0.3)
        after = self._settled_visible(strip)
        if after != expect and after == before:
            raise TabError(f"activating {label}: tab did not change the page set")

    def activate(self, top_name, sub_name=None):
        try:
            self._activate(top_name, sub_name)
        except TabError:
            if not self.cached:
                raise
            self._recalibrate()
            self._activate(top_name, sub_name)

    def _sub_from_cache(self, top_name):
        c = (self.cached or {}).get("sub", {}).get(top_name)
        if not c:
            return False
        strips = [w for w in self.main.descendants(class_name="AfxWnd42s")
                  if w.control_id() == c["id"] and w.is_visible() and w.rectangle().width() > 300]
        if len(strips) != 1:
            return False
        self.sub[top_name] = (strips[0], c["y"], [(x, None) for x in c["x"]])
        return True

    def _activate(self, top_name, sub_name=None):
        ti = TOP_TABS.index(top_name)
        x, expect = self.top_groups[ti]
        if self.current[0] != top_name:
            self._click_and_check(self.top, x, self.top_y, expect, top_name)
            self.current = (top_name, None)
        if sub_name is None:
            return
        if top_name not in self.sub and not self._sub_from_cache(top_name):
            self._calibrate_sub(top_name)
        entry = self.sub[top_name]
        if entry is None:
            raise TabError(f"{top_name} has no sub tabs")
        strip, y_off, groups = entry
        si = SUB_TABS[top_name].index(sub_name)
        sx, sexpect = groups[si]
        if self.current[1] != sub_name:
            self._click_and_check(strip, sx, y_off, sexpect, f"{top_name}/{sub_name}")
        self.current = (top_name, sub_name)
