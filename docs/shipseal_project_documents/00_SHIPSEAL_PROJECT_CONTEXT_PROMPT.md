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