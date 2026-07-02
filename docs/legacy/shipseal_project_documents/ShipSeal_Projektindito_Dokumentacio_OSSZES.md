# DEPRECATED

Superseded by:

docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md

# ShipSeal projektindĂ­tĂł dokumentĂˇciĂł

FrissĂ­tve: 2026-06-01

Ez a dokumentum a ShipSeal projekt egysĂ©ges, projektindĂ­tĂł dokumentĂˇciĂłja.

---

# 00 - Ăšj projekt kontextus Ă©s feltĂ¶ltĂ©si instrukciĂł

## CĂ©l

Ebben az Ăşj projektben a ShipSeal nevĹ± termĂ©ket szeretnĂ©nk kialakĂ­tani. A cĂ©l nem egy Ăşjabb ĂˇltalĂˇnos AI app, hanem egy olyan AI-projekt ĂˇtadĂˇs-elĹ‘kĂ©szĂ­tĹ‘ rendszer, amely AI prototĂ­pusokbĂłl agent-ready, tesztelhetĹ‘, dokumentĂˇlt Ă©s ĂĽgyfĂ©lnek ĂˇtadhatĂł projektcsomagot kĂ©szĂ­t.

## RĂ¶vid termĂ©kdefinĂ­ciĂł

ShipSeal ĂˇtvizsgĂˇlja az AI-projekt forrĂˇsait, dokumentĂˇciĂłjĂˇt Ă©s mĹ±kĂ¶dĂ©si leĂ­rĂˇsĂˇt, majd elkĂ©szĂ­ti azokat a fejlesztĂ©si, tesztelĂ©si, agent-instruction, MCP-governance, EU AI Act readiness Ă©s ĂĽgyfĂ©lĂˇtadĂˇsi dokumentumokat, amelyekre egy AI freelancernek, AI ĂĽgynĂ¶ksĂ©gnek vagy kis SaaS-fejlesztĹ‘nek szĂĽksĂ©ge van az ĂĽgyfĂ©lĂˇtadĂˇs elĹ‘tt.

## FeltĂ¶ltendĹ‘ forrĂˇsok

Az Ăşj projektbe tĂ¶ltsĂĽk fel a kĂ¶vetkezĹ‘ ZIP-eket:

1. `agentready-hub-main (1).zip`
   - jelenlegi nĂ©ven agentready-hub; a ShipSeal frontend Ă©s repo-szkenner alapja,
   - AGENTS.md / CLAUDE.md / MCP governance / readiness report generĂˇlĂˇs,
   - React + Vite + TypeScript + shadcn/ui alap.

2. `ai2ai-main (1).zip`
   - multi-model Expert Council / AI Debate backend,
   - Python CLI + opcionĂˇlis FastAPI API,
   - forrĂˇsbetĂ¶ltĂ©s, evidence pack, fĂĽggetlen modellek, rebuttal, final judge, output contract, riportgenerĂˇlĂˇs.

3. `verdictmesh-main (1).zip`
   - AI2AI frontend / VerdictMesh felĂĽlet,
   - Base44-exportĂˇlt Vite/React frontend,
   - AI2AI backendhez kapcsolhatĂł vizuĂˇlis debate/council UI.

## Ăšj projektben hasznĂˇlandĂł fĹ‘ prompt

A kĂ¶vetkezĹ‘ szĂ¶veget lehet bemĂˇsolni az Ăşj projekt elsĹ‘ ĂĽzenetekĂ©nt:

> A ShipSeal projektet szeretnĂ©m tovĂˇbbfejleszteni. A cĂ©l egy AI Project Delivery Pack Generator: AI-projektekbĹ‘l agent-ready fejlesztĂ©si fĂˇjlokat, Claude/Codex/agent instruction fĂˇjlokat, skilleket, MCP governance javaslatot, eval/red-team teszteket, EU AI Act readiness elĹ‘szĹ±rĂ©st Ă©s ĂĽgyfĂ©lnek ĂˇtadhatĂł riportot kĂ©szĂ­t. FeltĂ¶ltĂ¶ttem hĂˇrom meglĂ©vĹ‘ fĂ©lkĂ©sz forrĂˇsprojektet: agentready-hub, ai2ai Ă©s verdictmesh. KĂ©rlek, a forrĂˇsok alapjĂˇn segĂ­ts egysĂ©ges architektĂşrĂˇt, MVP-t Ă©s fejlesztĂ©si roadmapet kialakĂ­tani. Ne kezeld Ĺ‘ket hĂˇrom kĂĽlĂ¶n termĂ©kkĂ©nt; a A ShipSeal legyen a fĹ‘ termĂ©k, az AI2AI/VerdictMesh pedig a Review Council / VerdictMesh dĂ¶ntĂ©si motor Ă©s frontend alapja.

## Fontos stratĂ©giai dĂ¶ntĂ©sek

- Nem OpenText-specifikus termĂ©ket Ă©pĂ­tĂĽnk.
- Nem jogi tanĂˇcsadĂł platformot Ă©pĂ­tĂĽnk.
- Nem ĂˇltalĂˇnos AI governance enterprise platformot Ă©pĂ­tĂĽnk.
- Nem Ă¶nĂˇllĂł AI2AI debate jĂˇtĂ©kot Ă©pĂ­tĂĽnk.
- Nem csak AGENTS.md generĂˇtort Ă©pĂ­tĂĽnk.
- A fĹ‘ termĂ©k: AI-projekt ĂˇtadĂˇs-elĹ‘kĂ©szĂ­tĹ‘ Ă©s readiness csomag generĂˇtor.

## ElsĹ‘ MVP cĂ©lja

Egy feltĂ¶ltĂ¶tt ZIP vagy publikus GitHub repo alapjĂˇn kĂ©szĂĽljĂ¶n el:

- ShipSeal score,
- AGENTS.md,
- CLAUDE.md,
- 3-5 SKILL.md,
- MCP readiness/governance pack,
- 30 teszteset,
- 10 red-team prompt,
- EU AI Act readiness checklist,
- transparency notice draft,
- white-label ĂĽgyfĂ©lĂˇtadĂˇsi riport.
---

# 01 - CĂ©g- Ă©s termĂ©kleĂ­rĂˇs

## Projekt- Ă©s termĂ©knĂ©v

**ShipSeal**  
LehetsĂ©ges cĂ©gnĂ©v/mĂˇrkanĂ©v: **ShipSeal Labs** vagy **ShipSeal AI**.

A nĂ©v jelentĂ©se ebben a kontextusban: a termĂ©k â€žlezĂˇrjaâ€ť Ă©s ĂˇtadĂˇsra alkalmassĂˇ teszi az AI-projektet, mint egy minĹ‘sĂ©gi pecsĂ©t az ĂĽgyfĂ©lĂˇtadĂˇs elĹ‘tt.

## Mit csinĂˇl a cĂ©gĂĽnk?

A ShipSeal olyan AI-projekt ĂˇtadĂˇs-elĹ‘kĂ©szĂ­tĹ‘ Ă©s readiness platformot fejleszt, amely segĂ­t AI freelancereknek, AI ĂĽgynĂ¶ksĂ©geknek, no-code/low-code buildereknek Ă©s kis SaaS csapatoknak eldĂ¶nteni, hogy egy AI-alkalmazĂˇs kĂ©szen Ăˇll-e ĂĽgyfĂ©lĂˇtadĂˇsra, pilotra vagy Ă©lesĂ­tĂ©sre.

A rendszer nemcsak auditĂˇl, hanem konkrĂ©t ĂˇtadĂˇsi anyagokat is elĹ‘ĂˇllĂ­t:

- agent instruction fĂˇjlokat (`AGENTS.md`, `CLAUDE.md`, Codex/Cursor/Windsurf promptok),
- Claude Code / agent skilleket (`SKILL.md` csomagok),
- MCP readiness Ă©s governance javaslatot,
- teszteseteket Ă©s red-team promptokat,
- EU AI Act readiness elĹ‘szĹ±rĂ©st,
- transparency notice / disclosure szĂ¶vegtervezeteket,
- ĂĽgyfĂ©lnek ĂˇtadhatĂł, white-label PDF/Markdown riportot,
- go/no-go dĂ¶ntĂ©st Ă©s javĂ­tĂˇsi roadmapet.

## Mi a fĹ‘ problĂ©ma?

A generatĂ­v AI miatt egyre tĂ¶bb kis csapat Ă©s freelancer Ă©pĂ­t gyorsan AI-prototĂ­pusokat. A demĂłk sokszor lĂˇtvĂˇnyosak, de az ĂˇtadĂˇs elĹ‘tti Ăˇllapot bizonytalan:

- nincs rendes dokumentĂˇciĂł,
- nincs agenteknek szĂłlĂł projektkontekstus,
- nincs tesztelĂ©si stratĂ©gia,
- nincs eval/red-team csomag,
- nincs ĂĽgyfĂ©lnek ĂˇtadhatĂł readiness riport,
- nincs AI Act / transparency elĹ‘szĹ±rĂ©s,
- nincs tiszta fejlesztĂ©si folytatĂˇsi csomag,
- nincs megvĂˇlaszolva: â€žezt oda merem adni az ĂĽgyfĂ©lnek?â€ť

