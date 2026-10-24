# Jagannatha Hora for the web

A browser port of **Jagannatha Hora 8.0**, P.V.R. Narasimha Rao's Vedic astrology program, that reproduces its calculations exactly, with an **AI astrologer** that reads charts through those calculations, and an **MCP server** that gives the same tools to Claude, Gemini, Cursor and other AI apps.

Everything runs locally: the Swiss Ephemeris is compiled to WebAssembly and runs in the browser (or in Node for the MCP server). Nothing about a chart leaves your machine unless you use the AI features with your own API key.

## Features

- **Charts:** rasi and every divisional chart (D-1 to D-60, D-81, D-108, D-144), South or North Indian style, 56 bodies (special lagnas, upagrahas, arudhas, sphutas), houses in eleven systems, and KP lords down to the deha-sub.
- **Dasas:** Vimsottari and 48 other nakshatra, rasi and graha dasas, five levels deep.
- **Strengths and yogas:** Shadbala, Bhava bala, Ishta/Kashta, Vimsopaka, Ashtakavarga (with sodhana and pindas), avasthas, Tajaka balas, and JHora's full yoga set.
- **Timing:** transits (nine modes, transit calendar, special search), Tajaka annual and monthly charts with Mudda dasa, Tithi Pravesha, progressions, angular returns, Prasna and mundane charts.
- **Also:** panchanga, chakras (Sudarsana, Kota, Sarvatobhadra, Kalachakra, Shoola, Tripataki and more), horoscope matching, Laghu Parasari, and the Surya Siddhanta planetary model.
- **Files:** reads and writes JHora's `.jhd` files; JHora's place atlas is optional.

## Accuracy

The port is tested against Jagannatha Hora's own output: **1955 of 1957** comparisons match. The test data covers 18 charts and every tab, captured from the desktop program by [tools/harness](tools/harness/README.md). See [PARITY.md](PARITY.md) for the breakdown by area and the documented tolerances.

## Getting started

You need Node.js 22 or newer, and an installation of Jagannatha Hora 8.0 for its ephemeris data files. Those files are not in this repository.

```bash
npm install

# Copy JHora's Swiss Ephemeris files into public/ephe. Point JHORA_DIR at your JHora
# install; the default is the Windows location, "C:\Program Files (x86)\Jagannatha Hora".
JHORA_DIR="/path/to/Jagannatha Hora" bash tools/copy-ephe.sh

# Optional: JHora's atlas for searching places by name
node tools/atlas/install.mjs "/path/to/Jagannatha Hora/jhcore/atlas"

npm run dev        # http://localhost:5173
```

On a Mac running JHora through Wine or Whisky, `JHORA_DIR` is the `drive_c/Program Files (x86)/Jagannatha Hora` folder inside the bottle.

JHora's own data files are used because JHora 8.0 ships an older build of them; with the same files, positions match the desktop program.

## AI astrologer

The **AI Astrologer** button opens a chat about the chart on screen, using Claude or OpenAI with your own API key. Keys are stored only in your browser and sent only to the provider you choose.

The model doesn't guess positions or dates: it reads the chart through 20 tools that run the app's calculations. These cover positions, divisional charts, houses and KP, dasas, strengths, yogas, aspects, transits, exact ingress and conjunction moments, Tajaka and Tithi Pravesha charts, and panchanga. Its readings work through three layers (Parashari with Jaimini, KP, and Bhrigu Nandi Nadi) and quote the data behind each statement. The prompt and tools are in [src/ai](src/ai).

## MCP server

The same tools are available to any [Model Context Protocol](https://modelcontextprotocol.io) client. Each conversation runs as a consultation:

1. **The chart.** The assistant offers your saved charts, or takes birth details and saves them for next time.
2. **Past events.** It asks for a few dated events from your life and checks them against the dasas running at the time, to test the chart and birth time.
3. **Your question.** Only then does it read the chart for what you want to know.

Build it once (rebuild after code changes):

```bash
npm run mcp:build          # -> dist-mcp/jhora-mcp.mjs (self-contained, no node_modules needed)
```

The server needs the ephemeris files in `public/ephe` (see [Getting started](#getting-started)). It reads charts from `public/samples` and saves your own charts in `charts/`, which git ignores.

### Claude Desktop, Cursor and other local clients

Let the client launch the server itself. For Claude Desktop, add this to `claude_desktop_config.json` (**Settings → Developer → Edit Config**), then restart Claude:

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

This builds the server into a Node 22 image and publishes it on `127.0.0.1` only. Saved charts stay in `./charts` on the host, and the certificate from `.cache/mcp-tls` is mounted read-only, never copied into the image. The image includes the ephemeris files, so copy them first.

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

The tests compare the port with JHora's output in `golden/`; most need the ephemeris files.

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
