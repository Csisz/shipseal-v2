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