A ShipSeal erre a rĂ©sre Ă©pĂ­t.

## Egy mondatos termĂ©kĂ­gĂ©ret

**ShipSeal ĂˇtalakĂ­tja az AI-prototĂ­pust agent-ready, tesztelhetĹ‘, dokumentĂˇlt Ă©s ĂĽgyfĂ©lnek ĂˇtadhatĂł projektcsomaggĂˇ.**

Angol landing page verziĂł:

**Seal your AI project before you ship it: agent-ready, testable and client-ready.**

## CĂ©lcsoport

### ElsĹ‘dleges cĂ©lcsoport

- AI freelancerek,
- kis AI ĂĽgynĂ¶ksĂ©gek,
- no-code/low-code AI builderek,
- prompt engineering / automation tanĂˇcsadĂłk,
- indie SaaS fejlesztĹ‘k, akik AI-appot adnak Ăˇt ĂĽgyfeleknek.

### MĂˇsodlagos cĂ©lcsoport

- KKV-k, akik AI-appot rendeltek Ă©s fĂĽggetlen readiness review-t szeretnĂ©nek,
- AI-kĂ©pzĂ©st / workshopot tartĂł cĂ©gek,
- fejlesztĹ‘csapatok, akik AI coding agentekkel akarjĂˇk tovĂˇbbvinni a projektjeiket.

## MiĂ©rt fizetne ezĂ©rt valaki?

A cĂ©lcsoport nem elmĂ©leti megfelelĹ‘sĂ©get vĂˇsĂˇrol, hanem idĹ‘t, bizalmat Ă©s professzionĂˇlis ĂˇtadĂˇsi anyagot:

- kevesebb manuĂˇlis dokumentĂˇlĂˇs,
- gyorsabb ĂĽgyfĂ©lĂˇtadĂˇs,
- profibb lĂˇtszat Ă©s valĂłs minĹ‘sĂ©g,
- kevesebb beĂ©gĂ©si kockĂˇzat,
- elĹ‘re megfogalmazott tesztek Ă©s red-team kĂ©rdĂ©sek,
- EU AI Act / transparency tĂ©mĂˇban legalĂˇbb elĹ‘szĹ±rt, nem jogi, de rendezett dokumentĂˇciĂł,
- fejlesztĂ©si folytatĂˇs Claude Code / Codex / mĂˇs agentek szĂˇmĂˇra.

## TermĂ©kmodulok

### 1. Project Intake

BekĂ©ri:

- repo ZIP vagy GitHub URL,
- AI-app cĂ©ljĂˇt,
- cĂ©lfelhasznĂˇlĂłkat,
- kezelt adattĂ­pusokat,
- hasznĂˇlt modelleket,
- promptokat,
- pĂ©lda outputokat,
- emberi jĂłvĂˇhagyĂˇsi pontokat,
- EU/nem EU cĂ©lpiacot,
- ĂĽgyfĂ©lĂˇtadĂˇsi kontextust.

### 2. Repository & Delivery Readiness Scanner

Elemzi:

- projektstruktĂşrĂˇt,
- dokumentĂˇciĂłt,
- build/test/lint jeleket,
- meglĂ©vĹ‘ agent instruction fĂˇjlokat,
- `.env.example` Ă©s secret-kezelĂ©si jeleket,
- repo mĂ©retĂ©t, vendor/generated tartalmakat,
- mĹ±kĂ¶dĂ©si parancsokat.

### 3. Agent Pack Generator

GenerĂˇlja:

- `AGENTS.md`,
- `CLAUDE.md`,
- `CODEX_PROMPTS.md`,
- `REVIEWER_PROMPT.md`,
- `SECURITY_REVIEW.md`,
- `TESTING_STRATEGY.md`,
- `CI_QUALITY_GATE.yml`.

### 4. Skills Pack Generator

GenerĂˇlja pĂ©ldĂˇul:

- `.claude/skills/code-review/SKILL.md`,
- `.claude/skills/test-generation/SKILL.md`,
- `.claude/skills/eu-ai-act-readiness/SKILL.md`,
- `.claude/skills/release-check/SKILL.md`,
- `.claude/skills/client-handoff/SKILL.md`.

### 5. MCP Readiness & Governance

Nem vakon generĂˇl MCP szervert. ElĹ‘szĂ¶r eldĂ¶nti:

- kell-e MCP,
- milyen adatforrĂˇs / tool indokolja,
- read-only vagy write-capable legyen-e,
- milyen engedĂ©lyezĂ©si Ă©s naplĂłzĂˇsi szabĂˇly kell,
- milyen security kockĂˇzatok vannak.

ElsĹ‘ verziĂłban fĹ‘leg MCP readiness dokumentĂˇciĂł Ă©s skeleton javaslat kĂ©szĂĽljĂ¶n, nem production-ready MCP integrĂˇciĂł.

### 6. Eval & Red Team Pack

GenerĂˇl:

- normĂˇl teszteseteket,
- edge case teszteket,
- hallucination trap kĂ©rdĂ©seket,
- prompt injection prĂłbĂˇkat,
- adatkiĂˇramlĂˇsi teszteket,
- refusal/boundary teszteket,
- consistency teszteket.

### 7. EU AI Act Readiness Pack

ElĹ‘szĹ±ri:

- provider/deployer szerepkĂ¶rt,
- potenciĂˇlis high-risk irĂˇnyokat,
- tiltott vagy Ă©rzĂ©keny felhasznĂˇlĂˇsi jeleket,
- transparency / disclosure kĂ¶telezettsĂ©g jellegĹ± kĂ©rdĂ©seket,
- emberi felĂĽgyelet meglĂ©tĂ©t,
- AI-generĂˇlt tartalom jelĂ¶lĂ©sĂ©nek szĂĽksĂ©gessĂ©gĂ©t.

Fontos: a termĂ©k nem ĂˇllĂ­thatja, hogy jogi megfelelĹ‘sĂ©get igazol. A helyes ĂˇllĂ­tĂˇs: **elĹ‘zetes readiness Ă©s kĂ©rdĂ©slista jogi review-hoz**.

### 8. VerdictMesh Review Council

Az AI2AI/VerdictMesh technolĂłgiĂˇra Ă©pĂ­tve tĂ¶bb nĂ©zĹ‘pontĂş review kĂ©szĂĽlhet:

- QA reviewer,
- Security red teamer,
- EU AI Act / compliance reviewer,
- Product/business reviewer,
- Skeptical customer,
- Final judge.

Ez nem Ă¶nĂˇllĂł â€žAI-k vitĂˇznakâ€ť termĂ©k, hanem a ShipSeal dĂ¶ntĂ©si motorja.

## VersenyelĹ‘ny

ShipSeal nem akar kĂ¶zvetlenĂĽl enterprise governance platform, LangSmith-szerĹ± observability rendszer vagy jogi compliance tool lenni. A pozĂ­ciĂł:

**az AI-projekt ĂˇtadĂˇs elĹ‘tti gyakorlati delivery packje kis AI-csapatoknak.**

Ez a rĂ©s azĂ©rt Ă©rdekes, mert a legtĂ¶bb megoldĂˇs vagy tĂşl enterprise, vagy tĂşl fejlesztĹ‘i, vagy tĂşl jogi. ShipSeal a gyakorlati ĂˇtadĂˇsi ponton segĂ­t.

## HivatkozĂˇsi alapok

A stratĂ©gia az alĂˇbbi, nyilvĂˇnos Ă©s aktuĂˇlis technolĂłgiai/jogi irĂˇnyokra Ă©pĂ­t:

- EU AI Act: Regulation (EU) 2024/1689, risk-based AI rules; European Commission AI Act overview: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- European Commission AI Act Service Desk Compliance Checker: https://ai-act-service-desk.ec.europa.eu/en/eu-ai-act-compliance-checker
- European Commission Article 50 transparency draft guidance / consultation, 2026. mĂˇjus: https://digital-strategy.ec.europa.eu/en/consultations/consultation-draft-guidelines-transparency-obligations-under-ai-act
- AGENTS.md nyĂ­lt formĂˇtum: https://agents.md/
- Claude Code CLAUDE.md / memory dokumentĂˇciĂł: https://code.claude.com/docs/en/memory
- Claude Code Skills dokumentĂˇciĂł: https://code.claude.com/docs/en/skills
- Model Context Protocol dokumentĂˇciĂł: https://modelcontextprotocol.io/docs/getting-started/intro

MegjegyzĂ©s: az EU AI Act Ă©rtelmezĂ©si rĂ©szek nem minĹ‘sĂĽlnek jogi tanĂˇcsadĂˇsnak. A termĂ©k kommunikĂˇciĂłjĂˇban is ezt kell kĂ¶vetkezetesen feltĂĽntetni: elĹ‘szĹ±rĂ©s, readiness, dokumentĂˇciĂł-elĹ‘kĂ©szĂ­tĂ©s Ă©s technikai/jogi kĂ©rdĂ©slista kĂ©szĂĽl, nem jogi szakvĂ©lemĂ©ny.
---

