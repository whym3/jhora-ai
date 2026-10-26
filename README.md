# Jagannatha Hora for the web

**A Vedic astrology consultation with an AI that calculates exactly like Jagannatha Hora.**

Ask Claude (or Gemini in Antigravity, or GPT in the web app) about your chart, and it works from real calculations, not guesses. It casts your chart with the same calculations as **Jagannatha Hora 8.0**, P.V.R. Narasimha Rao's astrology program, and checks the chart against your past events before it answers. It then gives you a reading that quotes the data behind each point.

The project also includes the full Jagannatha Hora program as a web app that runs in your browser.

## Get a reading in 10 minutes

You need a Mac or a Windows PC. Nothing here costs money apart from your Claude plan.

**1. Install the Claude desktop app** from [claude.ai/download](https://claude.ai/download), open it and sign in.

**2. Install Node.js** from [nodejs.org](https://nodejs.org) (choose the **LTS** version and click through the installer). On a Mac with Homebrew, `brew install node` works too.

**3. Download this project:** click [**Download ZIP**](https://github.com/whym3/jhora-ai/archive/refs/heads/master.zip) and unzip it somewhere you'll keep it, such as your Documents folder. (Or `git clone https://github.com/whym3/jhora-ai.git`.)

**4. Run two commands.** Open a terminal in the unzipped folder:
- **Mac:** open the **Terminal** app, type `cd ` (with a space), drag the folder onto the window, and press Return.
- **Windows:** open the folder in File Explorer, right-click inside it, and choose **Open in Terminal**.

Then run:

```bash
npm install
npm run setup:claude
```

The first command downloads what the project needs (a minute or two). The second builds the astrologer and adds it to Claude's settings, keeping anything else you had there.

**5. Restart Claude.** Quit it completely (on a Mac, **Claude → Quit Claude**; on Windows, right-click the icon in the taskbar's notification area and choose **Quit**), then open it again.

**6. Start a new chat** and say:

> I'd like a Vedic astrology consultation.

### What happens in a consultation

1. **Your chart.** Claude asks whose chart it is and for the birth date, time and place. It works out the place's coordinates and time zone, shows them for you to confirm, and saves the chart so it is there next time.
2. **Your past events.** Before any prediction, it asks for a few dated events from your life: studies, jobs, marriage, children, moves, illnesses, losses. It checks them against the planetary periods (dasas) running at the time, to make sure the chart and birth time fit your life.
3. **Your question.** Then ask anything: career, money, relationships, health, the year ahead. The answer draws on the dasas, transits, yogas, divisional charts and more, and says which data each point comes from.

You can also ask directly, for example *"What dasa am I running now?"*, *"When does Saturn enter my 10th house?"* or *"Cast a prasna for the number 37."*

### Best models for accurate readings

The calculations are exact whatever model you use, but the reading is only as good as the model interpreting them. Readings are most accurate with a top model at **high thinking**:

| App | Model | Setting |
|---|---|---|
| Claude desktop app | **Fable 5.1** | extended thinking on |
| Antigravity (Gemini) | **Gemini Argon** | high thinking |
| Web app's AI astrologer (OpenAI key) | **the latest GPT model** | reasoning effort high |

Smaller or faster models can mix up chart details or skip steps of the method.

**Privacy.** Every calculation runs on your computer. Your conversation goes to the AI's provider (Anthropic, Google or OpenAI) like any other chat with it. Saved charts stay in the project's `charts` folder.

**If Claude doesn't offer the tools,** open **Settings → Developer** in Claude: "jhora" should be listed as running. If you moved or renamed the project folder, run `npm run setup:claude` again. On Windows, if the terminal says `npm` is not recognised, close it and open a new one after installing Node.js.

### Gemini, ChatGPT and other apps

- **ChatGPT:** the ChatGPT desktop app can't yet use a tool running on your own computer, only ones hosted on the internet. Use the AI astrologer built into the web app instead, with your OpenAI API key (see [The web app](#the-web-app) and [AI astrologer](#ai-astrologer)).
- **Gemini, in Antigravity:** Google's [Antigravity](https://antigravity.google) app runs the astrologer with Gemini models. After steps 2–4 above (with `npm run setup:print` in place of `npm run setup:claude`), the terminal shows a block of settings with this computer's paths filled in. In Antigravity, open the **…** menu in the agent panel, choose **MCP Servers → Manage MCP Servers → View raw config**, and paste the `"jhora"` entry inside `"mcpServers"`. Save, refresh the server list, and start a new conversation with *"I'd like a Vedic astrology consultation."* (Gemini's own desktop app did not give the tools to its model in testing.)
- **Claude Code, Cursor and other MCP apps:** see [MCP server](#mcp-server).

---

## About the project

A browser port of **Jagannatha Hora 8.0** that reproduces its calculations exactly, with an **AI astrologer** that reads charts through those calculations, and an **MCP server** that gives the same tools to Claude and other AI apps.

Everything runs locally: the Swiss Ephemeris is compiled to WebAssembly and runs in the browser (or in Node for the MCP server). Nothing about a chart leaves your machine unless you use the AI features.

## Features

- **Charts:** rasi and every divisional chart (D-1 to D-60, D-81, D-108, D-144), South or North Indian style, 56 bodies (special lagnas, upagrahas, arudhas, sphutas), houses in eleven systems, and KP lords down to the deha-sub.
- **Dasas:** Vimsottari and 48 other nakshatra, rasi and graha dasas, five levels deep.
- **Strengths and yogas:** Shadbala, Bhava bala, Ishta/Kashta, Vimsopaka, Ashtakavarga (with sodhana and pindas), avasthas, Tajaka balas, and JHora's full yoga set.
- **Timing:** transits (nine modes, transit calendar, special search), Tajaka annual and monthly charts with Mudda dasa, Tithi Pravesha, progressions, angular returns, Prasna and mundane charts.
- **Also:** panchanga, chakras (Sudarsana, Kota, Sarvatobhadra, Kalachakra, Shoola, Tripataki and more), horoscope matching, Laghu Parasari, and the Surya Siddhanta planetary model.
- **Files:** reads and writes JHora's `.jhd` files; JHora's place atlas is optional.

## Accuracy

The port is tested against Jagannatha Hora's own output: **all 3690** comparisons match. The test data covers 18 charts and every tab, plus mundane, progression and prasna charts, marriage matching for every nakshatra and pada, and the chart styles. It was captured from the desktop program by [tools/harness](tools/harness/README.md). See [PARITY.md](PARITY.md) for the breakdown by area and the documented tolerances. Sixteen tests of option variants are skipped until JHora's output for those settings is captured.

## The web app

The full program, with JHora's tabs and charts, in your browser. You need Node.js 22 or newer.

```bash
npm install
npm run dev        # then open http://localhost:5173
```

**Ephemeris files.** The Swiss Ephemeris data files in `public/ephe` are included, and they are JHora 8.0's own copies. That matters: JHora ships an older build of these files, and only the same files reproduce its output exactly. Compared with JHora's results across the test suite:

| Files in `public/ephe` | Tests that differ from JHora |
|---|---:|
| JHora's own copies (included) | 0 |
| Astrodienst's current official files | 314 |
| none (Swiss Ephemeris falls back to its Moshier approximation) | 844 |

To refresh them from an installation, run `JHORA_DIR="/path/to/Jagannatha Hora" bash tools/copy-ephe.sh`. The default `JHORA_DIR` is the Windows location; on a Mac running JHora through Wine or Whisky, it is the `drive_c/Program Files (x86)/Jagannatha Hora` folder inside the bottle.

**Place search (optional).** JHora's atlas lets you search birth places by name; it is not included. Copy it with `node tools/atlas/install.mjs "/path/to/Jagannatha Hora/jhcore/atlas"`.

## AI astrologer

The **AI Astrologer** button opens a chat about the chart on screen, using Claude or OpenAI with your own API key. Keys are stored only in your browser and sent only to the provider you choose.

The model doesn't guess positions or dates: it reads the chart through 25 tools that run the app's calculations. These cover:
- positions, divisional charts, and houses and KP
- dasas, strengths, yogas and aspects
- transits, and exact ingress and conjunction moments
- Tajaka, Tithi Pravesha and angular-return charts
- progressed charts (solar, Bhrigu, Sudarsana chakra, nakshatra dasa)
- prasna (108, KP 249, Nadi)
- mundane event charts (ingresses, aspects, stations, eclipses, solar and lunar new years and months, Ardra Pravesha)
- marriage matching and panchanga

Its readings work through three layers (Parashari with Jaimini, KP, and Bhrigu Nandi Nadi) and quote the data behind each statement. The prompt and tools are in [src/ai](src/ai).

## MCP server

The same 25 tools are available to any [Model Context Protocol](https://modelcontextprotocol.io) client, alongside the server's own chart and consultation tools. Each conversation runs as a consultation:

1. **The chart.** The assistant offers your saved charts, or takes birth details and saves them for next time.
2. **Past events.** It asks for a few dated events from your life and checks them against the dasas running at the time, to test the chart and birth time.
3. **Your question.** Only then does it read the chart for what you want to know.

Build it once (rebuild after code changes):

```bash
npm run mcp:build          # -> dist-mcp/jhora-mcp.mjs (self-contained, no node_modules needed)
```

The server needs the ephemeris files in `public/ephe` (see [The web app](#the-web-app)). It reads charts from `public/samples` and saves your own charts in `charts/`, which git ignores.

### Claude Desktop, Cursor and other local clients

Let the client launch the server itself. For Claude Desktop, `npm run setup:claude` builds the server and adds it to Claude's config (`--dry-run` shows the change without writing it; `--config <file>` picks the file). To do it by hand, add this to `claude_desktop_config.json` (**Settings → Developer → Edit Config**), then restart Claude:

```json
{
  "mcpServers": {
    "jhora": {
      "command": "node",
      "args": ["/absolute/path/to/jhora-ai/dist-mcp/jhora-mcp.mjs"]
    }
  }
}
```

Desktop apps may not see your shell's `PATH`; if the server doesn't start, give the full path to `node` (for example `/opt/homebrew/bin/node`). Cursor uses the same block in `~/.cursor/mcp.json`.

For Claude Code:

```bash
claude mcp add --scope user jhora -- node /absolute/path/to/jhora-ai/dist-mcp/jhora-mcp.mjs
```

Then just ask, for example *"I'd like a reading: open my saved chart"* or *"what dasa am I running now?"*. The server also offers a `jyotish_reading` prompt.

### As a standalone HTTP or HTTPS server

```bash
npm run mcp:http           # http://127.0.0.1:3333/mcp
npm run mcp:https          # https://localhost:3443/mcp
```

HTTPS needs a certificate for `localhost`, for example made with [mkcert](https://github.com/FiloSottile/mkcert):

```bash
mkdir -p .cache/mcp-tls
mkcert -cert-file .cache/mcp-tls/cert.pem -key-file .cache/mcp-tls/key.pem localhost 127.0.0.1
```

Both modes listen on this machine only and refuse requests addressed to any other host name. They are not yet safe to expose publicly: see [Limitations](#limitations).

### Docker

```bash
docker compose up -d --build    # https://localhost:3443/mcp
```

This builds the server into a Node 22 image and publishes it on `127.0.0.1` only. Saved charts stay in `./charts` on the host, and the certificate from `.cache/mcp-tls` is mounted read-only, never copied into the image. The image includes the ephemeris files.

### Settings

| Variable | Default | Meaning |
|---|---|---|
| `JHORA_ROOT` | the repository holding the server file | where `public/ephe` and `public/samples` are |
| `JHORA_CHARTS` | `charts/` | saved charts |
| `JHORA_MCP_LOG` | `charts/.jhora-mcp.log` | short log of every request, for clients whose own logs are unreadable |
| `JHORA_MCP_HOST` | `127.0.0.1` | listen address for HTTP/HTTPS (`0.0.0.0` in Docker) |
| `JHORA_TLS_CERT`, `JHORA_TLS_KEY` | `.cache/mcp-tls/cert.pem`, `key.pem` | certificate for HTTPS |

### Limitations

- **Not ready for public hosting.** The server is built for one person: every visitor would see the same saved charts, `open_chart` accepts file paths on the host, and each session loads its own copy of the calculation engine.
- **Cloud connectors can't reach it.** Claude's "custom connector" and Gemini's "Cloud MCP" connect from their providers' servers, which cannot reach a server on `localhost`.
- **Gemini's desktop app:** in testing, Gemini's local-server support did not offer the tools to its model.

## Development

| Command | What it does |
|---|---|
| `npm run dev` | the web app with live reload |
| `npm test` | all tests (Vitest) |
| `npm run typecheck` | TypeScript checks |
| `npm run build` | production build of the web app into `dist/` (works offline as a PWA) |
| `npm run parity` | regenerate PARITY.md from the test results |
| `npm run mcp:build` | build the MCP server |
| `npm run setup:claude` | build the MCP server and register it with the Claude desktop app |
| `npm run setup:print` | build the MCP server and print its config block for other apps (Antigravity, Cursor ...) |

The tests compare the port with JHora's output in `golden/`. `JHORA_EPHE_DIR=/some/folder npm test` runs them against another set of ephemeris files.

**Swiss Ephemeris engine.** It is built from Astrodienst's official source (v2.10.3) with Emscripten, plus small patches that emulate the DLL bundled with JHora. Rebuild it with `tools/build-sweph.sh`, which needs Docker.

**Golden data.** It comes from running the desktop program under automation; see [tools/harness](tools/harness/README.md).

### Layout

| Path | Contents |
|---|---|
| `src/core` | all calculations: positions, vargas, dasas, strengths, yogas, KP, transits, Tajaka, chakras, derived charts |
| `src/sweph` | typed wrapper around the Swiss Ephemeris WebAssembly build |
| `src/engine` | the calculation worker and its jobs (the tables every view and tool requests) |
| `src/ui` | the React interface |
| `src/ai` | the AI astrologer: system prompt, tools, Claude and OpenAI adapters |
| `src/mcp` | the MCP server |
| `golden` | sample charts and JHora's output for them |
| `tests` | Vitest suites |
| `tools` | ephemeris and atlas copying, engine build, test harness, parity report |

## Licence and credits

All astrological methods and the program's behaviour come from **Jagannatha Hora** by P.V.R. Narasimha Rao. This project reproduces its calculations so they can run on any platform; it is not affiliated with or endorsed by the author.

The ephemeris engine is the **Swiss Ephemeris** by Astrodienst AG, which is dual-licensed: under the GNU Affero General Public License (AGPL), or under Astrodienst's professional licence. Using this code, and especially running it as a public network service, has to follow one of the two.

This repository does not yet have a licence of its own.
