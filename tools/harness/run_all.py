"""Run every pending JHora capture in sequence (the option-variant goldens of the ported
features), restartable: a run skips the charts whose output already exists.

    python tools/harness/run_all.py [--jhora <copy-root>] [--only <name-prefix>] [--list]

Before every run the copy's jhcore/jhora.ini is restored from jhora.ini.pristine (made
once from the current file, which must equal JHora's defaults + AutoUpdateOn=0), because
JHora writes its options back on exit and --ini overrides would otherwise leak into the
next run. Option variants use three charts; default-setting runs six.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CH = lambda *names: [os.path.join("golden", "charts", n + ".jhd") for n in names]
VAR3 = CH("Mahatma Gandhi", "Swami Vivekananda", "India")
AYA3 = CH("Swami Vivekananda", "India", "Ramakrishna Paramahansa")
DEF6 = CH("Swami Vivekananda", "Mahatma Gandhi", "India", "Author of this software", "Aurobindo Ghose", "Maharshi Mahesh Yogi")


def run(name, out, views=None, ini=None, charts=VAR3, script="capture.py"):
    return {"name": name, "out": out, "views": views, "ini": ini or {}, "charts": charts, "script": script}


def ayanamsa_runs():
    """capture-ayanamsa.ps1's runs: every ayanamsa key passed each time (index = UserSelectedAyanamsa)."""
    base = {"UserSelectedAyanamsa": "17", "DeltaFromUserSelectedAyanamsa": "0.000000", "SiderealNaksharasInTropical": "0",
            "CustomStarCode": ",alVir", "CustomStarLongitude": "180.000000", "FixedPlaneInCustomStarAyanamsa": "0"}
    modes = {"00-lahiri": 0, "01-jagannatha": 1, "02-raman": 2, "03-deva-datta": 3, "04-kp": 4, "05-usha-shashi": 5,
             "06-yukteshwar": 6, "07-jn-bhasin": 7, "08-chandra-hari": 8, "09-fagan": 9, "10-deluce": 10, "11-djwhal-khul": 11,
             "12-aldebaran-15ta": 12, "13-galactic-center": 13, "14-hipparchos": 14, "15-sassanian": 15, "16-tropical": 16,
             "18-sss": 18, "19-custom-alVir": 19, "20-rohini-paksha": 20, "21-pushya-paksha": 21}
    extra = {"16-tropical-sidereal-nakshatras": {"UserSelectedAyanamsa": "16", "SiderealNaksharasInTropical": "1"},
             "17-delta-minus-0.25": {"UserSelectedAyanamsa": "17", "DeltaFromUserSelectedAyanamsa": "-0.250000"},
             "19-custom-alTau-46.5-plane": {"UserSelectedAyanamsa": "19", "CustomStarCode": ",alTau", "CustomStarLongitude": "46.500000",
                                            "FixedPlaneInCustomStarAyanamsa": "1"}}
    out = [run(f"ayanamsa/{n}", f"golden/jhora-ayanamsa/{n}", "views-ayanamsa.json", {**base, "UserSelectedAyanamsa": str(i)}, AYA3)
           for n, i in modes.items()]
    out += [run(f"ayanamsa/{n}", f"golden/jhora-ayanamsa/{n}", "views-ayanamsa.json", {**base, **v}, AYA3) for n, v in extra.items()]
    return out


def varga_runs():
    """views-vargas.json's 53 runs, merged: runs that change one independent key are combined
    (run j sets the j-th listed value of every such key); multi-key runs stay on their own."""
    d = json.load(open(os.path.join(HERE, "views-vargas.json"), encoding="utf-8"))
    runs = d["_runs"]
    base = next(r for r in runs if r["out"].endswith("defaults"))["ini"]
    single, multi = {}, []
    for r in runs:
        diff = {k: v for k, v in r["ini"].items() if base.get(k) != v}
        if len(diff) == 1:
            (k, v), = diff.items()
            single.setdefault(k, []).append(v)
        elif diff and not r["out"].split("/")[-1].startswith(("CustDiv", "DmDn")):
            multi.append(r)
        elif diff:   # custom D-n / D-m x n: independent columns, merged like single keys
            single.setdefault(r["out"].split("/")[-1].split("-")[0], []).append(diff)
    out = []
    width = max(len(v) for v in single.values())
    for j in range(width):
        ini = dict(base)
        for k, vals in single.items():
            if j < len(vals):
                if isinstance(vals[j], dict):
                    ini.update(vals[j])
                else:
                    ini[k] = vals[j]
        out.append(run(f"vargas/merged-{j}", f"golden/jhora-vargas/merged-{j}", "views-vargas.json", ini))
    for r in multi:
        out.append(run(f"vargas/{r['out'].split('/')[-1]}", r["out"], "views-vargas.json", r["ini"]))
    out.append(run("vargas/defaults", "golden/jhora-vargas/defaults", "views-vargas.json", base))
    return out


def json_runs(manifest, prefix):
    d = json.load(open(os.path.join(HERE, manifest), encoding="utf-8"))
    return [run(f"{prefix}/{r['out'].split('/')[-1]}", r["out"], manifest, r["ini"], VAR3) for r in d["_runs"]]