# 02 - Ăśzleti Ă©s megvalĂłsĂ­tĂˇsi terv

## VezetĹ‘i Ă¶sszefoglalĂł

A ShipSeal cĂ©lja, hogy a gyorsan kĂ©szĂĽlĹ‘ AI-prototĂ­pusokbĂłl ĂĽgyfĂ©lnek ĂˇtadhatĂł, agent-ready Ă©s elĹ‘zetesen kockĂˇzatkezelt projektcsomagot kĂ©szĂ­tsen. A termĂ©k elsĹ‘dleges vevĹ‘i AI freelancerek Ă©s kis AI-ĂĽgynĂ¶ksĂ©gek, akik ĂĽgyfeleknek Ă©pĂ­tenek chatbotokat, RAG rendszereket, dokumentum-AI eszkĂ¶zĂ¶ket, belsĹ‘ asszisztenseket vagy no-code/low-code AI automatizĂˇciĂłkat.

Az elsĹ‘ ĂĽzleti cĂ©l nem nagyvĂˇllalati SaaS, hanem fizetĹ‘s, gyorsan validĂˇlhatĂł riport- Ă©s delivery-pack szolgĂˇltatĂˇs. A szoftver fokozatosan nĹ‘ ki ebbĹ‘l: elĹ‘szĂ¶r automatikus riportgenerĂˇtor, utĂˇna white-label ĂĽgynĂ¶ksĂ©gi csomag, majd kĂ©sĹ‘bb csapatdashboard, GitHub App, backend worker, fizetĂ©s, audit history Ă©s API.

## TermĂ©kpozicionĂˇlĂˇs

### RĂ¶vid ĂĽzenet

**MielĹ‘tt Ăˇtadod az AI-appodat, tedd agent-readyvĂ©, tesztelhetĹ‘vĂ© Ă©s dokumentĂˇltan ĂĽgyfĂ©lkĂ©pessĂ©.**

### Angol verziĂł

**Before you ship an AI app, seal it with an agent-ready delivery pack.**

### Mit nem mondunk?

- Nem mondjuk, hogy teljes jogi megfelelĹ‘sĂ©get igazolunk.
- Nem mondjuk, hogy high-risk jogi minĹ‘sĂ­tĂ©st adunk.
- Nem mondjuk, hogy production security auditot vĂ©gzĂĽnk.
- Nem mondjuk, hogy minden MCP szerver biztonsĂˇgosan generĂˇlhatĂł automatikusan.

### Mit mondunk?

- Readiness reportot adunk.
- FejlesztĂ©si Ă©s ĂˇtadĂˇsi dokumentĂˇciĂłt generĂˇlunk.
- Teszteseteket Ă©s red-team promptokat kĂ©szĂ­tĂĽnk.
- EU AI Act transparency Ă©s risk kĂ©rdĂ©sekhez elĹ‘zetes checklistet adunk.
- Jogi review-hoz elĹ‘kĂ©szĂ­tjĂĽk az informĂˇciĂłkat.

## Piaci hipotĂ©zis

Az AI freelancerek Ă©s kis ĂĽgynĂ¶ksĂ©gek egyre gyakrabban adnak Ăˇt AI-prototĂ­pusokat, de az ĂˇtadĂˇs minĹ‘sĂ©ge sokszor ad hoc. Ha a ShipSeal kĂ©pes 30-60 percnyi dokumentĂˇciĂłs Ă©s review munkĂˇt 5-10 percre csĂ¶kkenteni, valamint a kĂ©sz anyag ĂĽgyfĂ©l felĂ© professzionĂˇlisabbĂˇ teszi a szĂˇllĂ­tĂˇst, akkor a cĂ©lcsoport fizethet Ă©rte.

## ElsĹ‘ fizetĹ‘s ajĂˇnlat

### ShipSeal Delivery Report

Input:

- repo ZIP vagy GitHub URL,
- AI-app leĂ­rĂˇs,
- cĂ©lfelhasznĂˇlĂłk,
- promptok / system prompt,
- kezelt adatok,
- pĂ©lda outputok,
- ĂĽgyfĂ©lĂˇtadĂˇsi cĂ©l.

Output:

- ShipSeal score,
- `AGENTS.md`,
- `CLAUDE.md`,
- 3-5 `SKILL.md`,
- MCP governance pack,
- eval/red-team pack,
- EU AI Act readiness checklist,
- transparency notice draft,
- white-label client handoff report.

## ĂrazĂˇsi javaslat

| Csomag | Ăr | Tartalom | CĂ©l |
|---|---:|---|---|
| Free preview | 0 EUR | readiness preview, 5 javaslat, 5 teszteset | lead generĂˇlĂˇs |
| Starter report | 49 EUR | AGENTS.md, CLAUDE.md, 30 teszteset, mini AI Act checklist | elsĹ‘ fizetĹ‘s validĂˇciĂł |
| Pro agency report | 149 EUR | white-label report, skillek, red-team pack, MCP pack | AI ĂĽgynĂ¶ksĂ©gek |
| Founder-reviewed audit | 499-999 EUR | manuĂˇlis szakĂ©rtĹ‘i review + 60 perc konzultĂˇciĂł | elsĹ‘ komoly bevĂ©tel |

Magyar validĂˇciĂłs Ăˇrak:

| Csomag | Ăr |
|---|---:|
| ElsĹ‘ riport | 19 900 Ft |
| White-label riport | 79 000 Ft |
| Founder-reviewed audit | 149 000-299 000 Ft |

## 30/60/90 napos megvalĂłsĂ­tĂˇsi terv

### ElsĹ‘ 30 nap - fizetĹ‘s validĂˇciĂłra alkalmas csomag

Feladatok:

1. Ăšj repo lĂ©trehozĂˇsa az egysĂ©ges ShipSeal irĂˇnyhoz.
2. A meglĂ©vĹ‘ agentready-hub frontend ShipSeal irĂˇnyĂş megtisztĂ­tĂˇsa Ă©s Ăşj pozicionĂˇlĂˇsa.
3. Az elsĹ‘ output-specifikĂˇciĂł vĂ©glegesĂ­tĂ©se.
4. Statikus / fĂ©lautomata ShipSeal Delivery Report generĂˇlĂˇsa.
5. Minta riport kĂ©szĂ­tĂ©se 1-2 sajĂˇt AI-projekt alapjĂˇn.
6. Landing page + fizetĂ©si Ă©rdeklĹ‘dĂ©si CTA.
7. 20-30 cĂ©lzott megkeresĂ©s AI freelancereknek / kis ĂĽgynĂ¶ksĂ©geknek.

30. napi mĂ©rĹ‘szĂˇmok:

- 1 mĹ±kĂ¶dĹ‘ demo,
- 2 minta riport,
- 20 megkeresĂ©s,
- 5 komoly visszajelzĂ©s,
- legalĂˇbb 1 fizetĂ©si szĂˇndĂ©k vagy fizetĹ‘s pilot.

### 60 nap - mĹ±kĂ¶dĹ‘ MVP

Feladatok:

1. Repo scanner + intake form Ă¶sszekĂ¶tĂ©se.
2. `AGENTS.md`, `CLAUDE.md`, skillek Ă©s MCP pack generĂˇlĂˇs stabilizĂˇlĂˇsa.
3. PDF/Markdown report export.
4. AI2AI/VerdictMesh Review Council elsĹ‘ integrĂˇciĂłja: QA, security, compliance, skeptical customer, final judge.
5. EU AI Act readiness checklist elsĹ‘ verziĂłja jogi review-val.
6. White-label report sablon.

60. napi mĂ©rĹ‘szĂˇmok:

- 3 fizetĹ‘s riport vagy founder-reviewed audit,
- 1 ĂĽgynĂ¶ksĂ©gi partnerjelĂ¶lt,
- 5 letĂ¶ltĂ¶tt/Ăˇtadott report,
- egyĂ©rtelmĹ± visszajelzĂ©s arrĂłl, melyik modulĂ©rt fizetnĂ©nek.

### 90 nap - fizetĹ‘s pilot Ă©s termĂ©kdĂ¶ntĂ©s

Feladatok:

1. FizetĂ©si integrĂˇciĂł.
2. EgyszerĹ± account / report history.
3. Job queue vagy backend worker dĂ¶ntĂ©s elĹ‘kĂ©szĂ­tĂ©se.
4. GitHub public import stabilizĂˇlĂˇsa, private repo kĂ©sĹ‘bbre.
5. Pro csomag kiadĂˇsa 5-10 fizetĹ‘s ĂĽgyfĂ©lnek.
6. Roadmap dĂ¶ntĂ©s: agency report, EU AI Act readiness vagy TestBench legyen-e a vezetĹ‘ Ă©rtĂ©kajĂˇnlat.

90. napi mĂ©rĹ‘szĂˇmok:

- 5-10 fizetĹ‘ ĂĽgyfĂ©l vagy legalĂˇbb 1000 EUR bevĂ©teli validĂˇciĂł,
- 3 testimonial,
- legalĂˇbb 30% visszatĂ©rĹ‘ hasznĂˇlati szĂˇndĂ©k ĂĽgynĂ¶ksĂ©geknĂ©l,
- vilĂˇgos dĂ¶ntĂ©s a kĂ¶vetkezĹ‘ 3 hĂłnap fĂłkuszĂˇrĂłl.

