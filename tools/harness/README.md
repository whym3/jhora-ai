# Golden-master harness

`jh_dump.py` runs the desktop Jagannatha Hora 8.0 on `.jhd` charts and saves
every table it shows (list views) to `golden/jhora/<chart>.json`. The web port's
tests compare against these files.

Setup (once):

1. Copy the install to a private folder, e.g. `~/.local/share/jhweb/jhora-harness`
   (`bin/`, `jhcore/`, `data/`). Never automate the real install.
2. Create `<copy>/jhcore/jhora.ini` containing `AutoUpdateOn=0`. JHora reads its
   settings from `<root>\jhcore\jhora.ini` (not `bin\`). Without this line it
   fetches `http://www.vedicastrologer.org/jh/auto/update.txt` at every start.
   The script refuses to run without it and kills JHora if any TCP connection
   appears.
3. `pip install pywinauto pillow`

Run:

    python tools/harness/jh_dump.py --jhora ~/.local/share/jhweb/jhora-harness \
        --out golden/jhora golden/charts/*.jhd

`golden/jhora-defaults.ini` is the ini JHora wrote on first exit: the complete
default settings the port must reproduce.