def kv(*pairs):
    return dict(p.split("=", 1) for p in pairs)


CALC = {
    "default": {},
    "amsa-swarudha1": kv("SwarudhaInAmsaBala=1"),
    "amsa-swarudha4": kv("SwarudhaInAmsaBala=4"),
    "amsa-swarudha7-disp": kv("SwarudhaInAmsaBala=7", "DispositorCombustionBadInAmsaBala=1", "DispositorDefeatBadInAmsaBala=1",
                              "DispositorNeechaBadInAmsaBala=1", "DispositorNeechaRasiBadInAmsaBala=1",
                              "DispositorPoorVimsopakaBadInAmsaBala=1", "DispositorSayanadiBadInAmsaBala=1"),
    "avastha-compound": kv("UseCompundRelationshipInAvasthas=1"),
    "avastha-compound-rasi": kv("UseCompundRelationshipInAvasthas=1", "CompoundRelationshipsFromRasi=1"),
    "av-reversed": kv("AshtakaVargaDefinition=0"),
    "av-bhava-eight": kv("BhavaDrivenSarvaAshtakaVarga=1", "EightAVInSAV=1"),
    "av-flag1": kv("AshtakaVargaCalculation=1 0"),
    "refraction": kv("ApparentRefraction=1"),
    "upagraha-eighth-lmt": kv("MandiInSaturnPortion=0", "GulikaInSaturnPortion=0", "UpagrahaDayDefinition=1"),
    "continuous-lagnas": kv("ContinuousSpecialLagnas=1"),
    "mb-pd-start": kv("MBTablePreference=1", "MBLocationPreference=0"),
    "pushkara-patel": kv("PushkaraBhagaJP=0"),
    "nodes-parasara": kv("NodalExaltationParasara=1"),
    "arudha-longitude": kv("LongitudeBasedBhavaArudhas=1", "ArudhaBasePlanet=2"),
    "arudha-divlongs": kv("LongitudeBasedBhavaArudhas=1", "DivLongsInBhavaArudhas=1"),
    "tropical-sidereal-naks": kv("UserSelectedAyanamsa=16", "SiderealNaksharasInTropical=1"),
}
DASA_COMMANDS = {
    "default": {}, "narayana-d9": kv("NarayanaDasaChart=1"), "paryaaya-d9": kv("ParyaayaDasaChart=1"),
    "lagnamsaka-d1": kv("LagnamsakaDasaChart=0"), "moola-no-lagna": kv("LagnaUsedInMoolaDasa=0"),
    "moola-no-moon": kv("MoonUsedInMoolaDasa=0"), "moola-mt0": kv("MoolaDasaNoCorrectionInMoolaTrikona=1"),
    "vimsottari-shift1": kv("NakshatraDasaShift=0 1"), "vimsottari-reverse": kv("AntiZodiacalDasa=0 1"),
    "saptarshi-shift3": kv("NakshatraDasaShift=12 3"), "kalachakra-lagna": kv("NakshatraDasaStartPoint=2 4"),
}
DASA_YEARS = {
    "vim-def0": kv("YearDefinition=0 0", "YearLength=0 365.242190"),
    "vim-def1": kv("YearDefinition=0 1", "YearLength=0 360.000000"),
    "vim-def2-400": kv("YearDefinition=0 2", "YearLength=0 400.000000"),
    "vim-def4": kv("YearDefinition=0 4", "YearLength=0 354.367080"),
    "vim-def6": kv("YearDefinition=0 6", "YearLength=0 365.256364"),
    "vim-def7": kv("YearDefinition=0 7", "YearLength=0 365.242190"),
    "vim-def1-len365": kv("YearDefinition=0 1", "YearLength=0 365.242190"),
    "narayana-def1": kv("YearDefinition=25 1", "YearLength=25 360.000000"),
    "karaka-def6": kv("YearDefinition=73 6", "YearLength=73 365.256364"),
}
DASA_OPTIONS = {
    "vim-start-lagna": kv("NakshatraDasaStartPoint=0 4"),
    "vim-ad-method1": kv("NaksDasaADMethodPreference=0 1"),
    "vim-ad-method3": kv("NaksDasaADMethodPreference=0 3"),
    "ashtottari-start-lagna": kv("NakshatraDasaStartPoint=1 4"),
    "yogini-shift2": kv("NakshatraDasaShift=3 2"),
    "dwadasottari-ad-method2": kv("NaksDasaADMethodPreference=6 2"),
}
BHAVA = {
    "default": {}, "lagna-equal": kv("BhavaChartRef=0"),
    "lagna-placidus": kv("BhavaChartRef=0", "HouseCuspsInMiddle=0", "HouseTypeWanted=4"),
    "rahu-reversed": kv("BhavaChartRef=8", "HouseCuspsInMiddle=0"),
    "rahu-forward": kv("BhavaChartRef=8", "HouseCuspsInMiddle=0", "HousesFromNodesReversed=0"),
}


