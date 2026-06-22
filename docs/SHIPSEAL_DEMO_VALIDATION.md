# DEPRECATED

Superseded by:

docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md

# ShipSeal MVP Demo Validation

This document describes the manual demo validation flow for the local-first ShipSeal MVP. Use it before a client-facing demo or before accepting a sprint that changes scan, intake, preview, or Delivery Pack output.

## Scope

- Validate the end-to-end MVP flow from app start to Delivery Pack ZIP review.
- Confirm the demo explains ShipSeal score, go/no-go status, risks, and generated handoff assets clearly.
- Confirm generated outputs are non-empty and suitable for MVP-level client review.
- Do not use external AI APIs, auth, payment, backend workers, or private repo integrations during this validation.

## Manual Validation Steps

1. Install dependencies if needed.

```bash
npm install
```

2. Start the app locally.

```bash
npm run dev
```

3. Open the Vite URL shown in the terminal. The default is usually `http://localhost:8080`.

4. On the landing page, confirm the product is presented as `ShipSeal - AI Project Delivery Pack Generator`.

5. Choose a small repository ZIP for the demo. Prefer a real but non-sensitive sample project.

6. Open the ZIP upload flow and upload the repository ZIP.

7. Click `Analyze repository` and wait for the scan to complete.

8. Fill the Project Intake fields with realistic demo values:

- `projectName`: client-friendly project name.
- `appDescription`: one-sentence product description.
- `targetUsers`: primary users or audience.
- `aiUseCase`: what the AI feature does.
- `usedInEU`: set according to the demo scenario.
- `handlesPersonalData`: set according to the demo scenario.
- `generatesUserFacingContent`: set according to the demo scenario.
- `hasHumanApproval`: set according to the demo scenario.
- `aiProvider` and `modelName`: provider/model planned or currently used.
- `clientName` and `agencyName`: optional white-label context.

Client report quality improves when the intake is complete. For a real demo, fill the project, client, agency, app description, target users, AI use case, EU/personal data/user-facing output, human approval, provider, and model fields before opening the client report.

9. Review the preview panel after the scan:

- Confirm the ShipSeal score is visible.
- Confirm the go/no-go category is visible.
- Confirm main risks are visible or show a sensible fallback.
- Confirm AI Act readiness, testing pack, and client handoff status cards are visible.
- Confirm the required Delivery Pack file list is visible.
- Confirm the print-ready report helper explains that the HTML report can be opened in a browser and saved as PDF.

10. Click `Download PDF report`, then click `Open HTML report` to confirm the fallback path.

11. Confirm the standalone HTML report opens. Use browser Print / Save as PDF if a PDF is needed.

12. Do not treat full dashboard printing as the client report export path. Use the print-ready HTML report for client-ready PDF output.

13. Click `Download ShipSeal Delivery Pack`.

14. Confirm the downloaded ZIP filename starts with `shipseal-delivery-pack-`.

15. Open the ZIP locally and inspect the folder structure.

16. Open `06-client-handoff/CLIENT_HANDOFF_REPORT.md` and `06-client-handoff/CLIENT_HANDOFF_REPORT.html`.

17. Confirm both reports are readable for a client or AI freelancer, not only for a developer.

18. Confirm the reports include the project name, score summary, go/no-go recommendation, risks, testing status, AI Act pre-screen, MCP readiness summary, 30/60/90 day roadmap, and disclaimer.

19. Run automated validation before finishing the demo review.

```bash
npm run test
npm run build
```

## Expected Delivery Pack Contents

The exported ZIP should contain these required top-level folders and files:

- `01-agent-instructions/`
- `02-skills/`
- `03-mcp-governance/`
- `04-testing/`
- `05-ai-act-readiness/`
- `06-client-handoff/`
- `07-context/`
- `score.json`

At minimum, verify these important files manually:

- `01-agent-instructions/AGENTS.md`
- `01-agent-instructions/CLAUDE.md`
- `02-skills/code-review/SKILL.md`
- `02-skills/test-generation/SKILL.md`
- `02-skills/ai-act-readiness/SKILL.md`
- `02-skills/release-check/SKILL.md`
- `02-skills/client-handoff/SKILL.md`
- `04-testing/EVAL_TEST_CASES.md`
- `04-testing/RED_TEAM_PROMPTS.md`
- `04-testing/TESTING_STRATEGY.md`
- `05-ai-act-readiness/AI_ACT_READINESS_CHECKLIST.md`
- `05-ai-act-readiness/TRANSPARENCY_NOTICE_DRAFT.md`
- `05-ai-act-readiness/LEGAL_REVIEW_QUESTIONS.md`
- `06-client-handoff/CLIENT_HANDOFF_REPORT.md`
- `06-client-handoff/CLIENT_HANDOFF_REPORT.html`
- `06-client-handoff/EXECUTIVE_SUMMARY.md`
- `06-client-handoff/NEXT_STEPS_ROADMAP.md`
- `07-context/REPO_CONTEXT_PACK.md`
- `07-context/repo-context-pack.json`

## Quality Checklist

Use this checklist when reviewing the downloaded Delivery Pack:

- The client handoff report is not empty.
- The client handoff report is understandable for a client or AI freelancer.
- The HTML client report opens standalone in a browser and can be saved as PDF from the print dialog.
- Dashboard print is not presented as the main client report export path.
- The generated readiness/legal outputs include a `This is not legal advice` disclaimer.
- The report includes a go/no-go or readiness decision.
- `04-testing/EVAL_TEST_CASES.md` includes at least 30 eval test cases.
- `04-testing/RED_TEAM_PROMPTS.md` includes at least 10 red-team prompts.
- The ZIP includes at least 5 `SKILL.md` files.
- `05-ai-act-readiness/TRANSPARENCY_NOTICE_DRAFT.md` exists and is not empty.
- `06-client-handoff/NEXT_STEPS_ROADMAP.md` includes a 30/60/90 day roadmap.
- `score.json` opens as valid JSON.
- No required Delivery Pack file is empty.
- The output does not claim legal compliance or production security certification.

## Demo Pass Criteria

The demo validation passes when:

- The app starts locally without backend services.
- ZIP scan completes for the selected sample repository.
- Intake data appears in relevant generated outputs.
- The preview explains score, go/no-go, risks, included files, and download action clearly.
- The print-ready report helper explains HTML report plus browser Save as PDF.
- `Download ShipSeal Delivery Pack` exports a ZIP with all required folders and files.
- The handoff report is client-ready at MVP quality.
- `npm run test` and `npm run build` both pass.

## Known MVP Boundaries

- ShipSeal does not execute uploaded or imported code.
- ShipSeal does not call external AI APIs.
- The readiness score is deterministic and heuristic.
- AI Act readiness output is a pre-screening aid only, not legal advice.
- Security output is not a production security audit.
- Public GitHub import can fail because of browser/network/CORS constraints; ZIP upload is the reliable fallback.

