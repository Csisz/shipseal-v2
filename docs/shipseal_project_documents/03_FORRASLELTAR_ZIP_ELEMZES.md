# 03 - Forrásleltár a csatolt ZIP-ek alapján

## Áttekintés

**Névkezelés:** a feltöltött forrásokban még előfordulhat az `AgentReady`, `agentready-hub`, `AI2AI` és `VerdictMesh` név. Ezek fejlesztési eredetként megmaradhatnak, de a végtermék és a dokumentáció már **ShipSeal** néven fut.

A jelenlegi források három különálló, de összeépíthető félkész projektet tartalmaznak. Ezeket nem érdemes önálló termékként továbbvinni, hanem egy egységes ShipSeal termék komponenseiként.

## 1. agentready-hub-main

### Jelenlegi szerep

Ez a legközelebb áll a végső ShipSeal termékhez. Egy React/Vite/shadcn alapú lokális webapp, amely repository ZIP-et vagy publikus GitHub repót elemez, ShipSeal Readiness Score-t számol, blokkolókat jelez, és átadási fájlokat generál.

### Technológia

- React
- Vite
- TypeScript
- shadcn/ui / Radix UI
- JSZip
- Vitest
- Tailwind
- localStorage metadata history

### Már működő képességek a README és kód alapján

- ZIP upload scanning böngészőben.
- Publikus GitHub repo import próbálkozás böngészőből.
- Manuális ZIP fallback.
- Determinisztikus readiness score.
- Critical blocker logika.
- AI readiness narrative lokális, template-alapú providerrel.
- Agent Pack export.
- MCP Governance Pack export.
- Sanitized Repo Context Pack export.
- Teljes ZIP export.
- Metadata-only recent scan history.
- No-code-execution safety elv.

### Generált fájlok

A kódban és export logikában az alábbi Agent Pack fájlok szerepelnek:

- `AGENTS.md`
- `CLAUDE.md`
- `CODEX_PROMPTS.md`
- `REVIEWER_PROMPT.md`
- `SECURITY_REVIEW.md`
- `TESTING_STRATEGY.md`
- `CI_QUALITY_GATE.yml`
- `AGENT_READINESS_REPORT.md`

Az MCP packban:

- `MCP_READINESS.md`
- `MCP_SECURITY_POLICY.md`
- `MCP_SERVER_RECOMMENDATIONS.md`
- `MCP_TOOL_ALLOWLIST.md`

A context packban:

- `REPO_CONTEXT_PACK.md`
- `repo-context-pack.json`

### Erősségek

- Már van termékszerű frontend.
- Már termékszerű frontendként használható, de márkanév szerint át kell nevezni ShipSealre.
- A lokális/privát scanning jó privacy üzenet.
- Determinisztikus scoring jó alap a bizalomhoz.
- Exportálható outputok már vannak.
- MCP governance irány már megjelent.

### Hiányosságok

- Nincs backend.
- Nincs auth.
- Nincs fizetés.
- Nincs adatbázis.
- Nincs private repo GitHub App.
- Nincs valódi AI provider integráció.
- Nincs PDF report export.
- Nincs EU AI Act readiness modul.
- Nincs Skills Pack generálás.
- Nincs VerdictMesh / Review Council integráció.
- A scoring jelenleg főleg repo metadata és file presence jellegű, nem valódi futtatott teszt.

### Mit használjunk fel belőle?

Ezt vegyük alap frontendnek és első scanner engine-nek. A meglévő pack-generálást bővítsük:

- Skills Pack,
- AI Act readiness,
- red-team/eval pack,
- customer handoff report,
- PDF export,
- VerdictMesh council review.

## 2. ai2ai-main

### Jelenlegi szerep

Ez egy Python alapú multi-model Expert Council / AI Debate rendszer. Több AI modellt szervez strukturált vitába, majd végső szintézist, meeting reportot, transcriptet, docx/markdown outputokat készít.

### Technológia

- Python
- opcionális FastAPI / Uvicorn API
- provider adapterek: OpenAI, Anthropic, Gemini, OpenAI-compatible
- modularizált `ai2ai/` package
- CLI belépési pont: `ai_debate.py`
- output contracts
- regression test logika

### Már működő / dokumentált képességek

- Forrásanyagok betöltése: ZIP, folder, docx, pdf, markdown, code, json, yaml, képek.
- Evidence Pack készítés.
- Független modellvélemények.
- Issue Matrix.
- Célzott rebuttal.
- Revision JSON.
- Final Judge.
- Contract-aware synthesis.
- Markdown synthesis.
- Meeting report.
- Transcript.
- Debate log.
- Opcionális API réteg.
- Regression test pipeline.

### Erősségek

- Ez adhatja a ShipSeal Review Council / VerdictMesh motorját.
- Már megvan a többfázisú gondolkodási logika.
- Jó a szerepalapú review-ra: QA, security, compliance, business, skeptical customer.
- Jó output-szerkezetekhez és dokumentumgeneráláshoz.
- Már van modularizált backend alap.