def all_runs():
    R = []
    # earlier captures still pending
    R.append(run("progressions", "golden/jhora-misc-prog", "views-progressions.json", charts=DEF6))
    R.append(run("matching", "golden/jhora-matching", script="capture_matching.py"))
    R.append(run("chartmenu", "golden/jhora-chartmenu", script="capture_chartmenu.py"))
    # charts
    R.append(run("chartpane/default", "golden/jhora-chartpane", "views-chartpane.json"))
    R.append(run("chartpane/twostyles", "golden/jhora-chartpane-twostyles", "views-chartpane.json", kv("UseTwoChartStyles=1", "ChartStyle2=2")))
    R.append(run("chartpane/unpacked", "golden/jhora-chartpane-unpacked", "views-chartpane.json", kv("MoreChartsOnBigDisplay=0")))
    R.append(run("chartviews/style0", "golden/jhora-chartviews", "views-chartviews.json", kv("ChartStyle=0")))
    for n in (1, 2, 3, 4):
        R.append(run(f"chartviews/style{n}", f"golden/jhora-chartviews-style{n}", "views-chartviews.json", kv(f"ChartStyle={n}")))
    for n in (2, 3, 4):
        R.append(run(f"chartstyles/{n}", f"golden/jhora-chartstyle{n}", "views-chartstyles.json", kv(f"ChartStyle={n}")))
    R += [run(f"bhava/{k}", f"golden/jhora-bhava/{k}", "views-bhava.json", v) for k, v in BHAVA.items()]
    # calculations
    R += ayanamsa_runs()
    R += varga_runs()
    R += [run(f"calc/{k}", f"golden/jhora-calc-options/{k}", "views-calc-options.json", v) for k, v in CALC.items()]
    R.append(run("basics/options", "golden/jhora-basics-options", "views-basics-options.json"))
    R.append(run("basics/bodies", "golden/jhora-bodies", "views-basics-options.json",
                 kv("BodyTypeOuterPlanet=1", "BodyTypeUpagraha=0", "BodyTypeVarnadas=0", "BodyTypeGrahaArudha=0")))
    R += json_runs("views-userpoints.json", "userpoints")
    # dasas
    R.append(run("dasas/tajaka", "golden/jhora-dasas-tajaka", "views-dasas-tajaka.json", charts=DEF6))
    R.append(run("dasas/tp", "golden/jhora-dasas-tp", "views-dasas-tp.json", charts=DEF6))
    R.append(run("dasas/prog-grouped", "golden/jhora-prog-grouped", "views-progressions-grouped.json", charts=DEF6))
    R += [run(f"dasa-commands/{k}", f"golden/jhora-dasa-commands/{k}", "views-dasa-commands.json", v) for k, v in DASA_COMMANDS.items()]
    R += [run(f"dasa-years/{k}", f"golden/jhora-dasa-years/{k}", "views-dasa-years.json", v) for k, v in DASA_YEARS.items()]
    R += [run(f"dasa-options/{k}", f"golden/jhora-dasa-options/{k}", "views-dasa-options.json", v) for k, v in DASA_OPTIONS.items()]
    return R


def log(msg):
    line = time.strftime("%H:%M:%S ") + msg
    print(line, flush=True)
    with open(os.path.join(HERE, "run_all.log"), "a", encoding="utf-8") as f:
        f.write(line + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jhora", default=os.path.expanduser(r"~\.local\share\jhweb\jhora-harness"))
    ap.add_argument("--only", default="")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()
    runs = [r for r in all_runs() if r["name"].startswith(args.only)]
    if args.list:
        for r in runs:
            print(r["name"], r["out"], r["views"], r["ini"], len(r["charts"]))
        print(len(runs), "runs")
        return
    ini = os.path.join(args.jhora, "jhcore", "jhora.ini")
    pristine = ini + ".pristine"
    if not os.path.exists(pristine):
        shutil.copyfile(ini, pristine)
    os.chdir(ROOT)
    for k, r in enumerate(runs):
        todo = [c for c in r["charts"] if not os.path.exists(os.path.join(r["out"], os.path.splitext(os.path.basename(c))[0] + ".json"))]
        if not todo:
            continue
        shutil.copyfile(pristine, ini)
        cmd = [sys.executable, "-u", os.path.join(HERE, r["script"]), "--jhora", args.jhora, "--out", r["out"]]
        if r["views"]:
            cmd += ["--views", os.path.join(HERE, r["views"])]
        for key, v in r["ini"].items():
            cmd += ["--ini", f"{key}={v}"]
        log(f"[{k + 1}/{len(runs)}] {r['name']}: {len(todo)} chart(s)")
        t = time.time()
        p = subprocess.run(cmd + todo, capture_output=True, text=True, encoding="utf-8", errors="replace")
        tail = (p.stdout + p.stderr).strip().splitlines()[-3:]
        log(f"    exit {p.returncode} in {time.time() - t:.0f}s: {' | '.join(tail)}")
        if "network connection" in p.stdout + p.stderr:
            log("JHora tried to go online: stopping")
            break
    shutil.copyfile(pristine, ini)
    log("done")


if __name__ == "__main__":
    main()
