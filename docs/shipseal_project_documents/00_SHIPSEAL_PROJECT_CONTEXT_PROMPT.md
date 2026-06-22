# DEPRECATED

Superseded by:

docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md

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
