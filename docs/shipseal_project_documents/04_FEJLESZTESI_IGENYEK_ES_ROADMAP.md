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