# ShipSeal projektindító dokumentáció

Frissítve: 2026-06-01

Ez a dokumentum a ShipSeal projekt egységes, projektindító dokumentációja.

---

# 00 - Új projekt kontextus és feltöltési instrukció

## Cél

Ebben az új projektben a ShipSeal nevű terméket szeretnénk kialakítani. A cél nem egy újabb általános AI app, hanem egy olyan AI-projekt átadás-előkészítő rendszer, amely AI prototípusokból agent-ready, tesztelhető, dokumentált és ügyfélnek átadható projektcsomagot készít.

## Rövid termékdefiníció

ShipSeal átvizsgálja az AI-projekt forrásait, dokumentációját és működési leírását, majd elkészíti azokat a fejlesztési, tesztelési, agent-instruction, MCP-governance, EU AI Act readiness és ügyfélátadási dokumentumokat, amelyekre egy AI freelancernek, AI ügynökségnek vagy kis SaaS-fejlesztőnek szüksége van az ügyfélátadás előtt.

## Feltöltendő források

Az új projektbe töltsük fel a következő ZIP-eket:

1. `agentready-hub-main (1).zip`
   - jelenlegi néven agentready-hub; a ShipSeal frontend és repo-szkenner alapja,
   - AGENTS.md / CLAUDE.md / MCP governance / readiness report generálás,
   - React + Vite + TypeScript + shadcn/ui alap.

2. `ai2ai-main (1).zip`
   - multi-model Expert Council / AI Debate backend,
   - Python CLI + opcionális FastAPI API,
   - forrásbetöltés, evidence pack, független modellek, rebuttal, final judge, output contract, riportgenerálás.

3. `verdictmesh-main (1).zip`
   - AI2AI frontend / VerdictMesh felület,
   - Base44-exportált Vite/React frontend,
   - AI2AI backendhez kapcsolható vizuális debate/council UI.

## Új projektben használandó fő prompt

A következő szöveget lehet bemásolni az új projekt első üzeneteként:

> A ShipSeal projektet szeretném továbbfejleszteni. A cél egy AI Project Delivery Pack Generator: AI-projektekből agent-ready fejlesztési fájlokat, Claude/Codex/agent instruction fájlokat, skilleket, MCP governance javaslatot, eval/red-team teszteket, EU AI Act readiness előszűrést és ügyfélnek átadható riportot készít. Feltöltöttem három meglévő félkész forrásprojektet: agentready-hub, ai2ai és verdictmesh. Kérlek, a források alapján segíts egységes architektúrát, MVP-t és fejlesztési roadmapet kialakítani. Ne kezeld őket három külön termékként; a A ShipSeal legyen a fő termék, az AI2AI/VerdictMesh pedig a Review Council / VerdictMesh döntési motor és frontend alapja.

## Fontos stratégiai döntések

- Nem OpenText-specifikus terméket építünk.
- Nem jogi tanácsadó platformot építünk.
- Nem általános AI governance enterprise platformot építünk.
- Nem önálló AI2AI debate játékot építünk.
- Nem csak AGENTS.md generátort építünk.
- A fő termék: AI-projekt átadás-előkészítő és readiness csomag generátor.

## Első MVP célja

Egy feltöltött ZIP vagy publikus GitHub repo alapján készüljön el:

- ShipSeal score,
- AGENTS.md,
- CLAUDE.md,
- 3-5 SKILL.md,
- MCP readiness/governance pack,
- 30 teszteset,
- 10 red-team prompt,
- EU AI Act readiness checklist,
- transparency notice draft,
- white-label ügyfélátadási riport.
---

# 01 - Cég- és termékleírás

## Projekt- és terméknév

**ShipSeal**  
Lehetséges cégnév/márkanév: **ShipSeal Labs** vagy **ShipSeal AI**.

A név jelentése ebben a kontextusban: a termék „lezárja” és átadásra alkalmassá teszi az AI-projektet, mint egy minőségi pecsét az ügyfélátadás előtt.

## Mit csinál a cégünk?

A ShipSeal olyan AI-projekt átadás-előkészítő és readiness platformot fejleszt, amely segít AI freelancereknek, AI ügynökségeknek, no-code/low-code buildereknek és kis SaaS csapatoknak eldönteni, hogy egy AI-alkalmazás készen áll-e ügyfélátadásra, pilotra vagy élesítésre.

A rendszer nemcsak auditál, hanem konkrét átadási anyagokat is előállít:

- agent instruction fájlokat (`AGENTS.md`, `CLAUDE.md`, Codex/Cursor/Windsurf promptok),
- Claude Code / agent skilleket (`SKILL.md` csomagok),
- MCP readiness és governance javaslatot,
- teszteseteket és red-team promptokat,
- EU AI Act readiness előszűrést,
- transparency notice / disclosure szövegtervezeteket,
- ügyfélnek átadható, white-label PDF/Markdown riportot,
- go/no-go döntést és javítási roadmapet.

## Mi a fő probléma?

A generatív AI miatt egyre több kis csapat és freelancer épít gyorsan AI-prototípusokat. A demók sokszor látványosak, de az átadás előtti állapot bizonytalan:

- nincs rendes dokumentáció,
- nincs agenteknek szóló projektkontekstus,
- nincs tesztelési stratégia,
- nincs eval/red-team csomag,
- nincs ügyfélnek átadható readiness riport,
- nincs AI Act / transparency előszűrés,
- nincs tiszta fejlesztési folytatási csomag,
- nincs megválaszolva: „ezt oda merem adni az ügyfélnek?”

A ShipSeal erre a résre épít.

