# Graph Report - jhora-ai  (2026-10-24)

## Corpus Check
- Large corpus: 348 files · ~3,596,367 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2209 nodes · 6932 edges · 107 communities (87 shown, 20 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 139 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106

## God Nodes (most connected - your core abstractions)
1. `norm360()` - 78 edges
2. `Chart` - 76 edges
3. `Sweph` - 68 edges
4. `Period` - 60 edges
5. `rasiCtx` - 57 edges
6. `Graha` - 56 edges
7. `signOf()` - 53 edges
8. `computeChart()` - 51 edges
9. `vitest` - 46 edges
10. `vargaLongitude()` - 43 edges

## Surprising Connections (you probably didn't know these)
- `suite()` --calls--> `computeChart()`  [EXTRACTED]
  tests/tajakaGolden.test.ts → src/core/chart.ts
- `suite()` --calls--> `mahaDasaText()`  [EXTRACTED]
  tests/tajakaGolden.test.ts → src/core/dasas/format.ts
- `suite()` --calls--> `patyayiniDasa()`  [EXTRACTED]
  tests/tajakaGolden.test.ts → src/core/dasas/patyayini.ts
- `nodeSweph()` --calls--> `loadEngine()`  [EXTRACTED]
  tests/helpers.ts → src/core/engine.ts
- `GoldenChart` --references--> `BirthData`  [EXTRACTED]
  tests/golden.ts → src/core/jhd.ts

## Import Cycles
- None detected.

## Communities (107 total, 20 thin omitted)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (40): akKendradiDasa(), BRAHMA_TITLE, brahmaDasa(), brahmaSign(), brahmaYears(), charaParasaraDasa(), drigDasa(), drigGroup() (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (39): Atlas, ATLAS_COUNTRIES, AtlasResult, AtlasScope, dstInEffect(), EX_USSR, LAST_SUN_MAR, LAST_SUN_OCT (+31 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (47): charaKarakas(), AK_KENDRADI_TITLE, AK_KENDRADI_GRAHA_TITLE, akKendradiGrahaDasa(), akKendradiGrahaYears(), karakaScheme(), OWN, BUDDHI_GATI_TITLE (+39 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (47): react, PROG_DASAS, ProgressionKind, BirthData, NamedBody, ChartResult, ChartSpec, SubView() (+39 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (40): computePositionsSSS(), eotAyanamsa(), SSS_INDEX, angularDistance(), APOGEE_REVOLUTIONS, apogeeLongitude(), apparentAhargana(), BEEJA (+32 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (44): CHARA_PARASARA_TITLE, charaParasaraYears(), mod12(), MOOLA_TITLE, moolaDasa(), moolaOrder(), MOOLATRIKONA, moolaYears() (+36 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (40): signsInVarga(), ALL, ARGALA, highlightSigns(), maranaKarakaSthana(), MKS, NAT, NAT_PK (+32 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (39): ArudhaOptions, bhavaArudha(), DEFAULT_ARUDHA, grahaArudha(), lordOf(), mod12(), OWN_SIGNS, signArudha() (+31 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (33): react-dom, bodiesByIndex(), bodyLongitude(), chakraBody, chartTithi(), chartWeekday(), JHORA_BODIES, kalachakraChakra (+25 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (37): author, dependencies, @anthropic-ai/sdk, openai, react, react-dom, description, devDependencies (+29 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (18): vitest, table(), applyOverride(), computeChart(), DasaBuilder, OTHER_DASAS, RASI_DASAS, MUNDANE_JOBS (+10 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (30): siderealLongitude(), computeTajakaChart(), LEVELS, solarYearsToJd(), STEP, sunSearch(), TAJAKA_LABEL, TajakaChart (+22 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (30): Align, apply(), assign(), attrs(), Captured, CELL, colourMismatches(), counts() (+22 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (31): planetBodies(), grahaDrishtiOn(), lattasOn(), onLine(), sarvatobhadra, sarvatobhadraGrid(), sarvatobhadraVedhasFrom(), sarvatobhadraVedhasOn() (+23 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (19): TP_JOBS, decodeHms(), parseJhd(), PositionOverride, GRAHAS, DEFAULT_SETTINGS, NAKSHATRAS, CASES (+11 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (26): mixedSlots(), TripatakiMode, bodyClass(), BodyStack(), ChakraSvg(), ChakraViewProps, CHAKRA_VIEWS, ChakraSubTab (+18 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (6): Ctx, Ctx, Ctx, Settings, meanEquinoxSpeeds(), Sweph

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (24): TithiInfo, Portion, CHARA_IRANGANTI_TITLE, charaIrangantiDasa(), charaIrangantiYears(), count1to12(), parityDir(), ROWS (+16 more)

### Community 19 - "Community 19"
Cohesion: 0.11
Nodes (25): dayFrame, nextEvent(), sunriseBits(), SunriseDefinition, adjustForTidacc(), deltatAa(), deltatEspenakMeeus1620(), deltatLongtermMorrisonStephenson() (+17 more)

### Community 20 - "Community 20"
Cohesion: 0.16
Nodes (29): angularReturn, ardraPravesha(), aspectMoment(), ASPECTS, bodyLon(), contactTime(), ctxOf(), divisionName() (+21 more)

### Community 21 - "Community 21"
Cohesion: 0.12
Nodes (27): AgentEvent, AiSettings, CLAUDE_MODELS, CLAUDE_TOOLS, DEFAULT_SETTINGS, Effort, errorText(), FALLBACK_MODELS (+19 more)

### Community 22 - "Community 22"
Cohesion: 0.16
Nodes (23): Chart, KARANA_CHATURASEETI_TITLE, karanaChaturaseetiDasa(), karanaLord(), NAISARGIKA_TITLE, SEQ, BODY, bodyId() (+15 more)

### Community 23 - "Community 23"
Cohesion: 0.10
Nodes (27): ANGA_RESULTS, angaGraha(), basicTransitTable(), houses(), LATTA, MA, MJV, MO (+19 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (26): lordLabel(), kotaChakra, fromMrityuBhaga(), fromPushkaraBhaga(), inPushkaramsa(), MRITYU_BHAGA, PUSHKARA_BHAGA, PUSHKARA_NAVAMSAS (+18 more)

### Community 25 - "Community 25"
Cohesion: 0.11
Nodes (23): build(), CHANDRA_ELLIPSE, CHANDRA_LINES, CHANDRA_STAR_XY, chandraKalanala(), DX, DY, Kalanala (+15 more)

### Community 26 - "Community 26"
Cohesion: 0.14
Nodes (24): antarDasaText(), DASA_ABBR, DasaTextCtx, formatDasaTime(), mahaDasaText(), periodLabel(), span(), AngleFn (+16 more)

### Community 27 - "Community 27"
Cohesion: 0.09
Nodes (28): castBirth(), Element, elongation(), FIXED_KARANA_LORD, fixedFrame(), Frame, FrameLords, horaInfo (+20 more)

### Community 28 - "Community 28"
Cohesion: 0.09
Nodes (28): AYANA_SIGN, BhavaBala, computeShadbala(), crem(), DEBILITATION_POINT, DIG_WEAK, DREKKANA_OFFSET, fold() (+20 more)

### Community 29 - "Community 29"
Cohesion: 0.15
Nodes (24): subdivide(), vimsottari(), birthWithOverride(), BHRIGU_YEARS, children(), dasaYearsAt(), lonOf(), PROG_BODIES (+16 more)

### Community 30 - "Community 30"
Cohesion: 0.13
Nodes (24): encodeHms(), writeJhd(), AiPanel, App(), diffIni(), DocTabs(), FIXED_TABLES, loadSample() (+16 more)

### Community 31 - "Community 31"
Cohesion: 0.11
Nodes (18): AI_TOOLS, AiTool, ALL_DASAS, AV_MODES, BODIES, DateInput, Json, NAKSHATRA_DASA_SYSTEMS (+10 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (26): bodySpeed(), CONTACT_NAMES, CONTACT_ORDER, DIVISION_NAMES, divisionArc(), DIVISIONS, eclipse, ECLIPSE_TYPES (+18 more)

### Community 33 - "Community 33"
Cohesion: 0.11
Nodes (26): AGES, ALERTNESS, BasicAvastha, basicAvasthas(), HADDA_BOUNDS, HADDA_LORDS, haddaLord(), HARSHA_CLASSES (+18 more)

### Community 34 - "Community 34"
Cohesion: 0.15
Nodes (12): pages(), scan(), visible_pages(), dump_chart(), labels_for(), main(), read_listview(), tcp_connections() (+4 more)

### Community 35 - "Community 35"
Cohesion: 0.09
Nodes (25): DREKKANA_TYPES, drekkanaType(), equalHousesMiddle(), grahaYuddha(), House, isCombust(), KARAKA_NAMES, LATTA_OFFSET (+17 more)

### Community 36 - "Community 36"
Cohesion: 0.21
Nodes (24): yogiPoints(), bhriguBindu(), CYCLE8, induLagna(), KALAS, lagnaAt(), planetPortions(), pranapadaLagna() (+16 more)

### Community 37 - "Community 37"
Cohesion: 0.13
Nodes (23): ANGA_LIMBS, ANGA_PARTS, CALENDAR_GOOD_TARA, CALENDAR_LEGEND, CalendarCell, calendarCellText(), CalendarOptions, CalendarRow (+15 more)

### Community 38 - "Community 38"
Cohesion: 0.14
Nodes (7): capture_chart(), reset(), capture_dasa_levels(), main(), Clipboard, record_draw(), Session

### Community 39 - "Community 39"
Cohesion: 0.10
Nodes (20): AV_BODIES, AvBody, navaTaras(), specialTaras(), AMSA_RULER_ROWS, ASYNC_TABLES, AV_MODES, DASA_LEVEL (+12 more)

### Community 40 - "Community 40"
Cohesion: 0.11
Nodes (20): ChakraChart, ARUDHA_LABELS, caption(), JHORA_VARGA_LONG_NAMES, MIXED_ARUDHA_X, MIXED_ARUDHA_Y, MIXED_DEFAULT_BODIES, MIXED_SLOT_X (+12 more)

### Community 41 - "Community 41"
Cohesion: 0.12
Nodes (22): CHOGHADIYAS, DUR1, DUR2, Element, elongation(), Fn, GULIKA, KARANA_OF_HALF (+14 more)

### Community 42 - "Community 42"
Cohesion: 0.11
Nodes (19): mod12(), muntha, MunthaBase, natalLon(), COMPOSITE_VARGAS, D12, D30_EVEN, D30_ODD (+11 more)

### Community 43 - "Community 43"
Cohesion: 0.18
Nodes (18): fmt(), parseIni(), specByKey, writeIni(), DEFAULTS, INI_SPEC, IniKeySpec, IniKind (+10 more)

### Community 44 - "Community 44"
Cohesion: 0.13
Nodes (18): defaultOtherIsGroom(), gunanka, MATCH_LEVELS, MATCH_NAKSHATRA_NAMES, MATCH_TITLE, matchHoroscopes(), MatchInput, matchLevel (+10 more)

### Community 45 - "Community 45"
Cohesion: 0.16
Nodes (15): JhoraIni, ChartStyle, AV_MODE_LABELS, AV_MODES, KEY_INFO_MODES, OTHER_STRENGTH_MODES, SUB_TABS, TOP_TABS (+7 more)

### Community 46 - "Community 46"
Cohesion: 0.19
Nodes (7): kill_harness_jhora(), main(), controls(), main(), run_case(), wait_dialog(), write_ini_overrides()

### Community 47 - "Community 47"
Cohesion: 0.16
Nodes (5): GdiTrace, check_ini(), controls(), main(), repaint()

### Community 48 - "Community 48"
Cohesion: 0.16
Nodes (16): placed(), SUD_HOUSE_X, SUD_HOUSE_Y, SUD_SLOT_X, SUD_SLOT_Y, SUDARSANA_MODE_BODIES, SUDARSANA_MODES, SUDARSANA_RINGS (+8 more)

### Community 49 - "Community 49"
Cohesion: 0.17
Nodes (11): SHORT_LABEL, dasaClock, YEAR_DEFINITIONS, YearDefinition, LAGHU_TABLES, PANCHANGA_JOBS, ayanamsaFromIndex(), AyanamsaId (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.19
Nodes (19): scanCrossing(), solveAngle(), wrap180(), annualSearch(), context(), lunarMonthAt(), PRAVESHA_BUTTON, PRAVESHA_SUFFIX (+11 more)

### Community 51 - "Community 51"
Cohesion: 0.16
Nodes (17): ORDINAL, SHORT, kpLords(), HOUSE_SYSTEMS, houseOptions, HouseRow, houseRows(), HouseSpan (+9 more)

### Community 52 - "Community 52"
Cohesion: 0.14
Nodes (15): dayText(), monthlyText(), pad2(), panchangaDays(), partsText(), SIGN_SHORT, timeText(), DAY_HEADERS (+7 more)

### Community 53 - "Community 53"
Cohesion: 0.18
Nodes (15): birthJdUt(), BasicOptions, computeTransitChart(), NatalRef, searchTol(), transitBirth(), VARGA_ORDER, prepare() (+7 more)

### Community 54 - "Community 54"
Cohesion: 0.20
Nodes (18): BASIC_MODES, CALENDAR_ITEMS, NATAL_REFS, VARGA_LABEL, STEPS, BasicTransitView(), BODIES, CAL_VARGAS (+10 more)

### Community 55 - "Community 55"
Cohesion: 0.14
Nodes (18): BODY_NAMES, bodyLon(), graha(), CORRELATION_PLANETS, CORRELATION_VARGA_LABEL, CORRELATION_VARGAS, CorrelationMatch, CorrelationOptions (+10 more)

### Community 56 - "Community 56"
Cohesion: 0.16
Nodes (13): KOTA_BENEFIC, KOTA_COL, KOTA_PALA, KOTA_ROW, KOTA_SLOT_X, KOTA_SLOT_Y, KOTA_ZONE_LABEL_POS, KOTA_ZONE_LABELS (+5 more)

### Community 57 - "Community 57"
Cohesion: 0.16
Nodes (16): ashtakavarga, AV_DEFAULT_OPTIONS, AV_PLANETS, AvOptions, bhinnashtakavargas(), ekadhipatyaSodhana(), GRAHA_MULT, OPTION_CELLS (+8 more)

### Community 58 - "Community 58"
Cohesion: 0.13
Nodes (13): KalachakraMode, KalachakraOptions, KalachakraStar, KC_DIKPALA, KC_MODE_TITLES, KC_SLOT_X, KC_SLOT_Y, KC_STAR_DIR (+5 more)

### Community 59 - "Community 59"
Cohesion: 0.16
Nodes (15): compoundRelation(), NATURAL_RAW, naturalRelation(), NINE, NODE_ROW, Relation, RELATION_NAMES, SEVEN (+7 more)

### Community 60 - "Community 60"
Cohesion: 0.21
Nodes (9): L(), mod(), NAKSHATRA_DASAS, nakshatraDasa(), NakshatraDasaDef, SAPTARSHI_TITLE, saptarshiDasa(), split() (+1 more)

### Community 61 - "Community 61"
Cohesion: 0.16
Nodes (15): BODIES, BODY_NAME, BODY_SHORT, bodyLon(), combos(), LAGHU_DEFAULTS, LAGHU_EXPLANATION, LAGHU_LAGNAS (+7 more)

### Community 63 - "Community 63"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 64 - "Community 64"
Cohesion: 0.19
Nodes (11): PRASNA_JOBS, ar(), Captured, Find, job(), MOMENT_TOL, MONTHS, mundane() (+3 more)

### Community 65 - "Community 65"
Cohesion: 0.21
Nodes (14): eventText(), formatAyanamsa(), formatHms(), karana(), keyInfoText(), localTime(), nakshatra(), pad2() (+6 more)

### Community 66 - "Community 66"
Cohesion: 0.21
Nodes (4): chart_view(), right_click(), ensure_front(), _work_area()

### Community 67 - "Community 67"
Cohesion: 0.21
Nodes (11): CHARA_KN_RAO_TITLE, charaKNRaoDasa(), charaKNRaoYears(), dirOf(), EVEN_MAP, NAVAMSA_TITLE, navamsaDasa(), startOf() (+3 more)

### Community 68 - "Community 68"
Cohesion: 0.24
Nodes (8): EngineClient, Pending, FromWorker, JobResult, ToWorker, Ctx, EngineProvider(), EngineState

### Community 69 - "Community 69"
Cohesion: 0.21
Nodes (11): JobState, DasaPane(), NAKSHATRA_DASA_SYSTEMS, NakshatraDasasView(), OTHER_DASA_SYSTEMS, OtherDasasView(), RASI_DASA_SYSTEMS, RasiDasasView() (+3 more)

### Community 70 - "Community 70"
Cohesion: 0.21
Nodes (7): ClaudeConversation, Conversation, OpenAIConversation, runAll(), startConversation(), ToolContext, JobRequest

### Community 71 - "Community 71"
Cohesion: 0.26
Nodes (11): avMode(), natalAv(), standard(), vedhaMatrix(), calendarVedha(), transitCalendar(), addDays(), bodySign() (+3 more)

### Community 72 - "Community 72"
Cohesion: 0.29
Nodes (9): stableStringify(), runText(), cache, cancelled, chartFor(), engine, fetchFile(), memo() (+1 more)

### Community 73 - "Community 73"
Cohesion: 0.27
Nodes (10): ChartBody, BodyList(), menuHandlers(), North(), NORTH_ANCHORS, NORTH_SHAPES, NORTH_SIGN_POS, Props (+2 more)

### Community 74 - "Community 74"
Cohesion: 0.31
Nodes (10): divide(), Kalachakra, KALACHAKRA_YEARS, kalachakraDasa(), padaLabel(), padaOf(), padaRow(), ROWS (+2 more)

### Community 75 - "Community 75"
Cohesion: 0.24
Nodes (10): BodySearch, jhoraCrossing(), jhoraRefine(), jump(), LAGNA_TOL, n360(), RANK, SearchOptions (+2 more)

### Community 76 - "Community 76"
Cohesion: 0.22
Nodes (11): addRunDependency(), createWasm(), receiveInstance(), receiveInstantiationResult(), findWasmBinary(), getWasmImports(), locateFile(), processData() (+3 more)

### Community 77 - "Community 77"
Cohesion: 0.24
Nodes (9): CANDIDATES, DIVISION, footedDirection(), ORDER, PARYAAYA_DEFAULT_VARGA, PARYAAYA_TITLE, paryaayaDasa, ParyaayaKind (+1 more)

### Community 78 - "Community 78"
Cohesion: 0.31
Nodes (7): createLazyFile(), stream_ops, writeChunks(), get_char(), mmap(), position(), read()

### Community 79 - "Community 79"
Cohesion: 0.25
Nodes (5): date, MODES, norm(), normRows(), View

### Community 80 - "Community 80"
Cohesion: 0.29
Nodes (6): ANGRET_BODIES, AngRetBody, AngularReturnInput, lagnaAt(), BODY_SHORT, siderealAscendant()

### Community 81 - "Community 81"
Cohesion: 0.47
Nodes (3): amsaRuler, nadiamsaDivision(), nadiamsaIndex()

### Community 82 - "Community 82"
Cohesion: 0.40
Nodes (5): Sahama, SahamaDef, sahamaTerms(), swap(), Term

### Community 84 - "Community 84"
Cohesion: 0.60
Nodes (4): bodySign(), parity(), VARNADA_TITLE, varnadaDasa()

### Community 85 - "Community 85"
Cohesion: 0.40
Nodes (5): abort(), getBinarySync(), getWasmBinary(), instantiateArrayBuffer(), instantiateAsync()

### Community 86 - "Community 86"
Cohesion: 0.40
Nodes (5): initRuntime(), postRun(), preRun(), run(), doRun()

### Community 87 - "Community 87"
Cohesion: 0.50
Nodes (4): ioctl_tcgets(), ioctl_tcsets(), ioctl_tiocgwinsz(), ___syscall_ioctl()

### Community 88 - "Community 88"
Cohesion: 0.67
Nodes (3): msync(), put_char(), write()

### Community 89 - "Community 89"
Cohesion: 1.00
Nodes (3): syncfs(), doCallback(), done()

## Knowledge Gaps
- **4 isolated node(s):** `@types/node`, `@types/react`, `@types/react-dom`, `typescript`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 744 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Graha` connect `Community 18` to `Community 3`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 11`, `Community 19`, `Community 22`, `Community 24`, `Community 25`, `Community 26`, `Community 28`, `Community 29`, `Community 32`, `Community 33`, `Community 35`, `Community 36`, `Community 37`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 48`, `Community 49`, `Community 51`, `Community 55`, `Community 57`, `Community 59`, `Community 60`, `Community 67`, `Community 73`, `Community 82`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `@types/node`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.018867924528301886 - nodes in this community are weakly interconnected._
- **Why does `Chart` connect `Community 22` to `Community 1`, `Community 3`, `Community 4`, `Community 6`, `Community 8`, `Community 9`, `Community 12`, `Community 13`, `Community 18`, `Community 19`, `Community 20`, `Community 23`, `Community 24`, `Community 26`, `Community 27`, `Community 28`, `Community 29`, `Community 32`, `Community 33`, `Community 35`, `Community 37`, `Community 39`, `Community 41`, `Community 42`, `Community 45`, `Community 49`, `Community 50`, `Community 51`, `Community 52`, `Community 53`, `Community 55`, `Community 59`, `Community 61`, `Community 64`, `Community 67`, `Community 72`, `Community 77`, `Community 80`, `Community 84`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1371584699453552 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Community 11` to `Community 2`, `Community 5`, `Community 9`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 25`, `Community 29`, `Community 31`, `Community 37`, `Community 39`, `Community 40`, `Community 43`, `Community 44`, `Community 48`, `Community 49`, `Community 56`, `Community 58`, `Community 60`, `Community 64`, `Community 79`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05367231638418079 - nodes in this community are weakly interconnected._