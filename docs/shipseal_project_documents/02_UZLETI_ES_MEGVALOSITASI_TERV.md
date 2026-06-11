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