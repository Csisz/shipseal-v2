# DEPRECATED

Superseded by:

docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md

# 03 - ForrĂˇsleltĂˇr a csatolt ZIP-ek alapjĂˇn

## ĂttekintĂ©s

**NĂ©vkezelĂ©s:** a feltĂ¶ltĂ¶tt forrĂˇsokban mĂ©g elĹ‘fordulhat az `AgentReady`, `agentready-hub`, `AI2AI` Ă©s `VerdictMesh` nĂ©v. Ezek fejlesztĂ©si eredetkĂ©nt megmaradhatnak, de a vĂ©gtermĂ©k Ă©s a dokumentĂˇciĂł mĂˇr **ShipSeal** nĂ©ven fut.

A jelenlegi forrĂˇsok hĂˇrom kĂĽlĂ¶nĂˇllĂł, de Ă¶sszeĂ©pĂ­thetĹ‘ fĂ©lkĂ©sz projektet tartalmaznak. Ezeket nem Ă©rdemes Ă¶nĂˇllĂł termĂ©kkĂ©nt tovĂˇbbvinni, hanem egy egysĂ©ges ShipSeal termĂ©k komponenseikĂ©nt.

## 1. agentready-hub-main

### Jelenlegi szerep

Ez a legkĂ¶zelebb Ăˇll a vĂ©gsĹ‘ ShipSeal termĂ©khez. Egy React/Vite/shadcn alapĂş lokĂˇlis webapp, amely repository ZIP-et vagy publikus GitHub repĂłt elemez, ShipSeal Readiness Score-t szĂˇmol, blokkolĂłkat jelez, Ă©s ĂˇtadĂˇsi fĂˇjlokat generĂˇl.

### TechnolĂłgia

- React
- Vite
- TypeScript
- shadcn/ui / Radix UI
- JSZip
- Vitest
- Tailwind
- localStorage metadata history

### MĂˇr mĹ±kĂ¶dĹ‘ kĂ©pessĂ©gek a README Ă©s kĂłd alapjĂˇn

- ZIP upload scanning bĂ¶ngĂ©szĹ‘ben.
- Publikus GitHub repo import prĂłbĂˇlkozĂˇs bĂ¶ngĂ©szĹ‘bĹ‘l.
- ManuĂˇlis ZIP fallback.
- Determinisztikus readiness score.
- Critical blocker logika.
- AI readiness narrative lokĂˇlis, template-alapĂş providerrel.
- Agent Pack export.
- MCP Governance Pack export.
- Sanitized Repo Context Pack export.
- Teljes ZIP export.
- Metadata-only recent scan history.
- No-code-execution safety elv.

### GenerĂˇlt fĂˇjlok

A kĂłdban Ă©s export logikĂˇban az alĂˇbbi Agent Pack fĂˇjlok szerepelnek:

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

### ErĹ‘ssĂ©gek

- MĂˇr van termĂ©kszerĹ± frontend.
- MĂˇr termĂ©kszerĹ± frontendkĂ©nt hasznĂˇlhatĂł, de mĂˇrkanĂ©v szerint Ăˇt kell nevezni ShipSealre.
- A lokĂˇlis/privĂˇt scanning jĂł privacy ĂĽzenet.
- Determinisztikus scoring jĂł alap a bizalomhoz.
- ExportĂˇlhatĂł outputok mĂˇr vannak.
- MCP governance irĂˇny mĂˇr megjelent.

### HiĂˇnyossĂˇgok

- Nincs backend.
- Nincs auth.
- Nincs fizetĂ©s.
- Nincs adatbĂˇzis.
- Nincs private repo GitHub App.
- Nincs valĂłdi AI provider integrĂˇciĂł.
- Nincs PDF report export.
- Nincs EU AI Act readiness modul.
- Nincs Skills Pack generĂˇlĂˇs.
- Nincs VerdictMesh / Review Council integrĂˇciĂł.
- A scoring jelenleg fĹ‘leg repo metadata Ă©s file presence jellegĹ±, nem valĂłdi futtatott teszt.

### Mit hasznĂˇljunk fel belĹ‘le?

Ezt vegyĂĽk alap frontendnek Ă©s elsĹ‘ scanner engine-nek. A meglĂ©vĹ‘ pack-generĂˇlĂˇst bĹ‘vĂ­tsĂĽk:

- Skills Pack,
- AI Act readiness,
- red-team/eval pack,
- customer handoff report,
- PDF export,
- VerdictMesh council review.

