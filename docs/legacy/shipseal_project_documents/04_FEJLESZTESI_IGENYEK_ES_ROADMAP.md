# DEPRECATED

Superseded by:

docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md

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
