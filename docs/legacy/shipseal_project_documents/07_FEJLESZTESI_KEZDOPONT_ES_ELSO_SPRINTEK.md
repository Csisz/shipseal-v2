# DEPRECATED

Superseded by:

docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md

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