## Egy mondatos termékígéret

**ShipSeal átalakítja az AI-prototípust agent-ready, tesztelhető, dokumentált és ügyfélnek átadható projektcsomaggá.**

Angol landing page verzió:

**Seal your AI project before you ship it: agent-ready, testable and client-ready.**

## Célcsoport

### Elsődleges célcsoport

- AI freelancerek,
- kis AI ügynökségek,
- no-code/low-code AI builderek,
- prompt engineering / automation tanácsadók,
- indie SaaS fejlesztők, akik AI-appot adnak át ügyfeleknek.

### Másodlagos célcsoport

- KKV-k, akik AI-appot rendeltek és független readiness review-t szeretnének,
- AI-képzést / workshopot tartó cégek,
- fejlesztőcsapatok, akik AI coding agentekkel akarják továbbvinni a projektjeiket.

## Miért fizetne ezért valaki?

A célcsoport nem elméleti megfelelőséget vásárol, hanem időt, bizalmat és professzionális átadási anyagot:

- kevesebb manuális dokumentálás,
- gyorsabb ügyfélátadás,
- profibb látszat és valós minőség,
- kevesebb beégési kockázat,
- előre megfogalmazott tesztek és red-team kérdések,
- EU AI Act / transparency témában legalább előszűrt, nem jogi, de rendezett dokumentáció,
- fejlesztési folytatás Claude Code / Codex / más agentek számára.

## Termékmodulok

### 1. Project Intake

Bekéri:

- repo ZIP vagy GitHub URL,
- AI-app célját,
- célfelhasználókat,
- kezelt adattípusokat,
- használt modelleket,
- promptokat,
- példa outputokat,
- emberi jóváhagyási pontokat,
- EU/nem EU célpiacot,
- ügyfélátadási kontextust.

### 2. Repository & Delivery Readiness Scanner

Elemzi:

- projektstruktúrát,
- dokumentációt,
- build/test/lint jeleket,
- meglévő agent instruction fájlokat,
- `.env.example` és secret-kezelési jeleket,
- repo méretét, vendor/generated tartalmakat,
- működési parancsokat.

### 3. Agent Pack Generator

Generálja:

- `AGENTS.md`,
- `CLAUDE.md`,
- `CODEX_PROMPTS.md`,
- `REVIEWER_PROMPT.md`,
- `SECURITY_REVIEW.md`,
- `TESTING_STRATEGY.md`,
- `CI_QUALITY_GATE.yml`.

### 4. Skills Pack Generator

Generálja például:

- `.claude/skills/code-review/SKILL.md`,
- `.claude/skills/test-generation/SKILL.md`,
- `.claude/skills/eu-ai-act-readiness/SKILL.md`,
- `.claude/skills/release-check/SKILL.md`,
- `.claude/skills/client-handoff/SKILL.md`.

### 5. MCP Readiness & Governance

Nem vakon generál MCP szervert. Először eldönti:

- kell-e MCP,
- milyen adatforrás / tool indokolja,
- read-only vagy write-capable legyen-e,
- milyen engedélyezési és naplózási szabály kell,
- milyen security kockázatok vannak.

Első verzióban főleg MCP readiness dokumentáció és skeleton javaslat készüljön, nem production-ready MCP integráció.

### 6. Eval & Red Team Pack

Generál:

- normál teszteseteket,
- edge case teszteket,
- hallucination trap kérdéseket,
- prompt injection próbákat,
- adatkiáramlási teszteket,
- refusal/boundary teszteket,
- consistency teszteket.

### 7. EU AI Act Readiness Pack

Előszűri:

- provider/deployer szerepkört,
- potenciális high-risk irányokat,
- tiltott vagy érzékeny felhasználási jeleket,
- transparency / disclosure kötelezettség jellegű kérdéseket,
- emberi felügyelet meglétét,
- AI-generált tartalom jelölésének szükségességét.

Fontos: a termék nem állíthatja, hogy jogi megfelelőséget igazol. A helyes állítás: **előzetes readiness és kérdéslista jogi review-hoz**.

### 8. VerdictMesh Review Council

Az AI2AI/VerdictMesh technológiára építve több nézőpontú review készülhet:

- QA reviewer,
- Security red teamer,
- EU AI Act / compliance reviewer,
- Product/business reviewer,
- Skeptical customer,
- Final judge.

Ez nem önálló „AI-k vitáznak” termék, hanem a ShipSeal döntési motorja.

## Versenyelőny

ShipSeal nem akar közvetlenül enterprise governance platform, LangSmith-szerű observability rendszer vagy jogi compliance tool lenni. A pozíció:

**az AI-projekt átadás előtti gyakorlati delivery packje kis AI-csapatoknak.**

Ez a rés azért érdekes, mert a legtöbb megoldás vagy túl enterprise, vagy túl fejlesztői, vagy túl jogi. ShipSeal a gyakorlati átadási ponton segít.

## Hivatkozási alapok

A stratégia az alábbi, nyilvános és aktuális technológiai/jogi irányokra épít:

- EU AI Act: Regulation (EU) 2024/1689, risk-based AI rules; European Commission AI Act overview: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- European Commission AI Act Service Desk Compliance Checker: https://ai-act-service-desk.ec.europa.eu/en/eu-ai-act-compliance-checker
- European Commission Article 50 transparency draft guidance / consultation, 2026. május: https://digital-strategy.ec.europa.eu/en/consultations/consultation-draft-guidelines-transparency-obligations-under-ai-act
- AGENTS.md nyílt formátum: https://agents.md/
- Claude Code CLAUDE.md / memory dokumentáció: https://code.claude.com/docs/en/memory
- Claude Code Skills dokumentáció: https://code.claude.com/docs/en/skills
- Model Context Protocol dokumentáció: https://modelcontextprotocol.io/docs/getting-started/intro