## FejlesztĂ©si stratĂ©gia

### ElsĹ‘ elv

Nem teljes platformot Ă©pĂ­tĂĽnk, hanem ĂˇtadhatĂł outputot.

### MĂˇsodik elv

A readiness score determinisztikus Ă©s auditĂˇlhatĂł legyen. Az AI magyarĂˇzhat, gazdagĂ­that, javasolhat, de ne Ă­rja felĂĽl a kritikus blokkolĂłkat.

### Harmadik elv

A jogi modul mindig elĹ‘szĹ±rĂ©s. A termĂ©k jogi kĂ©rdĂ©slistĂˇt Ă©s dokumentĂˇciĂłs alapot kĂ©szĂ­t, nem jogi szakvĂ©lemĂ©nyt.

### Negyedik elv

A VerdictMesh multi-agent council csak ott fusson, ahol Ă©rtĂ©ket ad: go/no-go, compliance uncertainty, high-risk signal, ĂĽgyfĂ©lĂˇtadĂˇsi dĂ¶ntĂ©s.

## Ă‰rtĂ©kesĂ­tĂ©si terv

### ElsĹ‘ cĂ©lzott megkeresĂ©sek

- AI freelancerek LinkedInen,
- magyar Ă©s nemzetkĂ¶zi no-code/AI ĂĽgynĂ¶ksĂ©gek,
- AI automatizĂˇciĂłs tanĂˇcsadĂłk,
- indie SaaS fejlesztĹ‘k,
- AI workshop oktatĂłk.

### TesztkĂ©rdĂ©sek

- AdtĂˇl mĂˇr Ăˇt AI-appot ĂĽgyfĂ©lnek?
- Volt-e kĂ©rdĂ©s a tesztelĂ©srĹ‘l, adatvĂ©delemrĹ‘l, EU AI ActrĹ‘l?
- KĂ©szĂĽlt-e ĂˇtadĂˇsi dokumentĂˇciĂł?
- HasznĂˇlnĂˇd-e, ha 10 perc alatt generĂˇlna egy white-label ĂˇtadĂˇsi riportot?
- FizetnĂ©l-e 49/149 EUR-t egy ilyen reportĂ©rt?

## KockĂˇzatok

| KockĂˇzat | MitigĂˇciĂł |
|---|---|
| TĂşl szĂ©les scope | MVP csak report + pack generĂˇlĂˇs |
| Jogi tanĂˇcsadĂˇsnak tĹ±nik | kĂ¶vetkezetes â€žreadiness / elĹ‘szĹ±rĂ©s / nem jogi tanĂˇcsâ€ť kommunikĂˇciĂł |
| AI output pontatlan | determinisztikus szabĂˇlyok + human review + evidence pack |
| MCP tĂşl komplex / biztonsĂˇgi kockĂˇzatos | elsĹ‘ verziĂłban readiness Ă©s skeleton, nem automatikus production MCP |
| VersenytĂˇrsak gyorsak | fĂłkusz: agency white-label handoff report, nem enterprise GRC |

## HivatkozĂˇsi alapok

A stratĂ©gia az alĂˇbbi, nyilvĂˇnos Ă©s aktuĂˇlis technolĂłgiai/jogi irĂˇnyokra Ă©pĂ­t:

- EU AI Act: Regulation (EU) 2024/1689, risk-based AI rules; European Commission AI Act overview: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- European Commission AI Act Service Desk Compliance Checker: https://ai-act-service-desk.ec.europa.eu/en/eu-ai-act-compliance-checker
- European Commission Article 50 transparency draft guidance / consultation, 2026. mĂˇjus: https://digital-strategy.ec.europa.eu/en/consultations/consultation-draft-guidelines-transparency-obligations-under-ai-act
- AGENTS.md nyĂ­lt formĂˇtum: https://agents.md/
- Claude Code CLAUDE.md / memory dokumentĂˇciĂł: https://code.claude.com/docs/en/memory
- Claude Code Skills dokumentĂˇciĂł: https://code.claude.com/docs/en/skills
- Model Context Protocol dokumentĂˇciĂł: https://modelcontextprotocol.io/docs/getting-started/intro

MegjegyzĂ©s: az EU AI Act Ă©rtelmezĂ©si rĂ©szek nem minĹ‘sĂĽlnek jogi tanĂˇcsadĂˇsnak. A termĂ©k kommunikĂˇciĂłjĂˇban is ezt kell kĂ¶vetkezetesen feltĂĽntetni: elĹ‘szĹ±rĂ©s, readiness, dokumentĂˇciĂł-elĹ‘kĂ©szĂ­tĂ©s Ă©s technikai/jogi kĂ©rdĂ©slista kĂ©szĂĽl, nem jogi szakvĂ©lemĂ©ny.
---

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
---

# 04 - FejlesztĂ©s kĂ¶zbeni szĂĽksĂ©gletek Ă©s roadmap

## Mire lesz szĂĽksĂ©gĂĽnk a fejlesztĂ©s kĂ¶zben?

A ShipSeal nem egyetlen komponensbĹ‘l Ăˇll. A sikerhez termĂ©k-, technikai, jogi, UX, sales Ă©s validĂˇciĂłs dĂ¶ntĂ©sek kellenek. Az alĂˇbbi lista azt rĂ¶gzĂ­ti, mire lesz szĂĽksĂ©g a kĂ¶vetkezĹ‘ fejlesztĂ©si szakaszban.

## 1. TermĂ©kdĂ¶ntĂ©sek

### EldĂ¶ntendĹ‘ kĂ©rdĂ©sek

- Mi az elsĹ‘ fizetĹ‘s output pontos neve?
- Starter report vagy Pro agency report legyen az elsĹ‘ fizetĹ‘s csomag?
- White-label legyen-e mĂˇr az MVP-ben?
- EU AI Act readiness mennyire legyen kĂ¶zponti ĂĽzenet?
- Az elsĹ‘ ICP AI freelancer, AI ĂĽgynĂ¶ksĂ©g vagy indie SaaS fejlesztĹ‘ legyen?
- Magyar vagy angol landing page induljon elĹ‘szĂ¶r?

### Javaslat

ElsĹ‘ fizetĹ‘s output neve:

**ShipSeal Delivery Report**

ElsĹ‘ ICP:

**AI freelancerek Ă©s kis AI ĂĽgynĂ¶ksĂ©gek, akik ĂĽgyfĂ©lnek adnak Ăˇt AI-appot.**

## 2. Output-specifikĂˇciĂł

Az MVP elĹ‘tt vĂ©glegesĂ­teni kell, pontosan milyen fĂˇjlok kĂ©szĂĽlnek.

### Minimum output

- `AGENTS.md`
- `CLAUDE.md`
- `CODEX_PROMPTS.md`
- `REVIEWER_PROMPT.md`
- `SECURITY_REVIEW.md`
- `TESTING_STRATEGY.md`
- `CI_QUALITY_GATE.yml`
- `MCP_READINESS.md`
- `MCP_SECURITY_POLICY.md`
- `MCP_SERVER_RECOMMENDATIONS.md`
- `MCP_TOOL_ALLOWLIST.md`
- `AI_ACT_READINESS_CHECKLIST.md`
- `TRANSPARENCY_NOTICE_DRAFT.md`
- `EVAL_TEST_CASES.md`
- `RED_TEAM_PROMPTS.md`
- `CLIENT_HANDOFF_REPORT.md`
- kĂ©sĹ‘bb PDF export.

## 3. Technikai szĂĽksĂ©gletek

### Frontend

- ShipSeal UI ĂşjrapozicionĂˇlĂˇsa.
- Intake form hozzĂˇadĂˇsa AI-app kontextushoz.
- Report preview UI.
- Skills Pack tab.
- EU AI Act readiness tab.
- VerdictMesh / Review Council tab.
- Export flow javĂ­tĂˇsa.
- FizetĂ©s vagy vĂˇrĂłlista CTA.

### Backend

MVP-ben mĂ©g lehet backend nĂ©lkĂĽli/fĂ©lautomata, de 60 napon belĂĽl kelleni fog:

- provider API hĂ­vĂˇsok server-side,
- secret management,
- rate limiting,
- report job stĂˇtusz,
- artifact retention,
- alap storage,
- user/session kezelĂ©s.

### Scanner

- ZIP limit Ă©s file count limit megtartĂˇsa.
- Public GitHub import fallback javĂ­tĂˇsa.
- Repo context pack bĹ‘vĂ­tĂ©se promptokkal Ă©s AI-app leĂ­rĂˇssal.
- Secret/sensitive file red flag bĹ‘vĂ­tĂ©se.
- Generated/vendor folder kezelĂ©s megtartĂˇsa.

### Pack generator

- Skills Pack generĂˇlĂˇs.
- AI Act checklist generĂˇlĂˇs.
- Red-team/eval pack generĂˇlĂˇs.
- Client handoff report generĂˇlĂˇs.
- White-label mezĹ‘k.

