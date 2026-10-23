"""Activate JHora's custom tab strips (CTabWnd, class AfxWnd42s) by clicking.

JHora draws its own tabs, so there is no tab control to query. We pin the main
window to a fixed size, click along each strip's caption row and record which page
became visible; the groups found left-to-right are the tabs in JHora's order.
Calibration is done once per JHora process and verified on every activation.
"""
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
WINDOW = (0, 0, 2000, 1400)
PAGE_CLASSES = ("AfxMDIFrame42s", "AfxWnd42s", "AfxFrameOrView42s", "#32770", "SysListView32")
TOP_STRIP_ID = 9592


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
        self._calibrate_top()

    # -- calibration -------------------------------------------------------
    @staticmethod
    def _visible(strip):
        return tuple(c.handle for c in strip.descendants(depth=3) if c.class_name() in PAGE_CLASSES and c.is_visible())

    def _scan(self, strip, y_off, x_max=None, step=20):
        r = strip.rectangle()
        groups = []
        for x in range(r.left + 8, (x_max or r.right) - 8, step):
            strip.click_input(coords=(x - r.left, y_off), absolute=False)
            time.sleep(0.12)
            v = self._visible(strip)
            if groups and groups[-1][2] == v:
                groups[-1][1] = x
            else:
                groups.append([x, x, v])
        return [((g[0] + g[1]) // 2, g[2]) for g in groups]

    def _calibrate_top(self):
        groups = self._scan(self.top, self.top_y, x_max=1500)
        if len(groups) != len(TOP_TABS):
            raise TabError(f"expected {len(TOP_TABS)} top tabs, found {len(groups)}")
        self.top_groups = groups
        self.log(f"tabs: top strip calibrated ({len(groups)} tabs)")

    def _calibrate_sub(self, top_name):
        wanted = SUB_TABS.get(top_name)
        if not wanted:
            self.sub[top_name] = None
            return
        strips = [w for w in self.main.descendants(class_name="AfxWnd42s")
                  if w.control_id() != TOP_STRIP_ID and w.is_visible() and w.rectangle().width() > 300]
        for strip in strips:
            h = strip.rectangle().height()
            for y_off in (14, h - 14):
                groups = self._scan(strip, y_off)
                if len(groups) == len(wanted):
                    self.sub[top_name] = (strip, y_off, groups)
                    self.log(f"tabs: {top_name} sub strip calibrated ({len(groups)} tabs)")
                    return
                if len(groups) > 1:
                    raise TabError(f"{top_name}: expected {len(wanted)} sub tabs, found {len(groups)}")
        raise TabError(f"{top_name}: no sub-tab strip found")

    # -- activation --------------------------------------------------------
    def activate(self, top_name, sub_name=None):
        ti = TOP_TABS.index(top_name)
        x, expect = self.top_groups[ti]
        if self.current[0] != top_name:
            r = self.top.rectangle()
            self.top.click_input(coords=(x - r.left, self.top_y), absolute=False)
            time.sleep(0.3)
            if self._visible(self.top) != expect:
                raise TabError(f"activating {top_name}: unexpected page set")
            self.current = (top_name, None)
        if sub_name is None:
            return
        if top_name not in self.sub:
            self._calibrate_sub(top_name)
        entry = self.sub[top_name]
        if entry is None:
            raise TabError(f"{top_name} has no sub tabs")
        strip, y_off, groups = entry
        si = SUB_TABS[top_name].index(sub_name)
        sx, sexpect = groups[si]
        r = strip.rectangle()
        strip.click_input(coords=(sx - r.left, y_off), absolute=False)
        time.sleep(0.3)
        if self._visible(strip) != sexpect:
            raise TabError(f"activating {top_name}/{sub_name}: unexpected page set")
        self.current = (top_name, sub_name)
