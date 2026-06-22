# DEPRECATED

Superseded by:

docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md

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
