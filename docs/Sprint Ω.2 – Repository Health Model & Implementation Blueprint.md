Sprint Ω.2 – Repository Health Model & Implementation Blueprint
1. Ellenőrzött jelenlegi állapot
A handoffban leírt új irány következetes és alkalmas a ShipSeal új termékidentitásának: AI Repository Intelligence Platform, ahol a Delivery Pack fontos kimenet, de nem maga a termék.
Amit a forrás ténylegesen tartalmaz
A következő elemek valóban implementálva vannak:
•	ZIP-, public GitHub- és GitHub App-alapú repository scan.
•	Teljes fájlútvonal- és fájlméret-leltár.
•	Generated/vendor és bináris fájlok felismerése és kizárása.
•	Korlátozott, méretlimites szövegolvasás Markdown-, JSON-, YAML-, TOML- és konfigurációs fájlokból.
•	Stack-, framework-, package manager-, script- és test framework-felismerés.
•	Determinisztikus readiness score.
•	Scan evidence és limited scan elkülönítés.
•	Agent Operating Mode.
•	Context Compression fájlok.
•	Folder-level AGENTS.md javaslatok.
•	Specialized Context Packs.
•	Skill- és MCP-ajánlások.
•	Dashboard, HTML/PDF riport, manifest, Delivery Pack ZIP és score.json.
•	Célcsomagokhoz igazított outputlista.
A releváns fő implementációs pontok:
•	scanner: src/lib/scanner.ts
•	scan limitek és exclusions: src/lib/scannerLimits.ts
•	stack detection: src/lib/stack.ts
•	jelenlegi scoring: src/lib/scoring.ts
•	report összeállítás: src/lib/readiness.ts
•	repository summary: src/lib/repositorySummary.ts
•	context pack: src/lib/repoContextPack.ts
•	context compression: src/lib/deliveryPack/contextCompression.ts
•	dashboard: src/components/agentready/ResultDashboard.tsx
•	export és score.json: src/lib/exports.ts
•	Delivery Pack manifest: src/lib/deliveryPack/manifest.ts
•	HTML/PDF riport: src/lib/report/
Technikai ellenőrzés
•	npm run build: sikeres.
•	A scoring-, dashboard-, PDF/HTML- és Delivery Pack-folyamatokra fókuszáló tesztcsomag: 113/113 teszt sikeres.
•	A teljes tesztfuttatás ebben a környezetben nem jutott el a végső összesítésig az időkorlát előtt, ezért azt nem nevezem igazolt teljesen zöld futásnak.
•	Az npm ci audit 20 dependency sérülékenységet jelzett, köztük egy kritikust. Ez nem része közvetlenül az Ω.2 modellnek, de külön dependency-health feladatként kezelendő.
________________________________________
2. A jelenlegi scoring korlátai
A mostani fő score még a korábbi readiness modell.
A src/lib/scoring.ts hat kategóriát használ:
1.	Project structure & documentation
2.	Build, test & quality gates
3.	AI agent instruction readiness
4.	Security & secret handling
5.	Token efficiency & context engineering
6.	Team workflow & governance
Ez jó kiindulási adatforrás, de nem azonos a tervezett Repository Health modellel.
Fontos problémák
2.1 A „Token efficiency” jelenleg nem valódi context-waste mérés
A jelenlegi kategória főként ezeket ellenőrzi:
•	van-e forrásmappa;
•	azonosítható-e belépési pont;
•	van-e README;
•	dominálják-e generated/vendor fájlok a repositoryt;
•	készíthető-e egyszerű modulmap.
Nem vizsgálja még:
•	a dokumentációs duplikációt;
•	a túlméretes releváns fájlokat;
•	a párhuzamos source-of-truth dokumentumokat;
•	a folder-level instruction coverage-et;
•	az aktív és archivált dokumentáció elkülönítését;
•	a bizonytalan routingot;
•	a kontextusfelület tényleges szerkezeti nagyságát.
2.2 Bizonyos signalok túl megengedők
Például jelenleg bármilyen docs/ mappa elegendő lehet az architecture documentation signalhoz. Ez akkor is pozitív eredményt adhat, ha a mappában nincs tényleges architektúraleírás.
2.3 A generálhatóság néha meglévő readinessként számít
A jelenlegi score részpontot adhat az AGENTS.md-re, ha a rendszer úgy ítéli meg, hogy az generálható README és stack manifest alapján.
Az új modellben ezt szét kell választani:
•	current state: mi van most ténylegesen a repositoryban;
•	ShipSeal opportunity: mit tud a ShipSeal létrehozni;
•	projected state: milyen lehetne az állapot a javaslatok alkalmazása után.
A generálható fájl nem számíthat meglévő repository health signalnak.
2.4 A context-generátorok részben csonkolt fájllistából dolgoznak
A repoContextPack.sampleFiles csak az első 40 releváns fájlt tartja meg. A Context Compression és a tooling recommendation logika több helyen ebből dolgozik.
Ezért egy később felsorolt fontos fájl kimaradhat:
•	a critical file listából;
•	a task routerből;
•	a tooling recommendation evidence-ből;
•	a folder routingból.
A Repository Health signalokat közvetlenül a teljes RepoScanInput.files leltárból kell kiszámítani, még a report összeállításakor.
2.5 A limited fallback nem használható új health score-hoz
A fallback scan mesterségesen létrehoz néhány mintafájlt, hogy a UI működőképes maradjon.
Az új modell ezt nem pontozhatja valódi repositoryként. Ilyenkor:
Repository Health: Insufficient evidence
állapot szükséges, nem egy mesterségesen alacsony vagy magas health score.
2.6 Dokumentációs source-of-truth drift már most is látható
A július 2-i positioning és vision dokumentumok már AI Repository Intelligence / Agent Efficiency irányúak, miközben a régebbi sellable product backlog még nagyrészt Delivery Pack generátorként definiálja a terméket.
A roadmap már Agent Efficiency Analytics és Context Waste score irányt tartalmaz, de még nem definiálja a determinisztikus modellt.
Ez jó dogfood példa arra, amit a Context Waste modellnek később jeleznie kell: több aktívnak látszó stratégiai dokumentum eltérő elsődleges pozicionálással.
________________________________________
3. Javasolt Repository Health adatmodell
A Repository Health ne a jelenlegi readiness score egyszerű átnevezése legyen.
Új, verziózott modell szükséges:
interface RepositoryHealthModel {
  modelVersion: 'repository-health-v1';
  measurementMethod: 'deterministic-static-scan';