Megjegyzés: az EU AI Act értelmezési részek nem minősülnek jogi tanácsadásnak. A termék kommunikációjában is ezt kell következetesen feltüntetni: előszűrés, readiness, dokumentáció-előkészítés és technikai/jogi kérdéslista készül, nem jogi szakvélemény.
---

# 02 - Üzleti és megvalósítási terv

## Vezetői összefoglaló

A ShipSeal célja, hogy a gyorsan készülő AI-prototípusokból ügyfélnek átadható, agent-ready és előzetesen kockázatkezelt projektcsomagot készítsen. A termék elsődleges vevői AI freelancerek és kis AI-ügynökségek, akik ügyfeleknek építenek chatbotokat, RAG rendszereket, dokumentum-AI eszközöket, belső asszisztenseket vagy no-code/low-code AI automatizációkat.

Az első üzleti cél nem nagyvállalati SaaS, hanem fizetős, gyorsan validálható riport- és delivery-pack szolgáltatás. A szoftver fokozatosan nő ki ebből: először automatikus riportgenerátor, utána white-label ügynökségi csomag, majd később csapatdashboard, GitHub App, backend worker, fizetés, audit history és API.

## Termékpozicionálás

### Rövid üzenet

**Mielőtt átadod az AI-appodat, tedd agent-readyvé, tesztelhetővé és dokumentáltan ügyfélképessé.**

### Angol verzió

**Before you ship an AI app, seal it with an agent-ready delivery pack.**

### Mit nem mondunk?

- Nem mondjuk, hogy teljes jogi megfelelőséget igazolunk.
- Nem mondjuk, hogy high-risk jogi minősítést adunk.
- Nem mondjuk, hogy production security auditot végzünk.
- Nem mondjuk, hogy minden MCP szerver biztonságosan generálható automatikusan.

### Mit mondunk?

- Readiness reportot adunk.
- Fejlesztési és átadási dokumentációt generálunk.
- Teszteseteket és red-team promptokat készítünk.
- EU AI Act transparency és risk kérdésekhez előzetes checklistet adunk.
- Jogi review-hoz előkészítjük az információkat.

## Piaci hipotézis

Az AI freelancerek és kis ügynökségek egyre gyakrabban adnak át AI-prototípusokat, de az átadás minősége sokszor ad hoc. Ha a ShipSeal képes 30-60 percnyi dokumentációs és review munkát 5-10 percre csökkenteni, valamint a kész anyag ügyfél felé professzionálisabbá teszi a szállítást, akkor a célcsoport fizethet érte.

## Első fizetős ajánlat

### ShipSeal Delivery Report

Input:

- repo ZIP vagy GitHub URL,
- AI-app leírás,
- célfelhasználók,
- promptok / system prompt,
- kezelt adatok,
- példa outputok,
- ügyfélátadási cél.

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

## Árazási javaslat

| Csomag | Ár | Tartalom | Cél |
|---|---:|---|---|
| Free preview | 0 EUR | readiness preview, 5 javaslat, 5 teszteset | lead generálás |
| Starter report | 49 EUR | AGENTS.md, CLAUDE.md, 30 teszteset, mini AI Act checklist | első fizetős validáció |
| Pro agency report | 149 EUR | white-label report, skillek, red-team pack, MCP pack | AI ügynökségek |
| Founder-reviewed audit | 499-999 EUR | manuális szakértői review + 60 perc konzultáció | első komoly bevétel |

Magyar validációs árak:

| Csomag | Ár |
|---|---:|
| Első riport | 19 900 Ft |
| White-label riport | 79 000 Ft |
| Founder-reviewed audit | 149 000-299 000 Ft |

## 30/60/90 napos megvalósítási terv

### Első 30 nap - fizetős validációra alkalmas csomag

Feladatok:

1. Új repo létrehozása az egységes ShipSeal irányhoz.
2. A meglévő agentready-hub frontend ShipSeal irányú megtisztítása és új pozicionálása.
3. Az első output-specifikáció véglegesítése.
4. Statikus / félautomata ShipSeal Delivery Report generálása.
5. Minta riport készítése 1-2 saját AI-projekt alapján.
6. Landing page + fizetési érdeklődési CTA.
7. 20-30 célzott megkeresés AI freelancereknek / kis ügynökségeknek.

30. napi mérőszámok:

- 1 működő demo,
- 2 minta riport,
- 20 megkeresés,
- 5 komoly visszajelzés,
- legalább 1 fizetési szándék vagy fizetős pilot.

### 60 nap - működő MVP

Feladatok:

1. Repo scanner + intake form összekötése.
2. `AGENTS.md`, `CLAUDE.md`, skillek és MCP pack generálás stabilizálása.
3. PDF/Markdown report export.
4. AI2AI/VerdictMesh Review Council első integrációja: QA, security, compliance, skeptical customer, final judge.
5. EU AI Act readiness checklist első verziója jogi review-val.
6. White-label report sablon.

60. napi mérőszámok:

- 3 fizetős riport vagy founder-reviewed audit,
- 1 ügynökségi partnerjelölt,
- 5 letöltött/átadott report,
- egyértelmű visszajelzés arról, melyik modulért fizetnének.

### 90 nap - fizetős pilot és termékdöntés

Feladatok:

1. Fizetési integráció.
2. Egyszerű account / report history.
3. Job queue vagy backend worker döntés előkészítése.
4. GitHub public import stabilizálása, private repo későbbre.
5. Pro csomag kiadása 5-10 fizetős ügyfélnek.
6. Roadmap döntés: agency report, EU AI Act readiness vagy TestBench legyen-e a vezető értékajánlat.

90. napi mérőszámok:

- 5-10 fizető ügyfél vagy legalább 1000 EUR bevételi validáció,
- 3 testimonial,
- legalább 30% visszatérő használati szándék ügynökségeknél,
- világos döntés a következő 3 hónap fókuszáról.

## Fejlesztési stratégia

### Első elv

Nem teljes platformot építünk, hanem átadható outputot.

### Második elv

A readiness score determinisztikus és auditálható legyen. Az AI magyarázhat, gazdagíthat, javasolhat, de ne írja felül a kritikus blokkolókat.

### Harmadik elv

A jogi modul mindig előszűrés. A termék jogi kérdéslistát és dokumentációs alapot készít, nem jogi szakvéleményt.

### Negyedik elv

A VerdictMesh multi-agent council csak ott fusson, ahol értéket ad: go/no-go, compliance uncertainty, high-risk signal, ügyfélátadási döntés.

## Értékesítési terv

### Első célzott megkeresések

- AI freelancerek LinkedInen,
- magyar és nemzetközi no-code/AI ügynökségek,
- AI automatizációs tanácsadók,
- indie SaaS fejlesztők,
- AI workshop oktatók.

### Tesztkérdések

- Adtál már át AI-appot ügyfélnek?
- Volt-e kérdés a tesztelésről, adatvédelemről, EU AI Actről?
- Készült-e átadási dokumentáció?
- Használnád-e, ha 10 perc alatt generálna egy white-label átadási riportot?
- Fizetnél-e 49/149 EUR-t egy ilyen reportért?

## Kockázatok

| Kockázat | Mitigáció |
|---|---|
| Túl széles scope | MVP csak report + pack generálás |
| Jogi tanácsadásnak tűnik | következetes „readiness / előszűrés / nem jogi tanács” kommunikáció |
| AI output pontatlan | determinisztikus szabályok + human review + evidence pack |
| MCP túl komplex / biztonsági kockázatos | első verzióban readiness és skeleton, nem automatikus production MCP |
| Versenytársak gyorsak | fókusz: agency white-label handoff report, nem enterprise GRC |

## Hivatkozási alapok

A stratégia az alábbi, nyilvános és aktuális technológiai/jogi irányokra épít:

- EU AI Act: Regulation (EU) 2024/1689, risk-based AI rules; European Commission AI Act overview: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- European Commission AI Act Service Desk Compliance Checker: https://ai-act-service-desk.ec.europa.eu/en/eu-ai-act-compliance-checker
- European Commission Article 50 transparency draft guidance / consultation, 2026. május: https://digital-strategy.ec.europa.eu/en/consultations/consultation-draft-guidelines-transparency-obligations-under-ai-act
- AGENTS.md nyílt formátum: https://agents.md/
- Claude Code CLAUDE.md / memory dokumentáció: https://code.claude.com/docs/en/memory
- Claude Code Skills dokumentáció: https://code.claude.com/docs/en/skills
- Model Context Protocol dokumentáció: https://modelcontextprotocol.io/docs/getting-started/intro

Megjegyzés: az EU AI Act értelmezési részek nem minősülnek jogi tanácsadásnak. A termék kommunikációjában is ezt kell következetesen feltüntetni: előszűrés, readiness, dokumentáció-előkészítés és technikai/jogi kérdéslista készül, nem jogi szakvélemény.
---

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
---

# 04 - Fejlesztés közbeni szükségletek és roadmap

## Mire lesz szükségünk a fejlesztés közben?

A ShipSeal nem egyetlen komponensből áll. A sikerhez termék-, technikai, jogi, UX, sales és validációs döntések kellenek. Az alábbi lista azt rögzíti, mire lesz szükség a következő fejlesztési szakaszban.

## 1. Termékdöntések

### Eldöntendő kérdések

- Mi az első fizetős output pontos neve?
- Starter report vagy Pro agency report legyen az első fizetős csomag?
- White-label legyen-e már az MVP-ben?
- EU AI Act readiness mennyire legyen központi üzenet?
- Az első ICP AI freelancer, AI ügynökség vagy indie SaaS fejlesztő legyen?
- Magyar vagy angol landing page induljon először?

### Javaslat

Első fizetős output neve:

**ShipSeal Delivery Report**

Első ICP:

**AI freelancerek és kis AI ügynökségek, akik ügyfélnek adnak át AI-appot.**

## 2. Output-specifikáció

Az MVP előtt véglegesíteni kell, pontosan milyen fájlok készülnek.

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
- később PDF export.

## 3. Technikai szükségletek

### Frontend

- ShipSeal UI újrapozicionálása.
- Intake form hozzáadása AI-app kontextushoz.
- Report preview UI.
- Skills Pack tab.
- EU AI Act readiness tab.
- VerdictMesh / Review Council tab.
- Export flow javítása.
- Fizetés vagy várólista CTA.

### Backend

MVP-ben még lehet backend nélküli/félautomata, de 60 napon belül kelleni fog:

- provider API hívások server-side,
- secret management,
- rate limiting,
- report job státusz,
- artifact retention,
- alap storage,
- user/session kezelés.

### Scanner

- ZIP limit és file count limit megtartása.
- Public GitHub import fallback javítása.
- Repo context pack bővítése promptokkal és AI-app leírással.
- Secret/sensitive file red flag bővítése.
- Generated/vendor folder kezelés megtartása.

