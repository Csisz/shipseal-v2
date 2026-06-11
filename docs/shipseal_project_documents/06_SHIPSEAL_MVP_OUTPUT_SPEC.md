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