  overall: {
    score: number | null;
    status:
      | 'AI-ready workspace'
      | 'Workable with optimization'
      | 'Fragmented workspace'
      | 'High agent friction'
      | 'Blocked'
      | 'Insufficient evidence';
    confidence: 'High' | 'Medium' | 'Low';
  };

  dimensions: {
    repositoryIntelligence: HealthDimension;
    contextWaste: ContextWasteDimension;
    aiDevelopmentReadiness: HealthDimension;
    agentRouting: HealthDimension;
    deliveryConfidence: HealthDimension;
  };

  blockers: HealthBlocker[];
  topActions: HealthRecommendation[];
  measurementBoundary: string[];
}
Minden signal egységes szerkezetű legyen:
interface HealthSignal {
  id: string;
  dimension: string;
  label: string;

  status:
    | 'pass'
    | 'partial'
    | 'fail'
    | 'unknown'
    | 'not-applicable';

  weight: number;
  earned: number;

  evidence: string[];
  recommendationId?: string;
}
Pontszámítás
Egy dimenzió pontszáma:
dimension score =
round(
  100 × összes megszerzett pont
      / összes alkalmazható signal súlya
)
A not-applicable signal nem kerül a nevezőbe.
Az unknown nem egyenlő automatikusan a hibával. Csökkenti a confidence szintet, és szükség esetén megakadályozza az overall score publikálását.
________________________________________
4. Overall Repository Health formula
Javasolt súlyozás:
Dimenzió	Overall súly
Repository Intelligence	25%
Context Efficiency	20%
AI Development Readiness	25%
Agent Routing	15%
Delivery Confidence	15%
A Context Waste esetén a felhasználónak a kockázatot mutatjuk:
Context Waste Risk: 0–100
0 = alacsony kockázat
100 = nagyon magas kockázat
Az overall képletben ennek inverze szerepel:
context efficiency = 100 - context waste risk
overall =
0.25 × Repository Intelligence
+ 0.20 × Context Efficiency
+ 0.25 × AI Development Readiness
+ 0.15 × Agent Routing
+ 0.15 × Delivery Confidence
Overall státuszok
Score	Státusz
85–100	AI-ready workspace
70–84	Workable with optimization
50–69	Fragmented workspace
0–49	High agent friction
Külön státuszok:
•	Blocked: kritikus secret-, trust- vagy biztonsági blocker.
•	Insufficient evidence: limited fallback vagy nem értékelhető scan.
Az „AgentReady Certified” elnevezést az új modellből érdemes elhagyni, mert formális tanúsítás érzetét keltheti.
________________________________________
5. Repository Intelligence Score
Mit mér?
Mennyire áll rendelkezésre strukturált, tartós és újrahasználható projekttudás egy új AI-agent számára?
Signal	Súly	Determinisztikus szabály
Projektidentitás és cél	15	README megléte, valamint purpose/overview/features/about tartalom
Setup és command guidance	15	install/setup/run szekció és ténylegesen észlelt parancsok
Architektúra vagy rendszertérkép	15	tényleges ARCHITECTURE, SYSTEM_DESIGN, docs/architecture jellegű dokumentum
Globális agent instructions	15	root AGENTS.md, CLAUDE.md, Cursor/Codex szabályok
Fejlesztési szabályok	10	CONTRIBUTING, development policy vagy change policy
Ownership, critical files és ismert kockázatok	15	CODEOWNERS/OWNERSHIP, critical files policy, known risks
Canonical context és routing layer	15	docs index, command map, task router vagy tartós project memory
Új detection szabályok
•	Egy docs/ mappa önmagában nem számít architecture signalnak.
•	A root és nested instruction fájlokat külön kell számolni.
•	A ShipSeal által generált Delivery Pack fájlok nem növelhetik a pre-scan score-t.
•	Az aktív repositoryban már meglévő ShipSeal fájlok természetesen számíthatnak, ha egy későbbi scan során tényleges forrásfájlként jelennek meg.
________________________________________
6. Context Waste Risk
Mit mér?
Mekkora szerkezeti kockázata van annak, hogy egy AI-agent szükségtelenül sok, duplikált, irreleváns vagy bizonytalan kontextust dolgoz fel?
Ez heurisztikus repository risk score, nem tényleges tokenszámláló.
Kockázati signal	Maximum kockázati pont
Generated/vendor noise	20
Túlméretes releváns fájlok	15
Pontosan duplikált dokumentáció	15
Aktív dokumentációs sprawl	15
Source-of-truth ambiguity	15
Hiányzó compact context layer	10
Routing- és entry-point ambiguity	10
6.1 Generated/vendor noise
Számítandó:
fileNoiseRatio = generatedVendorFileCount / totalFileCount
byteNoiseRatio = generatedVendorBytes / totalBytes
noiseRatio = max(fileNoiseRatio, byteNoiseRatio)
Noise ratio	Kockázat
≤1%	0
>1–10%	5
>10–30%	10
>30–50%	15
>50%	20
Evidence példa:
1,842 of 2,400 files are under node_modules or dist.
Generated/vendor content represents 74% of archive bytes.
6.2 Túlméretes releváns fájlok
Generated és binary fájlok nélkül:
•	source file: 100 KB felett large;
•	dokumentáció: 150 KB felett large;
•	konfiguráció: 300 KB felett large;
•	500 KB felett giant.
Javasolt pontozás:
risk = min(15, largeFileCount × 2 + giantFileCount × 3)
Ez nem állítja, hogy az agent biztosan megnyitja ezeket. Azt jelzi, hogy nagy, nehezen szeletelhető kontextusfelületek találhatók.
6.3 Dokumentációs duplikáció
A scanner már beolvassa a Markdown- és textfájlok tartalmát.
Új derived signal:
1.	whitespace normalizálása;
2.	generált ShipSeal header és dátumsorok eltávolítása;
3.	kisbetűsítés;
4.	SHA-256 vagy stabil lokális hash;
5.	azonos hashű aktív dokumentumok csoportosítása.
Pontozás a duplikált dokumentációs byte-arány alapján:
Duplikált doc byte ratio	Kockázat
0%	0
>0–10%	5
>10–30%	10
>30%	15
A near-duplicate szemantikai elemzés nem szükséges az MVP-ben.
6.4 Aktív documentation sprawl
Először külön kell választani:
•	aktív dokumentáció;
•	karanténozott dokumentáció: legacy/, archive/, deprecated/, old/.
A karanténozott dokumentum önmagában nem büntetendő ugyanúgy, mint az aktív, párhuzamos dokumentáció.
Aktív dokumentumok	Docs index nélkül
≤10	0
11–25	5
26–50	10
>50	15
Ha van egyértelmű docs/README.md, docs/INDEX.md vagy canonical documentation map, a kockázat felezhető.
6.5 Source-of-truth ambiguity
Dokumentumcsaládok:
•	README
•	ARCHITECTURE
•	ROADMAP
•	SECURITY
•	CONTRIBUTING
•	POSITIONING
•	PRODUCT_VISION
•	AGENTS ugyanazon folder scope-on belül
Minden olyan dokumentumcsalád, amelynek egy aktív scope-ban több canonical jelöltje van:
+3 risk, maximum 15
A docs/legacy/ alatti példány nem számít aktív konfliktusnak.
6.6 Hiányzó compact context layer
Állapot	Kockázat
nincs agent instruction, architecture summary vagy task router	10
csak egy ilyen context anchor van	5
legalább két, egymást kiegészítő context anchor van	0
6.7 Routing ambiguity
Felismerendő lehetséges entry pointok:
•	src/main.*
•	src/index.*
•	app/page.*
•	pages/index.*
•	main.py
•	manage.py
•	cmd/*/main.go
•	server/bootstrap entry pointok
•	több package manifest monorepóban
Állapot	Kockázat
egyértelmű entry point vagy router	0
2–3 belépési pont, router nélkül	5
4 vagy több belépési pont, router és folder guidance nélkül	10
________________________________________
7. AI Development Readiness Score
Mit mér?
Mennyire biztonságosan és ellenőrizhetően tud egy AI-agent módosítást készíteni?
Signal	Súly
Felismerhető stack/manifest	10
Lockfile és package manager	6
Build command	12
Test command és testfájlok	16
Lint	8
Typecheck	8
CI workflow	12
Env és secret hygiene	12
Verification strategy	8
Deployment/rollback guidance	8
Fontos szabályok
•	A script jelenléte nem jelenti, hogy a parancs sikeresen lefutott.
•	A CI fájl jelenléte nem jelenti, hogy a CI zöld.
•	A tesztfájl jelenléte nem jelenti, hogy a tesztek jók vagy lefutnak.
•	Minden ilyen signal megnevezése legyen például:
Declared build command found
Test files detected
CI workflow file detected
és ne:
Build verified
Tests passing
CI healthy
Új CI-script keresztellenőrzés
A scanner már beolvassa a workflow YAML fájlokat.
Új signal:
•	a package script létezik;
•	a CI workflow hivatkozik rá;
•	vagy a CI közvetlenül futtat ismert build/test/lint parancsot.
Ez erősebb signal, mint a CI fájl puszta jelenléte.
Blocker szabályok
Secret-like fájl észlelésekor:
•	AI Development Readiness secret hygiene signal: 0;
•	overall állapot: Blocked vagy Critical review required;
•	konkrét fájlútvonal evidence;
•	nincs automatikus állítás arról, hogy a fájl valóban érvényes titkot tartalmaz.
________________________________________
8. Agent Routing Score
Mit mér?
Mennyire egyértelmű egy coding agent számára, hogy egy feladathoz hol kezdjen, mit ne módosítson és hogyan ellenőrizze a változtatást?
Signal	Súly
Root agent instructions	15
Folder-level instruction coverage	25
Task router	15
Critical/protected files policy	15
Ownership boundaries	10
Entry-point map	10
Local verification guidance	10
Folder-level instruction coverage
Relevant foldernek számítanak az aktív kóddal vagy dokumentációval rendelkező mappák, például:
•	src
•	app
•	api
•	server
•	backend
•	components
•	lib
•	tests
•	docs
Coverage:
coveredRelevantFolders / relevantFolders
Egy folder akkor covered, ha van:
•	közvetlen folder-level AGENTS.md;
•	megfelelő lokális Cursor rule;
•	vagy más explicit, folderhez kötött instruction fájl.
A ShipSeal által javasolt, de még nem alkalmazott folder agent fájl nem számít coverage-nek.
Small repository kezelés
Egy egyetlen source folderből álló kis repositorynál a folder-level hierarchy nem feltétlenül indokolt.
Ezért bizonyos folder-coverage signalok not-applicable állapotot kaphatnak, például:
•	legfeljebb egy releváns source folder;
•	egyetlen egyértelmű belépési pont;
•	root instructions elegendően konkrétak.
________________________________________
9. Delivery Confidence Score
Mit mér?
Mennyire érthetően, reprodukálhatóan és felelősen adható át vagy üzemeltethető a repository?
Signal	Súly
Handoff vagy project summary	15
Release checklist	15
Deployment és rollback guidance	15
Ownership/maintainers	15
Security/privacy/data guidance	15
Operational vagy support runbook	10
Versioning/changelog/license signals	10
Known risks vagy decision record	5
Ez a score a repository jelenlegi állapotát méri.
A ShipSeal által frissen generált Client Report vagy Delivery Pack nem növelheti ugyanabban a scanben ezt a pontszámot. Az outputot külön kell kommunikálni:
Current Delivery Confidence: 48
Projected improvements available from ShipSeal: 4
Egy későbbi újrascannelés során az alkalmazott dokumentumok már valós repository signalok lehetnek.
________________________________________
10. Meglévő signalok, amelyeket közvetlenül újrahasználhatunk
Meglévő signal	Jelenlegi forrás	Új felhasználás
fájlútvonal és méret	RepoFileSummary	large files, folder map, doc sprawl
ignored reason	RepoFileSummary.ignoredReason	generated/vendor noise
discovered/analyzed/ignored counts	ScanSummary	scan confidence és evidence
generated/vendor counts	ScanSummary	Context Waste
readable text bytes	ScanSummary	measurement evidence, nem tokenbecslés
ignored folders	ScanSummary	context exclusions
warnings és limited scan	ScanSummary	confidence/insufficient evidence
languages/frameworks	DetectedStack	intelligence és readiness
scripts/run commands	DetectedStack	command map és verification
test frameworks	DetectedStack	AI Development Readiness
key folders	RepositorySummary	routing
instruction files	RepositorySummary	intelligence/routing, kibővítendő nested detectionnel
key file booleans	ScanEvidence	gyors UI summary
blockers	jelenlegi scoring	új blocker input, felülvizsgált szabályokkal
source metadata	ScanSourceMetadata	report evidence
intake data	Project Intake	riportkontextus, nem repository score
________________________________________
11. Szükséges új signalok
Új scanner nélkül, a meglévő inputból előállíthatók
•	fájlkategorizálás: source, test, docs, config, instruction, generated, binary;
•	generated/vendor byte ratio;
•	relevant large file count;
•	giant file count;
•	nested AGENTS.md és instruction scope map;
•	entry-point candidates;
•	canonical document candidates;
•	active/legacy/archive document classification;
•	exact duplicate documentation hash;
•	docs index detection;
•	command map fájlok felismerése;
•	task router felismerése;
•	critical files policy felismerése;
•	known risks és decision log felismerése;
•	lockfile detection;
•	release, deployment, rollback és runbook detection;
•	CI workflow és package script cross-reference.
Minimális scanner-model bővítés
Érdemes létrehozni egy belső, nem exportált aggregált struktúrát:
interface RepositorySignalInput {
  files: ClassifiedRepoFile[];
  readableDocuments: ReadableDocumentSignal[];
  instructionsByScope: Record<string, string[]>;
  entryPoints: string[];
  activeDocumentFamilies: Record<string, string[]>;
}
A raw dokumentumtartalom továbbra sem kerülhet:
•	score.json-ba;
•	localStorage-ba;
•	scan historyba;
•	report exportba.
Csak az aggregált evidence kerüljön ki, például:
{
  "duplicateDocumentationGroups": 2,
  "duplicateDocumentationFiles": [
    ["docs/ROADMAP.md", "ROADMAP_2026.md"]
  ]
}
Nem része az MVP-nek
•	tényleges tokenfogyasztás;
•	model/provider billing adatok;
•	agent session idő;
•	tényleges build/test sikeresség;
•	git history alapú dokumentumfrissesség;
•	semantic near-duplicate AI-elemzés;
•	teljes import graph vagy AST-alapú architecture map.
________________________________________
12. Hamis tokenmegtakarítási állítások elkerülése
Tiltott állítások az MVP-ben
•	„30%-kal kevesebb token”
•	„X dollárt takarít meg”
•	„kétszer gyorsabb agent session”
•	„Y token megtakarítás”
•	fájlbyte → token automatikus átváltás
•	garantált költség- vagy időmegtakarítás
Engedélyezett állítások
•	generated/vendor fájlok száma;
•	ignored fájlok és byte-ok;
•	aktív dokumentumok száma;
•	duplikált dokumentumcsoportok;
•	túlméretes releváns fájlok;
•	folder instruction coverage;
•	context anchorök;
•	routing ambiguity;
•	static Context Waste Risk.
Minden felületen és exportban jelenjen meg:
Context Waste Risk is a deterministic static estimate based on repository structure and readable documentation signals. ShipSeal did not measure actual agent prompts, provider token usage, billing, or task completion time.
Agent Operating Mode terminológia
A jelenlegi szöveg ilyen kifejezéseket használ:
•	Lowest token cost
•	Normal token usage
•	Higher token usage
Ezek nem számszerű állítások, de jobb lenne pontosabb, bizonyíthatóbb nyelvre cserélni:
Jelenlegi	Javasolt
Higher token usage	Broadest context and verification policy
Normal token usage	Selective context and verification policy
Lowest token cost	Narrowest context policy
Fastest iteration	Optimized for short, low-risk iterations
A „Token Saver” mód neve maradhat, de a leírás világítsa meg, hogy ez munkapolitika, nem mért megtakarítás.
________________________________________
13. Score → konkrét javítás kapcsolat
Minden hiányos signalhoz kötelezően tartozzon egy fix definíció.
interface HealthRecommendation {
  id: string;
  title: string;
  whyItMatters: string;
  action: string;
  targetPaths: string[];
  evidence: string[];
  affectedDimensions: string[];
  potentialDimensionGain: number;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
}
Példák
Hiányzó task router
Evidence:
- 5 relevant source folders found.
- 4 possible entry points found.
- No TASK_ROUTER.md or equivalent routing document detected.

Action:
Create a task router mapping common task types to starting folders,
critical files and focused verification commands.

Suggested path:
docs/TASK_ROUTER.md

Potential Agent Routing gain:
15 points
Generated/vendor noise
Evidence:
- node_modules represents 61% of archive files.
- dist represents 18% of archive bytes.

Action:
Remove generated folders from repository archives and add them
to .gitignore where appropriate.
Dokumentációs ambiguity
Evidence:
- docs/ROADMAP.md
- SHIPSEAL_2026_PRODUCT_ROADMAP.md
- SELLABLE_PRODUCT_BACKLOG.md
contain overlapping active product-direction signals.

Action:
Declare one canonical roadmap and move historical documents under
docs/legacy or link them explicitly from docs/README.md.
Recommendation prioritás
Javasolt rendezési formula:
priority value =
unearned signal weight
× dimension overall weight
× severity multiplier
Sorrend:
1.	kritikus blocker;
2.	nagy overall hatás;
3.	több dimenziót javító action;
4.	kis kockázatú és könnyen alkalmazható fix.
A dashboard legfeljebb az első 3–5 akciót mutassa alapállapotban.
________________________________________
14. Dashboard-integráció
Javasolt új fő hierarchy
Hero rész
A jelenlegi readiness score helyett:
•	Repository Health: 74/100
•	Status: Workable with optimization
•	Context Waste Risk: 32/100 – Moderate
•	Top action: Add folder-level routing for src, api and tests
Dimenziók
Öt kompakt kártya:
1.	Repository Intelligence
2.	Context Waste Risk
3.	AI Development Readiness
4.	Agent Routing
5.	Delivery Confidence
A Context Waste kártyán a színskála fordított:
•	0–24: low risk
•	25–49: moderate
•	50–74: high
•	75–100: very high
Explainability
Minden kártya:
•	score;
•	2 legerősebb evidence;
•	2 legnagyobb gap;
•	„Why this score?” disclosure;
•	kapcsolódó fixek.
Régi readiness kategóriák
A jelenlegi CategoryBreakdown egy átmeneti verzióban maradjon meg:
Technical readiness details
néven, összecsukható másodlagos szekcióként.
Így az új modell bevezetése nem töri el azonnal a régi logikát és teszteket.
MCP Readiness
Maradjon külön governance dimenzió.
Ne kerüljön az öt Repository Health dimenzió közé, és ne befolyásolja közvetlenül az overall score-t az első verzióban.
________________________________________
15. score.json integráció
Első kompatibilis schema
{
  "product": "ShipSeal",
  "scoreSchemaVersion": 2,

  "score": 72,
  "status": "Almost Ready",
  "isReady": false,
  "categories": [],

  "legacyReadiness": {
    "score": 72,
    "status": "Almost Ready",
    "isReady": false,
    "categories": []
  },

  "repositoryHealth": {
    "modelVersion": "repository-health-v1",
    "measurementMethod": "deterministic-static-scan",
    "overall": {
      "score": 68,
      "status": "Fragmented workspace",
      "confidence": "High"
    },
    "dimensions": {},
    "blockers": [],
    "topActions": [],
    "measurementBoundary": []
  }
}
Kompatibilitási döntés
Az első verzióban a root:
•	score
•	status
•	isReady
•	categories
maradjon változatlan, mert a dashboard-, export- és tesztlogika jelenleg ezekre épül.
Az új UI elsődlegesen a:
repositoryHealth.overall
adatot használja.
Egy későbbi schema v3-ban lehet eldönteni, hogy a root score már Repository Health score-t jelentsen-e.
________________________________________
16. HTML- és PDF-riport
A PDF jelenleg ugyanabból a HTML-generátorból készül, ezért egyetlen report model bővítése elegendő mindkét formátumhoz.
A ClientReportSummary kapjon új mezőket:
repositoryHealthScore
repositoryHealthStatus
repositoryHealthConfidence
repositoryHealthDimensions
contextWasteRisk
repositoryHealthActions
repositoryHealthBoundary
Riport sorrend
1.	Repository Health summary
2.	Öt dimenzió
3.	Top repository improvements
4.	Scan evidence
5.	Selected package és generated outputs
6.	Delivery/readiness részletek
7.	MCP, AI Act és egyéb package-specifikus rész
8.	Measurement boundary és disclaimer
A PDF-ben ne kerüljön minden signal a fő részbe. A részletes evidence mehet egy tömörebb appendixbe.
________________________________________
17. Delivery Pack és manifest
Új javasolt fájl
07-context/REPOSITORY_HEALTH.md
Tartalma:
•	overall health;
•	öt dimenzió;
•	Context Waste Risk;
•	evidence;
•	top actions;
•	blocker;
•	measurement boundary;
•	jelenlegi és projected state világos elkülönítése.
Külön repository-health.json nem szükséges az MVP-ben, mert a score.json már tartalmazza a teljes gépi struktúrát. Ez elkerüli az újabb párhuzamos source of truth létrehozását.
Manifest
A manifest verziója:
version: 1 → version: 2
Az új fájl kerüljön a context szekcióba.
Javasolt package mapping:
Package	Repository Health fájl
Agent development	igen
Rescue/refactor	igen
Client handoff	igen
Full ShipSeal	igen
Testing/red-team	csak score.json health metadata
Security/data	csak score.json health metadata
MCP readiness	csak score.json health metadata
AI Act	csak score.json health metadata
Repo Context Pack
A REPO_CONTEXT_PACK.md és JSON kapjon egy kompakt összefoglalót:
Repository Health: 68/100
Context Waste Risk: 42/100
Top actions:
- Add task routing
- Consolidate roadmap documents
- Add CI test execution
A teljes signal lista maradjon a score.json-ban és a REPOSITORY_HEALTH.md-ben.
________________________________________
18. Szükséges tesztek
18.1 Signal extraction unit tesztek
Új fájlok például:
src/test/repositoryHealthSignals.test.ts
src/test/repositoryHealthScoring.test.ts
src/test/repositoryHealthRecommendations.test.ts
Ellenőrizendő:
•	generated/vendor count- és byte-arány;
•	large/giant relevant file detection;
•	exact duplicate docs;
•	active kontra legacy docs;
•	canonical document conflicts;
•	nested AGENTS coverage;
•	task router detection;
•	entry-point ambiguity;
•	CI-script cross-reference;
•	lockfile és command detection;
•	release/deployment/ownership signalok.
18.2 Determinizmus
Ugyanaz az input:
•	ugyanazokat a signalokat;
•	ugyanazt a pontszámot;
•	ugyanazt az action sorrendet
adja, függetlenül a fájlok bemeneti sorrendjétől.
Ez különösen fontos, mert a jelenlegi sampleFiles.slice(0, 40) sorrendfüggő.
18.3 Monotonitási tesztek
•	AGENTS.md hozzáadása nem ronthatja a Repository Intelligence score-t.
•	Folder-level AGENTS.md hozzáadása nem ronthatja az Agent Routing score-t.
•	node_modules hozzáadása nem javíthatja a Context Waste score-t.
•	Dokumentumok legacy mappába mozgatása csökkentheti a sprawl/ambiguity risket.
•	Test script hozzáadása csak az érintett readiness signalokat javítsa.
•	ShipSeal által generált, még nem alkalmazott output ne növelje a repository score-t.
18.4 Limited scan teszt
Limited fallback esetén:
overall.score === null
overall.status === 'Insufficient evidence'
confidence === 'Low'
A mesterséges fallback fájlok nem pontozhatók.
18.5 Recommendation coverage
Minden fail vagy partial signalhoz legyen:
•	recommendation ID;
•	konkrét action;
•	evidence;
•	legalább egy target path vagy egyértelmű repository action.
Ne maradjon generikus:
Worth +3 points
szöveg.
18.6 Export contract tesztek
Ellenőrizendő:
•	score.json.repositoryHealth megegyezik a dashboard által használt modellel;
•	manifest output count egyezik a ZIP fájljaival;
•	REPOSITORY_HEALTH.md szerepel a megfelelő package-ekben;
•	HTML és PDF ugyanazt a health score-t használja;
•	Delivery Manifest ugyanazt a score-t és státuszt mutatja;
•	a nested JSON wrapperben lévő content.repositoryHealth is helyes.
18.7 UI tesztek
•	öt dimenzió megjelenik;
•	Context Waste Risk egyértelműen „higher is worse”;
•	limited scan nem jelenít meg valódi health score-t;
•	top actions evidence-szel jelennek meg;
•	legacy readiness breakdown elérhető, de másodlagos;
•	MCP score továbbra is külön dimenzió.
18.8 Claim-safety tesztek
A generált UI-, report- és Markdown-szövegek ne tartalmazzanak:
•	konkrét tokenmegtakarítási százalékot;
•	garantált költségmegtakarítást;
•	garantált sebességnövekedést;
•	„verified tests/build” állítást static scan alapján.
18.9 Golden fixture repositoryk
Legalább négy fixture:
1.	Mature AI-ready repo
o	docs, commands, CI, tests, AGENTS hierarchy.
2.	Small clean repo
o	kevés mappa, root instructions elegendő.
3.	Noisy AI-generated repo
o	duplikált docs, több roadmap, generated folders, nagy fájlok.
4.	Limited/invalid archive
o	nincs publikálható score.
________________________________________
19. Kisméretű, biztonságos implementációs sorrend
Ω.2.1 – Pure Repository Health core
Csak:
•	típusok;
•	file classification;
•	signal extraction;
•	score formula;
•	recommendation mapping;
•	unit tesztek.
Nem változik:
•	dashboard;
•	export;
•	manifest;
•	report.
Javasolt új könyvtár:
src/lib/repositoryHealth/
  types.ts
  classifyFiles.ts
  extractSignals.ts
  scoreRepositoryHealth.ts
  recommendations.ts
  index.ts
Ω.2.2 – Report model és score.json
•	ReadinessReport.repositoryHealth
•	ScoreJsonExport.repositoryHealth
•	scoreSchemaVersion: 2
•	legacy mezők változatlanul maradnak
•	export contract tesztek
Még nincs nagy UI-átrendezés.
Ω.2.3 – Dashboard explainability
•	Repository Health summary
•	öt dimenzió
•	top actions
•	measurement boundary
•	legacy category breakdown összecsukható szekcióban
Ω.2.4 – HTML/PDF report integration
•	közös typed report summary
•	dimension overview
•	Context Waste disclaimer
•	top repository actions
•	HTML/PDF parity tesztek
Ω.2.5 – Delivery Pack és manifest
•	07-context/REPOSITORY_HEALTH.md
•	manifest v2
•	goal mapping
•	ZIP/output count konzisztencia
•	Repo Context Pack compact health summary
Ω.2.6 – Product language cleanup
•	Agent Operating Mode terminológia pontosítása
•	„token cost” helyett context-policy nyelvezet
•	régi aktív roadmap/backlog dokumentumok canonical/legacy rendezése
•	claim-safety regressziós tesztek
________________________________________
20. Kötelező Codex sprint-záróformátum
Minden későbbi Codex prompt végén pontosan ez szerepeljen:
Completed in this sprint
•	Mi készült el ténylegesen?
•	Mely fájlok változtak?
•	Milyen automata tesztek futottak le?
Still remaining
•	Mi maradt a következő sprintekre?
•	Mi nem került szándékosan implementálásra?
•	Van-e ismert technikai vagy termékkockázat?
Manual verification checklist
•	Mely célzott parancsokat kell lefuttatni?
•	Mely dashboard- és exportfolyamatokat kell kézzel ellenőrizni?
•	Mely fixture repositorykat kell újrascannelni?