### Pack generator

- Skills Pack generálás.
- AI Act checklist generálás.
- Red-team/eval pack generálás.
- Client handoff report generálás.
- White-label mezők.

### Review Council

- AI2AI service szűkítése ShipSeal szerepekre:
  - QA Reviewer,
  - Security Reviewer,
  - EU AI Act Readiness Reviewer,
  - Product/Delivery Reviewer,
  - Skeptical Customer,
  - Final Judge.
- Nem kell az összes régi scenario.
- Költségbecslés és token limit kell.

## 4. Infrastrukturális szükségletek

### MVP

- Vercel/Netlify frontend deploy.
- Backend nélkül vagy minimális backenddel indulás.
- Minta riportok statikus exportként.
- Analytics: Plausible, PostHog vagy egyszerű event log.
- Form: Tally/Typeform/own form.

### Fizetős validációhoz

- Stripe vagy Lemon Squeezy.
- Email capture.
- Report delivery link.
- Terms / privacy oldal.
- „Not legal advice” disclaimer.

### Később

- Object storage ideiglenes uploadokhoz.
- Queue / worker.
- Backend scanning.
- GitHub App.
- Auth + organizations.
- Report history.
- Self-hosted lehetőség.

## 5. Adatvédelmi és biztonsági szükségletek

Mivel repo ZIP-eket, promptokat, üzleti dokumentációt és AI-app leírásokat kezelünk, különösen fontos:

- explicit user consent upload előtt,
- retention policy,
- local-first vagy short-lived artifact policy,
- raw source ne menjen AI providerhez csak sanitized context pack,
- secrets redaction,
- no-code-execution guarantee,
- audit log,
- törlési lehetőség,
- privacy policy.

## 6. Tesztelési szükségletek

### Automata

- unit tesztek scannerre,
- scoring snapshot tesztek,
- pack output snapshot tesztek,
- EU Act checklist decision tree tesztek,
- PDF/Markdown export tesztek,
- API smoke tesztek.

### Manuális

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

## 7. Sales/validációs szükségletek

- 1 oldalas landing page.
- 2 minta riport.
- 1 demo videó.
- 30 célzott megkeresési lista.
- 5 interjú kérdéssor.
- Fizetési ajánlat: 49 EUR / 149 EUR / founder-reviewed.

## 8. Fejlesztési ütemezés

### Sprint 0 - projektindítás

- Új repo / új projekt setup.
- Források feltöltése.
- Dokumentumok és scope rögzítése.
- Döntés: agentready-hub legyen az alap.

### Sprint 1 - output-spec és UI reposition

- Új landing szöveg.
- Új report struktúra.
- Intake form.
- Report preview skeleton.

### Sprint 2 - Delivery Pack MVP

- AGENTS/CLAUDE meglévő generátor finomítása.
- Skills Pack generátor.
- MCP pack megtartása/bővítése.
- Eval/red-team pack generálás.

### Sprint 3 - AI Act readiness MVP

- Role/risk intake kérdések.
- Transparency checklist.
- Disclaimer.
- Ügyvéd review.

### Sprint 4 - Review Council MVP

- AI2AI backend adapter.
- 5 szerep + final judge.
- Council summary beemelése reportba.

### Sprint 5 - fizetős demo

- PDF/Markdown export.
- White-label mezők.
- Landing CTA.
- Első fizetős riportok.

## 9. Kill criteria

Le kell állni vagy pivotálni, ha 60 napon belül:

- 30 megkeresésből nincs legalább 3 erős érdeklődő,
- senki nem fizetne 49 EUR-t sem egy reportért,
- a célcsoport szerint az AGENTS/CLAUDE output önmagában elég és nem kell AI Act / report,
- a jogi kommunikáció túl kockázatosnak bizonyul,
- az output minősége nem jobb, mint egy sima ChatGPT prompt.

## 10. Legfontosabb következő fejlesztői feladatok

1. Új `CLIENT_HANDOFF_REPORT.md` sablon megírása.
2. `AI_ACT_READINESS_CHECKLIST.md` output definiálása.
3. `SKILL.md` generátor hozzáadása.
4. ShipSeal frontend új landing copy.
5. AI2AI Review Council szerepek beszűkítése.
6. Minta AI-app alapján minta riport készítése.
---

# 05 - EU AI Act és jogi workstream

## Cél

A ShipSeal EU AI Act modulja ne legyen jogi tanácsadó eszköz. A cél egy olyan előszűrő és dokumentáció-előkészítő funkció, amely segít AI fejlesztőknek és ügynökségeknek rendezni a kérdéseket, amelyeket egy jogász vagy compliance szakértő később ellenőrizhet.

A feleség jogi szakértelme itt komoly előny lehet, de a termékben és marketingben óvatosan kell fogalmazni.

## Ajánlott jogi pozicionálás

### Kerülendő állítások

- „AI Act compliant minősítést adunk.”
- „Jogi megfelelőséget igazolunk.”
- „Megmondjuk, hogy high-risk-e a rendszered jogilag.”
- „Kiváltjuk a jogi tanácsadást.”

### Használható állítások

- „AI Act readiness előszűrést készítünk.”
- „Összegyűjtjük a jogi review-hoz szükséges technikai és működési információkat.”
- „Transparency / disclosure javaslatokat készítünk.”
- „Kérdéslistát adunk jogi ellenőrzéshez.”
- „Nem jogi tanácsadás, hanem fejlesztői és termékoldali felkészültségi riport.”

## Mit kell a jogi workstreamben tisztázni?

### 1. Szerepkörök