### Hiányosságok

- Nagyon nagy CLI file is jelen van (`ai2ai/cli.py` jelentős méretű), további tisztítás kellhet.
- Provider adapterek részben stub/korai állapotúak lehetnek.
- Nem ShipSeal-specifikus még.
- Az API opcionális, nem production backend.
- Auth, queue, storage, billing nincs.
- Nem közvetlenül UI-barát report engine.

### Mit használjunk fel belőle?

Az AI2AI legyen a ShipSeal egyik backend modulja:

- `ReviewCouncilService`,
- `EvidencePackBuilder`,
- `RoleBasedReviewer`,
- `FinalJudge`,
- `ReportSynthesizer`.

A meglévő debate logikát szűkíteni kell ShipSeal célokra. Nem kell minden scenario az MVP-be.

## 3. verdictmesh-main

### Jelenlegi szerep

Ez egy Base44-exportált Vite/React frontend, amely a lokális AI2AI backendhez tud kapcsolódni. A célja a modellek közötti debate / council folyamat vizuális megjelenítése.

### Technológia

- React
- Vite
- JavaScript / JSX
- Base44 SDK opcionálisan
- Tailwind / shadcn/Radix UI
- Framer Motion
- React Markdown
- jspdf / html2canvas dependency is jelen van
- API client: `src/api/ai2aiClient.js`

### Már meglévő képességek

- Launch képernyő backend vagy demo móddal.
- AI2AI API integráció.
- Verdict oldal, amely session metadata, validation status, artifact path és synthesis output megjelenítésére alkalmas.
- Vizuális council/debate komponensek:
  - CouncilChatFeed,
  - CouncilCompletionCard,
  - CouncilRightRail,
  - CouncilStatusBar,
  - DebateMetricsBar,
  - LiveDebateGraph,
  - LiveEventFeed,
  - LiveModelCard,
  - LiveTranscript.

### Erősségek

- Látványos UI alap a Review Council funkcióhoz.
- Már kapcsolódik az AI2AI backendhez.
- Jó demoérték: megmutatja, hogy több szerep értékeli a projektet.
- A VerdictMesh név használható belső motornévként.

### Hiányosságok

- Base44-exportált, tisztításra szorulhat.
- JavaScript, miközben ShipSeal TypeScript; egységesítés kell.
- Külön frontendként nem célszerű továbbvinni.
- Auth/demo flow és Base44 maradványok termékbe emelés előtt rendezendők.
- Nincs közös design system a ShipSeal frontenddel.

### Mit használjunk fel belőle?

Nem önálló termékként. Használjuk:

- Review Council vizualizációs komponensek inspirációjaként,
- Verdict oldal alapgondolatként,
- AI2AI API client mintaként,
- élő debate / council demo UI részleteként.

## Összesített komponens-térkép

| Végső ShipSeal modul | Felhasználható forrás |
|---|---|
| Repo scanner | agentready-hub |
| Agent Pack generátor | agentready-hub |
| MCP Governance Pack | agentready-hub |
| Repo Context Pack | agentready-hub |
| Review Council / multi-agent review | ai2ai-main |
| Evidence Pack | ai2ai-main |
| Final Judge / synthesis | ai2ai-main |
| Debate / council visual UI | verdictmesh-main |
| Backend API minta | ai2ai-main + verdictmesh-main |
| Product landing és upload UI | agentready-hub |

## Javasolt új repo-struktúra

```text
shipseal/
  apps/
    web/                    # ShipSeal frontend, TypeScript, Vite/React
    api/                    # FastAPI vagy Node backend később
  packages/
    scanner/                # repo scanner és scoring
    pack-generator/         # AGENTS, CLAUDE, skills, MCP, reports
    review-council/         # AI2AI/VerdictMesh logika szűkítve
    ai-act-readiness/       # checklist, questions, transparency drafts
    report-renderer/        # Markdown/PDF/DOCX export később
  docs/
    product/
    architecture/
    legal/
    sales/
  examples/
    sample-ai-apps/
    sample-reports/
```

## Első migrációs döntés

A leggyorsabb út: ne monorepo-migrációval kezdjünk. Először az `agentready-hub` repót vigyük tovább új branchben, és importáljunk be belőle funkciókat:

1. Az agentready-hub frontend marad az alap, ShipSealre átnevezve.
2. AI2AI-t külön backend service-ként kapcsoljuk.
3. VerdictMesh komponenseket csak később emeljük át.
4. A report output-spec legyen előbb kész, mint a nagy architektúra.

## Statikus vizsgálat korlátja

A ZIP-eket forrás- és dokumentációszinten néztük át. Buildet, tesztet, dependency auditot és runtime futtatást ebben a dokumentumkészítési lépésben nem végeztünk. A következő fejlesztési lépésben külön technikai smoke test szükséges.