## 2. ai2ai-main

### Jelenlegi szerep

Ez egy Python alapĂş multi-model Expert Council / AI Debate rendszer. TĂ¶bb AI modellt szervez strukturĂˇlt vitĂˇba, majd vĂ©gsĹ‘ szintĂ©zist, meeting reportot, transcriptet, docx/markdown outputokat kĂ©szĂ­t.

### TechnolĂłgia

- Python
- opcionĂˇlis FastAPI / Uvicorn API
- provider adapterek: OpenAI, Anthropic, Gemini, OpenAI-compatible
- modularizĂˇlt `ai2ai/` package
- CLI belĂ©pĂ©si pont: `ai_debate.py`
- output contracts
- regression test logika

### MĂˇr mĹ±kĂ¶dĹ‘ / dokumentĂˇlt kĂ©pessĂ©gek

- ForrĂˇsanyagok betĂ¶ltĂ©se: ZIP, folder, docx, pdf, markdown, code, json, yaml, kĂ©pek.
- Evidence Pack kĂ©szĂ­tĂ©s.
- FĂĽggetlen modellvĂ©lemĂ©nyek.
- Issue Matrix.
- CĂ©lzott rebuttal.
- Revision JSON.
- Final Judge.
- Contract-aware synthesis.
- Markdown synthesis.
- Meeting report.
- Transcript.
- Debate log.
- OpcionĂˇlis API rĂ©teg.
- Regression test pipeline.

### ErĹ‘ssĂ©gek

- Ez adhatja a ShipSeal Review Council / VerdictMesh motorjĂˇt.
- MĂˇr megvan a tĂ¶bbfĂˇzisĂş gondolkodĂˇsi logika.
- JĂł a szerepalapĂş review-ra: QA, security, compliance, business, skeptical customer.
- JĂł output-szerkezetekhez Ă©s dokumentumgenerĂˇlĂˇshoz.
- MĂˇr van modularizĂˇlt backend alap.

### HiĂˇnyossĂˇgok

- Nagyon nagy CLI file is jelen van (`ai2ai/cli.py` jelentĹ‘s mĂ©retĹ±), tovĂˇbbi tisztĂ­tĂˇs kellhet.
- Provider adapterek rĂ©szben stub/korai ĂˇllapotĂşak lehetnek.
- Nem ShipSeal-specifikus mĂ©g.
- Az API opcionĂˇlis, nem production backend.
- Auth, queue, storage, billing nincs.
- Nem kĂ¶zvetlenĂĽl UI-barĂˇt report engine.

### Mit hasznĂˇljunk fel belĹ‘le?

Az AI2AI legyen a ShipSeal egyik backend modulja:

- `ReviewCouncilService`,
- `EvidencePackBuilder`,
- `RoleBasedReviewer`,
- `FinalJudge`,
- `ReportSynthesizer`.

A meglĂ©vĹ‘ debate logikĂˇt szĹ±kĂ­teni kell ShipSeal cĂ©lokra. Nem kell minden scenario az MVP-be.

## 3. verdictmesh-main

### Jelenlegi szerep

Ez egy Base44-exportĂˇlt Vite/React frontend, amely a lokĂˇlis AI2AI backendhez tud kapcsolĂłdni. A cĂ©lja a modellek kĂ¶zĂ¶tti debate / council folyamat vizuĂˇlis megjelenĂ­tĂ©se.

### TechnolĂłgia

- React
- Vite
- JavaScript / JSX
- Base44 SDK opcionĂˇlisan
- Tailwind / shadcn/Radix UI
- Framer Motion
- React Markdown
- jspdf / html2canvas dependency is jelen van
- API client: `src/api/ai2aiClient.js`

### MĂˇr meglĂ©vĹ‘ kĂ©pessĂ©gek

- Launch kĂ©pernyĹ‘ backend vagy demo mĂłddal.
- AI2AI API integrĂˇciĂł.
- Verdict oldal, amely session metadata, validation status, artifact path Ă©s synthesis output megjelenĂ­tĂ©sĂ©re alkalmas.
- VizuĂˇlis council/debate komponensek:
  - CouncilChatFeed,
  - CouncilCompletionCard,
  - CouncilRightRail,
  - CouncilStatusBar,
  - DebateMetricsBar,
  - LiveDebateGraph,
  - LiveEventFeed,
  - LiveModelCard,
  - LiveTranscript.

### ErĹ‘ssĂ©gek