- Provider, deployer, importer, distributor fogalmak gyakorlati különbsége.
- Egy AI freelancer vagy ügynökség mikor provider?
- Az ügyfél mikor deployer?
- White-label fejlesztésnél ki milyen szerepet viselhet?
- Magyar KKV-k esetén milyen tipikus szerződéses helyzetek vannak?

### 2. Kockázati kategóriák

- Tiltott AI gyakorlatok rövid, fejlesztőbarát magyarázata.
- High-risk előszűrés Annex III témák alapján.
- Mely use case-eket kell MVP-ben automatikusan „legal review required” jelzéssel ellátni?
- Mikor lehet „minimal/limited risk” irányban kommunikálni?

### 3. Transparency / Article 50

A 2026. májusi European Commission draft guidance alapján a transparency kötelezettségek különösen fontosak lehetnek. Tisztázandó:

- Mikor kell jelezni, hogy a felhasználó AI rendszerrel beszél?
- Milyen chatbot disclosure szöveg legyen ajánlott?
- Mikor kell AI-generált tartalmat jelölni?
- Mikor kell deepfake vagy manipulált tartalom disclosure?
- Milyen „first interaction” / „first exposure” szövegek legyenek?
- Magyar nyelvű mintaszövegek hogyan hangozzanak?

### 4. Emberi felügyelet

- Mit jelenthet low-risk / limited-risk appoknál az emberi ellenőrzés?
- Milyen döntéseket nem hozhat az AI önállóan?
- Milyen területeken kell automatikus „human review required” jelzés?
- Hogyan fogalmazzuk meg ezt ügyfélátadási riportban?

### 5. Adatvédelem / GDPR kapcsolódás

Bár ez nem csak AI Act kérdés, a terméknek kérdeznie kell:

- kezel-e személyes adatot,
- kezel-e különleges adatot,
- kerül-e adat külső AI providerhez,
- van-e adatfeldolgozói viszony,
- van-e törlési és retention policy,
- van-e naplózás,
- van-e adatminimalizálás.

### 6. Szerződéses és felelősségi keretek

- Mit vállalhat egy AI ügynökség az ügyfél felé?
- Mit nem szabad ígérnie?
- Milyen átadási disclaimer szükséges?
- Hogyan jelöljük, hogy a riport pillanatfelvétel?
- Hogyan kezeljük, hogy a jog változhat?

## Feleség / jogász által segíthető konkrét feladatok

### A. Terméknyelvezet ellenőrzése

Ellenőrizze:

- landing page állításait,
- pricing oldal állításait,
- report disclaimereket,
- „not legal advice” megfogalmazást,
- magyar és angol kockázati figyelmeztetéseket.

### B. AI Act kérdőív review

Segítsen kialakítani:

- provider/deployer kérdéssort,
- high-risk előszűrő kérdéssort,
- Article 50 transparency kérdéseket,
- human oversight kérdéseket,
- legal review required trigger pontokat.

### C. Mintaszövegek

Készíthet / ellenőrizhet:

- chatbot disclosure magyarul,
- chatbot disclosure angolul,
- AI-generated content jelölési szöveg,
- ügyfélátadási disclaimer,
- report footer disclaimer,
- Terms / privacy alap-szöveg váz.

### D. Red flag lista

Segíthet meghatározni, mikor jelezzen a rendszer:

- „legal review strongly recommended”,
- „do not ship before legal review”,
- „high-risk possibility”,
- „transparency notice missing”,
- „personal data handling unclear”.

### E. Magyar piaci sajátosságok

Értelmezheti:

- magyar KKV-k számára milyen kommunikáció érthető,
- hogyan kerülhető el a jogi tanácsadás látszata,
- milyen felelősségi kizárások szükségesek,
- milyen szerződéses modell javasolt founder-reviewed auditoknál.

## Jogi inputból készülő ShipSeal outputok

### `AI_ACT_READINESS_CHECKLIST.md`

Tartalom:

- alkalmazás célja,
- szerepkörök,
- felhasználói kör,
- kezelt adatok,
- kockázati előszűrés,
- transparency kérdések,
- human oversight,
- legal review triggers.

### `TRANSPARENCY_NOTICE_DRAFT.md`

Tartalom:

- rövid disclosure,
- bővebb disclosure,
- chatbot kezdőüzenet,
- footer / help page szöveg,
- AI-generated content jelölési sablon.

### `LEGAL_REVIEW_QUESTIONS.md`

Tartalom:

- jogásznak átadandó kérdések,
- tisztázandó szerepkörök,
- ügyféloldali döntések,
- szerződéses felelősség,
- adatvédelmi hiányok.

### `CLIENT_HANDOFF_LEGAL_NOTES.md`

Tartalom:

- mit vizsgáltunk,
- mit nem vizsgáltunk,
- mihez kell jogi review,
- milyen ismert korlátok vannak.

## Javasolt disclaimer sablon

> Ez a riport technikai, termékoldali és előzetes AI Act readiness elemzés. Nem minősül jogi tanácsadásnak, jogi szakvéleménynek vagy hatósági megfelelőségi igazolásnak. A riport célja, hogy összegyűjtse az AI-rendszerrel kapcsolatos főbb kockázati, átláthatósági, emberi felügyeleti és dokumentációs kérdéseket, amelyeket szükség esetén jogi szakértővel kell ellenőriztetni.

Angol változat:

> This report is a technical, product and preliminary AI Act readiness assessment. It does not constitute legal advice, a legal opinion or a formal compliance certification. Its purpose is to organize the main risk, transparency, human oversight and documentation questions related to the AI system so they can be reviewed by a qualified legal professional where necessary.

