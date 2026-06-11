# AgentReady Demo Script

## 3-5 Minute Product Demo

### 1. Problem

"AI coding agents are powerful, but most repositories are not ready for them. They may lack instructions, verification commands, security boundaries, or context discipline. AgentReady gives teams a deterministic readiness baseline before they hand work to agents."

### 2. Open The Sample Report

Click `View sample report`.

"This opens a realistic Next.js sample without requiring an upload. The repo is `sample-nextjs-app`, scored 92, and it is AI Coding Ready because it has a score above 85 and zero critical blockers."

### 3. Explain The Score

Point to the main readiness summary and score breakdown.

"The score is deterministic. AI narrative explains the result, but it does not override blockers or readiness rules."

### 4. Show Blockers And Improvements

Point to Critical blockers and Optional improvements.

"Critical blockers are gates. Optional improvements are useful, but they do not undermine a ready status."

### 5. Show Agent Pack

Open the Core Agent Pack tabs.

"AgentReady generates practical files like AGENTS.md, CLAUDE.md, reviewer prompts, testing strategy, and CI guidance. These are repository-specific and ready to commit."

### 6. Show MCP Readiness

Scroll to MCP Readiness and MCP Governance Pack.

"MCP is treated as a separate governance layer. AgentReady recommends safe server categories and policy guardrails instead of assuming every tool should be enabled."

### 7. Show Repo Context Pack

Open the Repo Context Pack area.

"This is sanitized metadata for future AI providers or coding agents. It includes stack, scripts, folders, blockers, ignored folders, security findings, and MCP summary, but not raw full file contents or secrets."

### 8. Show GitHub Import

Click `Scan another repo`, then open `Import from GitHub`.

"For demos, users can paste a public GitHub repo URL. If the browser can download the public ZIP, ShipSeal scans it locally. If browser import fails, the app falls back cleanly to manual ZIP upload."

### 9. Show Exports

Download `score.json` or the Agent Pack ZIP.

"The ZIP includes core Agent Pack files, MCP governance files, and the sanitized Repo Context Pack."

### 10. Roadmap Close

"The current MVP is local-first and safe. Next production phases would add backend workers, GitHub App private repo scanning, webhook-based rescans, PR readiness checks, and server-side AI provider integrations with sanitized context only."
