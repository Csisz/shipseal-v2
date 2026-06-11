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