## Első jogi sprint feladatai

1. AI Act role/risk kérdőív első változatának ellenőrzése.
2. Transparency notice sablonok megírása magyarul és angolul.
3. „Not legal advice” és report disclaimer jóváhagyása.
4. High-risk red flag trigger lista készítése.
5. Founder-reviewed audit szerződéses keretének előzetes vázlata.

## Hivatkozási alapok

A stratégia az alábbi, nyilvános és aktuális technológiai/jogi irányokra épít:

- EU AI Act: Regulation (EU) 2024/1689, risk-based AI rules; European Commission AI Act overview: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- European Commission AI Act Service Desk Compliance Checker: https://ai-act-service-desk.ec.europa.eu/en/eu-ai-act-compliance-checker
- European Commission Article 50 transparency draft guidance / consultation, 2026. május: https://digital-strategy.ec.europa.eu/en/consultations/consultation-draft-guidelines-transparency-obligations-under-ai-act
- AGENTS.md nyílt formátum: https://agents.md/
- Claude Code CLAUDE.md / memory dokumentáció: https://code.claude.com/docs/en/memory
- Claude Code Skills dokumentáció: https://code.claude.com/docs/en/skills
- Model Context Protocol dokumentáció: https://modelcontextprotocol.io/docs/getting-started/intro

Megjegyzés: az EU AI Act értelmezési részek nem minősülnek jogi tanácsadásnak. A termék kommunikációjában is ezt kell következetesen feltüntetni: előszűrés, readiness, dokumentáció-előkészítés és technikai/jogi kérdéslista készül, nem jogi szakvélemény.
---

# 06 - ShipSeal MVP output specifikáció

## MVP cél

A felhasználó feltölt egy repo ZIP-et vagy megad egy publikus GitHub URL-t, majd kitölt egy rövid AI-app kontextus kérdőívet. A ShipSeal ebből elkészít egy letölthető Delivery Pack csomagot.

## Inputok

### Kötelező

- Projekt neve
- Repo ZIP vagy GitHub URL
- AI-app rövid leírása
- Célfelhasználó
- Mire használják az AI-t?
- Kezel-e személyes adatot?
- Használ-e generatív AI outputot ügyfél/felhasználó felé?
- Van-e emberi jóváhagyás?
- EU-ban használják-e?

### Opcionális

- System prompt
- Példa user promptok
- Példa válaszok
- Használt modellek
- Használt AI provider
- RAG / dokumentumfeltöltés leírása
- API endpoint / demo URL
- Ügyfél neve
- Ügynökség neve / logó

## Outputcsomag struktúra

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

## Readiness score dimenziók

### 1. Agent readiness

- van-e README,
- van-e setup/run/test információ,
- van-e AGENTS/CLAUDE/Cursor/Codex instruction,
- egyértelmű-e a repo struktúra,
- biztonságos-e agentekkel dolgozni.

### 2. Delivery readiness

- átadható-e ügyfélnek,
- van-e dokumentáció,
- van-e ismert korlátlista,
- van-e tesztelési bizonyíték,
- van-e roadmap.

### 3. Eval readiness

- vannak-e tesztesetek,
- van-e red-team prompt,
- van-e hallucination / injection / boundary teszt,
- van-e manuális validáció.

### 4. MCP readiness

- indokolt-e MCP,
- milyen tool/data source kell,
- mennyire kockázatos,
- van-e allowlist,
- van-e audit log javaslat.

### 5. EU AI Act readiness

- EU-ban használják-e,
- AI interaction disclosure szükséges-e,
- generált tartalom jelölése szükséges-e,
- high-risk lehetőség van-e,
- human oversight megvan-e,
- jogi review trigger aktiválódik-e.

## Go / no-go kategóriák

- **Ready for internal development** - agentekkel továbbfejleszthető, de ügyfélnek még nem adható.
- **Ready for demo** - demózható, de nincs teljes átadási dokumentáció.
- **Ready for client pilot** - korlátozott ügyfél pilotra alkalmas human review-val.
- **Not ready** - kritikus technikai/dokumentációs/compliance hiány.
- **Legal review required** - jogi ellenőrzés nélkül nem javasolt élesítés/átadás.

## Review Council szerepek

### QA Reviewer

Vizsgálja:

- tesztelhetőség,
- edge case-ek,
- regressziós kockázat,
- output stabilitás.

### Security Reviewer

Vizsgálja:

- secret leakage,
- prompt injection,
- adatkiáramlás,
- túl széles MCP/tool hozzáférés.

### EU AI Act Readiness Reviewer

Vizsgálja:

- transparency,
- szerepkör,
- high-risk signal,
- human oversight,
- legal review triggers.

### Product/Delivery Reviewer

Vizsgálja:

- érthető termékígéret,
- ügyfélátadási minőség,
- hiányzó dokumentáció,
- roadmap realitás.

### Skeptical Customer

Vizsgálja:

- miben nem bízná az ügyfél,
- milyen kérdéseket tenne fel,
- mi hiányzik ahhoz, hogy átvegye.

### Final Judge

Összesíti:

- readiness score,
- fő kockázatok,
- go/no-go,
- következő javítások.

## Első demo scenario

Töltsünk fel egy saját AI miniappot, például:

- AI chatbot,
- RAG dokumentumasszisztens,
- AI_COMP egyik modulja,
- VerdictMesh frontend,
- ShipSeal saját repo.

A demo végén legyen letölthető egy Delivery Pack ZIP.

## MVP elfogadási kritérium

Az MVP akkor jó, ha egy AI freelancer ezt mondaná:

> Ezt a csomagot tényleg be tudom tenni az ügyfélátadás mellé, és jobb színben tünteti fel a munkámat.
---

# 07 - Fejlesztési kezdőpont és első sprintek

## Rövid döntés

A fejlesztést **nem** az AI2AI/VerdictMesh integrációval és nem teljes monorepo-átalakítással érdemes kezdeni.

A leggyorsabb eladható irány:

**az `agentready-hub-main` frontendből készítsünk ShipSeal MVP-t, és először a Delivery Pack exportot tegyük teljessé.**

Ez azért a legjobb kezdőpont, mert már van működő React/Vite/TypeScript felület, ZIP-feltöltés, repo-szkenner, readiness scoring és ZIP export. A hiányzó érték most nem a látványos council UI, hanem az, hogy a kimeneti csomag pontosan azt adja, amit az első fizetős ügyfélnek oda lehet adni.

## Első fejlesztési cél

Az első működő ShipSeal MVP egy ZIP vagy publikus GitHub repo alapján generáljon egy letölthető csomagot:

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

## Első branch

Javasolt branch név:

```bash
git checkout -b shipseal-mvp-delivery-pack
```

## 1. lépés - Rebrand és technikai alap tisztítása

Feladatok:

- UI szövegek átírása AgentReadyről ShipSealre.
- Export ZIP fájlnevek átírása `shipseal-agent-pack-*` vagy `shipseal-delivery-pack-*` formára.
- README és docs alap átnevezése.
- Tesztek frissítése az új fájlnevekre.
- A régi forrásnevek megőrzése csak belső technikai referenciaként.

Elsőként ellenőrizendő fájlok az `agentready-hub-main` forrásban:

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

## 2. lépés - Delivery Pack output contract

Hozzunk létre egy explicit output szerződést, például:

```text
src/lib/deliveryPack/manifest.ts
src/lib/deliveryPack/generators.ts
src/lib/deliveryPack/types.ts
```

A manifest mondja meg, hogy pontosan milyen fájlokat kell generálni. Ez azért fontos, mert innentől minden fejlesztés ehhez mérhető.

Minimum generálandó fájlok:

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

## 3. lépés - Intake form hozzáadása

A repo önmagában nem elég az EU AI Act és ügyfélátadási riporthoz. Kell egy rövid kérdőív.

Első MVP mezők:

- projekt neve,
- AI-app rövid leírása,
- célfelhasználó,
- mire használják az AI-t,
- EU-ban használják-e,
- kezel-e személyes adatot,
- generál-e tartalmat végfelhasználónak,
- van-e emberi jóváhagyás,
- használt AI provider / modell,
- ügyfél neve opcionálisan,
- ügynökség neve opcionálisan.

## 4. lépés - Hiányzó generátorok megírása

A jelenlegi forrás már tud agent pack és MCP jellegű anyagokat generálni. A ShipSeal MVP-hez a legfontosabb hiányzó generátorok:

1. `AI_ACT_READINESS_CHECKLIST.md`
2. `TRANSPARENCY_NOTICE_DRAFT.md`
3. `LEGAL_REVIEW_QUESTIONS.md`
4. `EVAL_TEST_CASES.md` - legalább 30 teszteset
5. `RED_TEAM_PROMPTS.md` - legalább 10 red-team prompt
6. `CLIENT_HANDOFF_REPORT.md`
7. `EXECUTIVE_SUMMARY.md`
8. `NEXT_STEPS_ROADMAP.md`
9. `02-skills/*/SKILL.md` csomagok

## 5. lépés - Tesztek és elfogadási feltételek

Első MVP elfogadási kritérium:

- ZIP feltöltés után lefut a scan.
- Látszik a ShipSeal score.
- A felhasználó ki tud tölteni egy rövid intake formot.
- Egy gombbal letölthető a teljes `shipseal-delivery-pack` ZIP.
- A ZIP-ben minden kötelező fájl benne van.
- A teszt ellenőrzi a fájlneveket, a mappastruktúrát és a minimum tartalmi elemeket.

Javasolt első teszt:

```text
src/test/deliveryPack.test.ts
```

## Mit ne most csináljunk?

Az első MVP előtt ne ezzel kezdjünk:

- teljes monorepo migráció,
- auth/fizetés,
- private GitHub App,
- teljes AI2AI multi-model integráció,
- VerdictMesh UI teljes beolvasztása,
- automatikus jogi minősítés,
- enterprise dashboard.

Ezek fontosak lehetnek később, de most lassítanák az első eladható verziót.

## 30 napos fejlesztési sorrend

### 1. hét

- Rebrand ShipSealre.
- Delivery Pack manifest.
- Export ZIP struktúra.
- Tesztek frissítése.

### 2. hét

- Intake form.
- AI Act checklist generátor.
- Transparency notice generátor.
- Legal review questions generátor.

### 3. hét

- 30 eval teszteset generátor.
- 10 red-team prompt generátor.
- SKILL.md generátorok.
- Client handoff report v1.

### 4. hét

- Report preview UI.
- White-label mezők.
- Letölthető teljes csomag.
- 3 minta repo alapján manuális validáció.

## Következő konkrét parancs

A fejlesztést ezzel érdemes indítani a lokális forrásban:

```bash
cd agentready-hub-main
git checkout -b shipseal-mvp-delivery-pack
npm install
npm run test
npm run build
```

Ha ez lefut, akkor az első kódmódosítás a `src/lib/exports.ts` és a hozzá kapcsolódó teszt legyen, hogy az exportált ZIP neve és struktúrája már ShipSeal irányba menjen.