- LĂˇtvĂˇnyos UI alap a Review Council funkciĂłhoz.
- MĂˇr kapcsolĂłdik az AI2AI backendhez.
- JĂł demoĂ©rtĂ©k: megmutatja, hogy tĂ¶bb szerep Ă©rtĂ©keli a projektet.
- A VerdictMesh nĂ©v hasznĂˇlhatĂł belsĹ‘ motornĂ©vkĂ©nt.

### HiĂˇnyossĂˇgok

- Base44-exportĂˇlt, tisztĂ­tĂˇsra szorulhat.
- JavaScript, mikĂ¶zben ShipSeal TypeScript; egysĂ©gesĂ­tĂ©s kell.
- KĂĽlĂ¶n frontendkĂ©nt nem cĂ©lszerĹ± tovĂˇbbvinni.
- Auth/demo flow Ă©s Base44 maradvĂˇnyok termĂ©kbe emelĂ©s elĹ‘tt rendezendĹ‘k.
- Nincs kĂ¶zĂ¶s design system a ShipSeal frontenddel.

### Mit hasznĂˇljunk fel belĹ‘le?

Nem Ă¶nĂˇllĂł termĂ©kkĂ©nt. HasznĂˇljuk:

- Review Council vizualizĂˇciĂłs komponensek inspirĂˇciĂłjakĂ©nt,
- Verdict oldal alapgondolatkĂ©nt,
- AI2AI API client mintakĂ©nt,
- Ă©lĹ‘ debate / council demo UI rĂ©szletekĂ©nt.

## Ă–sszesĂ­tett komponens-tĂ©rkĂ©p

| VĂ©gsĹ‘ ShipSeal modul | FelhasznĂˇlhatĂł forrĂˇs |
|---|---|
| Repo scanner | agentready-hub |
| Agent Pack generĂˇtor | agentready-hub |
| MCP Governance Pack | agentready-hub |
| Repo Context Pack | agentready-hub |
| Review Council / multi-agent review | ai2ai-main |
| Evidence Pack | ai2ai-main |
| Final Judge / synthesis | ai2ai-main |
| Debate / council visual UI | verdictmesh-main |
| Backend API minta | ai2ai-main + verdictmesh-main |
| Product landing Ă©s upload UI | agentready-hub |

## Javasolt Ăşj repo-struktĂşra

```text
shipseal/
  apps/
    web/                    # ShipSeal frontend, TypeScript, Vite/React
    api/                    # FastAPI vagy Node backend kĂ©sĹ‘bb
  packages/
    scanner/                # repo scanner Ă©s scoring
    pack-generator/         # AGENTS, CLAUDE, skills, MCP, reports
    review-council/         # AI2AI/VerdictMesh logika szĹ±kĂ­tve
    ai-act-readiness/       # checklist, questions, transparency drafts
    report-renderer/        # Markdown/PDF/DOCX export kĂ©sĹ‘bb
  docs/
    product/
    architecture/
    legal/
    sales/
  examples/
    sample-ai-apps/
    sample-reports/
```

## ElsĹ‘ migrĂˇciĂłs dĂ¶ntĂ©s

A leggyorsabb Ăşt: ne monorepo-migrĂˇciĂłval kezdjĂĽnk. ElĹ‘szĂ¶r az `agentready-hub` repĂłt vigyĂĽk tovĂˇbb Ăşj branchben, Ă©s importĂˇljunk be belĹ‘le funkciĂłkat:

1. Az agentready-hub frontend marad az alap, ShipSealre Ăˇtnevezve.
2. AI2AI-t kĂĽlĂ¶n backend service-kĂ©nt kapcsoljuk.
3. VerdictMesh komponenseket csak kĂ©sĹ‘bb emeljĂĽk Ăˇt.
4. A report output-spec legyen elĹ‘bb kĂ©sz, mint a nagy architektĂşra.

## Statikus vizsgĂˇlat korlĂˇtja

A ZIP-eket forrĂˇs- Ă©s dokumentĂˇciĂłszinten nĂ©ztĂĽk Ăˇt. Buildet, tesztet, dependency auditot Ă©s runtime futtatĂˇst ebben a dokumentumkĂ©szĂ­tĂ©si lĂ©pĂ©sben nem vĂ©geztĂĽnk. A kĂ¶vetkezĹ‘ fejlesztĂ©si lĂ©pĂ©sben kĂĽlĂ¶n technikai smoke test szĂĽksĂ©ges.