### Review Council

- AI2AI service szĹ±kĂ­tĂ©se ShipSeal szerepekre:
  - QA Reviewer,
  - Security Reviewer,
  - EU AI Act Readiness Reviewer,
  - Product/Delivery Reviewer,
  - Skeptical Customer,
  - Final Judge.
- Nem kell az Ă¶sszes rĂ©gi scenario.
- KĂ¶ltsĂ©gbecslĂ©s Ă©s token limit kell.

## 4. InfrastrukturĂˇlis szĂĽksĂ©gletek

### MVP

- Vercel/Netlify frontend deploy.
- Backend nĂ©lkĂĽl vagy minimĂˇlis backenddel indulĂˇs.
- Minta riportok statikus exportkĂ©nt.
- Analytics: Plausible, PostHog vagy egyszerĹ± event log.
- Form: Tally/Typeform/own form.

### FizetĹ‘s validĂˇciĂłhoz

- Stripe vagy Lemon Squeezy.
- Email capture.
- Report delivery link.
- Terms / privacy oldal.
- â€žNot legal adviceâ€ť disclaimer.

### KĂ©sĹ‘bb

- Object storage ideiglenes uploadokhoz.
- Queue / worker.
- Backend scanning.
- GitHub App.
- Auth + organizations.
- Report history.
- Self-hosted lehetĹ‘sĂ©g.

## 5. AdatvĂ©delmi Ă©s biztonsĂˇgi szĂĽksĂ©gletek

Mivel repo ZIP-eket, promptokat, ĂĽzleti dokumentĂˇciĂłt Ă©s AI-app leĂ­rĂˇsokat kezelĂĽnk, kĂĽlĂ¶nĂ¶sen fontos:

- explicit user consent upload elĹ‘tt,
- retention policy,
- local-first vagy short-lived artifact policy,
- raw source ne menjen AI providerhez csak sanitized context pack,
- secrets redaction,
- no-code-execution guarantee,
- audit log,
- tĂ¶rlĂ©si lehetĹ‘sĂ©g,
- privacy policy.

## 6. TesztelĂ©si szĂĽksĂ©gletek

### Automata

- unit tesztek scannerre,
- scoring snapshot tesztek,
- pack output snapshot tesztek,
- EU Act checklist decision tree tesztek,
- PDF/Markdown export tesztek,
- API smoke tesztek.

### ManuĂˇlis

- kis Next.js sample repo,
- Python FastAPI sample,
- no-code style AI app description,
- RAG chatbot example,
- dokumentum-AI example,
- intentionally bad repo / missing docs example.

### Quality gates

- `npm run build`
- `npm run test`
- `npm run lint`
- Python backend smoke test
- AI2AI regression subset

## 7. Sales/validĂˇciĂłs szĂĽksĂ©gletek

- 1 oldalas landing page.
- 2 minta riport.
- 1 demo videĂł.
- 30 cĂ©lzott megkeresĂ©si lista.
- 5 interjĂş kĂ©rdĂ©ssor.
- FizetĂ©si ajĂˇnlat: 49 EUR / 149 EUR / founder-reviewed.

## 8. FejlesztĂ©si ĂĽtemezĂ©s

### Sprint 0 - projektindĂ­tĂˇs

- Ăšj repo / Ăşj projekt setup.
- ForrĂˇsok feltĂ¶ltĂ©se.
- Dokumentumok Ă©s scope rĂ¶gzĂ­tĂ©se.
- DĂ¶ntĂ©s: agentready-hub legyen az alap.

### Sprint 1 - output-spec Ă©s UI reposition

- Ăšj landing szĂ¶veg.
- Ăšj report struktĂşra.
- Intake form.
- Report preview skeleton.

### Sprint 2 - Delivery Pack MVP

- AGENTS/CLAUDE meglĂ©vĹ‘ generĂˇtor finomĂ­tĂˇsa.
- Skills Pack generĂˇtor.
- MCP pack megtartĂˇsa/bĹ‘vĂ­tĂ©se.
- Eval/red-team pack generĂˇlĂˇs.

### Sprint 3 - AI Act readiness MVP

- Role/risk intake kĂ©rdĂ©sek.
- Transparency checklist.
- Disclaimer.
- ĂśgyvĂ©d review.

### Sprint 4 - Review Council MVP

- AI2AI backend adapter.
- 5 szerep + final judge.
- Council summary beemelĂ©se reportba.

### Sprint 5 - fizetĹ‘s demo

- PDF/Markdown export.
- White-label mezĹ‘k.
- Landing CTA.
- ElsĹ‘ fizetĹ‘s riportok.

## 9. Kill criteria

Le kell Ăˇllni vagy pivotĂˇlni, ha 60 napon belĂĽl:

- 30 megkeresĂ©sbĹ‘l nincs legalĂˇbb 3 erĹ‘s Ă©rdeklĹ‘dĹ‘,
- senki nem fizetne 49 EUR-t sem egy reportĂ©rt,
- a cĂ©lcsoport szerint az AGENTS/CLAUDE output Ă¶nmagĂˇban elĂ©g Ă©s nem kell AI Act / report,
- a jogi kommunikĂˇciĂł tĂşl kockĂˇzatosnak bizonyul,
- az output minĹ‘sĂ©ge nem jobb, mint egy sima ChatGPT prompt.

## 10. Legfontosabb kĂ¶vetkezĹ‘ fejlesztĹ‘i feladatok

1. Ăšj `CLIENT_HANDOFF_REPORT.md` sablon megĂ­rĂˇsa.
2. `AI_ACT_READINESS_CHECKLIST.md` output definiĂˇlĂˇsa.
3. `SKILL.md` generĂˇtor hozzĂˇadĂˇsa.
4. ShipSeal frontend Ăşj landing copy.
5. AI2AI Review Council szerepek beszĹ±kĂ­tĂ©se.
6. Minta AI-app alapjĂˇn minta riport kĂ©szĂ­tĂ©se.
---

# 05 - EU AI Act Ă©s jogi workstream

## CĂ©l

A ShipSeal EU AI Act modulja ne legyen jogi tanĂˇcsadĂł eszkĂ¶z. A cĂ©l egy olyan elĹ‘szĹ±rĹ‘ Ă©s dokumentĂˇciĂł-elĹ‘kĂ©szĂ­tĹ‘ funkciĂł, amely segĂ­t AI fejlesztĹ‘knek Ă©s ĂĽgynĂ¶ksĂ©geknek rendezni a kĂ©rdĂ©seket, amelyeket egy jogĂˇsz vagy compliance szakĂ©rtĹ‘ kĂ©sĹ‘bb ellenĹ‘rizhet.

A felesĂ©g jogi szakĂ©rtelme itt komoly elĹ‘ny lehet, de a termĂ©kben Ă©s marketingben Ăłvatosan kell fogalmazni.

## AjĂˇnlott jogi pozicionĂˇlĂˇs

### KerĂĽlendĹ‘ ĂˇllĂ­tĂˇsok

- â€žAI Act compliant minĹ‘sĂ­tĂ©st adunk.â€ť
- â€žJogi megfelelĹ‘sĂ©get igazolunk.â€ť
- â€žMegmondjuk, hogy high-risk-e a rendszered jogilag.â€ť
- â€žKivĂˇltjuk a jogi tanĂˇcsadĂˇst.â€ť

### HasznĂˇlhatĂł ĂˇllĂ­tĂˇsok

- â€žAI Act readiness elĹ‘szĹ±rĂ©st kĂ©szĂ­tĂĽnk.â€ť
- â€žĂ–sszegyĹ±jtjĂĽk a jogi review-hoz szĂĽksĂ©ges technikai Ă©s mĹ±kĂ¶dĂ©si informĂˇciĂłkat.â€ť
- â€žTransparency / disclosure javaslatokat kĂ©szĂ­tĂĽnk.â€ť
- â€žKĂ©rdĂ©slistĂˇt adunk jogi ellenĹ‘rzĂ©shez.â€ť
- â€žNem jogi tanĂˇcsadĂˇs, hanem fejlesztĹ‘i Ă©s termĂ©koldali felkĂ©szĂĽltsĂ©gi riport.â€ť

## Mit kell a jogi workstreamben tisztĂˇzni?

### 1. SzerepkĂ¶rĂ¶k

- Provider, deployer, importer, distributor fogalmak gyakorlati kĂĽlĂ¶nbsĂ©ge.
- Egy AI freelancer vagy ĂĽgynĂ¶ksĂ©g mikor provider?
- Az ĂĽgyfĂ©l mikor deployer?
- White-label fejlesztĂ©snĂ©l ki milyen szerepet viselhet?
- Magyar KKV-k esetĂ©n milyen tipikus szerzĹ‘dĂ©ses helyzetek vannak?

### 2. KockĂˇzati kategĂłriĂˇk

- Tiltott AI gyakorlatok rĂ¶vid, fejlesztĹ‘barĂˇt magyarĂˇzata.
- High-risk elĹ‘szĹ±rĂ©s Annex III tĂ©mĂˇk alapjĂˇn.
- Mely use case-eket kell MVP-ben automatikusan â€žlegal review requiredâ€ť jelzĂ©ssel ellĂˇtni?
- Mikor lehet â€žminimal/limited riskâ€ť irĂˇnyban kommunikĂˇlni?

### 3. Transparency / Article 50

A 2026. mĂˇjusi European Commission draft guidance alapjĂˇn a transparency kĂ¶telezettsĂ©gek kĂĽlĂ¶nĂ¶sen fontosak lehetnek. TisztĂˇzandĂł:

- Mikor kell jelezni, hogy a felhasznĂˇlĂł AI rendszerrel beszĂ©l?
- Milyen chatbot disclosure szĂ¶veg legyen ajĂˇnlott?
- Mikor kell AI-generĂˇlt tartalmat jelĂ¶lni?
- Mikor kell deepfake vagy manipulĂˇlt tartalom disclosure?
- Milyen â€žfirst interactionâ€ť / â€žfirst exposureâ€ť szĂ¶vegek legyenek?
- Magyar nyelvĹ± mintaszĂ¶vegek hogyan hangozzanak?

### 4. Emberi felĂĽgyelet

- Mit jelenthet low-risk / limited-risk appoknĂˇl az emberi ellenĹ‘rzĂ©s?
- Milyen dĂ¶ntĂ©seket nem hozhat az AI Ă¶nĂˇllĂłan?
- Milyen terĂĽleteken kell automatikus â€žhuman review requiredâ€ť jelzĂ©s?
- Hogyan fogalmazzuk meg ezt ĂĽgyfĂ©lĂˇtadĂˇsi riportban?

### 5. AdatvĂ©delem / GDPR kapcsolĂłdĂˇs

BĂˇr ez nem csak AI Act kĂ©rdĂ©s, a termĂ©knek kĂ©rdeznie kell:

- kezel-e szemĂ©lyes adatot,
- kezel-e kĂĽlĂ¶nleges adatot,
- kerĂĽl-e adat kĂĽlsĹ‘ AI providerhez,
- van-e adatfeldolgozĂłi viszony,
- van-e tĂ¶rlĂ©si Ă©s retention policy,
- van-e naplĂłzĂˇs,
- van-e adatminimalizĂˇlĂˇs.

### 6. SzerzĹ‘dĂ©ses Ă©s felelĹ‘ssĂ©gi keretek

- Mit vĂˇllalhat egy AI ĂĽgynĂ¶ksĂ©g az ĂĽgyfĂ©l felĂ©?
- Mit nem szabad Ă­gĂ©rnie?
- Milyen ĂˇtadĂˇsi disclaimer szĂĽksĂ©ges?
- Hogyan jelĂ¶ljĂĽk, hogy a riport pillanatfelvĂ©tel?
- Hogyan kezeljĂĽk, hogy a jog vĂˇltozhat?

## FelesĂ©g / jogĂˇsz Ăˇltal segĂ­thetĹ‘ konkrĂ©t feladatok

### A. TermĂ©knyelvezet ellenĹ‘rzĂ©se

EllenĹ‘rizze:

- landing page ĂˇllĂ­tĂˇsait,
- pricing oldal ĂˇllĂ­tĂˇsait,
- report disclaimereket,
- â€žnot legal adviceâ€ť megfogalmazĂˇst,
- magyar Ă©s angol kockĂˇzati figyelmeztetĂ©seket.

### B. AI Act kĂ©rdĹ‘Ă­v review

SegĂ­tsen kialakĂ­tani:

- provider/deployer kĂ©rdĂ©ssort,
- high-risk elĹ‘szĹ±rĹ‘ kĂ©rdĂ©ssort,
- Article 50 transparency kĂ©rdĂ©seket,
- human oversight kĂ©rdĂ©seket,
- legal review required trigger pontokat.

### C. MintaszĂ¶vegek

KĂ©szĂ­thet / ellenĹ‘rizhet:

- chatbot disclosure magyarul,
- chatbot disclosure angolul,
- AI-generated content jelĂ¶lĂ©si szĂ¶veg,
- ĂĽgyfĂ©lĂˇtadĂˇsi disclaimer,
- report footer disclaimer,
- Terms / privacy alap-szĂ¶veg vĂˇz.

### D. Red flag lista

SegĂ­thet meghatĂˇrozni, mikor jelezzen a rendszer:

- â€žlegal review strongly recommendedâ€ť,
- â€ždo not ship before legal reviewâ€ť,
- â€žhigh-risk possibilityâ€ť,
- â€žtransparency notice missingâ€ť,
- â€žpersonal data handling unclearâ€ť.

### E. Magyar piaci sajĂˇtossĂˇgok

Ă‰rtelmezheti:

- magyar KKV-k szĂˇmĂˇra milyen kommunikĂˇciĂł Ă©rthetĹ‘,
- hogyan kerĂĽlhetĹ‘ el a jogi tanĂˇcsadĂˇs lĂˇtszata,
- milyen felelĹ‘ssĂ©gi kizĂˇrĂˇsok szĂĽksĂ©gesek,
- milyen szerzĹ‘dĂ©ses modell javasolt founder-reviewed auditoknĂˇl.

## Jogi inputbĂłl kĂ©szĂĽlĹ‘ ShipSeal outputok

### `AI_ACT_READINESS_CHECKLIST.md`

Tartalom:

- alkalmazĂˇs cĂ©lja,
- szerepkĂ¶rĂ¶k,
- felhasznĂˇlĂłi kĂ¶r,
- kezelt adatok,
- kockĂˇzati elĹ‘szĹ±rĂ©s,
- transparency kĂ©rdĂ©sek,
- human oversight,
- legal review triggers.

### `TRANSPARENCY_NOTICE_DRAFT.md`

Tartalom:

- rĂ¶vid disclosure,
- bĹ‘vebb disclosure,
- chatbot kezdĹ‘ĂĽzenet,
- footer / help page szĂ¶veg,
- AI-generated content jelĂ¶lĂ©si sablon.

### `LEGAL_REVIEW_QUESTIONS.md`

Tartalom:

- jogĂˇsznak ĂˇtadandĂł kĂ©rdĂ©sek,
- tisztĂˇzandĂł szerepkĂ¶rĂ¶k,
- ĂĽgyfĂ©loldali dĂ¶ntĂ©sek,
- szerzĹ‘dĂ©ses felelĹ‘ssĂ©g,
- adatvĂ©delmi hiĂˇnyok.

### `CLIENT_HANDOFF_LEGAL_NOTES.md`

Tartalom:

- mit vizsgĂˇltunk,
- mit nem vizsgĂˇltunk,
- mihez kell jogi review,
- milyen ismert korlĂˇtok vannak.

## Javasolt disclaimer sablon

> Ez a riport technikai, termĂ©koldali Ă©s elĹ‘zetes AI Act readiness elemzĂ©s. Nem minĹ‘sĂĽl jogi tanĂˇcsadĂˇsnak, jogi szakvĂ©lemĂ©nynek vagy hatĂłsĂˇgi megfelelĹ‘sĂ©gi igazolĂˇsnak. A riport cĂ©lja, hogy Ă¶sszegyĹ±jtse az AI-rendszerrel kapcsolatos fĹ‘bb kockĂˇzati, ĂˇtlĂˇthatĂłsĂˇgi, emberi felĂĽgyeleti Ă©s dokumentĂˇciĂłs kĂ©rdĂ©seket, amelyeket szĂĽksĂ©g esetĂ©n jogi szakĂ©rtĹ‘vel kell ellenĹ‘riztetni.

Angol vĂˇltozat:

> This report is a technical, product and preliminary AI Act readiness assessment. It does not constitute legal advice, a legal opinion or a formal compliance certification. Its purpose is to organize the main risk, transparency, human oversight and documentation questions related to the AI system so they can be reviewed by a qualified legal professional where necessary.

## ElsĹ‘ jogi sprint feladatai

1. AI Act role/risk kĂ©rdĹ‘Ă­v elsĹ‘ vĂˇltozatĂˇnak ellenĹ‘rzĂ©se.
2. Transparency notice sablonok megĂ­rĂˇsa magyarul Ă©s angolul.
3. â€žNot legal adviceâ€ť Ă©s report disclaimer jĂłvĂˇhagyĂˇsa.
4. High-risk red flag trigger lista kĂ©szĂ­tĂ©se.
5. Founder-reviewed audit szerzĹ‘dĂ©ses keretĂ©nek elĹ‘zetes vĂˇzlata.

## HivatkozĂˇsi alapok

A stratĂ©gia az alĂˇbbi, nyilvĂˇnos Ă©s aktuĂˇlis technolĂłgiai/jogi irĂˇnyokra Ă©pĂ­t:

- EU AI Act: Regulation (EU) 2024/1689, risk-based AI rules; European Commission AI Act overview: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- European Commission AI Act Service Desk Compliance Checker: https://ai-act-service-desk.ec.europa.eu/en/eu-ai-act-compliance-checker
- European Commission Article 50 transparency draft guidance / consultation, 2026. mĂˇjus: https://digital-strategy.ec.europa.eu/en/consultations/consultation-draft-guidelines-transparency-obligations-under-ai-act
- AGENTS.md nyĂ­lt formĂˇtum: https://agents.md/
- Claude Code CLAUDE.md / memory dokumentĂˇciĂł: https://code.claude.com/docs/en/memory
- Claude Code Skills dokumentĂˇciĂł: https://code.claude.com/docs/en/skills
- Model Context Protocol dokumentĂˇciĂł: https://modelcontextprotocol.io/docs/getting-started/intro

MegjegyzĂ©s: az EU AI Act Ă©rtelmezĂ©si rĂ©szek nem minĹ‘sĂĽlnek jogi tanĂˇcsadĂˇsnak. A termĂ©k kommunikĂˇciĂłjĂˇban is ezt kell kĂ¶vetkezetesen feltĂĽntetni: elĹ‘szĹ±rĂ©s, readiness, dokumentĂˇciĂł-elĹ‘kĂ©szĂ­tĂ©s Ă©s technikai/jogi kĂ©rdĂ©slista kĂ©szĂĽl, nem jogi szakvĂ©lemĂ©ny.
---

# 06 - ShipSeal MVP output specifikĂˇciĂł

## MVP cĂ©l

A felhasznĂˇlĂł feltĂ¶lt egy repo ZIP-et vagy megad egy publikus GitHub URL-t, majd kitĂ¶lt egy rĂ¶vid AI-app kontextus kĂ©rdĹ‘Ă­vet. A ShipSeal ebbĹ‘l elkĂ©szĂ­t egy letĂ¶lthetĹ‘ Delivery Pack csomagot.

## Inputok

### KĂ¶telezĹ‘

- Projekt neve
- Repo ZIP vagy GitHub URL
- AI-app rĂ¶vid leĂ­rĂˇsa
- CĂ©lfelhasznĂˇlĂł
- Mire hasznĂˇljĂˇk az AI-t?
- Kezel-e szemĂ©lyes adatot?
- HasznĂˇl-e generatĂ­v AI outputot ĂĽgyfĂ©l/felhasznĂˇlĂł felĂ©?
- Van-e emberi jĂłvĂˇhagyĂˇs?
- EU-ban hasznĂˇljĂˇk-e?

### OpcionĂˇlis

- System prompt
- PĂ©lda user promptok
- PĂ©lda vĂˇlaszok
- HasznĂˇlt modellek
- HasznĂˇlt AI provider
- RAG / dokumentumfeltĂ¶ltĂ©s leĂ­rĂˇsa
- API endpoint / demo URL
- ĂśgyfĂ©l neve
- ĂśgynĂ¶ksĂ©g neve / logĂł

## Outputcsomag struktĂşra

```text
shipseal-delivery-pack-[project]/
  01-agent-instructions/
    AGENTS.md
    CLAUDE.md
    CODEX_PROMPTS.md
    REVIEWER_PROMPT.md
  02-skills/
    code-review/SKILL.md
    test-generation/SKILL.md
    ai-act-readiness/SKILL.md
    release-check/SKILL.md
    client-handoff/SKILL.md
  03-mcp-governance/
    MCP_READINESS.md
    MCP_SECURITY_POLICY.md
    MCP_SERVER_RECOMMENDATIONS.md
    MCP_TOOL_ALLOWLIST.md
  04-testing/
    EVAL_TEST_CASES.md
    RED_TEAM_PROMPTS.md
    TESTING_STRATEGY.md
    CI_QUALITY_GATE.yml
  05-ai-act-readiness/
    AI_ACT_READINESS_CHECKLIST.md
    TRANSPARENCY_NOTICE_DRAFT.md
    LEGAL_REVIEW_QUESTIONS.md
  06-client-handoff/
    CLIENT_HANDOFF_REPORT.md
    EXECUTIVE_SUMMARY.md
    NEXT_STEPS_ROADMAP.md
  07-context/
    REPO_CONTEXT_PACK.md
    repo-context-pack.json
  score.json
```

## Readiness score dimenziĂłk

### 1. Agent readiness

- van-e README,
- van-e setup/run/test informĂˇciĂł,
- van-e AGENTS/CLAUDE/Cursor/Codex instruction,
- egyĂ©rtelmĹ±-e a repo struktĂşra,
- biztonsĂˇgos-e agentekkel dolgozni.

### 2. Delivery readiness

- ĂˇtadhatĂł-e ĂĽgyfĂ©lnek,
- van-e dokumentĂˇciĂł,
- van-e ismert korlĂˇtlista,
- van-e tesztelĂ©si bizonyĂ­tĂ©k,
- van-e roadmap.

### 3. Eval readiness

- vannak-e tesztesetek,
- van-e red-team prompt,
- van-e hallucination / injection / boundary teszt,
- van-e manuĂˇlis validĂˇciĂł.

### 4. MCP readiness

- indokolt-e MCP,
- milyen tool/data source kell,
- mennyire kockĂˇzatos,
- van-e allowlist,
- van-e audit log javaslat.

### 5. EU AI Act readiness

- EU-ban hasznĂˇljĂˇk-e,
- AI interaction disclosure szĂĽksĂ©ges-e,
- generĂˇlt tartalom jelĂ¶lĂ©se szĂĽksĂ©ges-e,
- high-risk lehetĹ‘sĂ©g van-e,
- human oversight megvan-e,
- jogi review trigger aktivĂˇlĂłdik-e.

## Go / no-go kategĂłriĂˇk

- **Ready for internal development** - agentekkel tovĂˇbbfejleszthetĹ‘, de ĂĽgyfĂ©lnek mĂ©g nem adhatĂł.
- **Ready for demo** - demĂłzhatĂł, de nincs teljes ĂˇtadĂˇsi dokumentĂˇciĂł.
- **Ready for client pilot** - korlĂˇtozott ĂĽgyfĂ©l pilotra alkalmas human review-val.
- **Not ready** - kritikus technikai/dokumentĂˇciĂłs/compliance hiĂˇny.
- **Legal review required** - jogi ellenĹ‘rzĂ©s nĂ©lkĂĽl nem javasolt Ă©lesĂ­tĂ©s/ĂˇtadĂˇs.

## Review Council szerepek

### QA Reviewer

VizsgĂˇlja:

- tesztelhetĹ‘sĂ©g,
- edge case-ek,
- regressziĂłs kockĂˇzat,
- output stabilitĂˇs.

### Security Reviewer

VizsgĂˇlja:

- secret leakage,
- prompt injection,
- adatkiĂˇramlĂˇs,
- tĂşl szĂ©les MCP/tool hozzĂˇfĂ©rĂ©s.

### EU AI Act Readiness Reviewer

VizsgĂˇlja:

- transparency,
- szerepkĂ¶r,
- high-risk signal,
- human oversight,
- legal review triggers.

### Product/Delivery Reviewer

VizsgĂˇlja:

- Ă©rthetĹ‘ termĂ©kĂ­gĂ©ret,
- ĂĽgyfĂ©lĂˇtadĂˇsi minĹ‘sĂ©g,
- hiĂˇnyzĂł dokumentĂˇciĂł,
- roadmap realitĂˇs.

### Skeptical Customer

VizsgĂˇlja:

- miben nem bĂ­znĂˇ az ĂĽgyfĂ©l,
- milyen kĂ©rdĂ©seket tenne fel,
- mi hiĂˇnyzik ahhoz, hogy Ăˇtvegye.

### Final Judge

Ă–sszesĂ­ti:

- readiness score,
- fĹ‘ kockĂˇzatok,
- go/no-go,
- kĂ¶vetkezĹ‘ javĂ­tĂˇsok.

## ElsĹ‘ demo scenario

TĂ¶ltsĂĽnk fel egy sajĂˇt AI miniappot, pĂ©ldĂˇul:

- AI chatbot,
- RAG dokumentumasszisztens,
- AI_COMP egyik modulja,
- VerdictMesh frontend,
- ShipSeal sajĂˇt repo.

A demo vĂ©gĂ©n legyen letĂ¶lthetĹ‘ egy Delivery Pack ZIP.

## MVP elfogadĂˇsi kritĂ©rium

Az MVP akkor jĂł, ha egy AI freelancer ezt mondanĂˇ:

> Ezt a csomagot tĂ©nyleg be tudom tenni az ĂĽgyfĂ©lĂˇtadĂˇs mellĂ©, Ă©s jobb szĂ­nben tĂĽnteti fel a munkĂˇmat.
---

# 07 - FejlesztĂ©si kezdĹ‘pont Ă©s elsĹ‘ sprintek

## RĂ¶vid dĂ¶ntĂ©s

A fejlesztĂ©st **nem** az AI2AI/VerdictMesh integrĂˇciĂłval Ă©s nem teljes monorepo-ĂˇtalakĂ­tĂˇssal Ă©rdemes kezdeni.

A leggyorsabb eladhatĂł irĂˇny:

**az `agentready-hub-main` frontendbĹ‘l kĂ©szĂ­tsĂĽnk ShipSeal MVP-t, Ă©s elĹ‘szĂ¶r a Delivery Pack exportot tegyĂĽk teljessĂ©.**

Ez azĂ©rt a legjobb kezdĹ‘pont, mert mĂˇr van mĹ±kĂ¶dĹ‘ React/Vite/TypeScript felĂĽlet, ZIP-feltĂ¶ltĂ©s, repo-szkenner, readiness scoring Ă©s ZIP export. A hiĂˇnyzĂł Ă©rtĂ©k most nem a lĂˇtvĂˇnyos council UI, hanem az, hogy a kimeneti csomag pontosan azt adja, amit az elsĹ‘ fizetĹ‘s ĂĽgyfĂ©lnek oda lehet adni.

## ElsĹ‘ fejlesztĂ©si cĂ©l

Az elsĹ‘ mĹ±kĂ¶dĹ‘ ShipSeal MVP egy ZIP vagy publikus GitHub repo alapjĂˇn generĂˇljon egy letĂ¶lthetĹ‘ csomagot:

```text
shipseal-delivery-pack-[project]/
  01-agent-instructions/
  02-skills/
  03-mcp-governance/
  04-testing/
  05-ai-act-readiness/
  06-client-handoff/
  07-context/
  score.json
```

## ElsĹ‘ branch

Javasolt branch nĂ©v:

```bash
git checkout -b shipseal-mvp-delivery-pack
```

## 1. lĂ©pĂ©s - Rebrand Ă©s technikai alap tisztĂ­tĂˇsa

Feladatok:

- UI szĂ¶vegek ĂˇtĂ­rĂˇsa AgentReadyrĹ‘l ShipSealre.
- Export ZIP fĂˇjlnevek ĂˇtĂ­rĂˇsa `shipseal-agent-pack-*` vagy `shipseal-delivery-pack-*` formĂˇra.
- README Ă©s docs alap ĂˇtnevezĂ©se.
- Tesztek frissĂ­tĂ©se az Ăşj fĂˇjlnevekre.
- A rĂ©gi forrĂˇsnevek megĹ‘rzĂ©se csak belsĹ‘ technikai referenciakĂ©nt.

ElsĹ‘kĂ©nt ellenĹ‘rizendĹ‘ fĂˇjlok az `agentready-hub-main` forrĂˇsban:

```text
src/lib/exports.ts
src/lib/agentPack.ts
src/lib/readiness.ts
src/components/agentready/Landing.tsx
src/components/agentready/ResultDashboard.tsx
src/components/agentready/AgentPackTabs.tsx
src/test/readiness.test.ts
README.md
docs/
```

## 2. lĂ©pĂ©s - Delivery Pack output contract

Hozzunk lĂ©tre egy explicit output szerzĹ‘dĂ©st, pĂ©ldĂˇul:

```text
src/lib/deliveryPack/manifest.ts
src/lib/deliveryPack/generators.ts
src/lib/deliveryPack/types.ts
```

A manifest mondja meg, hogy pontosan milyen fĂˇjlokat kell generĂˇlni. Ez azĂ©rt fontos, mert innentĹ‘l minden fejlesztĂ©s ehhez mĂ©rhetĹ‘.

Minimum generĂˇlandĂł fĂˇjlok:

- `AGENTS.md`
- `CLAUDE.md`
- `CODEX_PROMPTS.md`
- `REVIEWER_PROMPT.md`
- 3-5 darab `SKILL.md`
- `MCP_READINESS.md`
- `MCP_SECURITY_POLICY.md`
- `MCP_SERVER_RECOMMENDATIONS.md`
- `MCP_TOOL_ALLOWLIST.md`
- `EVAL_TEST_CASES.md`
- `RED_TEAM_PROMPTS.md`
- `TESTING_STRATEGY.md`
- `CI_QUALITY_GATE.yml`
- `AI_ACT_READINESS_CHECKLIST.md`
- `TRANSPARENCY_NOTICE_DRAFT.md`
- `LEGAL_REVIEW_QUESTIONS.md`
- `CLIENT_HANDOFF_REPORT.md`
- `EXECUTIVE_SUMMARY.md`
- `NEXT_STEPS_ROADMAP.md`
- `REPO_CONTEXT_PACK.md`
- `repo-context-pack.json`
- `score.json`

## 3. lĂ©pĂ©s - Intake form hozzĂˇadĂˇsa

A repo Ă¶nmagĂˇban nem elĂ©g az EU AI Act Ă©s ĂĽgyfĂ©lĂˇtadĂˇsi riporthoz. Kell egy rĂ¶vid kĂ©rdĹ‘Ă­v.

ElsĹ‘ MVP mezĹ‘k:

- projekt neve,
- AI-app rĂ¶vid leĂ­rĂˇsa,
- cĂ©lfelhasznĂˇlĂł,
- mire hasznĂˇljĂˇk az AI-t,
- EU-ban hasznĂˇljĂˇk-e,
- kezel-e szemĂ©lyes adatot,
- generĂˇl-e tartalmat vĂ©gfelhasznĂˇlĂłnak,
- van-e emberi jĂłvĂˇhagyĂˇs,
- hasznĂˇlt AI provider / modell,
- ĂĽgyfĂ©l neve opcionĂˇlisan,
- ĂĽgynĂ¶ksĂ©g neve opcionĂˇlisan.

## 4. lĂ©pĂ©s - HiĂˇnyzĂł generĂˇtorok megĂ­rĂˇsa

A jelenlegi forrĂˇs mĂˇr tud agent pack Ă©s MCP jellegĹ± anyagokat generĂˇlni. A ShipSeal MVP-hez a legfontosabb hiĂˇnyzĂł generĂˇtorok:

1. `AI_ACT_READINESS_CHECKLIST.md`
2. `TRANSPARENCY_NOTICE_DRAFT.md`
3. `LEGAL_REVIEW_QUESTIONS.md`
4. `EVAL_TEST_CASES.md` - legalĂˇbb 30 teszteset
5. `RED_TEAM_PROMPTS.md` - legalĂˇbb 10 red-team prompt
6. `CLIENT_HANDOFF_REPORT.md`
7. `EXECUTIVE_SUMMARY.md`
8. `NEXT_STEPS_ROADMAP.md`
9. `02-skills/*/SKILL.md` csomagok

## 5. lĂ©pĂ©s - Tesztek Ă©s elfogadĂˇsi feltĂ©telek

ElsĹ‘ MVP elfogadĂˇsi kritĂ©rium:

- ZIP feltĂ¶ltĂ©s utĂˇn lefut a scan.
- LĂˇtszik a ShipSeal score.
- A felhasznĂˇlĂł ki tud tĂ¶lteni egy rĂ¶vid intake formot.
- Egy gombbal letĂ¶lthetĹ‘ a teljes `shipseal-delivery-pack` ZIP.
- A ZIP-ben minden kĂ¶telezĹ‘ fĂˇjl benne van.
- A teszt ellenĹ‘rzi a fĂˇjlneveket, a mappastruktĂşrĂˇt Ă©s a minimum tartalmi elemeket.

Javasolt elsĹ‘ teszt:

```text
src/test/deliveryPack.test.ts
```

## Mit ne most csinĂˇljunk?

Az elsĹ‘ MVP elĹ‘tt ne ezzel kezdjĂĽnk:

- teljes monorepo migrĂˇciĂł,
- auth/fizetĂ©s,
- private GitHub App,
- teljes AI2AI multi-model integrĂˇciĂł,
- VerdictMesh UI teljes beolvasztĂˇsa,
- automatikus jogi minĹ‘sĂ­tĂ©s,
- enterprise dashboard.

Ezek fontosak lehetnek kĂ©sĹ‘bb, de most lassĂ­tanĂˇk az elsĹ‘ eladhatĂł verziĂłt.

## 30 napos fejlesztĂ©si sorrend

### 1. hĂ©t

- Rebrand ShipSealre.
- Delivery Pack manifest.
- Export ZIP struktĂşra.
- Tesztek frissĂ­tĂ©se.

### 2. hĂ©t

- Intake form.
- AI Act checklist generĂˇtor.
- Transparency notice generĂˇtor.
- Legal review questions generĂˇtor.

### 3. hĂ©t

- 30 eval teszteset generĂˇtor.
- 10 red-team prompt generĂˇtor.
- SKILL.md generĂˇtorok.
- Client handoff report v1.

### 4. hĂ©t

- Report preview UI.
- White-label mezĹ‘k.
- LetĂ¶lthetĹ‘ teljes csomag.
- 3 minta repo alapjĂˇn manuĂˇlis validĂˇciĂł.

## KĂ¶vetkezĹ‘ konkrĂ©t parancs

A fejlesztĂ©st ezzel Ă©rdemes indĂ­tani a lokĂˇlis forrĂˇsban:

```bash
cd agentready-hub-main
git checkout -b shipseal-mvp-delivery-pack
npm install
npm run test
npm run build
```

Ha ez lefut, akkor az elsĹ‘ kĂłdmĂłdosĂ­tĂˇs a `src/lib/exports.ts` Ă©s a hozzĂˇ kapcsolĂłdĂł teszt legyen, hogy az exportĂˇlt ZIP neve Ă©s struktĂşrĂˇja mĂˇr ShipSeal irĂˇnyba menjen.

